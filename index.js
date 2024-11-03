const express = require('express');
const path = require('path');
const fetch = require('node-fetch');  // Ensure `node-fetch` is installed if needed: npm install node-fetch

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

// Route to send email using SendGrid API
app.post('/api/sendMail', async (req, res) => {
    const { subject, body, recipient_email } = req.body;

    try {
        const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                personalizations: [{ to: [{ email: recipient_email }] }],
                from: { email: 'your-email@example.com' },  // Update this with your sender email
                subject,
                content: [{ type: 'text/html', value: body }]
            })
        });

        if (!response.ok) throw new Error("Failed to send email");

        res.json({ message: "Email sent successfully" });
    } catch (error) {
        console.error("Error sending email:", error);
        res.status(500).json({ error: "Failed to send email" });
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
