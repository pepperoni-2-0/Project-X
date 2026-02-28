const protocolEngine = require('../services/protocolEngine');
const protocolRunner = require('../services/protocolRunner');

/**
 * Handles POST /protocol
 * Creates a new doctor protocol.
 */
async function createProtocol(req, res) {
    try {
        const protocol = req.body;

        if (!protocol || !protocol.name || !protocol.nodes) {
            return res.status(400).json({ error: 'Missing required protocol fields.' });
        }

        const created = await protocolEngine.createProtocol(protocol);
        res.status(201).json(created);
    } catch (error) {
        console.error('Error in createProtocol:', error);
        res.status(500).json({ error: 'Failed to create protocol.' });
    }
}

/**
 * Handles GET /protocols
 * Returns a list of all protocols.
 */
async function getProtocols(req, res) {
    try {
        const protocols = await protocolEngine.getAllProtocols();
        res.json(protocols);
    } catch (error) {
        console.error('Error in getProtocols:', error);
        res.status(500).json({ error: 'Failed to load protocols.' });
    }
}

/**
 * Handles GET /protocol/:id
 * Retrieves a single protocol by its ID.
 */
async function getProtocolById(req, res) {
    try {
        const { id } = req.params;
        const protocol = await protocolEngine.getProtocolById(id);

        if (!protocol) {
            return res.status(404).json({ error: 'Protocol not found.' });
        }

        res.json(protocol);
    } catch (error) {
        console.error('Error in getProtocolById:', error);
        res.status(500).json({ error: 'Failed to get protocol.' });
    }
}

/**
 * Handles DELETE /protocol/:id
 * Deletes a protocol from the JSON storage.
 */
async function deleteProtocol(req, res) {
    try {
        const { id } = req.params;
        const isDeleted = await protocolEngine.deleteProtocol(id);

        if (!isDeleted) {
            return res.status(404).json({ error: 'Protocol not found or already deleted.' });
        }

        res.json({ message: 'Protocol successfully deleted.' });
    } catch (error) {
        console.error('Error in deleteProtocol:', error);
        res.status(500).json({ error: 'Failed to delete protocol.' });
    }
}

/**
 * Handles POST /protocol/:id/run
 * Starts a protocol flowchart session — returns first question node.
 */
async function startProtocolRun(req, res) {
    try {
        const { id } = req.params;
        const result = await protocolRunner.startProtocol(id);
        res.json(result);
    } catch (error) {
        console.error('Error in startProtocolRun:', error);
        res.status(500).json({ error: error.message || 'Failed to start protocol run.' });
    }
}

/**
 * Handles POST /protocol/:id/advance
 * Expects { currentNodeId, answer: 'yes'|'no' }
 * Returns the next node or a final result.
 */
async function advanceProtocolRun(req, res) {
    try {
        const { id } = req.params;
        const { currentNodeId, answer } = req.body;

        if (currentNodeId === undefined || !answer) {
            return res.status(400).json({ error: 'Missing currentNodeId or answer.' });
        }

        const result = await protocolRunner.advanceProtocol(id, currentNodeId, answer);
        res.json(result);
    } catch (error) {
        console.error('Error in advanceProtocolRun:', error);
        res.status(500).json({ error: error.message || 'Failed to advance protocol.' });
    }
}

module.exports = {
    createProtocol,
    getProtocols,
    getProtocolById,
    deleteProtocol,
    startProtocolRun,
    advanceProtocolRun
};
