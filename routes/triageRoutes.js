const express = require('express');
const router = express.Router();
const { getQuestions, evaluateTriage, getAssessments, saveAssessment, deleteAssessment } = require('../controllers/triageController');

// Triage logic endpoints
router.post('/triage/questions', getQuestions);
router.post('/triage/run', evaluateTriage);

// Assessment storage endpoints
router.get('/assessments', getAssessments);
router.post('/assessment/save', saveAssessment);
router.delete('/assessment/:id', deleteAssessment);

module.exports = router;

