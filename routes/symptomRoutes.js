const express = require('express');
const router = express.Router();
const { getSymptoms } = require('../controllers/symptomController');

router.get('/symptoms', getSymptoms);

module.exports = router;
