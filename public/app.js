const API_BASE = '/api';

// ─────────────────────────────────────────────────────────────────────────────
// LOCAL STORAGE KEYS
// ─────────────────────────────────────────────────────────────────────────────
const LS = {
    USER: 'jeevan_user',
    ASSESSMENTS: 'jeevan_all_assessments',   // every assessment (source of truth)
    PENDING: 'jeevan_pending_sync',           // IDs of assessments not yet synced to server
    // API response cache — so every view works offline after first load
    CACHE_CONDITIONS: 'jeevan_cache_conditions',
    CACHE_SYMPTOMS: 'jeevan_cache_symptoms',
    CACHE_PROTOCOLS: 'jeevan_cache_protocols',
};

// ─────────────────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────────────────
const state = {
    user: null,
    symptoms: [],
    selectedSymptoms: new Set(),
    answers: {},
    triageResult: null,
    protocols: [],

    // Flowchart builder
    builderNodes: [],
    connecting: null,
    draggingNode: null,

    // Protocol runner
    activeProtocolId: null,
    activeProtocolNodeId: null,
    protoAnswerLog: [],
    protoStepCount: 0,

    // Patient modal callback
    _modalResolve: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// OFFLINE-FIRST STORAGE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Read all local assessments (localStorage is the primary source of truth). */
function localReadAssessments() {
    try { return JSON.parse(localStorage.getItem(LS.ASSESSMENTS) || '[]'); }
    catch { return []; }
}

/** Persist assessments array back to localStorage. */
function localWriteAssessments(arr) {
    localStorage.setItem(LS.ASSESSMENTS, JSON.stringify(arr));
}

/** Return the Set of pending (unsynced) assessment IDs. */
function getPendingIds() {
    try { return new Set(JSON.parse(localStorage.getItem(LS.PENDING) || '[]')); }
    catch { return new Set(); }
}

/** Overwrite the pending-IDs list. */
function savePendingIds(idSet) {
    localStorage.setItem(LS.PENDING, JSON.stringify([...idSet]));
}

/**
 * Save an assessment offline-first.
 * 1) Write to localStorage immediately.
 * 2) Mark it as pending sync.
 * 3) Attempt an immediate server push; if that succeeds, clear the pending flag.
 */
async function saveAssessmentOfflineFirst(record) {
    // 1. localStorage — always works
    const all = localReadAssessments();
    const existsIdx = all.findIndex(a => a.id === record.id);
    if (existsIdx >= 0) all[existsIdx] = record;
    else all.push(record);
    localWriteAssessments(all);

    // 2. Mark pending
    const pending = getPendingIds();
    pending.add(record.id);
    savePendingIds(pending);
    updatePendingBadge();

    // 3. Try immediate server push
    await attemptServerSync();
}

/**
 * Try to push all pending assessments to the server.
 * Called on save AND on reconnect.
 */
async function attemptServerSync() {
    const pending = getPendingIds();
    if (pending.size === 0) return;

    const all = localReadAssessments();
    const toSync = all.filter(a => pending.has(a.id));
    if (toSync.length === 0) { savePendingIds(new Set()); updatePendingBadge(); return; }

    try {
        const res = await fetch(`${API_BASE}/sync/push`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assessments: toSync }),
            signal: AbortSignal.timeout(5000)       // 5 s timeout
        });
        if (!res.ok) throw new Error('Server error');
        const { synced } = await res.json();

        if (synced > 0 || toSync.length > 0) {
            // Clear pending IDs that we just sent
            const newPending = getPendingIds();
            toSync.forEach(a => newPending.delete(a.id));
            savePendingIds(newPending);
            updatePendingBadge();
            if (synced > 0) showToast(`✓ ${synced} assessment${synced > 1 ? 's' : ''} synced to server`, 'success');
        }
    } catch {
        // Server unreachable — data stays in pending queue, will retry
        updatePendingBadge();
    }
}

function updatePendingBadge() {
    const pending = getPendingIds();
    const badge = document.getElementById('pending-sync-badge');
    const cnt = document.getElementById('pending-sync-count');
    if (pending.size > 0) {
        badge.classList.remove('hidden');
        cnt.textContent = pending.size;
    } else {
        badge.classList.add('hidden');
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATIENT DETAILS MODAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Opens the patient details modal.
 * @returns {Promise<{patientName:string, assessmentDate:string}|null>}
 *   Resolves with the entered values, or null if cancelled.
 */
function askPatientDetails() {
    return new Promise((resolve) => {
        state._modalResolve = resolve;

        // Pre-fill date with today
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('patient-date-input').value = today;
        document.getElementById('patient-name-input').value = '';

        const overlay = document.getElementById('patient-modal-overlay');
        overlay.classList.remove('hidden');
        // Focus the name input after transition
        setTimeout(() => document.getElementById('patient-name-input').focus(), 120);
    });
}

function closePatientModal(result) {
    document.getElementById('patient-modal-overlay').classList.add('hidden');
    if (state._modalResolve) {
        state._modalResolve(result);
        state._modalResolve = null;
    }
}

document.getElementById('modal-cancel-btn').addEventListener('click', () => closePatientModal(null));
document.getElementById('patient-modal-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('patient-modal-overlay')) closePatientModal(null);
});
document.getElementById('modal-confirm-btn').addEventListener('click', () => {
    const name = document.getElementById('patient-name-input').value.trim();
    const date = document.getElementById('patient-date-input').value;
    if (!name) {
        document.getElementById('patient-name-input').classList.add('input-shake');
        setTimeout(() => document.getElementById('patient-name-input').classList.remove('input-shake'), 400);
        return;
    }
    closePatientModal({ patientName: name, assessmentDate: date });
});
// Allow Enter key to confirm
document.getElementById('patient-name-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('modal-confirm-btn').click();
});

// ─────────────────────────────────────────────────────────────────────────────
// CACHED UI REFERENCES
// ─────────────────────────────────────────────────────────────────────────────
const el = {
    loginScreen: document.getElementById('login-screen'),
    appScreen: document.getElementById('app-screen'),
    loginForm: document.getElementById('login-form'),
    loginName: document.getElementById('login-name'),
    dashName: document.getElementById('dash-name'),
    navBtns: document.querySelectorAll('.nav-btn'),
    views: document.querySelectorAll('.view'),
    toast: document.getElementById('toast'),
    statCond: document.getElementById('stat-conditions'),
    statProto: document.getElementById('stat-protocols'),
    statAsses: document.getElementById('stat-assessments'),
    condList: document.getElementById('conditions-list'),
    symptomContainer: document.getElementById('symptoms-container'),
    btnNext1: document.getElementById('btn-triage-next-1'),
    questionsContainer: document.getElementById('questions-container'),
    btnRun: document.getElementById('btn-triage-run'),
    builderProtoName: document.getElementById('builder-protocol-name'),
    btnSaveProto: document.getElementById('btn-save-protocol'),
    btnClearCanvas: document.getElementById('btn-clear-canvas'),
    flowchartCanvas: document.getElementById('flowchart-canvas'),
    flowchartNodes: document.getElementById('flowchart-nodes'),
    connectionsSvg: document.getElementById('connections-svg'),
    emptyDropState: document.getElementById('empty-drop-state'),
    hintText: document.getElementById('hint-text'),
};

// ─────────────────────────────────────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
    el.toast.textContent = msg;
    el.toast.className = `toast show toast-${type}`;
    clearTimeout(el._toastTimer);
    el._toastTimer = setTimeout(() => el.toast.classList.remove('show'), 3500);
}

// ─────────────────────────────────────────────────────────────────────────────
// NAVIGATION
// ─────────────────────────────────────────────────────────────────────────────
function switchView(targetId) {
    el.views.forEach(v => { v.classList.remove('active'); v.classList.add('hidden'); });
    const target = document.getElementById(targetId);
    target.classList.remove('hidden');
    target.classList.add('active');
    el.navBtns.forEach(b => b.classList.toggle('active', b.dataset.target === targetId));
    if (targetId === 'view-dashboard') loadDashboard();
    if (targetId === 'view-conditions') loadConditions();
    if (targetId === 'view-runner') initRunnerView();
    if (targetId === 'view-assessments') loadAssessments();
    if (targetId === 'view-builder') loadBuilderView();
}

el.navBtns.forEach(btn => btn.addEventListener('click', e => {
    switchView(e.currentTarget.dataset.target);
    closeMobileSidebar();
}));

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE NAVIGATION — Hamburger + Slide Sidebar + Bottom Nav
// ─────────────────────────────────────────────────────────────────────────────
const hamburgerBtn = document.getElementById('hamburger-btn');
const sidebarEl = document.querySelector('.sidebar');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');
const mobileNavBtns = document.querySelectorAll('.mobile-nav-btn');

function openMobileSidebar() {
    sidebarEl.classList.add('open');
    sidebarBackdrop.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeMobileSidebar() {
    sidebarEl.classList.remove('open');
    sidebarBackdrop.classList.remove('active');
    document.body.style.overflow = '';
}

hamburgerBtn.addEventListener('click', () => {
    if (sidebarEl.classList.contains('open')) closeMobileSidebar();
    else openMobileSidebar();
});

sidebarBackdrop.addEventListener('click', closeMobileSidebar);

// Mobile bottom nav — mirrors switchView logic
mobileNavBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.dataset.target;
        switchView(target);
        mobileNavBtns.forEach(b => b.classList.toggle('active', b.dataset.target === target));
    });
});

// Patch switchView so mobile bottom nav stays in sync whenever called from
// anywhere (e.g. dashboard hero buttons)
const _origSwitchView = switchView;
window.switchView = function (targetId) {
    _origSwitchView(targetId);
    mobileNavBtns.forEach(b => b.classList.toggle('active', b.dataset.target === targetId));
    closeMobileSidebar();
};

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────
el.loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = el.loginName.value.trim();
    const pin = document.getElementById('login-pin').value.trim();
    if (name && pin) {
        state.user = { name, pin };
        localStorage.setItem(LS.USER, JSON.stringify(state.user));
        loginSuccess();
    }
});

document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem(LS.USER);
    location.reload();
});

function initAuth() {
    const saved = localStorage.getItem(LS.USER);
    if (saved) { state.user = JSON.parse(saved); loginSuccess(); }
}

function loginSuccess() {
    el.loginScreen.classList.remove('active');
    el.appScreen.classList.remove('hidden');
    el.appScreen.classList.add('active');
    el.dashName.textContent = state.user.name;
    document.getElementById('user-display-name').textContent = state.user.name;
    switchView('view-dashboard');
}

// ─────────────────────────────────────────────────────────────────────────────
// API HELPERS  (used for read-only server calls; saves go through offline layer)
// ─────────────────────────────────────────────────────────────────────────────

// Map endpoints to their localStorage cache keys
const API_CACHE_MAP = {
    '/conditions': LS.CACHE_CONDITIONS,
    '/symptoms': LS.CACHE_SYMPTOMS,
    '/protocols': LS.CACHE_PROTOCOLS,
};

async function apiGet(endpoint) {
    const cacheKey = API_CACHE_MAP[endpoint]; // e.g. 'jeevan_cache_conditions'
    try {
        const res = await fetch(`${API_BASE}${endpoint}`, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) throw new Error('Network error');
        const data = await res.json();
        // ✅ Save to localStorage so it's available offline next time
        if (cacheKey) localStorage.setItem(cacheKey, JSON.stringify(data));
        return data;
    } catch {
        // 📦 Offline or server error — serve from localStorage cache
        if (cacheKey) {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                console.log(`[Offline] Serving ${endpoint} from localStorage cache.`);
                return JSON.parse(cached);
            }
        }
        return null;
    }
}

async function apiPost(endpoint, data) {
    try {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            signal: AbortSignal.timeout(5000)
        });
        return await res.json();
    } catch { return null; }
}

async function apiDelete(endpoint) {
    try {
        const res = await fetch(`${API_BASE}${endpoint}`, { method: 'DELETE', signal: AbortSignal.timeout(5000) });
        return await res.json();
    } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD — reads from local storage so it works offline
// ─────────────────────────────────────────────────────────────────────────────
async function loadDashboard() {
    const localAssessments = localReadAssessments();

    // Conditions and protocols still come from server (config data, rarely changes)
    const [conds, protos] = await Promise.all([
        apiGet('/conditions'), apiGet('/protocols')
    ]);

    if (conds) el.statCond.textContent = conds.length;
    if (protos) el.statProto.textContent = protos.length;

    // Assessment count from LOCAL storage (authoritative, works offline)
    el.statAsses.textContent = localAssessments.length;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONDITIONS
// ─────────────────────────────────────────────────────────────────────────────
async function loadConditions() {
    const conds = await apiGet('/conditions');
    if (!conds) {
        el.condList.innerHTML = `<p style="color:var(--text-muted);padding:1rem">Unable to load conditions — you may be offline.</p>`;
        return;
    }
    el.condList.innerHTML = conds.map(c => `
    <div class="condition-card">
      <div style="display:flex;justify-content:space-between;align-items:start;">
        <h3>${c.name}</h3>
        <span class="risk-tag" style="background:var(--risk-${c.risk.toLowerCase()}20);color:var(--risk-${c.risk.toLowerCase()})">${c.risk}</span>
      </div>
      <p>${c.action}</p>
      <div class="condition-tags">${c.symptoms.map(s => `<span class="tag">${s}</span>`).join('')}</div>
    </div>
  `).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// SYMPTOM SVGs
// ─────────────────────────────────────────────────────────────────────────────
function getSymptomSVG(sym) {
    const svgs = {
        "Fever": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/></svg>`,
        "Cough": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0Z"/><path d="M5 15v6"/><path d="M15 9h6"/><path d="M15 13h4"/><path d="M15 17h2"/></svg>`,
        "Headache": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>`,
        "Fatigue": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="16" height="10" rx="2" ry="2"/><line x1="22" y1="11" x2="22" y2="13"/></svg>`,
        "Vomiting": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v16"/><path d="M8 8l4-4 4 4"/></svg>`,
        "Diarrhea": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14l-7 7-7-7"/><path d="M12 3v18"/></svg>`,
        "Chest Pain": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M12 8l-2 4h4l-2 4"/></svg>`,
        "Breathing Difficulty": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/></svg>`,
        "Abdominal Pain": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>`,
        "Body Ache": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
        "Sore Throat": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
        "Runny Nose": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a5 5 0 0 0 5-5c0-4.5-5-11-5-11s-5 6.5-5 11a5 5 0 0 0 5 5z"/></svg>`,
        "Dizziness": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`,
        "Nausea": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 15s1.5-2 4-2 4 2 4 2"/></svg>`,
        "Skin Rash": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="8" cy="10" r="1"/><circle cx="14" cy="14" r="1"/><circle cx="16" cy="8" r="1"/></svg>`,
        "Blurred Vision": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/><line x1="2" y1="2" x2="22" y2="22"/></svg>`,
        "High Blood Pressure": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
        "Dehydration Signs": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2A15 15 0 0 1 22 15a10 10 0 0 1-20 0A15 15 0 0 1 12 2z"/></svg>`,
    };
    const fallback = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`;
    return svgs[sym] || fallback;
}

// ═════════════════════════════════════════════════════════════════════════════
// TRIAGE RUNNER — Mode Picker
// ═════════════════════════════════════════════════════════════════════════════
function initRunnerView() {
    document.getElementById('triage-mode-picker').classList.remove('hidden');
    document.getElementById('symptom-triage-flow').classList.add('hidden');
    document.getElementById('protocol-triage-flow').classList.add('hidden');
}

window.selectTriageMode = function (mode) {
    document.getElementById('triage-mode-picker').classList.add('hidden');
    document.getElementById('symptom-triage-flow').classList.add('hidden');
    document.getElementById('protocol-triage-flow').classList.add('hidden');

    if (!mode) {
        document.getElementById('triage-mode-picker').classList.remove('hidden');
        return;
    }
    if (mode === 'symptom') {
        document.getElementById('symptom-triage-flow').classList.remove('hidden');
        loadTriageData();
        resetTriageStep(1);
    } else if (mode === 'protocol') {
        document.getElementById('protocol-triage-flow').classList.remove('hidden');
        loadProtocolPickerList();
        document.getElementById('protocol-pick-step').classList.remove('hidden');
        document.getElementById('protocol-qa-step').classList.add('hidden');
        document.getElementById('protocol-result-step').classList.add('hidden');
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// SYMPTOM TRIAGE
// ─────────────────────────────────────────────────────────────────────────────
async function loadTriageData() {
    if (state.symptoms.length === 0) state.symptoms = await apiGet('/symptoms') || [];
    el.symptomContainer.innerHTML = state.symptoms.map(sym => `
    <div class="symptom-toggle ${state.selectedSymptoms.has(sym) ? 'selected' : ''}" data-val="${sym}">
      <div class="sym-icon">${getSymptomSVG(sym)}</div>
      <span>${sym}</span>
    </div>
  `).join('');
    document.querySelectorAll('.symptom-toggle').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const val = e.currentTarget.dataset.val;
            if (state.selectedSymptoms.has(val)) {
                state.selectedSymptoms.delete(val); e.currentTarget.classList.remove('selected');
            } else {
                state.selectedSymptoms.add(val); e.currentTarget.classList.add('selected');
            }
            el.btnNext1.disabled = state.selectedSymptoms.size === 0;
        });
    });
}

el.btnNext1.addEventListener('click', async () => {
    const symArray = Array.from(state.selectedSymptoms);
    el.btnNext1.textContent = "Loading...";
    const res = await apiPost('/triage/questions', { symptoms: symArray });
    el.btnNext1.textContent = "Next: Follow-up Questions";
    state.answers = {};
    if (res && res.questions && res.questions.length > 0) {
        el.questionsContainer.innerHTML = res.questions.map((q, i) => `
      <div class="question-item">
        <h4>${q}</h4>
        <div class="radio-group" data-q="${q}">
          <label class="radio-label"><input type="radio" name="q_${i}" value="Yes" onchange="updateAnswer('${q}', 'Yes')"> Yes</label>
          <label class="radio-label"><input type="radio" name="q_${i}" value="No" onchange="updateAnswer('${q}', 'No')"> No</label>
        </div>
      </div>
    `).join('');
    } else {
        el.questionsContainer.innerHTML = `<p style="color:var(--text-muted)">No specific follow-up questions needed. You can proceed.</p>`;
    }
    document.getElementById('triage-step-1').classList.remove('active');
    document.getElementById('triage-step-1').classList.add('hidden');
    resetTriageStep(2);
});

window.updateAnswer = (q, ans) => { state.answers[q] = ans; };
window.resetTriageStep = (step) => {
    document.querySelectorAll('.triage-step').forEach(e => { e.classList.remove('active'); e.classList.add('hidden'); });
    const target = document.getElementById(`triage-step-${step}`);
    target.classList.remove('hidden');
    target.classList.add('active');
};

el.btnRun.addEventListener('click', async () => {
    el.btnRun.textContent = "Analyzing...";
    const symArray = Array.from(state.selectedSymptoms);
    const res = await apiPost('/triage/run', { symptoms: symArray, answers: state.answers });
    el.btnRun.textContent = "Run Triage Engine";
    if (res) { state.triageResult = res; showTriageResult(res); }
});

function showTriageResult(res) {
    resetTriageStep(3);
    document.getElementById('triage-risk-value').textContent = res.riskLevel;
    document.getElementById('triage-risk-banner').style.background = `rgba(var(--risk-${res.riskLevel.toLowerCase()}-rgb), 0.15)`;
    document.getElementById('triage-risk-value').style.color = `var(--risk-${res.riskLevel.toLowerCase()})`;
    document.getElementById('triage-matched-conditions').innerHTML = res.conditions.map(c => `
    <div class="matched-item">
      <div style="flex:1"><span style="font-weight:600">${c.name}</span>
        <div class="score-bar"><div class="score-fill" style="width:${c.score}%"></div></div>
      </div>
      <div style="margin-left:1rem;color:var(--accent-cyan);font-weight:600">${c.score}% Match</div>
    </div>
  `).join('');
    document.getElementById('triage-explanation-list').innerHTML = res.explanation.map(e => `<li>${e}</li>`).join('');
    document.getElementById('triage-recommendation').textContent = res.recommendations;
}

document.getElementById('btn-save-assessment').addEventListener('click', async () => {
    if (!state.triageResult) return;

    const patient = await askPatientDetails();
    if (!patient) return;   // user cancelled

    const btn = document.getElementById('btn-save-assessment');
    btn.textContent = "Saving...";
    btn.disabled = true;

    const record = {
        id: 'A' + Date.now(),
        patientName: patient.patientName,
        assessmentDate: patient.assessmentDate,
        date: new Date().toISOString(),
        mode: 'symptom',
        symptoms: Array.from(state.selectedSymptoms),
        answers: state.answers,
        result: state.triageResult,
        savedBy: state.user?.name || 'Unknown'
    };

    await saveAssessmentOfflineFirst(record);
    showToast(`Saved for ${patient.patientName}`, 'success');
    btn.textContent = "Saved ✓";
});

window.resetTriage = () => {
    state.selectedSymptoms.clear();
    state.answers = {};
    state.triageResult = null;
    el.btnNext1.disabled = true;
    const btn = document.getElementById('btn-save-assessment');
    btn.disabled = false;
    btn.textContent = "Save Assessment";
    loadTriageData();
    resetTriageStep(1);
};

// ═════════════════════════════════════════════════════════════════════════════
// PROTOCOL-BASED TRIAGE RUNNER
// ═════════════════════════════════════════════════════════════════════════════
async function loadProtocolPickerList() {
    const protos = await apiGet('/protocols');
    const container = document.getElementById('protocol-pick-list');
    if (!protos || protos.length === 0) {
        container.innerHTML = `<div style="color:var(--text-muted);grid-column:1/-1;padding:1rem;">
            No protocols found. Go to <strong>Protocol Builder</strong> to create one first.
        </div>`;
        return;
    }
    container.innerHTML = protos.map(p => {
        const nodeCount = p.nodes ? p.nodes.length : 0;
        const qCount = p.nodes ? p.nodes.filter(n => n.type === 'question').length : 0;
        return `
        <div class="protocol-pick-card" onclick="startProtoRun('${p.id}')">
          <div class="pick-card-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><rect x="2" y="9" width="8" height="6" rx="2" stroke="#8b5cf6" stroke-width="2"/><rect x="14" y="4" width="8" height="6" rx="2" stroke="#8b5cf6" stroke-width="2"/><rect x="14" y="14" width="8" height="6" rx="2" stroke="#8b5cf6" stroke-width="2"/><path d="M10 12h2M12 7v10" stroke="#8b5cf6" stroke-width="1.5" stroke-linecap="round"/></svg>
          </div>
          <h3>${p.name}</h3>
          <p>${nodeCount} nodes · ${qCount} question${qCount !== 1 ? 's' : ''}</p>
          <span class="pick-run-label">Click to Run →</span>
        </div>`;
    }).join('');
}

window.startProtoRun = async function (protocolId) {
    state.activeProtocolId = protocolId;
    state.protoAnswerLog = [];
    state.protoStepCount = 0;
    const res = await apiPost(`/protocol/${protocolId}/run`, {});
    if (!res) { showToast('Failed to start protocol', 'error'); return; }
    document.getElementById('protocol-pick-step').classList.add('hidden');
    if (res.done) showProtoResult(res.result);
    else showProtoQuestion(res);
};

function showProtoQuestion(nodeData) {
    state.activeProtocolNodeId = nodeData.nodeId;
    state.protoStepCount++;
    document.getElementById('protocol-qa-step').classList.remove('hidden');
    document.getElementById('protocol-result-step').classList.add('hidden');
    document.getElementById('proto-name-label').textContent = nodeData.protocolName || 'Protocol';
    document.getElementById('proto-question-text').textContent = nodeData.question;
    const pct = Math.min((state.protoStepCount / 8) * 100, 90);
    document.getElementById('proto-progress-fill').style.width = pct + '%';
}

window.answerProto = async function (answer) {
    const btn = answer === 'yes' ? document.getElementById('proto-yes-btn') : document.getElementById('proto-no-btn');
    btn.classList.add('btn-loading');
    state.protoAnswerLog.push({ question: document.getElementById('proto-question-text').textContent, answer });
    const res = await apiPost(`/protocol/${state.activeProtocolId}/advance`, {
        currentNodeId: state.activeProtocolNodeId, answer
    });
    btn.classList.remove('btn-loading');
    if (!res) { showToast('Protocol error — please retry', 'error'); return; }
    if (res.done) { document.getElementById('proto-progress-fill').style.width = '100%'; showProtoResult(res.result); }
    else showProtoQuestion(res);
};

function showProtoResult(result) {
    document.getElementById('protocol-qa-step').classList.add('hidden');
    document.getElementById('protocol-result-step').classList.remove('hidden');
    document.getElementById('proto-result-protocol-name').textContent = result.protocolName || 'Protocol Complete';
    document.getElementById('proto-result-action').textContent = result.action || 'No action specified.';
    const riskEl = document.getElementById('proto-risk-chip');
    const risk = (result.risk || 'unknown').toLowerCase();
    riskEl.textContent = result.risk || 'Unknown';
    riskEl.className = `proto-risk-chip risk-${risk}`;
    state.triageResult = {
        mode: 'protocol', protocolId: state.activeProtocolId,
        protocolName: result.protocolName, risk: result.risk,
        action: result.action, answerLog: state.protoAnswerLog
    };
    // Re-enable save button
    const btn = document.getElementById('btn-save-proto-assessment');
    btn.disabled = false;
    btn.textContent = "Save to Records";
}

window.restartProtoRun = function () {
    document.getElementById('protocol-qa-step').classList.add('hidden');
    document.getElementById('protocol-result-step').classList.add('hidden');
    document.getElementById('protocol-pick-step').classList.remove('hidden');
    document.getElementById('proto-progress-fill').style.width = '0%';
    loadProtocolPickerList();
};

document.getElementById('btn-save-proto-assessment').addEventListener('click', async () => {
    if (!state.triageResult) return;

    const patient = await askPatientDetails();
    if (!patient) return;

    const btn = document.getElementById('btn-save-proto-assessment');
    btn.textContent = "Saving...";
    btn.disabled = true;

    const record = {
        id: 'P' + Date.now(),
        patientName: patient.patientName,
        assessmentDate: patient.assessmentDate,
        date: new Date().toISOString(),
        mode: 'protocol',
        symptoms: state.protoAnswerLog.map(a => a.question),
        answers: Object.fromEntries(state.protoAnswerLog.map(a => [a.question, a.answer])),
        result: {
            mode: 'protocol',
            riskLevel: state.triageResult.risk,
            conditions: [{ name: state.triageResult.protocolName || 'Protocol Result', score: 100 }],
            recommendations: state.triageResult.action,
            explanation: state.protoAnswerLog.map(a => `${a.question}: ${a.answer}`)
        },
        savedBy: state.user?.name || 'Unknown'
    };

    await saveAssessmentOfflineFirst(record);
    showToast(`Saved for ${patient.patientName}`, 'success');
    btn.textContent = "Saved ✓";
});

// ─────────────────────────────────────────────────────────────────────────────
// ASSESSMENTS — reads from localStorage (offline-first)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deletes an assessment:
 * 1. Removes from localStorage immediately.
 * 2. Removes from pending queue if present.
 * 3. Fires DELETE to server (best-effort, failure is silent).
 */
window.deleteAssessmentRecord = async function (id) {
    // Two-click confirmation: first click arms, second confirms
    const btn = document.querySelector(`button[data-delete-id="${id}"]`);
    if (!btn) return;

    if (btn.dataset.armed !== 'true') {
        btn.dataset.armed = 'true';
        btn.textContent = 'Confirm?';
        btn.classList.add('btn-delete-armed');
        // Auto-disarm after 3 s
        setTimeout(() => {
            if (btn.dataset.armed === 'true') {
                btn.dataset.armed = 'false';
                btn.textContent = '🗑';
                btn.classList.remove('btn-delete-armed');
            }
        }, 3000);
        return;
    }

    // Confirmed — remove locally first
    const all = localReadAssessments();
    localWriteAssessments(all.filter(a => a.id !== id));

    // Remove from pending queue too
    const pending = getPendingIds();
    pending.delete(id);
    savePendingIds(pending);
    updatePendingBadge();

    // Re-render table immediately
    loadAssessments();
    showToast('Assessment deleted.', 'info');

    // Best-effort server delete (silent failure if offline)
    try {
        await fetch(`${API_BASE}/assessment/${id}`, {
            method: 'DELETE',
            signal: AbortSignal.timeout(5000)
        });
    } catch { /* offline — local record already gone */ }
};

function loadAssessments() {
    const data = localReadAssessments();
    const tbody = document.getElementById('assessments-table-body');
    const pending = getPendingIds();

    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="color:var(--text-muted);padding:2rem">No assessments recorded yet.</td></tr>`;
        return;
    }

    tbody.innerHTML = [...data].reverse().map(a => {
        const isPending = pending.has(a.id);
        const risk = (a.result?.riskLevel || 'low').toLowerCase();
        return `<tr>
      <td>
        <strong>${a.patientName || '—'}</strong>
        <br><span style="font-size:0.75rem;color:var(--text-muted)">${a.assessmentDate || ''}</span>
      </td>
      <td><span class="mode-badge mode-${a.mode || 'symptom'}">${a.mode === 'protocol' ? '🔷 Protocol' : '📊 Symptom'}</span></td>
      <td style="font-size:0.83rem;color:var(--text-secondary)">${Array.isArray(a.symptoms) ? a.symptoms.slice(0, 3).join(', ') + (a.symptoms.length > 3 ? '…' : '') : '-'}</td>
      <td><span class="risk-tag" style="color:var(--risk-${risk})">${a.result?.riskLevel || 'N/A'}</span></td>
      <td>${isPending
                ? `<span class="sync-pending-dot">⏳ Pending</span>`
                : `<span class="sync-ok-dot">✓ Synced</span>`
            }</td>
      <td>
        <button
          class="btn-delete-assessment"
          data-delete-id="${a.id}"
          data-armed="false"
          onclick="deleteAssessmentRecord('${a.id}')"
          title="Delete this assessment"
        >🗑</button>
      </td>
    </tr>`;
    }).join('');
}

// Update the assessments table header
document.addEventListener('DOMContentLoaded', () => {
    const thead = document.querySelector('#assessments-table-body')?.closest('table')?.querySelector('thead tr');
    if (thead) {
        thead.innerHTML = `
      <th>Patient / Date</th>
      <th>Mode</th>
      <th>Symptoms / Questions</th>
      <th>Risk</th>
      <th>Sync</th>
      <th></th>
    `;
    }
});


// ═════════════════════════════════════════════════════════════════════════════
// FLOWCHART PROTOCOL BUILDER
// ═════════════════════════════════════════════════════════════════════════════
function loadBuilderView() {
    refreshBuilderProtoList();
}

async function refreshBuilderProtoList() {
    const protos = await apiGet('/protocols');
    const pList = document.getElementById('builder-protocols-list');
    if (!protos || protos.length === 0) {
        pList.innerHTML = `<p style="color:var(--text-muted);font-size:0.85rem">No protocols yet.</p>`;
        return;
    }
    pList.innerHTML = protos.map(p => `
    <div class="mini-proto" style="display:flex;justify-content:space-between;align-items:center;">
      <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="vertical-align:middle;margin-right:4px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="#25a5a1" stroke-width="2"/><polyline points="14 2 14 8 20 8" stroke="#72dad2" stroke-width="2"/></svg>${p.name}</span>
      <button class="mini-proto-delete" onclick="deleteProto('${p.id}')">✕</button>
    </div>`).join('');
}

window.deleteProto = async function (id) {
    await apiDelete(`/protocol/${id}`);
    showToast('Protocol deleted.', 'info');
    refreshBuilderProtoList();
};

// ── Drag from toolkit ────────────────────────────────────────────────────────
const draggables = document.querySelectorAll('.draggable-item');
draggables.forEach(item => {
    item.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', item.dataset.type); item.classList.add('dragging'); });
    item.addEventListener('dragend', () => item.classList.remove('dragging'));
});

el.flowchartCanvas.addEventListener('dragover', (e) => { e.preventDefault(); el.flowchartCanvas.classList.add('drag-over'); });
el.flowchartCanvas.addEventListener('dragleave', () => el.flowchartCanvas.classList.remove('drag-over'));
el.flowchartCanvas.addEventListener('drop', (e) => {
    e.preventDefault();
    el.flowchartCanvas.classList.remove('drag-over');
    const type = e.dataTransfer.getData('text/plain');
    if (!type) return;
    const rect = el.flowchartCanvas.getBoundingClientRect();
    addNode(type, Math.max(0, e.clientX - rect.left - 130), Math.max(0, e.clientY - rect.top - 60));
});

function addNode(type, x, y) {
    const id = Date.now();
    const node = { id, type, text: '', risk: '', action: '', x, y, yesTo: null, noTo: null };
    state.builderNodes.push(node);
    renderNode(node);
    updateEmptyState();
    setHint(type === 'question'
        ? 'Fill in question text. Click Yes/No ports to connect to other nodes.'
        : 'Fill in the risk level and recommended action.');
}

function renderNode(node) {
    const existing = document.querySelector(`.fc-node[data-id="${node.id}"]`);
    if (existing) existing.remove();

    const div = document.createElement('div');
    div.className = `fc-node fc-node-${node.type}`;
    div.dataset.id = node.id;
    div.style.left = node.x + 'px';
    div.style.top = node.y + 'px';

    if (node.type === 'question') {
        div.innerHTML = `
      <div class="fc-node-header fc-header-question">
        <span class="fc-type-label">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Question
        </span>
        <button class="fc-delete-btn" onclick="deleteNode(${node.id})">✕</button>
      </div>
      <div class="fc-node-body">
        <input class="fc-input" placeholder="Type your yes/no question..." value="${escHtml(node.text)}"
          oninput="updateNodeField(${node.id}, 'text', this.value)">
      </div>
      <div class="fc-node-ports">
        <button class="fc-port fc-port-yes ${node.yesTo ? 'fc-port-connected' : ''}" onclick="startConnection(${node.id}, 'yes')">
          ${node.yesTo ? '✓ Yes →' : '+ Yes'}
        </button>
        <button class="fc-port fc-port-no ${node.noTo ? 'fc-port-connected' : ''}" onclick="startConnection(${node.id}, 'no')">
          ${node.noTo ? '✗ No →' : '+ No'}
        </button>
      </div>`;
    } else {
        div.innerHTML = `
      <div class="fc-node-header fc-header-result">
        <span class="fc-type-label">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Result
        </span>
        <button class="fc-delete-btn" onclick="deleteNode(${node.id})">✕</button>
      </div>
      <div class="fc-node-body">
        <select class="fc-select" onchange="updateNodeField(${node.id}, 'risk', this.value)">
          <option value="" ${!node.risk ? 'selected' : ''}>Select Risk Level</option>
          <option value="Low" ${node.risk === 'Low' ? 'selected' : ''}>🟢 Low</option>
          <option value="Medium" ${node.risk === 'Medium' ? 'selected' : ''}>🟡 Medium</option>
          <option value="High" ${node.risk === 'High' ? 'selected' : ''}>🟠 High</option>
          <option value="Critical" ${node.risk === 'Critical' ? 'selected' : ''}>🔴 Critical</option>
        </select>
        <input class="fc-input" placeholder="Recommended action..." value="${escHtml(node.action)}"
          oninput="updateNodeField(${node.id}, 'action', this.value)" style="margin-top:0.5rem;">
      </div>`;
    }

    div.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON') return;
        startNodeDrag(e, node.id);
    });

    el.flowchartNodes.appendChild(div);
    renderConnections();
}

function escHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

window.updateNodeField = (id, field, val) => {
    const node = state.builderNodes.find(n => n.id === id);
    if (node) { node[field] = val; renderConnections(); }
};

window.deleteNode = (id) => {
    state.builderNodes.forEach(n => { if (n.yesTo === id) n.yesTo = null; if (n.noTo === id) n.noTo = null; });
    state.builderNodes = state.builderNodes.filter(n => n.id !== id);
    const e2 = document.querySelector(`.fc-node[data-id="${id}"]`);
    if (e2) e2.remove();
    renderConnections();
    updateEmptyState();
    rerenderAllNodes();
};

function startNodeDrag(e, nodeId) {
    const node = state.builderNodes.find(n => n.id === nodeId);
    if (!node) return;
    state.draggingNode = { nodeId, startMouseX: e.clientX, startMouseY: e.clientY, startNodeX: node.x, startNodeY: node.y };
    el.flowchartCanvas.classList.add('dragging-active');
    e.preventDefault();
}

document.addEventListener('mousemove', (e) => {
    if (!state.draggingNode) return;
    const { nodeId, startMouseX, startMouseY, startNodeX, startNodeY } = state.draggingNode;
    const node = state.builderNodes.find(n => n.id === nodeId);
    if (!node) return;
    node.x = Math.max(0, startNodeX + e.clientX - startMouseX);
    node.y = Math.max(0, startNodeY + e.clientY - startMouseY);
    const e2 = document.querySelector(`.fc-node[data-id="${nodeId}"]`);
    if (e2) { e2.style.left = node.x + 'px'; e2.style.top = node.y + 'px'; }
    renderConnections();
});

document.addEventListener('mouseup', () => {
    if (state.draggingNode) { state.draggingNode = null; el.flowchartCanvas.classList.remove('dragging-active'); }
});

window.startConnection = function (fromNodeId, branch) {
    if (state.connecting?.fromNodeId === fromNodeId && state.connecting?.branch === branch) {
        state.connecting = null;
        setHint('Connection cancelled.');
        return;
    }
    state.connecting = { fromNodeId, branch };
    setHint(`Click any other node to connect the <strong>${branch.toUpperCase()}</strong> branch of node #${fromNodeId}.`);
};

document.addEventListener('click', (e) => {
    if (!state.connecting) return;
    const targetNodeEl = e.target.closest('.fc-node');
    if (!targetNodeEl) { state.connecting = null; setHint('Connection cancelled.'); return; }
    const targetId = parseInt(targetNodeEl.dataset.id, 10);
    const { fromNodeId, branch } = state.connecting;
    if (targetId === fromNodeId) { showToast("Can't connect a node to itself.", 'error'); return; }
    const fromNode = state.builderNodes.find(n => n.id === fromNodeId);
    if (!fromNode) return;
    if (branch === 'yes') fromNode.yesTo = targetId;
    else fromNode.noTo = targetId;
    state.connecting = null;
    rerenderAllNodes();
    setHint('✓ Connected! Continue building or save your protocol.');
    showToast(`Connected ${branch.toUpperCase()} → Node #${targetId}`, 'success');
});

function renderConnections() {
    const svg = el.connectionsSvg;
    svg.innerHTML = '';
    const canvasRect = el.flowchartCanvas.getBoundingClientRect();
    state.builderNodes.forEach(node => {
        if (node.type !== 'question') return;
        const el2 = document.querySelector(`.fc-node[data-id="${node.id}"]`);
        if (!el2) return;
        const nr = el2.getBoundingClientRect();
        const nx = nr.left - canvasRect.left;
        const ny = nr.top - canvasRect.top;
        [
            { key: 'yesTo', color: '#10b981', ox: 60 },
            { key: 'noTo', color: '#ef4444', ox: nr.width - 60 }
        ].forEach(({ key, color, ox }) => {
            const targetId = node[key];
            if (!targetId) return;
            const te = document.querySelector(`.fc-node[data-id="${targetId}"]`);
            if (!te) return;
            const tr = te.getBoundingClientRect();
            drawCurve(svg, nx + ox, ny + nr.height, tr.left - canvasRect.left + tr.width / 2, tr.top - canvasRect.top, color, key === 'yesTo' ? 'YES' : 'NO');
        });
    });
}

function drawCurve(svg, x1, y1, x2, y2, color, label) {
    const dy = Math.abs(y2 - y1) * 0.5;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`);
    path.setAttribute('stroke', color); path.setAttribute('stroke-width', '2.5'); path.setAttribute('fill', 'none');
    path.setAttribute('marker-end', `url(#arr-${color.replace('#', '')})`);

    const defs = svg.querySelector('defs') || svg.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'defs'));
    const mid = `arr-${color.replace('#', '')}`;
    if (!document.getElementById(mid)) {
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        marker.setAttribute('id', mid); marker.setAttribute('markerWidth', '10'); marker.setAttribute('markerHeight', '7');
        marker.setAttribute('refX', '9'); marker.setAttribute('refY', '3.5'); marker.setAttribute('orient', 'auto');
        const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        poly.setAttribute('points', '0 0, 10 3.5, 0 7'); poly.setAttribute('fill', color);
        marker.appendChild(poly); defs.appendChild(marker);
    }
    svg.appendChild(path);

    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const badge = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    badge.setAttribute('x', mx - 18); badge.setAttribute('y', my - 11);
    badge.setAttribute('width', '36'); badge.setAttribute('height', '20');
    badge.setAttribute('rx', '10'); badge.setAttribute('fill', color); badge.setAttribute('opacity', '0.9');
    svg.appendChild(badge);
    const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    txt.setAttribute('x', mx); txt.setAttribute('y', my + 4); txt.setAttribute('text-anchor', 'middle');
    txt.setAttribute('font-size', '10'); txt.setAttribute('font-weight', 'bold'); txt.setAttribute('fill', 'white');
    txt.setAttribute('font-family', 'Outfit, sans-serif'); txt.textContent = label;
    svg.appendChild(txt);
}

function rerenderAllNodes() {
    el.flowchartNodes.innerHTML = '';
    el.connectionsSvg.innerHTML = '';
    state.builderNodes.forEach(node => renderNode(node));
}

function updateEmptyState() {
    el.emptyDropState.style.display = state.builderNodes.length === 0 ? 'flex' : 'none';
}

function setHint(msg) { el.hintText.innerHTML = msg; }

el.btnSaveProto.addEventListener('click', async () => {
    const name = el.builderProtoName.value.trim() || 'Untitled Protocol';
    if (state.builderNodes.length === 0) { showToast('Cannot save empty protocol.', 'error'); return; }
    if (!state.builderNodes.some(n => n.type === 'result')) { showToast('Add at least one Result node first.', 'error'); return; }
    const emptyQ = state.builderNodes.find(n => n.type === 'question' && !n.text.trim());
    if (emptyQ) { showToast('Fill in the question text for all Question nodes.', 'error'); return; }

    const nodes = state.builderNodes.map(n => {
        const base = { id: n.id, type: n.type };
        if (n.type === 'question') { base.text = n.text; base.weight = 1; if (n.yesTo) base.yes = n.yesTo; if (n.noTo) base.no = n.noTo; }
        else { base.risk = n.risk || 'Unknown'; base.action = n.action || 'Consult a physician.'; }
        return base;
    });

    el.btnSaveProto.textContent = 'Saving...';
    const res = await apiPost('/protocol', { name, nodes });
    if (res && res.id) {
        showToast(`Protocol "${name}" saved!`, 'success');
        el.builderProtoName.value = '';
        state.builderNodes = [];
        rerenderAllNodes();
        updateEmptyState();
        setHint('Protocol saved! Run it from "Run Triage → Protocol-Based".');
        refreshBuilderProtoList();
    } else { showToast('Failed to save protocol.', 'error'); }
    el.btnSaveProto.textContent = 'Save Protocol';
});

el.btnClearCanvas.addEventListener('click', () => {
    state.builderNodes = []; rerenderAllNodes(); updateEmptyState();
    setHint('Canvas cleared. Drag nodes from the toolkit to start building.');
});

// ─────────────────────────────────────────────────────────────────────────────
// SYNC STATUS + AUTO-SYNC
// ─────────────────────────────────────────────────────────────────────────────
let _wasOnline = true;

async function updateSyncStatus() {
    const res = await apiGet('/sync/status');
    const span = document.querySelector('.status-text');
    const badge = document.getElementById('sync-status');
    const isOnline = res && res.status === 'Online';

    if (isOnline) {
        span.textContent = 'Network Active';
        badge.className = 'status-badge online';

        // Reconnect detected → try to flush pending queue
        if (!_wasOnline) {
            showToast('Back online — syncing pending assessments…', 'info');
            await attemptServerSync();
        }
        _wasOnline = true;
    } else {
        span.textContent = 'Offline Mode';
        badge.className = 'status-badge offline';
        _wasOnline = false;
    }
}

// Also sync via browser online/offline events (more reliable for real connectivity changes)
window.addEventListener('online', async () => {
    showToast('Connection restored — syncing…', 'info');
    await updateSyncStatus();
    await attemptServerSync();
});

window.addEventListener('offline', () => {
    showToast('You are offline. Assessments will be saved locally.', 'info');
    document.querySelector('.status-text').textContent = 'Offline Mode';
    document.getElementById('sync-status').className = 'status-badge offline';
});

// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────
initAuth();
updateEmptyState();
updatePendingBadge();

// Poll sync status + attempt queued sync every 30 seconds
setInterval(async () => {
    await updateSyncStatus();
    await attemptServerSync();
}, 30000);

updateSyncStatus();
