const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 8080;

// Serve static files (like index.html, styles.css, script.js)
app.use(express.static(path.join(__dirname)));

// Fallback route for index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
