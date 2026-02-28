const { readJSON } = require('../utils/fileStorage');

const PROTOCOL_FILE = 'data/protocols.json';

/**
 * Starts a protocol session by returning the first node.
 * @param {string} protocolId
 * @returns {Object} { nodeId, node } — the starting node
 */
async function startProtocol(protocolId) {
    const protocols = await readJSON(PROTOCOL_FILE);
    const protocol = protocols.find(p => p.id === protocolId);
    if (!protocol) throw new Error('Protocol not found: ' + protocolId);

    // First node is always index 0
    const firstNode = protocol.nodes[0];
    if (!firstNode) throw new Error('Protocol has no nodes.');

    return formatNodeResponse(protocol, firstNode);
}

/**
 * Advances the protocol by answering yes or no to the current node.
 * @param {string} protocolId
 * @param {number|string} currentNodeId
 * @param {string} answer - 'yes' or 'no'
 * @returns {Object} next node info, or a result object if the flow ends
 */
async function advanceProtocol(protocolId, currentNodeId, answer) {
    const protocols = await readJSON(PROTOCOL_FILE);
    const protocol = protocols.find(p => p.id === protocolId);
    if (!protocol) throw new Error('Protocol not found: ' + protocolId);

    const currentNode = protocol.nodes.find(n => String(n.id) === String(currentNodeId));
    if (!currentNode) throw new Error('Node not found: ' + currentNodeId);

    // If already a result node, just return it (terminal)
    if (currentNode.type === 'result') {
        return formatNodeResponse(protocol, currentNode);
    }

    // Determine next node ID from yes/no branch
    const nextId = answer.toLowerCase() === 'yes' ? currentNode.yes : currentNode.no;

    if (!nextId) {
        // No branch defined — return a generic terminal result
        return {
            done: true,
            result: {
                risk: 'Unknown',
                action: 'No further protocol path defined. Please consult a physician.',
                protocolName: protocol.name
            }
        };
    }

    const nextNode = protocol.nodes.find(n => String(n.id) === String(nextId));
    if (!nextNode) {
        return {
            done: true,
            result: {
                risk: 'Unknown',
                action: 'Protocol path references a missing node. Consult a physician.',
                protocolName: protocol.name
            }
        };
    }

    return formatNodeResponse(protocol, nextNode);
}

/**
 * Helper to format a node response consistently.
 */
function formatNodeResponse(protocol, node) {
    if (node.type === 'result') {
        return {
            done: true,
            result: {
                risk: node.risk || 'Unknown',
                action: node.action || 'No action specified.',
                protocolName: protocol.name
            }
        };
    }

    return {
        done: false,
        nodeId: node.id,
        question: node.text || 'No question text provided.',
        weight: node.weight || 1,
        protocolName: protocol.name
    };
}

module.exports = { startProtocol, advanceProtocol };
