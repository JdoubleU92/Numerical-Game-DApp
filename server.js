// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

// Load contract ABIs
const cloneFactoryABI = JSON.parse(fs.readFileSync('approved-clone-factory-abi.json', 'utf8'));
const numericalGameABI = JSON.parse(fs.readFileSync('numerical-game-abi.json', 'utf8'));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Serve contract data
app.get('/contract-data', (req, res) => {
    res.json({
        cloneFactoryAddress: process.env.CLONEFACTORY_ADDRESS,
        cloneFactoryABI: cloneFactoryABI,
        numericalGameABI: numericalGameABI,
        templateAddress: process.env.TEMPLATE_ADDRESS,
        networkUrl: process.env.NETWORK_URL
    });
});

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});