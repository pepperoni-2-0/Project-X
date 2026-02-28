const { readJSON } = require('../utils/fileStorage');
const { calculateRiskLevel } = require('./scoringEngine');

/**
 * Runs the symptom triage logic based on the provided symptoms and question answers.
 * 1. Loads conditions.json
 * 2. Counts matched symptoms for each condition
 * 3. Calculates base score (matched/total * 100)
 * 4. Adds weight bonus for severe symptoms
 * 5. Sorts conditions by score
 * 6. Selects top 3
 * 7. Calculates overall risk level using the highest matched condition
 * @param {Array<string>} symptoms - Array of symptom strings.
 * @param {Object} answers - Dictionary of question answers.
 * @returns {Promise<Object>} The triage results matching the required output format.
 */
async function runTriage(symptoms, answers = {}) {
    const conditions = await readJSON('data/conditions.json');

    if (!conditions || conditions.length === 0) {
        throw new Error('Conditions data could not be loaded.');
    }

    // Calculate scores for all conditions
    const scoredConditions = conditions.map(condition => {
        let matchedCount = 0;
        let scoreBonus = 0;
        const explanations = [];

        // Find matches and calculate weight bonuses
        for (const symptom of symptoms) {
            if (condition.symptoms.includes(symptom)) {
                matchedCount++;
                explanations.push(`${symptom} matched`);

                // Add weight bonus if symptom is specified in weights
                if (condition.weights && condition.weights[symptom]) {
                    const weight = condition.weights[symptom];
                    // Example logic: if weight > 2, it's considered severe
                    if (weight > 2) {
                        scoreBonus += weight;
                        explanations.push(`${symptom} increases risk`);
                    }
                }
            }
        }

        // Calculate initial percentage score based on symptom matches
        let baseScore = 0;
        if (condition.symptoms.length > 0) {
            baseScore = (matchedCount / condition.symptoms.length) * 100;
        }

        // Final score is base percentage + flat bonus (capped at 100 for percentage representation)
        const finalScore = Math.min(Math.round(baseScore + scoreBonus), 100);

        return {
            name: condition.name,
            score: finalScore,
            risk: condition.risk,
            action: condition.action,
            explanation: explanations
        };
    });

    // Sort conditions descending by score
    scoredConditions.sort((a, b) => b.score - a.score);

    // Take top 3 non-zero score conditions
    const topConditions = scoredConditions.filter(c => c.score > 0).slice(0, 3);

    // If no conditions match at all
    if (topConditions.length === 0) {
        return {
            conditions: [],
            riskLevel: "Low",
            recommendations: "No concerning conditions matched. Please rest and monitor.",
            explanation: ["No specific conditions matched the provided symptoms."]
        };
    }

    // Calculate the highest risk level from the top matched conditions
    const riskLevel = calculateRiskLevel(topConditions);

    // Aggregate explanations (returning flat array of explanation sentences)
    const aggregatedExplanations = [];
    topConditions.forEach(c => {
        c.explanation.forEach(exp => {
            // Avoid duplicate explanation lines if possible
            if (!aggregatedExplanations.includes(exp)) {
                aggregatedExplanations.push(exp);
            }
        });
    });

    // Recommendation is from the top matched condition
    const recommendation = topConditions[0].action;

    return {
        conditions: topConditions.map(c => ({ name: c.name, score: c.score })),
        riskLevel,
        recommendations: recommendation,
        explanation: aggregatedExplanations
    };
}

module.exports = {
    runTriage
};
