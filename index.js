const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 8080;

// Middleware to parse JSON requests
app.use(express.json());

// Serve static files from the root directory
app.use(express.static(path.join(__dirname)));

// Send index.html file for the root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});



// Route to fetch the closest airport using Tequila API
app.post('/api/getClosestAirport', async (req, res) => {
    const { latitude, longitude } = req.body;

    try {
        const apiKey = process.env.TEQUILA_API_KEY;

        if (!apiKey) {
            console.error('Tequila API key is not set in environment variables.');
            return res.status(500).json({ error: 'Server configuration error.' });
        }

        // Construct the Tequila API URL with query parameters
        const url = new URL('https://api.tequila.kiwi.com/locations/radius');
        const params = {
            lat: latitude,
            lon: longitude,
            radius: 250, // Search radius in kilometers
            locale: 'en-US',
            location_types: 'airport',
            limit: 1, // Get only the closest airport
            active_only: true,
        };

        // Append query parameters to the URL
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

        // Make the GET request to Tequila API
        const tequilaResponse = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'apikey': apiKey
            }
        });

        // Check if the response status is OK (200)
        if (!tequilaResponse.ok) {
            const errorText = await tequilaResponse.text();
            console.error(`Tequila API error: ${tequilaResponse.status} - ${errorText}`);
            return res.status(tequilaResponse.status).json({ error: 'Failed to fetch closest airport.' });
        }

        const data = await tequilaResponse.json();

        // Check if any locations were found
        if (data.locations && data.locations.length > 0) {
            const nearestAirport = data.locations[0];
            console.log('Closest Airport:', nearestAirport);

            // Structure the response data as needed
            const responseData = {
                code: nearestAirport.code, // IATA code (e.g., "OSL")
                icao: nearestAirport.icao, // ICAO code (e.g., "ENGM")
                name: nearestAirport.name, // Airport name (if available)
                city: nearestAirport.city ? nearestAirport.city.name : 'Unknown City', // Extract city name
                country: nearestAirport.country ? nearestAirport.country.name : 'Unknown Country', // Extract country name
                latitude: nearestAirport.latitude,
                longitude: nearestAirport.longitude,
                // Include other necessary fields if required
            };
            

            return res.json(responseData);
        } else {
            console.log('No airport found near this location.');
            return res.status(404).json({ error: 'No nearby airports found.' });
        }
    } catch (error) {
        console.error('Error fetching closest airport:', error);
        return res.status(500).json({ error: 'Failed to fetch closest airport.' });
    }
});

// Route for Airport and City Autocomplete
app.get('/api/airport-suggestions', async (req, res) => {
    const { term, location_types, limit } = req.query;

    if (!term || term.length < 3) {
        return res.status(400).json({ error: 'Search term is too short' });
    }

    try {
        // Log the request data for debugging
        console.log(`Searching for term: ${term}`);

        // Construct the Tequila API URL with query parameters
        const url = new URL('https://tequila-api.kiwi.com/locations/query');
        const params = {
            term: term,
            location_types: 'airport,city', // Include both airport and city
            limit: limit || 10
        };

        // Append query parameters to the URL
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

        // Make the GET request to Tequila API
        const tequilaResponse = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'apikey': process.env.TEQUILA_API_KEY
            }
        });

        // Parse the response data once
        const data = await tequilaResponse.json();

        // Log the parsed Tequila API response for debugging
        console.log('Tequila API Response:', data);

        // Check if the response is successful
        if (!tequilaResponse.ok) {
            console.error(`Tequila API error: ${tequilaResponse.status} - ${JSON.stringify(data)}`);
            return res.status(tequilaResponse.status).json({ error: 'Failed to fetch suggestions', details: data });
        }

        // Structure suggestions to include location type
        const suggestions = data.locations.map(location => ({
            label: `${location.name} (${location.code}) - ${location.type}`, // e.g., "London Heathrow (LHR) - airport"
            value: `${location.type}:${location.code} - ${location.name}`,   // e.g., "airport:LHR - London Heathrow"
            type: location.type  // 'airport' or 'city'
        }));

        // Return the structured suggestions
        res.json({ locations: suggestions });

    } catch (error) {
        console.error('Error fetching suggestions from Tequila API:', error);

        // Provide more detailed error logging
        if (error.response) {
            // Log the response from the Tequila API
            console.error('Tequila API response error:', error.response.data);
            res.status(500).json({ error: 'Tequila API response error', details: error.response.data });
        } else if (error.request) {
            // Log request issues (network, etc.)
            console.error('Tequila API request error:', error.request);
            res.status(500).json({ error: 'Tequila API request error' });
        } else {
            // Log unexpected errors
            console.error('Unexpected error:', error.message);
            res.status(500).json({ error: 'Unexpected error' });
        }
    }
});



// Route for Suggesting Price Limit using Tequila Search API
app.get('/api/suggestPriceLimit', async (req, res) => {
    const {
        origin, destination, dateFrom, dateTo, returnFrom, returnTo,
        maxStops, maxFlyDuration, flightType, currency, dtime_from,
        dtime_to, ret_dtime_from, ret_dtime_to
    } = req.query;

    try {
        // Resolve 'fly_from' and 'fly_to' with type prefixes
        const fly_from = await resolveLocationType(origin);
        const fly_to = await resolveLocationType(destination);

        // Construct query parameters for Tequila Search API
        const queryParams = new URLSearchParams({
            fly_from: fly_from,
            fly_to: fly_to,
            date_from: dateFrom,
            date_to: dateTo,
            return_from: returnFrom,
            return_to: returnTo,
            max_sector_stopovers: maxStops,
            max_fly_duration: maxFlyDuration,
            flight_type: flightType,
            curr: currency,
            dtime_from,
            dtime_to,
            ret_dtime_from,
            ret_dtime_to,
            sort: 'price'
        });

        // Log the search parameters for debugging
        console.log(`Searching flights with parameters: ${queryParams.toString()}`);

        // Make the GET request to Tequila Search API
        const response = await fetch(`https://tequila-api.kiwi.com/v2/search?${queryParams.toString()}`, {
            method: 'GET',
            headers: {
                'apikey': process.env.TEQUILA_API_KEY
            }
        });

        // Check if the response is successful
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Tequila Search API error: ${response.status} - ${errorText}`);
            return res.status(response.status).json({ error: 'Failed to fetch flight data.' });
        }

        const data = await response.json();

        // Log the response data for debugging
        console.log('Tequila Search API Response:', data);

        // Return the flight data to the frontend
        res.json(data);
    } catch (error) {
        console.error("Error suggesting price limit:", error);
        res.status(500).json({ error: "Failed to suggest price limit", details: error.message });
    }
});



/**
 * Resolve the location type for a given term.
 * @param {string} term 
 * @returns {string} Resolved term with type prefix (e.g., 'city:LON', 'airport:LHR')
 */
const resolveLocationType = async (term) => {
    // Check if term already has type prefix
    const typePrefixMatch = term.match(/^(airport|city|country|metro|region|subdivision|continent|special):(.+)$/i);
    if (typePrefixMatch) {
        const type = typePrefixMatch[1].toLowerCase();
        const code = typePrefixMatch[2];
        return `${type}:${code}`;
    }

    // If no prefix, query the Tequila API to determine the type
    const apiKey = process.env.TEQUILA_API_KEY;
    if (!apiKey) {
        console.error('Tequila API key is not set in environment variables.');
        throw new Error('Server configuration error.');
    }

    const url = new URL('https://tequila-api.kiwi.com/locations/query');
    const params = {
        term: term,
        location_types: 'airport,city', // Limit to airport and city for relevance
        limit: 1
    };
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

    const tequilaResponse = await fetch(url.toString(), {
        method: 'GET',
        headers: {
            'apikey': apiKey
        }
    });

    if (!tequilaResponse.ok) {
        const errorText = await tequilaResponse.text();
        console.error(`Tequila API error while resolving location type: ${tequilaResponse.status} - ${errorText}`);
        throw new Error('Failed to resolve location type.');
    }

    const data = await tequilaResponse.json();

    if (data.locations && data.locations.length > 0) {
        const location = data.locations[0];
        // Use the first location's type
        const type = location.type; // 'airport' or 'city'
        const code = location.code;
        return `${type}:${code}`;
    } else {
        console.error('No location found for term:', term);
        throw new Error('No location found.');
    }
};







// Route for Sheety Proxy
app.post('/api/sheetyProxy', async (req, res) => {
    const formData = req.body;
    const sheetyApiUrl = process.env.SHEETY_API_URL; // Set your Sheety API URL in environment variables
    const sheetyToken = process.env.SHEETY_TOKEN; // Set your Sheety API token in environment variables

    try {
        const sheetyResponse = await fetch(sheetyApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sheetyToken}`
            },
            body: JSON.stringify(formData)
        });

        if (!sheetyResponse.ok) {
            // Handle non-2xx responses
            const errorData = await sheetyResponse.json();
            console.error(`Error posting data to Sheety: ${sheetyResponse.status} - ${sheetyResponse.statusText}`);
            console.error(`Response data: ${JSON.stringify(errorData)}`);
            return res.status(sheetyResponse.status).json(errorData);
        }

        const responseData = await sheetyResponse.json();
        res.status(200).json(responseData); // Return Sheety's response to the client

    } catch (error) {
        console.error("Error posting data to Sheety:", error.message);

        if (error.response) {
            // Sheety responded with an error status
            console.error(`Response status: ${error.response.status}`);
            console.error(`Response data: ${JSON.stringify(error.response.data)}`);
            res.status(error.response.status).json(error.response.data || { error: 'Error occurred while posting data to Sheety.' });
        } else if (error.request) {
            // No response received from Sheety
            console.error(`No response received from Sheety: ${error.message}`);
            res.status(500).json({ error: 'No response received from Sheety.' });
        } else {
            // Error setting up the request
            console.error(`Error setting up request to Sheety: ${error.message}`);
            res.status(500).json({ error: 'Error setting up request to Sheety.' });
        }
    }
});

// Route to fetch city by IATA code using Tequila API
app.get('/api/getCityByIATA', async (req, res) => {
    const { iataCode } = req.query;

    try {
        const response = await fetch(`https://tequila-api.kiwi.com/locations/query?term=${encodeURIComponent(iataCode)}&location_types=city&limit=1`, {
            method: 'GET',
            headers: { 'apikey': process.env.TEQUILA_API_KEY }
        });

        const data = await response.json();
        res.json({ city: data.locations[0]?.name || 'Unknown city' });
    } catch (error) {
        console.error("Error fetching city by IATA:", error);
        res.status(500).json({ error: "Failed to fetch city by IATA code" });
    }
});

// Route to suggest price limit using Tequila API
app.get('/api/suggestPriceLimit', async (req, res) => {
    const {
        origin, destination, dateFrom, dateTo, returnFrom, returnTo,
        maxStops, maxFlyDuration, flightType, currency, dtime_from,
        dtime_to, ret_dtime_from, ret_dtime_to
    } = req.query;

    const queryParams = new URLSearchParams({
        fly_from: origin,
        fly_to: destination,
        date_from: dateFrom,
        date_to: dateTo,
        return_from: returnFrom,
        return_to: returnTo,
        max_sector_stopovers: maxStops,
        max_fly_duration: maxFlyDuration,
        flight_type: flightType,
        curr: currency,
        dtime_from,
        dtime_to,
        ret_dtime_from,
        ret_dtime_to,
        sort: 'price'
    });

    try {
        const response = await fetch(`https://tequila-api.kiwi.com/v2/search?${queryParams.toString()}`, {
            method: 'GET',
            headers: {
                'apikey': process.env.TEQUILA_API_KEY
            }
        });

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error("Error suggesting price limit:", error);
        res.status(500).json({ error: "Failed to suggest price limit" });
    }
});


// Microsoft Graph setup for sending emails
const EMAIL_TENANT_ID = process.env.EMAIL_TENANT_ID;
const EMAIL_CLIENT_ID = process.env.EMAIL_CLIENT_ID;
const EMAIL_CLIENT_SECRET = process.env.EMAIL_CLIENT_SECRET;

// ------------ EMAIL ---------------

app.post('/api/sendEmail', async (req, res) => {
    try {
        const { subject, body, recipient_email } = req.body;

        // Validate required parameters
        if (!subject || !body || !recipient_email) {
            return res.status(400).json({ message: "Missing required parameters: subject, body, or recipient_email." });
        }

        // Get access token for Microsoft Graph API
        const token = await getAccessToken();

        // Log the token to verify it
        console.log("Access Token:", token);

        // Send the email via Microsoft Graph API
        const result = await sendEmail(subject, body, recipient_email, token);

        // Return success or failure response
        return res.status(result ? 200 : 500).json({ message: result ? "Email sent successfully." : "Failed to send email." });

    } catch (error) {
        console.error('Error during email sending:', error.message);

        // Send error message back to frontend
        return res.status(500).json({ message: `Error during email sending: ${error.message}` });
    }
});


async function getAccessToken() {
    const tokenData = {
        grant_type: 'client_credentials',
        client_id: EMAIL_CLIENT_ID,
        client_secret: EMAIL_CLIENT_SECRET,
        scope: 'https://graph.microsoft.com/.default'  // Make sure this scope is correct
    };

    const response = await fetch(`https://login.microsoftonline.com/${EMAIL_TENANT_ID}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(tokenData).toString()
    });

    if (!response.ok) {
        console.error('Error fetching token:', await response.text());
        throw new Error(`Failed to get access token: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Access Token:', data.access_token); // Log to verify the token
    return data.access_token;
}



async function sendEmail(subject, body, recipientEmail, token) {
    const SENDMAIL_ENDPOINT = `https://graph.microsoft.com/v1.0/users/pierre@robotize.no/sendMail`;

    const message = {
        message: {
            subject: subject,
            body: {
                contentType: "HTML",
                content: body
            },
            toRecipients: [
                {
                    emailAddress: {
                        address: 'pierre@robotize.no'
                    }
                }
            ],
            attachments: []  // No image attachment
        },
        saveToSentItems: "true"
    };

    try {
        const response = await fetch(SENDMAIL_ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(message)
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Error response from Microsoft Graph:", errorData);
            throw new Error(`Failed to send email: ${JSON.stringify(errorData)}`);
        }

        return response.ok;
    } catch (error) {
        console.error("Error in sendEmail function:", error);
        throw error;
    }
}

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
