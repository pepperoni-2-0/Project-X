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
            condition.questions.forEach(q => {
                if (typeof q === 'string') {
                    // Try to avoid asking about symptoms explicitly mentioned
                    const lowerQ = q.toLowerCase();
                    if (lowerQ.includes('fever') && symptoms.includes('Fever')) return;
                    if (lowerQ.includes('cough') && symptoms.includes('Cough')) return;
                    questionSet.add(q);
                } else if (typeof q === 'object') {
                    if (q.linked_symptom) {
                        // Intelligent dynamic logic
                        const symptomPresent = symptoms.includes(q.linked_symptom);
                        if (q.ask_if === 'present' && symptomPresent) {
                            questionSet.add(q.text);
                        } else if (q.ask_if === 'absent' && !symptomPresent) {
                            questionSet.add(q.text);
                        }
                    } else if (q.text) {
                        // Fallback filter
                        const lowerQ = q.text.toLowerCase();
                        if (lowerQ.includes('fever') && symptoms.includes('Fever')) return;
                        if (lowerQ.includes('cough') && symptoms.includes('Cough')) return;
                        questionSet.add(q.text);
                    }
                }
            });
        }
    }

    return {
        questions: Array.from(questionSet)
    };
}

module.exports = {
    getFollowupQuestions
};
