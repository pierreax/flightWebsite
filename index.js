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



// Route to fetch the closest airport using Aviationstack API
app.post('/api/getClosestAirport', async (req, res) => {
    const { latitude, longitude } = req.body;

    try {
        const apiKey = process.env.AVIATIONSTACK_API_KEY;

        if (!apiKey) {
            console.error('Aviationstack API key is not set in environment variables.');
            return res.status(500).json({ error: 'Server configuration error.' });
        }

        // Construct the Aviationstack API URL with query parameters
        const url = new URL('https://api.aviationstack.com/v1/airports');
        const params = {
            access_key: apiKey,
            lat: latitude,
            lon: longitude,
            radius: 200, // Search radius in kilometers
            limit: 1,   // Get only the closest airport
        };

        // Append query parameters to the URL
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

        // Make the GET request to Aviationstack
        const aviationstackResponse = await fetch(url.toString());

        // Check if the response status is OK (200)
        if (!aviationstackResponse.ok) {
            const errorText = await aviationstackResponse.text();
            console.error(`Aviationstack API error: ${aviationstackResponse.status} - ${errorText}`);
            return res.status(aviationstackResponse.status).json({ error: 'Failed to fetch closest airport.' });
        }

        const data = await aviationstackResponse.json();

        // Check if any airports were found
        if (data.data && data.data.length > 0) {
            const nearestAirport = data.data[0];
            console.log('Closest Airport:', nearestAirport);

            // Structure the response data as needed
            const responseData = {
                airport_iata: nearestAirport.airport_iata,
                airport_icao: nearestAirport.airport_icao,
                airport_name: nearestAirport.airport_name,
                city_iata: nearestAirport.city_iata,
                city_icao: nearestAirport.city_icao,
                city_name: nearestAirport.city_name,
                country_name: nearestAirport.country_name,
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
        dtime_to, ret_dtime_from, ret_dtime_to, select_airlines,
        select_airlines_exclude
    } = req.query;

    const queryParams = new URLSearchParams({
        fly_from: origin,
        fly_to: destination,
        date_from: dateFrom,
        date_to: dateTo,
        return_from: returnFrom,
        return_to: returnTo,
        max_stopovers: maxStops,
        max_fly_duration: maxFlyDuration,
        flight_type: flightType,
        curr: currency,
        dtime_from,
        dtime_to,
        ret_dtime_from,
        ret_dtime_to,
        select_airlines,
        select_airlines_exclude: select_airlines_exclude ? "1" : "0"
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
