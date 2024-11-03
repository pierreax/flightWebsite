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

// Route to fetch the closest airport using Amadeus API
app.post('/api/getClosestAirport', async (req, res) => {
    const { latitude, longitude } = req.body;

    try {
        const tokenResponse = await fetch('https://api.amadeus.com/v1/security/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: process.env.AMADEUS_API_KEY,
                client_secret: process.env.AMADEUS_API_SECRET
            })
        });

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        const amadeusResponse = await fetch(
            `https://api.amadeus.com/v1/reference-data/locations/airports?latitude=${latitude}&longitude=${longitude}`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        const data = await amadeusResponse.json();
        res.json(data);
    } catch (error) {
        console.error("Error fetching closest airport:", error);
        res.status(500).json({ error: "Failed to fetch closest airport" });
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
app.post('/api/suggestPriceLimit', async (req, res) => {
    const requestData = req.body;

    try {
        const response = await fetch('https://tequila-api.kiwi.com/v2/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': process.env.TEQUILA_API_KEY
            },
            body: JSON.stringify(requestData)
        });

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error("Error suggesting price limit:", error);
        res.status(500).json({ error: "Failed to suggest price limit" });
    }
});

// Microsoft Graph setup for sending emails
const TENANT_ID = process.env.EMAIL_TENANT_ID;
const CLIENT_ID = process.env.EMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.EMAIL_CLIENT_SECRET;
const SCOPE = 'https://graph.microsoft.com/.default';
const TOKEN_ENDPOINT = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
const EMAIL_ADDRESS = "pierre@robotize.no"; // Sender email address

// Function to get Microsoft Graph access token
async function getAccessToken() {
    const tokenData = {
        grant_type: 'client_credentials',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        scope: SCOPE
    };

    const response = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(tokenData).toString()
    });

    if (!response.ok) {
        throw new Error(`Failed to get access token: ${response.statusText}`);
    }

    const data = await response.json();
    return data.access_token;
}

// Function to send an email through Microsoft Graph API
async function sendEmail(subject, body, recipientEmail, token) {
    const SENDMAIL_ENDPOINT = `https://graph.microsoft.com/v1.0/users/${EMAIL_ADDRESS}/sendMail`;

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
            ]
        },
        saveToSentItems: "true"
    };

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
        throw new Error(`Failed to send email: ${JSON.stringify(errorData)}`);
    }

    return response.ok;
}

// Route to send an email using Microsoft Graph
app.post('/api/sendMail', async (req, res) => {
    const { subject = "New submission for your Flight Robot", body = "Great news, somebody just signed up for your Flight Robot", recipient_email } = req.body;

    try {
        const token = await getAccessToken();  // Get access token
        const result = await sendEmail(subject, body, recipient_email, token);  // Send email

        if (result) {
            res.json({ message: "Email sent successfully" });
        } else {
            res.status(500).json({ error: "Failed to send email" });
        }
    } catch (error) {
        console.error("Error sending email:", error);
        res.status(500).json({ error: "An error occurred while sending email" });
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
