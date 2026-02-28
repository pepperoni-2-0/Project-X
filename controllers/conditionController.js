const { readJSON } = require('../utils/fileStorage');

/**
 * Handles GET /conditions API.
 * Returns the complete list of conditions.
 */
async function getConditions(req, res) {
    try {
        const conditions = await readJSON('data/conditions.json');
        res.json(conditions);
    } catch (error) {
        console.error('Error in getConditions:', error);
        res.status(500).json({ error: 'Failed to load conditions.' });
    }
}

module.exports = {
    getConditions
};
