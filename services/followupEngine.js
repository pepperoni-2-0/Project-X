const { readJSON } = require('../utils/fileStorage');

/**
 * Finds matching conditions based on provided symptoms and collects
 * all relevant follow-up questions, removing duplicates.
 * @param {Array<string>} symptoms - List of symptoms.
 * @returns {Promise<Object>} Output object containing a unique list of questions.
 */
async function getFollowupQuestions(symptoms) {
    if (!symptoms || !Array.isArray(symptoms)) {
        return { questions: [] };
    }

    const conditions = await readJSON('data/conditions.json');
    const questionSet = new Set();

    for (const condition of conditions) {
        // Check if the condition shares any symptoms with the input
        const hasMatch = symptoms.some(sym => condition.symptoms.includes(sym));

        if (hasMatch && condition.questions) {
            condition.questions.forEach(q => questionSet.add(q));
        }
    }

    return {
        questions: Array.from(questionSet)
    };
}

module.exports = {
    getFollowupQuestions
};
