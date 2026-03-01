const fs = require('fs').promises;
const path = require('path');

// ─────────────────────────────────────────────────────────────────────────────
// PATH RESOLUTION — handles both dev mode and packaged executable
//
// When run normally (node server.js):
//   → data files are at  backend/data/
//
// When run as packaged .exe (via pkg):
//   → bundled snapshot files are READ-ONLY
//   → mutable data (protocols.json, assessments.json) is stored in
//     a "jeevan-data/" folder NEXT TO the .exe, so changes persist
//   → on first launch, default data files are copied there automatically
// ─────────────────────────────────────────────────────────────────────────────

const IS_PKG = typeof process.pkg !== 'undefined'; // true when running as .exe

// Where writable runtime data lives
const WRITABLE_DATA_DIR = IS_PKG
  ? path.join(path.dirname(process.execPath), 'jeevan-data')
  : path.resolve(__dirname, '..', 'data');

// Where bundled (read-only) seed data lives inside the snapshot
const SNAPSHOT_DATA_DIR = path.resolve(__dirname, '..', 'data');

// Mutable files: always read/write from writable dir
const MUTABLE_FILES = new Set(['protocols.json', 'assessments.json']);

/**
 * On first run of the packaged exe, seed the writable data dir
 * by copying default files from the bundled snapshot.
 */
async function ensureDataDir() {
  if (!IS_PKG) return; // nothing needed in dev mode
  try {
    await fs.mkdir(WRITABLE_DATA_DIR, { recursive: true });
    const seedFiles = ['conditions.json', 'symptoms.json', 'protocols.json', 'assessments.json'];
    for (const file of seedFiles) {
      const dest = path.join(WRITABLE_DATA_DIR, file);
      try {
        await fs.access(dest); // already exists — skip
      } catch {
        // Not yet in writable dir — copy seed from snapshot
        try {
          const src = path.join(SNAPSHOT_DATA_DIR, file);
          const content = await fs.readFile(src, 'utf8');
          await fs.writeFile(dest, content, 'utf8');
          console.log(`[Setup] Seeded ${file} → jeevan-data/`);
        } catch {
          // Seed file missing too — create safe empty default
          const empty = (file === 'assessments.json' || file === 'protocols.json') ? '[]' : '{}';
          await fs.writeFile(dest, empty, 'utf8');
        }
      }
    }
  } catch (err) {
    console.error('[Setup] Failed to initialise data directory:', err.message);
  }
}

/**
 * Resolve a data file path. Mutable files always go to writable dir.
 * Static files (conditions, symptoms) can be read from snapshot.
 */
function resolveDataPath(filePath) {
  const filename = path.basename(filePath);
  if (IS_PKG) {
    // All files — use writable dir (seeded on startup)
    return path.join(WRITABLE_DATA_DIR, filename);
  }
  return path.resolve(__dirname, '..', filePath);
}

/**
 * Reads a JSON file and parses the content.
 * @param {string} filePath - Relative path from backend root, e.g. 'data/conditions.json'
 * @returns {Promise<any>}
 */
async function readJSON(filePath) {
  try {
    const fullPath = resolveDataPath(filePath);
    const data = await fs.readFile(fullPath, 'utf8');
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
 * @param {string} filePath - Relative path from backend root.
 * @param {any} data - Data to serialise.
 */
async function writeJSON(filePath, data) {
  try {
    const fullPath = resolveDataPath(filePath);
    await fs.writeFile(fullPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error(`[Error] Failed to write to ${filePath}:`, error.message);
    throw error;
  }
}

module.exports = { readJSON, writeJSON, ensureDataDir };
