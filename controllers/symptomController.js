const { readJSON } = require('../utils/fileStorage');

/**
 * Handles GET /symptoms API.
 * Returns the list of all available symptoms from the JSON database.
 */
async function getSymptoms(req, res) {
    try {
        const symptoms = await readJSON('data/symptoms.json');
        res.json(symptoms);
    } catch (error) {
        console.error('Error in getSymptoms:', error);
        res.status(500).json({ error: 'Failed to load symptoms.' });
    }
}

module.exports = {
    getSymptoms
};
