const express = require('express');
const router = express.Router();
const { getSyncStatus, pushAssessments } = require('../controllers/syncController');

router.get('/sync/status', getSyncStatus);
router.post('/sync/push', pushAssessments);

module.exports = router;

