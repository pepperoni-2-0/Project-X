const express = require('express');
const cors = require('cors');

// Import custom routes
const symptomRoutes = require('./routes/symptomRoutes');
const conditionRoutes = require('./routes/conditionRoutes');
const protocolRoutes = require('./routes/protocolRoutes');
const triageRoutes = require('./routes/triageRoutes');
const syncRoutes = require('./routes/syncRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable JSON parsing and CORS
app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static('public'));

// Mount the routes under /api
app.use('/api', symptomRoutes);
app.use('/api', conditionRoutes);
app.use('/api', protocolRoutes);
app.use('/api', triageRoutes);
app.use('/api', syncRoutes);

// Generic Error Handler Module
app.use((err, req, res, next) => {
    console.error('Unhandled Server Error:', err.stack);
    res.status(500).json({ error: 'An unexpected server error occurred.' });
});

// Define 404 handler for unmatched routes
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found.' });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Offline mode ready');
});
