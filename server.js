const express = require('express');
const cors = require('cors');
const path = require('path');

// Import custom routes
const symptomRoutes = require('./routes/symptomRoutes');
const conditionRoutes = require('./routes/conditionRoutes');
const protocolRoutes = require('./routes/protocolRoutes');
const triageRoutes = require('./routes/triageRoutes');
const syncRoutes = require('./routes/syncRoutes');

// fileStorage now exposes ensureDataDir for first-run setup
const { ensureDataDir } = require('./utils/fileStorage');

const app = express();
const PORT = process.env.PORT || 3000;

// Detect if running as a pkg-packaged executable
const IS_PKG = typeof process.pkg !== 'undefined';

// Enable JSON parsing and CORS
app.use(cors());
app.use(express.json());

// Serve static frontend files
// Use absolute __dirname so it works both in dev and inside the pkg snapshot
app.use(express.static(path.join(__dirname, 'public')));

// Mount the routes under /api
app.use('/api', symptomRoutes);
app.use('/api', conditionRoutes);
app.use('/api', protocolRoutes);
app.use('/api', triageRoutes);
app.use('/api', syncRoutes);

// Generic Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled Server Error:', err.stack);
    res.status(500).json({ error: 'An unexpected server error occurred.' });
});

// 404 handler for unmatched routes
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found.' });
});

// ─────────────────────────────────────────────────────────────────────────────
// STARTUP
// ─────────────────────────────────────────────────────────────────────────────
async function start() {
    // When packaged: seed writable data dir on first run
    await ensureDataDir();

    app.listen(PORT, () => {
        console.log(`\n╔══════════════════════════════════════╗`);
        console.log(`║   JEEVAN Triage Platform             ║`);
        console.log(`║   Running on http://localhost:${PORT}  ║`);
        console.log(`╚══════════════════════════════════════╝\n`);
        console.log('Offline mode ready. Sync activates when internet is detected.\n');

        // Auto-open browser only when running as packaged .exe
        if (IS_PKG) {
            const url = `http://localhost:${PORT}`;
            const { exec } = require('child_process');
            const cmd = process.platform === 'darwin' ? `open "${url}"`
                : process.platform === 'win32' ? `start "" "${url}"`
                    : `xdg-open "${url}"`;
            setTimeout(() => {
                exec(cmd);
                console.log(`Browser opened at ${url}`);
            }, 800);
        }
    });
}

start();
