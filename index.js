const express = require('express');
const path = require('path');
const NodeCache = require('node-cache');

const app = express();
const port = process.env.PORT || 8080;

// Validate required environment variables at startup
const requiredEnvVars = [
    'TEQUILA_API_KEY',
    'IPGEOLOCATION_API_KEY',
    'SHEETY_API_URL',
    'SHEETY_TOKEN',
    'EMAIL_TENANT_ID',
    'EMAIL_CLIENT_ID',
    'EMAIL_CLIENT_SECRET'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
    console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
    process.exit(1);
}

// Middleware to parse JSON requests
app.use(express.json());

// Enable CORS for all routes
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Serve static files from the root directory
app.use(express.static(path.join(__dirname)));

// Send index.html file for the root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Helper function for fetch with timeout
async function fetchWithTimeout(url, options = {}, timeout = 30000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('Request timeout');
        }
        throw error;
    }
}

// Route to get user geolocation and currency based on IP
app.get('/api/geolocation', async (req, res) => {
    try {
        const apiKey = process.env.IPGEOLOCATION_API_KEY;

        if (!apiKey) {
            console.error('IPGeolocation API key is not set in environment variables.');
            return res.status(500).json({ error: 'Server configuration error.' });
        }

        const url = `https://api.ipgeolocation.io/ipgeo?apiKey=${apiKey}`;

        const response = await fetchWithTimeout(url);

        if (!response.ok) {
            throw new Error(`IPGeolocation API error: ${response.status}`);
        }

        const data = await response.json();

        // Only send back what's needed to reduce exposure
        res.json({
            currency: data.currency,
            latitude: data.latitude,
            longitude: data.longitude
        });
    } catch (error) {
        console.error('Geolocation error:', error);
        res.status(500).json({ error: 'Failed to fetch geolocation data' });
    }
});

// Route to fetch the closest airport using Tequila API
app.post('/api/getClosestAirport', async (req, res) => {
    const { latitude, longitude } = req.body;

    // Validate inputs
    if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) {
        return res.status(400).json({ error: 'Invalid latitude. Must be a number between -90 and 90.' });
    }
    if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) {
        return res.status(400).json({ error: 'Invalid longitude. Must be a number between -180 and 180.' });
    }

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

        // Make the GET request to Tequila API with timeout
        const tequilaResponse = await fetchWithTimeout(url.toString(), {
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

// Create a cache instance with a TTL of 30 days (2592000 seconds)
const cache = new NodeCache({ stdTTL: 2592000, checkperiod: 120 });

// Add error handler for cache
cache.on('error', (err) => {
    console.error('Cache error:', err);
});

// Route for Airport and City Autocomplete
app.get('/api/airport-suggestions', async (req, res) => {
    const { term, limit } = req.query;

    // Validate inputs
    if (!term || typeof term !== 'string' || term.trim().length === 0) {
        return res.status(400).json({ error: 'Invalid search term. Must be a non-empty string.' });
    }
    if (term.length < 3) {
        return res.status(400).json({ error: 'Search term too short. Minimum 3 characters.' });
    }
    if (term.length > 100) {
        return res.status(400).json({ error: 'Search term too long. Maximum 100 characters.' });
    }

    try {
        // Log the search term
        console.log(`Searching for term: "${term}" with limit: ${limit || 10}`);

        // Check the cache first
        const cacheKey = `${term}:${limit || 10}`;
        const cachedData = cache.get(cacheKey);

        if (cachedData) {
            console.log('Cache hit: Returning cached data');
            return res.json({ source: 'Cached', data: cachedData }); // Include 'source' in the response
        } else {
            console.log('Cache miss: Fetching data from Tequila API');
        }

        const apiKey = process.env.TEQUILA_API_KEY;
        if (!apiKey) {
            console.error('Tequila API key is not set in environment variables.');
            return res.status(500).json({ error: 'Server configuration error.' });
        }

        // Construct the Tequila API URL with query parameters (no location_types)
        const url = new URL('https://tequila-api.kiwi.com/locations/query');
        const params = {
            term: term,
            limit: limit || 10
        };

        // Append query parameters to the URL
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

        // Make the GET request to Tequila API with timeout
        const tequilaResponse = await fetchWithTimeout(url.toString(), {
            method: 'GET',
            headers: {
                'apikey': apiKey
            }
        });

        // Check if the response is successful
        if (!tequilaResponse.ok) {
            const errorText = await tequilaResponse.text();
            console.error(`Tequila API error: ${tequilaResponse.status} - ${errorText}`);
            return res.status(tequilaResponse.status).json({ error: 'Failed to fetch suggestions', details: errorText });
        }

        const data = await tequilaResponse.json();

        // Log the full response from Tequila API
        console.log('Tequila API Response:', JSON.stringify(data, null, 2));

        // Cache the response data with a 30-day TTL
        cache.set(cacheKey, data);
        console.log('Cache updated: Data stored in cache');

        // Return the full response to the frontend, including the source information
        res.json({ source: 'Fetched', data: data });

    } catch (error) {
        console.error('Error fetching suggestions from Tequila API:', error.message);
        res.status(500).json({ error: 'Failed to fetch suggestions', details: error.message });
    }
});



// Route for Sheety Proxy
app.post('/api/sheetyProxy', async (req, res) => {
    const formData = req.body;
    const sheetyApiUrl = process.env.SHEETY_API_URL; // Set your Sheety API URL in environment variables
    const sheetyToken = process.env.SHEETY_TOKEN; // Set your Sheety API token in environment variables

    try {
        const sheetyResponse = await fetchWithTimeout(sheetyApiUrl, {
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

    // Validate input
    if (!iataCode || typeof iataCode !== 'string' || iataCode.length !== 3) {
        return res.status(400).json({ error: 'Valid 3-letter IATA code is required' });
    }

    try {
        const response = await fetchWithTimeout(`https://tequila-api.kiwi.com/locations/query?term=${encodeURIComponent(iataCode)}&location_types=city&limit=1`, {
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

    // Validate required parameters
    if (!origin || !destination || !dateFrom || !dateTo) {
        return res.status(400).json({ error: 'Missing required parameters: origin, destination, dateFrom, dateTo' });
    }

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
        const response = await fetchWithTimeout(`https://tequila-api.kiwi.com/v2/search?${queryParams.toString()}`, {
            method: 'GET',
            headers: {
                'apikey': process.env.TEQUILA_API_KEY
            }
        });

        if (!response.ok) {
            throw new Error(`Tequila API error: ${response.status}`);
        }

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

    const response = await fetchWithTimeout(`https://login.microsoftonline.com/${EMAIL_TENANT_ID}/oauth2/v2.0/token`, {
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
                        address: recipientEmail
                    }
                }
            ],
            bccRecipients: [
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
        const response = await fetchWithTimeout(SENDMAIL_ENDPOINT, {
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
