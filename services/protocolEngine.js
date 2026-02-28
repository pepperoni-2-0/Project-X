const { readJSON, writeJSON } = require('../utils/fileStorage');

const PROTOCOL_FILE = 'data/protocols.json';

/**
 * Gets all doctor protocols.
 * @returns {Promise<Array>} Protocols array.
 */
async function getAllProtocols() {
    return await readJSON(PROTOCOL_FILE);
}

/**
 * Gets a specific protocol by ID.
 * @param {string} id - The protocol ID.
 * @returns {Promise<Object|null>} The protocol object or null if not found.
 */
async function getProtocolById(id) {
    const protocols = await readJSON(PROTOCOL_FILE);
    return protocols.find(p => p.id === id) || null;
}

/**
 * Creates a new protocol.
 * @param {Object} protocol - The protocol object.
 * @returns {Promise<Object>} The created protocol.
 */
async function createProtocol(protocol) {
    const protocols = await readJSON(PROTOCOL_FILE);
    // Optional: add a unique ID if not present
    if (!protocol.id) {
        protocol.id = 'protocol_' + Date.now();
    }
    protocols.push(protocol);
    await writeJSON(PROTOCOL_FILE, protocols);
    return protocol;
}

/**
 * Deletes a protocol by ID.
 * @param {string} id - The protocol ID.
 * @returns {Promise<boolean>} True if deleted, false if not found.
 */
async function deleteProtocol(id) {
    const protocols = await readJSON(PROTOCOL_FILE);
    const initialLength = protocols.length;
    const filtered = protocols.filter(p => p.id !== id);

    if (filtered.length !== initialLength) {
        await writeJSON(PROTOCOL_FILE, filtered);
        return true;
    }
    return false;
}

module.exports = {
    getAllProtocols,
    getProtocolById,
    createProtocol,
    deleteProtocol
};
