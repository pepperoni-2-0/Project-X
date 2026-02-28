const { checkInternet } = require('../utils/internetCheck');
const { readJSON, writeJSON } = require('../utils/fileStorage');

/**
 * Handles GET /sync/status
 * Returns Online if internet ping succeeds, else Offline.
 */
async function getSyncStatus(req, res) {
    try {
        const isOnline = await checkInternet();
        res.json({
            status: isOnline ? 'Online' : 'Offline'
        });
    } catch (error) {
        console.error('Error in getSyncStatus:', error);
        res.status(500).json({ error: 'Failed to retrieve sync status.' });
    }
}

/**
 * Handles POST /sync/push
 * Accepts an array of assessment objects from the client.
 * Deduplicates by ID so re-syncing the same record is safe.
 * Returns { synced: number, skipped: number }
 */
async function pushAssessments(req, res) {
    try {
        const { assessments } = req.body;

        if (!Array.isArray(assessments) || assessments.length === 0) {
            return res.status(400).json({ error: 'assessments array is required.' });
        }

        const existing = await readJSON('data/assessments.json');
        const existingIds = new Set(existing.map(a => a.id));

        let synced = 0;
        let skipped = 0;

        for (const record of assessments) {
            if (!record.id) { skipped++; continue; }
            if (existingIds.has(record.id)) { skipped++; continue; }
            // Tag the record as server-synced
            record.syncedAt = new Date().toISOString();
            existing.push(record);
            existingIds.add(record.id);
            synced++;
        }

        await writeJSON('data/assessments.json', existing);

        res.json({ synced, skipped, total: assessments.length });
    } catch (error) {
        console.error('Error in pushAssessments:', error);
        res.status(500).json({ error: 'Failed to sync assessments.' });
    }
}

module.exports = {
    getSyncStatus,
    pushAssessments
};

