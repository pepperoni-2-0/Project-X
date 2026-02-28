const { runTriage } = require('../services/triageEngine');
const { getFollowupQuestions } = require('../services/followupEngine');
const { readJSON, writeJSON } = require('../utils/fileStorage');

/**
 * Handles POST /triage/questions
 * Expects { "symptoms": ["Fever", "Cough"] }
 * Returns follow-up questions for the matched conditions.
 */
async function getQuestions(req, res) {
    try {
        const { symptoms } = req.body;

        if (!symptoms || !Array.isArray(symptoms)) {
            return res.status(400).json({ error: 'Invalid or missing symptoms array.' });
        }

        const result = await getFollowupQuestions(symptoms);
        res.json(result);
    } catch (error) {
        console.error('Error in getQuestions:', error);
        res.status(500).json({ error: 'Failed to calculate follow-up questions.' });
    }
}

/**
 * Handles POST /triage/run
 * Expects { "symptoms": [...], "answers": {...} }
 * Returns prioritized conditions, risk level, and explanations.
 */
async function evaluateTriage(req, res) {
    try {
        const { symptoms, answers } = req.body;

        if (!symptoms || !Array.isArray(symptoms)) {
            return res.status(400).json({ error: 'Invalid or missing symptoms array.' });
        }

        const result = await runTriage(symptoms, answers || {});
        res.json(result);
    } catch (error) {
        console.error('Error in evaluateTriage:', error);
        res.status(500).json({ error: 'Failed to run triage engine.' });
    }
}

/**
 * Handles GET /assessments
 * Returns all saved triage assessments.
 */
async function getAssessments(req, res) {
    try {
        const assessments = await readJSON('data/assessments.json');
        res.json(assessments);
    } catch (error) {
        console.error('Error in getAssessments:', error);
        res.status(500).json({ error: 'Failed to get assessments.' });
    }
}

/**
 * Handles POST /assessment/save
 * Expects { id, symptoms, answers, result }
 * Saves the triage instance into assessments.json.
 */
async function saveAssessment(req, res) {
    try {
        const { id, symptoms, answers, result } = req.body;

        if (!id || !symptoms) {
            return res.status(400).json({ error: 'Missing minimally required assessment data (id, symptoms).' });
        }

        const assessments = await readJSON('data/assessments.json');

        const newAssessment = {
            id,
            symptoms,
            answers: answers || {},
            result: result || {},
            date: new Date().toISOString()
        };

        assessments.push(newAssessment);
        await writeJSON('data/assessments.json', assessments);

        res.status(201).json({ message: 'Assessment saved successfully.' });
    } catch (error) {
        console.error('Error in saveAssessment:', error);
        res.status(500).json({ error: 'Failed to save assessment.' });
    }
}

/**
 * Handles DELETE /assessment/:id
 * Removes an assessment from assessments.json by its ID.
 */
async function deleteAssessment(req, res) {
    try {
        const { id } = req.params;
        const assessments = await readJSON('data/assessments.json');
        const before = assessments.length;
        const filtered = assessments.filter(a => a.id !== id);

        if (filtered.length === before) {
            // ID not found on server — still return 200 since it may only be local
            return res.json({ message: 'Assessment not found on server (may be local-only).', deleted: false });
        }

        await writeJSON('data/assessments.json', filtered);
        res.json({ message: 'Assessment deleted.', deleted: true });
    } catch (error) {
        console.error('Error in deleteAssessment:', error);
        res.status(500).json({ error: 'Failed to delete assessment.' });
    }
}

module.exports = {
    getQuestions,
    evaluateTriage,
    getAssessments,
    saveAssessment,
    deleteAssessment
};
