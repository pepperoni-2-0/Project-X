/**
 * Calculates the highest risk level from a list of matched conditions.
 * Risk hierarchy: Critical > High > Medium > Low.
 * @param {Array} conditions - The matched condition objects containing a 'risk' property.
 * @returns {string} The highest calculated risk level.
 */
function calculateRiskLevel(conditions) {
    if (!conditions || conditions.length === 0) return 'Low';

    const riskPriority = {
        'Critical': 4,
        'High': 3,
        'Medium': 2,
        'Low': 1
    };

    let maxRisk = 'Low';
    let maxRiskVal = 1;

    for (const condition of conditions) {
        const risk = condition.risk;
        if (riskPriority[risk] && riskPriority[risk] > maxRiskVal) {
            maxRisk = risk;
            maxRiskVal = riskPriority[risk];
        }
    }

    return maxRisk;
}

module.exports = {
    calculateRiskLevel
};
