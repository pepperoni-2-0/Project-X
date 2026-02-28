const fs = require('fs').promises;
const path = require('path');

/**
 * Reads a JSON file and parses the content.
 * @param {string} filePath - The relative path to the JSON file from backend root.
 * @returns {Promise<any>} The parsed JSON data or an empty array if not found.
 */
async function readJSON(filePath) {
  try {
    const data = await fs.readFile(path.resolve(__dirname, '..', filePath), 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn(`[Warning] File not found: ${filePath}. Returning empty array/object.`);
      return filePath.endsWith('assessments.json') || filePath.endsWith('protocols.json') 
        ? [] 
        : null;
    }
    console.error(`[Error] Failed to read ${filePath}:`, error.message);
    throw error;
  }
}

/**
 * Writes data to a JSON file safely.
 * @param {string} filePath - The relative path to the JSON file from backend root.
 * @param {any} data - The data to be written as JSON.
 * @returns {Promise<void>}
 */
async function writeJSON(filePath, data) {
  try {
    await fs.writeFile(
      path.resolve(__dirname, '..', filePath),
      JSON.stringify(data, null, 2),
      'utf8'
    );
  } catch (error) {
    console.error(`[Error] Failed to write to ${filePath}:`, error.message);
    throw error;
  }
}

module.exports = {
  readJSON,
  writeJSON
};
