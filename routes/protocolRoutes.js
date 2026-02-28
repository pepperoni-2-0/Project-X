const express = require('express');
const router = express.Router();
const { createProtocol, getProtocols, getProtocolById, deleteProtocol, startProtocolRun, advanceProtocolRun } = require('../controllers/protocolController');

router.post('/protocol', createProtocol);
router.get('/protocols', getProtocols);
router.get('/protocol/:id', getProtocolById);
router.delete('/protocol/:id', deleteProtocol);

// Protocol flowchart runner
router.post('/protocol/:id/run', startProtocolRun);
router.post('/protocol/:id/advance', advanceProtocolRun);

module.exports = router;
