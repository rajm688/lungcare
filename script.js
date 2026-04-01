/* ── Utility ── */
function esc(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ── Firebase Init ── */
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCeBxHzJbfFUi6_DU8SpuFQgtXI6LOwns8',
  authDomain: 'lungcare-721be.firebaseapp.com',
  projectId: 'lungcare-721be',
  storageBucket: 'lungcare-721be.firebasestorage.app',
  messagingSenderId: '167334814176',
  appId: '1:167334814176:web:068aa93adbc0768f678b85'
};
const VAPID_KEY = 'BMaJO5Tsl5xqnq2N4YjTjiezRER6IItjkhIwNhsJeIb6Fpk8_fUCWzeBvtNUND-uoo0Cw8hmcZ4KSyJ3cifSRIQ';

firebase.initializeApp(FIREBASE_CONFIG);
const fsDb = firebase.firestore();
const fbMessaging = firebase.messaging();
const fbAuth = firebase.auth();
let currentUid = null;

/* ── Auth ── */
const Auth = {
  initAuth() {
    const form = document.getElementById('auth-form');
    const forgot = document.getElementById('auth-forgot');
    const btn = document.getElementById('auth-submit');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('auth-email').value.trim();
      const password = document.getElementById('auth-password').value;
      if (!email || !password) return;
      btn.disabled = true;
      btn.textContent = 'Signing in\u2026';
      this.clearMsg();
      try {
        await fbAuth.signInWithEmailAndPassword(email, password);
      } catch (err) {
        const msgs = {
          'auth/user-not-found': 'No account found with this email',
          'auth/wrong-password': 'Incorrect password',
          'auth/invalid-email': 'Invalid email address',
          'auth/too-many-requests': 'Too many attempts. Try again later.',
          'auth/invalid-credential': 'Invalid email or password'
        };
        this.showMsg(msgs[err.code] || err.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Sign In';
      }
    });

    forgot.addEventListener('click', async (e) => {
      e.preventDefault();
      const email = document.getElementById('auth-email').value.trim();
      if (!email) {
        this.showMsg('Enter your email first, then tap Forgot password', 'error');
        return;
      }
      try {
        await fbAuth.sendPasswordResetEmail(email);
        this.showMsg('Password reset email sent! Check your inbox.', 'success');
      } catch (err) {
        if (err.code === 'auth/invalid-email') this.showMsg('Invalid email address', 'error');
        else this.showMsg('Reset email sent if account exists.', 'success');
      }
    });

    fbAuth.onAuthStateChanged((user) => {
      if (user) {
        currentUid = user.uid;
        this.cleanupOldAuth();
        this.unlock();
      }
    });
  },
  showMsg(t, c = '') {
    const e = document.getElementById('auth-msg');
    e.textContent = t;
    e.className = 'auth-msg' + (c ? ' ' + c : '');
  },
  clearMsg() {
    const e = document.getElementById('auth-msg');
    e.textContent = '';
    e.className = 'auth-msg';
  },
  cleanupOldAuth() {
    ['lc_pin_hash', 'lc_pin_salt', 'lc_bio_cred', 'lc_auth_attempts', 'lc_auth_lockout'].forEach((k) =>
      localStorage.removeItem(k)
    );
  },
  unlock() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app').style.display = 'flex';
    startApp();
  }
};

/* ── User-scoped Firestore path ── */
function userCol(col) {
  return `users/${currentUid}/${col}`;
}

/* ── Constants ── */
const TASKS = [
  {
    id: 'spo2-wake',
    s: 'morning',
    n: 'Check SpO2 on waking',
    d: 'Target \u2265 95%. Below 93% \u2192 sit upright, call doctor.',
    t: 'mon'
  },
  {
    id: 'postural',
    s: 'morning',
    n: 'Postural drainage \u2014 10 min',
    d: 'Head lower than chest. Gravity drains mucus before clearance.',
    t: 'clear'
  },
  {
    id: 'nasal-wash',
    s: 'morning',
    n: 'Nasal saline wash',
    d: 'Lukewarm 37\u00B0C RO water + Jala Neti salt. Daily now, not weekly.',
    t: 'nasal'
  },
  {
    id: 'forocot-am',
    s: 'morning',
    n: 'Forocot G \u2014 1 puff (9 AM)',
    d: 'Take around 9 AM. Wait 10\u201315 min. Rinse mouth after.',
    t: 'med'
  },
  {
    id: 'aerobika-am',
    s: 'morning',
    n: 'Aerobika \u2014 5 cycles',
    d: 'Inhale \u2192 hold 2s \u2192 exhale through device \u2192 huff cough after.',
    t: 'clear'
  },
  {
    id: 'spiro',
    s: 'morning',
    n: 'Spirometer \u2014 10 deep breaths',
    d: 'Hold 3s each. Do before Aerobika. Mon/Wed/Fri only.',
    t: 'ex',
    days: [1, 3, 5]
  },
  {
    id: 'core-am',
    s: 'morning',
    n: 'Core: belly breathing + pelvic tilt',
    d: '10 diaphragmatic breaths + 10 pelvic tilts on back. 5 min.',
    t: 'core'
  },
  {
    id: 'breakfast',
    s: 'morning',
    n: 'High-calorie South Indian breakfast',
    d: 'Idli/pesarattu + eggs/paneer + banana + turmeric milk. 500+ kcal.',
    t: 'food'
  },
  {
    id: 'walk-am',
    s: 'morning',
    n: 'Morning walk \u2014 20 min',
    d: 'Pursed-lip breathing. N95 near traffic. Check SpO2 after.',
    t: 'ex'
  },
  {
    id: 'stretch',
    s: 'morning',
    n: 'Doorway chest stretch \u2014 3\u00D730s',
    d: 'Lean through doorway, chest opens. Fixes posture.',
    t: 'pos'
  },
  {
    id: 'snack-am',
    s: 'day',
    n: 'Mid-morning snack (10:30 AM)',
    d: 'Nuts + groundnut chikki + coconut water. Never skip.',
    t: 'food'
  },
  {
    id: 'lunch',
    s: 'day',
    n: 'Lunch \u2014 biggest meal (1 PM)',
    d: 'Rice + sambar + dal + curd. Add ghee. 650 kcal target.',
    t: 'food'
  },
  {
    id: 'spo2-pm',
    s: 'day',
    n: 'Post-lunch SpO2 + 30 min rest',
    d: 'Sit upright after eating. Never lie flat for 45 min after food.',
    t: 'mon'
  },
  {
    id: 'water',
    s: 'day',
    n: 'Water \u2014 2.5 litres by 4 PM',
    d: 'Warm or room temp only. No cold water. Thin mucus = easier clearance.',
    t: 'hyd'
  },
  {
    id: 'snack-pm',
    s: 'day',
    n: 'Afternoon snack (4 PM)',
    d: 'Ragi malt / peanut butter toast / steamed sweet potato.',
    t: 'food'
  },
  {
    id: 'chin-tuck',
    s: 'day',
    n: 'Chin tuck \u2014 10 reps \u00D7 3 today',
    d: 'Pull chin back, hold 5s. Corrects forward head posture.',
    t: 'pos'
  },
  {
    id: 'forocot-pm',
    s: 'night',
    n: 'Forocot G \u2014 1 puff (9 PM)',
    d: 'Second dose around 9 PM. Wait 10\u201315 min. Rinse mouth after.',
    t: 'med'
  },
  {
    id: 'aerobika-pm',
    s: 'evening',
    n: 'Aerobika \u2014 evening 5 cycles',
    d: 'Critical before sleep. Same technique as morning.',
    t: 'clear'
  },
  {
    id: 'core-pm',
    s: 'evening',
    n: 'Core + strength exercises (4\u00D7/week)',
    d: 'Dead bug, glute bridge, bird-dog, wall sit. 20 min.',
    t: 'core'
  },
  {
    id: 'walk-pm',
    s: 'evening',
    n: 'Evening walk \u2014 20\u201330 min',
    d: 'Park preferred. SpO2 should return to baseline within 3 min.',
    t: 'ex'
  },
  {
    id: 'dinner',
    s: 'evening',
    n: 'Dinner before 8 PM',
    d: 'Ragi roti + kurma + dal + ghee. 500 kcal target.',
    t: 'food'
  },
  {
    id: 'post-dinner',
    s: 'evening',
    n: 'Post-dinner walk \u2014 10 min',
    d: 'Reduces bloating. Do not lie flat for 45 min after eating.',
    t: 'ex'
  },
  {
    id: 'huff',
    s: 'night',
    n: 'Pre-sleep huff cough \u2014 3\u20134 times',
    d: 'Sit upright, exhale forcefully. Spit mucus. Prevents night cough.',
    t: 'clear'
  },
  {
    id: 'snack-night',
    s: 'night',
    n: 'Bedtime protein snack',
    d: 'Warm milk + turmeric + honey / boiled eggs / curd rice.',
    t: 'food'
  },
  {
    id: 'clean',
    s: 'night',
    n: 'Clean all devices',
    d: 'Aerobika + nasal bottle + nebuliser mesh. Aspergillus grows fast.',
    t: 'hyg'
  },
  {
    id: 'sleep',
    s: 'night',
    n: 'Sleep \u2014 2 pillows, right side',
    d: '10 PM target. Air purifier on. No fan directly on face.',
    t: 'slp'
  }
];
const SESSIONS = { morning: 'Morning', day: 'Daytime', evening: 'Evening', night: 'Night' };
const SESSION_ORDER = ['morning', 'day', 'evening', 'night'];
const DEFAULT_MEDS = [
  { id: 'forocot-am-med', time: 'am', icon: '\uD83D\uDC8A', n: 'Forocot G', sub: '1 puff \u2014 morning inhaler' },
  { id: 'forocot-pm-med', time: 'pm', icon: '\uD83D\uDC8A', n: 'Forocot G', sub: '1 puff \u2014 evening inhaler' }
];
const CHIP_CLASS = {
  med: 'chip-med',
  clear: 'chip-clear',
  food: 'chip-food',
  ex: 'chip-ex',
  mon: 'chip-mon',
  core: 'chip-core',
  pos: 'chip-pos',
  hyd: 'chip-hyd',
  hyg: 'chip-hyg',
  slp: 'chip-slp',
  nasal: 'chip-nasal'
};
const CHIP_LABEL = {
  med: 'Medication',
  clear: 'Clearance',
  food: 'Nutrition',
  ex: 'Exercise',
  mon: 'Monitor',
  core: 'Core',
  pos: 'Posture',
  hyd: 'Hydration',
  hyg: 'Hygiene',
  slp: 'Sleep',
  nasal: 'Nasal'
};
const MOODS = [
  { id: 'great', emoji: '\uD83D\uDE04', label: 'Great' },
  { id: 'good', emoji: '\uD83D\uDE0A', label: 'Good' },
  { id: 'okay', emoji: '\uD83D\uDE10', label: 'Okay' },
  { id: 'low', emoji: '\uD83D\uDE14', label: 'Low' },
  { id: 'sad', emoji: '\uD83D\uDE22', label: 'Sad' },
  { id: 'sick', emoji: '\uD83E\uDD12', label: 'Unwell' }
];
const MUCUS_COLORS = [
  'Clear / White',
  'Yellow',
  'Light Green',
  'Dark Green',
  'Brown / Rust',
  'Pink / Blood-tinged',
  'Other'
];
const MUCUS_VOLUMES = ['Scant (< 1 tsp)', 'Small (1-2 tsp)', 'Moderate (1-2 tbsp)', 'Large (> 2 tbsp)'];
const MUCUS_CONSISTENCY = ['Thin / Watery', 'Normal', 'Thick / Sticky', 'Very Thick'];

/* ── Configurable medications ── */
function getMeds() {
  const c = localStorage.getItem('lc_custom_meds');
  return c ? JSON.parse(c) : DEFAULT_MEDS;
}
function saveMedsConfig(meds) {
  localStorage.setItem('lc_custom_meds', JSON.stringify(meds));
}
function addCustomMed() {
  const name = document.getElementById('med-add-name').value.trim();
  const sub = document.getElementById('med-add-sub').value.trim();
  const time = document.getElementById('med-add-time').value;
  if (!name) return;
  const meds = getMeds();
  meds.push({ id: 'med-' + Date.now(), time, icon: '\uD83D\uDC8A', n: name, sub: sub || name });
  saveMedsConfig(meds);
  document.getElementById('med-add-name').value = '';
  document.getElementById('med-add-sub').value = '';
  renderMedConfig();
  renderMeds();
}
function removeCustomMed(id) {
  saveMedsConfig(getMeds().filter((m) => m.id !== id));
  renderMedConfig();
  renderMeds();
}
function renderMedConfig() {
  const el = document.getElementById('med-config-list');
  const meds = getMeds();
  if (!meds.length) {
    el.innerHTML = '<div style="font-size:13px;color:var(--text-3);padding:8px 0">No medications configured.</div>';
    return;
  }
  el.innerHTML = meds
    .map(
      (m) =>
        '<div class="med-config-item"><div class="med-config-info"><div class="med-config-name">' +
        esc(m.n) +
        '</div><div class="med-config-sub">' +
        esc(m.sub) +
        ' \u00B7 ' +
        (m.time === 'am' ? 'Morning' : 'Evening') +
        '</div></div><button class="med-del-btn" data-medid="' +
        esc(m.id) +
        '">\u2715</button></div>'
    )
    .join('');
  el.querySelectorAll('.med-del-btn').forEach((b) =>
    b.addEventListener('click', () => removeCustomMed(b.dataset.medid))
  );
}

/* ── Firestore DB (replaces IndexedDB) ── */
const DB = {
  async open() {
    try {
      await fsDb.enablePersistence({ synchronizeTabs: false });
    } catch (e) {
      console.warn('Firestore persistence:', e.code);
    }
    await this._migrateFromIndexedDB();
    await this._migrateRootToUser();
  },

  async put(col, data) {
    const docId = data.key || data.date;
    await fsDb.collection(userCol(col)).doc(docId).set(data);
    this._dirty(col);
  },

  async add(col, data) {
    await fsDb.collection(userCol(col)).add(data);
    this._dirty(col);
  },

  async get(col, key) {
    const doc = await fsDb.collection(userCol(col)).doc(key).get();
    return doc.exists ? doc.data() : null;
  },

  async getByIndex(col, field, value) {
    const snap = await fsDb.collection(userCol(col)).where(field, '==', value).get();
    return snap.docs.map((d) => d.data());
  },

  async getRange(col, field, lo, hi) {
    const snap = await fsDb.collection(userCol(col)).where(field, '>=', lo).where(field, '<=', hi).get();
    return snap.docs.map((d) => d.data());
  },

  async deleteItem(col, key) {
    await fsDb.collection(userCol(col)).doc(key).delete();
    this._dirty(col);
  },

  async getAll(col) {
    const snap = await fsDb.collection(userCol(col)).get();
    return snap.docs.map((d) => d.data());
  },

  // Cache
  _cache: {},
  _dirty(store) {
    Object.keys(this._cache).forEach((k) => {
      if (k.startsWith(store + '_')) delete this._cache[k];
    });
  },
  async cachedGetRange(col, field, lo, hi) {
    const key = col + '_' + field + '_' + lo + '_' + hi;
    if (this._cache[key]) return this._cache[key];
    const r = await this.getRange(col, field, lo, hi);
    this._cache[key] = r;
    return r;
  },
  async cachedGetByIndex(col, field, v) {
    const key = col + '_' + field + '_' + v;
    if (this._cache[key]) return this._cache[key];
    const r = await this.getByIndex(col, field, v);
    this._cache[key] = r;
    return r;
  },

  // One-time migration from IndexedDB → Firestore
  async _migrateFromIndexedDB() {
    if (localStorage.getItem('lc_migrated_firestore')) return;
    try {
      const idb = await new Promise((res, rej) => {
        const r = indexedDB.open('lungcareDB', 3);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
        r.onupgradeneeded = (e) => {
          const d = e.target.result;
          if (!d.objectStoreNames.contains('checklist'))
            d.createObjectStore('checklist', { keyPath: 'key' }).createIndex('date', 'date');
          if (!d.objectStoreNames.contains('spo2'))
            d.createObjectStore('spo2', { keyPath: 'id', autoIncrement: true }).createIndex('date', 'date');
          if (!d.objectStoreNames.contains('meds'))
            d.createObjectStore('meds', { keyPath: 'key' }).createIndex('date', 'date');
          if (!d.objectStoreNames.contains('dailylog')) d.createObjectStore('dailylog', { keyPath: 'date' });
        };
      });
      const readAll = (s) =>
        new Promise((res, rej) => {
          try {
            const tx = idb.transaction(s, 'readonly').objectStore(s).getAll();
            tx.onsuccess = () => res(tx.result);
            tx.onerror = () => rej(tx.error);
          } catch {
            res([]);
          }
        });
      const checklist = await readAll('checklist');
      const spo2 = await readAll('spo2');
      const meds = await readAll('meds');
      let dailylog = [];
      try {
        dailylog = await readAll('dailylog');
      } catch {}
      const total = checklist.length + spo2.length + meds.length + dailylog.length;
      if (total === 0) {
        localStorage.setItem('lc_migrated_firestore', '1');
        idb.close();
        return;
      }
      /* migration in progress */
      // Batch write in chunks of 400
      const all = [
        ...checklist.map((d) => ({ col: 'checklist', id: d.key, d })),
        ...spo2.map((d) => ({ col: 'spo2', id: null, d })),
        ...meds.map((d) => ({ col: 'meds', id: d.key, d })),
        ...dailylog.map((d) => ({ col: 'dailylog', id: d.date, d }))
      ];
      for (let i = 0; i < all.length; i += 400) {
        const batch = fsDb.batch();
        all.slice(i, i + 400).forEach((item) => {
          const ref = item.id ? fsDb.collection(userCol(item.col)).doc(item.id) : fsDb.collection(userCol(item.col)).doc();
          batch.set(ref, item.d);
        });
        await batch.commit();
      }
      localStorage.setItem('lc_migrated_firestore', '1');
      /* migration done */
      idb.close();
    } catch (e) {
      console.warn('Migration:', e);
      localStorage.setItem('lc_migrated_firestore', '1');
    }
  },

  async _migrateRootToUser() {
    if (!currentUid || localStorage.getItem('lc_migrated_user_scope')) return;
    try {
      const cols = ['checklist', 'spo2', 'meds', 'dailylog'];
      let totalMigrated = 0;
      for (const col of cols) {
        const snap = await fsDb.collection(col).get();
        if (snap.empty) continue;
        for (let i = 0; i < snap.docs.length; i += 400) {
          const batch = fsDb.batch();
          snap.docs.slice(i, i + 400).forEach((doc) => {
            batch.set(fsDb.collection(userCol(col)).doc(doc.id), doc.data());
          });
          await batch.commit();
        }
        totalMigrated += snap.docs.length;
      }
      if (totalMigrated > 0) console.log(`Migrated ${totalMigrated} docs to user scope`);
      localStorage.setItem('lc_migrated_user_scope', '1');
    } catch (e) {
      console.warn('User scope migration:', e);
      localStorage.setItem('lc_migrated_user_scope', '1');
    }
  }
};

/* ── Helpers ── */
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' });
const dayLabel = (d) => ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][new Date(d + 'T00:00:00').getDay()];
const dateRange = (n) => {
  const a = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    a.push(d.toISOString().slice(0, 10));
  }
  return a;
};
let completions = new Set(),
  medCompletions = new Set();
function getTodayTasks() {
  const dow = new Date().getDay();
  return TASKS.filter((t) => !t.days || t.days.includes(dow));
}
function getAllTasksForDisplay() {
  const dow = new Date().getDay();
  return TASKS.map((t) => ({ ...t, skipped: t.days && !t.days.includes(dow) }));
}
function validCompletionCount() {
  const v = new Set(getTodayTasks().map((t) => t.id));
  let c = 0;
  for (const id of completions) if (v.has(id)) c++;
  return c;
}

/* ── Tabs with animation ── */
const TAB_ORDER = ['today', 'spo2', 'meds', 'progress'];
let currentTabIdx = 0;
function switchTab(tab, btn) {
  const newIdx = TAB_ORDER.indexOf(tab);
  if (newIdx === currentTabIdx) return;
  const dir = newIdx > currentTabIdx ? 'slide-right' : 'slide-left';
  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active', 'slide-left', 'slide-right'));
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
  const panel = document.getElementById('panel-' + tab);
  panel.classList.add('active');
  void panel.offsetWidth;
  panel.classList.add(dir);
  btn.classList.add('active');
  currentTabIdx = newIdx;
  if (tab === 'progress') renderProgress();
  if (tab === 'spo2') {
    renderSpo2History();
    renderSpo2Avg();
    renderSpo2Chart();
  }
  if (tab === 'meds') renderMeds();
}

/* ── Checklist ── */
function buildChecklist() {
  const body = document.getElementById('checklist-body');
  body.innerHTML = '';
  const tt = getAllTasksForDisplay();
  const g = {};
  SESSION_ORDER.forEach((s) => (g[s] = []));
  tt.forEach((t) => (g[t.s] || []).push(t));
  SESSION_ORDER.forEach((s) => {
    if (!g[s].length) return;
    const l = document.createElement('div');
    l.className = 'session-label';
    l.textContent = SESSIONS[s];
    body.appendChild(l);
    const c = document.createElement('div');
    c.className = 'card';
    c.style.margin = '0 16px';
    g[s].forEach((task) => {
      const it = document.createElement('div');
      if (task.skipped) {
        it.className = 'task-item skipped';
        it.innerHTML =
          '<div class="task-check"></div><div class="task-content"><div class="task-name">' +
          esc(task.n) +
          '</div><div class="task-skip-note">Not scheduled today</div></div>';
      } else {
        it.className = 'task-item' + (completions.has(task.id) ? ' done' : '');
        it.dataset.id = task.id;
        it.innerHTML =
          '<div class="task-check"></div><div class="task-content"><div class="task-name">' +
          esc(task.n) +
          '</div><div class="task-detail">' +
          esc(task.d) +
          '</div><span class="chip ' +
          (CHIP_CLASS[task.t] || 'chip-mon') +
          '">' +
          (CHIP_LABEL[task.t] || '') +
          '</span></div>';
        it.addEventListener('click', () => toggleTask(task.id, it));
      }
      c.appendChild(it);
    });
    body.appendChild(c);
  });
}

/* ── Undo ── */
let undoPending = null,
  undoTimer = null;
function showUndo(taskId) {
  clearTimeout(undoTimer);
  undoPending = { taskId };
  document.getElementById('undo-text').textContent = 'Task unchecked';
  document.getElementById('undo-toast').classList.add('visible');
  undoTimer = setTimeout(() => {
    undoPending = null;
    document.getElementById('undo-toast').classList.remove('visible');
  }, 4000);
}
async function undoLastAction() {
  if (!undoPending) return;
  clearTimeout(undoTimer);
  const { taskId } = undoPending;
  undoPending = null;
  document.getElementById('undo-toast').classList.remove('visible');
  completions.add(taskId);
  await DB.put('checklist', { key: today() + '_' + taskId, date: today(), taskId, ts: Date.now() });
  buildChecklist();
  updateProgress();
  await saveStreak();
}

async function toggleTask(id, el) {
  if (navigator.vibrate) navigator.vibrate(15);
  const dk = today(),
    k = dk + '_' + id;
  if (completions.has(id)) {
    completions.delete(id);
    el.classList.remove('done');
    await DB.deleteItem('checklist', k);
    showUndo(id);
  } else {
    completions.add(id);
    el.classList.add('done');
    await DB.put('checklist', { key: k, date: dk, taskId: id, ts: Date.now() });
  }
  updateProgress();
  await saveStreak();
}

function updateProgress() {
  const done = validCompletionCount(),
    total = getTodayTasks().length,
    pct = total ? Math.round((done / total) * 100) : 0;
  const circ = 2 * Math.PI * 30;
  document.getElementById('ring-fill').style.strokeDashoffset = circ * (1 - pct / 100);
  document.getElementById('ring-pct').textContent = pct + '%';
  document.getElementById('summary-pct').textContent = pct + '%';
  document.getElementById('tasks-done').textContent = done + ' of ' + total + ' tasks done';
  const msgs = [
    [0, "Let's start strong today!"],
    [25, 'Good start \u2014 keep going!'],
    [50, 'Halfway there!'],
    [75, 'Almost done \u2014 finish strong!'],
    [100, '100% complete! Great work!']
  ];
  let msg = msgs[0][1];
  for (const [t, m] of msgs) if (pct >= t) msg = m;
  document.getElementById('summary-sub').textContent = msg;
}

async function loadTodayChecklist() {
  const r = await DB.cachedGetByIndex('checklist', 'date', today());
  const valid = new Set(TASKS.map((t) => t.id));
  completions = new Set(r.map((x) => x.taskId).filter((id) => valid.has(id)));
}

async function saveStreak() {
  const done = validCompletionCount(),
    total = getTodayTasks().length,
    pct = total ? Math.round((done / total) * 100) : 0;
  await DB.put('checklist', {
    key: 'day_' + today(),
    date: today(),
    taskId: '__summary__',
    pct,
    done,
    total,
    ts: Date.now()
  });
  await renderStreak();
}

async function renderStreak() {
  const days = dateRange(30),
    lo = days[0],
    hi = days[days.length - 1];
  const all = await DB.cachedGetRange('checklist', 'date', lo, hi);
  const sm = {};
  for (const r of all) if (r.taskId === '__summary__') sm[r.date] = r.pct;
  let streak = 0;
  const ts = today();
  for (const d of [...days].reverse()) {
    if (d > ts) continue;
    if ((sm[d] || 0) >= 70) streak++;
    else if (d < ts) break;
  }
  let best = 0,
    cur = 0;
  for (const d of days) {
    if ((sm[d] || 0) >= 70) {
      cur++;
      best = Math.max(best, cur);
    } else cur = 0;
  }
  document.getElementById('streak-header').textContent = '\uD83D\uDD25 ' + streak;
  document.getElementById('streak-big').textContent = streak;
  document.getElementById('streak-best-text').textContent = 'Best streak: ' + best + ' days';
  return { summaries: sm, streak };
}

/* ── SpO2 ── */
function updateSpo2Display() {
  const v = parseInt(document.getElementById('inp-spo2').value);
  const d = document.getElementById('spo2-display'),
    s = document.getElementById('spo2-status');
  if (!v) {
    d.innerHTML = '&mdash;';
    s.textContent = '';
    return;
  }
  d.textContent = v + '%';
  d.className = 'spo2-value-display ' + (v >= 95 ? 'spo2-ok' : v >= 93 ? 'spo2-warn' : 'spo2-bad');
  s.textContent =
    v >= 95
      ? '\u2713 Normal range'
      : v >= 93
        ? '\u26A0 Slightly low \u2014 rest & monitor'
        : '\u26D4 Low \u2014 call doctor immediately';
  s.style.color = v >= 95 ? 'var(--success)' : v >= 93 ? 'var(--warn)' : 'var(--danger)';
}
const _spo2Inp = document.getElementById('inp-spo2');
if (_spo2Inp) _spo2Inp.addEventListener('input', updateSpo2Display);

function showSpo2Error(msg) {
  const el = document.getElementById('spo2-error');
  el.textContent = msg;
  el.classList.add('visible');
  setTimeout(() => el.classList.remove('visible'), 3000);
}

async function saveSpo2() {
  const v = parseInt(document.getElementById('inp-spo2').value);
  if (!v || v < 70 || v > 100) {
    showSpo2Error('Enter a valid SpO2 value (70\u2013100)');
    return;
  }
  await DB.add('spo2', {
    date: today(),
    time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    spo2: v,
    pulse: document.getElementById('inp-pulse').value || null,
    feeling: document.getElementById('inp-feeling').value,
    notes: (document.getElementById('inp-notes').value || '').substring(0, 500),
    ts: Date.now()
  });
  if (navigator.vibrate) navigator.vibrate(20);
  ['inp-spo2', 'inp-pulse', 'inp-feeling', 'inp-notes'].forEach((id) => (document.getElementById(id).value = ''));
  document.getElementById('spo2-display').innerHTML = '&mdash;';
  document.getElementById('spo2-status').textContent = '';
  renderSpo2History();
  renderSpo2Avg();
  renderSpo2Chart();
}

async function renderSpo2Avg() {
  const days = dateRange(7);
  const recs = await DB.cachedGetRange('spo2', 'date', days[0], days[days.length - 1]);
  const valid = recs.filter((x) => x.spo2);
  const el = document.getElementById('spo2-avg-wrap');
  if (!valid.length) {
    el.innerHTML = '';
    return;
  }
  const avg = Math.round(valid.reduce((s, r) => s + r.spo2, 0) / valid.length);
  const min = Math.min(...valid.map((r) => r.spo2)),
    max = Math.max(...valid.map((r) => r.spo2));
  const cls = avg >= 95 ? 'spo2-ok' : avg >= 93 ? 'spo2-warn' : 'spo2-bad';
  el.innerHTML =
    '<div class="spo2-avg-card"><div class="spo2-avg-val ' +
    cls +
    '">' +
    avg +
    '%</div><div class="spo2-avg-info"><div class="spo2-avg-label">7-day average SpO2</div><div class="spo2-avg-range">Range: ' +
    min +
    '% \u2013 ' +
    max +
    '% \u00B7 ' +
    valid.length +
    ' readings</div></div></div>';
}

/* ── SpO2 Trend Chart ── */
async function renderSpo2Chart() {
  const wrap = document.getElementById('spo2-chart-wrap');
  const days = dateRange(7);
  const recs = await DB.cachedGetRange('spo2', 'date', days[0], days[days.length - 1]);
  const byDate = {};
  for (const r of recs)
    if (r.spo2) {
      if (!byDate[r.date]) byDate[r.date] = [];
      byDate[r.date].push(r.spo2);
    }
  const points = days
    .map((d) => ({
      date: d,
      avg: byDate[d] ? Math.round(byDate[d].reduce((a, b) => a + b, 0) / byDate[d].length) : null,
      label: dayLabel(d)
    }))
    .filter((p) => p.avg !== null);
  if (points.length < 2) {
    wrap.innerHTML = '';
    return;
  }
  const W = 320,
    H = 160,
    pL = 32,
    pR = 10,
    pT = 20,
    pB = 26,
    cW = W - pL - pR,
    cH = H - pT - pB;
  const fMin = 88,
    fMax = 100,
    fR = fMax - fMin;
  const fy = (v) => pT + cH - ((v - fMin) / fR) * cH;
  const fx = (i) => pL + (i / (points.length - 1)) * cW;
  let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">';
  svg +=
    '<rect x="' +
    pL +
    '" y="' +
    fy(fMax) +
    '" width="' +
    cW +
    '" height="' +
    (fy(95) - fy(fMax)) +
    '" fill="#ECFDF5"/>';
  svg +=
    '<rect x="' + pL + '" y="' + fy(95) + '" width="' + cW + '" height="' + (fy(93) - fy(95)) + '" fill="#FFFBEB"/>';
  svg +=
    '<rect x="' + pL + '" y="' + fy(93) + '" width="' + cW + '" height="' + (fy(fMin) - fy(93)) + '" fill="#FEF2F2"/>';
  for (let v = 90; v <= 100; v += 2) {
    const ly = fy(v);
    svg +=
      '<line x1="' +
      pL +
      '" y1="' +
      ly +
      '" x2="' +
      (W - pR) +
      '" y2="' +
      ly +
      '" stroke="#E2E8F0" stroke-width="0.5" stroke-dasharray="3,3"/>';
    svg +=
      '<text x="' +
      (pL - 5) +
      '" y="' +
      (ly + 3) +
      '" text-anchor="end" font-size="8" font-family="Inter,sans-serif" fill="#94A3B8" font-weight="700">' +
      v +
      '</text>';
  }
  svg +=
    '<line x1="' +
    pL +
    '" y1="' +
    fy(95) +
    '" x2="' +
    (W - pR) +
    '" y2="' +
    fy(95) +
    '" stroke="#10B981" stroke-width="0.7" opacity=".4"/>';
  svg +=
    '<line x1="' +
    pL +
    '" y1="' +
    fy(93) +
    '" x2="' +
    (W - pR) +
    '" y2="' +
    fy(93) +
    '" stroke="#EF4444" stroke-width="0.7" opacity=".4"/>';
  let areaD = 'M' + fx(0).toFixed(1) + ',' + fy(points[0].avg).toFixed(1);
  for (let i = 1; i < points.length; i++) areaD += ' L' + fx(i).toFixed(1) + ',' + fy(points[i].avg).toFixed(1);
  areaD += ' L' + fx(points.length - 1).toFixed(1) + ',' + (pT + cH) + ' L' + fx(0).toFixed(1) + ',' + (pT + cH) + ' Z';
  svg += '<path d="' + areaD + '" fill="url(#chartGrad)" opacity=".3"/>';
  svg +=
    '<defs><linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6366F1"/><stop offset="100%" stop-color="#6366F1" stop-opacity="0"/></linearGradient></defs>';
  let pathD = points.map((p, i) => (i === 0 ? 'M' : 'L') + fx(i).toFixed(1) + ',' + fy(p.avg).toFixed(1)).join(' ');
  svg +=
    '<path d="' +
    pathD +
    '" fill="none" stroke="#6366F1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>';
  points.forEach((p, i) => {
    const cx = fx(i),
      cy = fy(p.avg);
    const dc = p.avg >= 95 ? '#10B981' : p.avg >= 93 ? '#F59E0B' : '#EF4444';
    svg += '<circle cx="' + cx + '" cy="' + cy + '" r="4" fill="' + dc + '" stroke="white" stroke-width="2"/>';
    svg +=
      '<text x="' +
      cx +
      '" y="' +
      (cy - 9) +
      '" text-anchor="middle" font-size="9" font-family="Inter,sans-serif" fill="#1E293B" font-weight="800">' +
      p.avg +
      '</text>';
  });
  points.forEach((p, i) => {
    svg +=
      '<text x="' +
      fx(i) +
      '" y="' +
      (H - 6) +
      '" text-anchor="middle" font-size="9" font-family="Inter,sans-serif" fill="#94A3B8" font-weight="700">' +
      p.label +
      '</text>';
  });
  svg += '</svg>';
  wrap.innerHTML =
    '<div class="spo2-chart"><div class="card-header"><span class="card-title">7-Day SpO2 Trend</span></div>' +
    svg +
    '</div>';
}

async function renderSpo2History() {
  const days = dateRange(14);
  const recs = await DB.cachedGetRange('spo2', 'date', days[0], days[days.length - 1]);
  const valid = recs.filter((x) => x.spo2).sort((a, b) => b.ts - a.ts);
  const el = document.getElementById('spo2-history');
  if (!valid.length) {
    el.innerHTML =
      '<div class="empty-state"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg><p>No readings yet.<br>Log your first SpO2 reading above.</p></div>';
    return;
  }
  el.innerHTML = valid
    .slice(0, 20)
    .map((r) => {
      const c = r.spo2 >= 95 ? 'spo2-ok' : r.spo2 >= 93 ? 'spo2-warn' : 'spo2-bad';
      return (
        '<div class="log-item"><div class="log-spo2 ' +
        c +
        '">' +
        r.spo2 +
        '%</div><div class="log-meta"><div class="log-date">' +
        esc(fmtDate(r.date)) +
        ' \u00B7 ' +
        esc(r.time) +
        (r.feeling ? ' \u00B7 ' + esc(r.feeling) : '') +
        '</div>' +
        (r.notes ? '<div class="log-notes">' + esc(r.notes) + '</div>' : '') +
        '</div>' +
        (r.pulse
          ? '<div class="log-pulse">' +
            esc(r.pulse) +
            '<br><span style="font-size:10px;color:var(--text-3)">bpm</span></div>'
          : '') +
        '</div>'
      );
    })
    .join('');
}

/* ── Meds ── */
async function loadTodayMeds() {
  const r = await DB.cachedGetByIndex('meds', 'date', today());
  medCompletions = new Set(r.map((x) => x.medId));
}
function renderMeds() {
  const meds = getMeds();
  const b = document.getElementById('meds-body');
  const amMeds = meds.filter((m) => m.time === 'am'),
    pmMeds = meds.filter((m) => m.time === 'pm');
  let html = '';
  if (amMeds.length)
    html +=
      '<div class="med-time-header">Morning medications</div><div class="card" style="margin:0 16px 8px">' +
      amMeds.map(medHtml).join('') +
      '</div>';
  if (pmMeds.length)
    html +=
      '<div class="med-time-header">Evening medications</div><div class="card" style="margin:0 16px 16px">' +
      pmMeds.map(medHtml).join('') +
      '</div>';
  if (!meds.length)
    html =
      '<div class="empty-state" style="padding:40px 20px"><p>No medications configured.<br>Add them in Settings.</p></div>';
  b.innerHTML = html;
  b.querySelectorAll('.med-item').forEach((el) => {
    el.addEventListener('click', () => toggleMed(el.dataset.id));
  });
}
function medHtml(m) {
  const d = medCompletions.has(m.id);
  return (
    '<div class="med-item' +
    (d ? ' taken' : '') +
    '" data-id="' +
    esc(m.id) +
    '"><div class="med-icon">' +
    (d ? '\u2713' : m.icon) +
    '</div><div class="med-info"><div class="med-name">' +
    esc(m.n) +
    '</div><div class="med-sub">' +
    esc(m.sub) +
    '</div></div><div class="med-status">' +
    (d ? 'Taken' : 'Pending') +
    '</div></div>'
  );
}
async function toggleMed(id) {
  if (navigator.vibrate) navigator.vibrate(15);
  const dk = today(),
    k = dk + '_' + id;
  if (medCompletions.has(id)) {
    medCompletions.delete(id);
    await DB.deleteItem('meds', k);
  } else {
    medCompletions.add(id);
    await DB.put('meds', { key: k, date: dk, medId: id, ts: Date.now() });
  }
  renderMeds();
}

/* ── Evening Reflection (Mood + Mucus) ── */
let dailyLog = null;
async function loadDailyLog() {
  try {
    dailyLog = await DB.get('dailylog', today());
  } catch {
    dailyLog = null;
  }
}

function renderReflection() {
  const wrap = document.getElementById('reflection-wrap');
  const saved = dailyLog && dailyLog.mood;
  let h =
    '<div class="reflection-card"><div class="reflection-header"><span class="reflection-header-emoji">\uD83C\uDF19</span>Evening Reflection';
  if (saved) h += ' <span class="reflection-saved">\u2713 Saved</span>';
  h += '</div>';
  h += '<div class="reflection-section"><div class="reflection-label">How was your day?</div><div class="mood-grid">';
  MOODS.forEach((m) => {
    const sel = dailyLog && dailyLog.mood === m.id ? ' selected' : '';
    h +=
      '<button class="mood-btn' +
      sel +
      '" data-mood="' +
      m.id +
      '"><span class="mood-emoji">' +
      m.emoji +
      '</span><span class="mood-label">' +
      m.label +
      '</span></button>';
  });
  h += '</div></div>';
  h += '<div class="reflection-section"><div class="reflection-label">Sputum Log</div>';
  const mc = dailyLog?.mucusColor || '',
    mv = dailyLog?.mucusVolume || '',
    mcon = dailyLog?.mucusConsistency || '';
  h +=
    '<div class="mucus-row"><div class="field"><label>Color</label><select id="mucus-color"><option value="">Select color</option>';
  MUCUS_COLORS.forEach(
    (c) => (h += '<option value="' + esc(c) + '"' + (mc === c ? ' selected' : '') + '>' + esc(c) + '</option>')
  );
  h +=
    '</select></div><div class="field"><label>Volume</label><select id="mucus-volume"><option value="">Select volume</option>';
  MUCUS_VOLUMES.forEach(
    (v) => (h += '<option value="' + esc(v) + '"' + (mv === v ? ' selected' : '') + '>' + esc(v) + '</option>')
  );
  h += '</select></div></div>';
  const showCustom = mc === 'Other';
  h +=
    '<div class="field" id="mucus-custom-wrap" style="margin-bottom:10px;' +
    (showCustom ? '' : 'display:none') +
    '"><label>Describe color</label><input type="text" id="mucus-custom" value="' +
    esc(dailyLog?.mucusCustomColor || '') +
    '" placeholder="e.g. greenish-yellow"></div>';
  h +=
    '<div class="mucus-row"><div class="field"><label>Consistency</label><select id="mucus-consistency"><option value="">Select</option>';
  MUCUS_CONSISTENCY.forEach(
    (c) => (h += '<option value="' + esc(c) + '"' + (mcon === c ? ' selected' : '') + '>' + esc(c) + '</option>')
  );
  h += '</select></div><div class="field"></div></div></div>';
  h +=
    '<div class="reflection-section"><div class="field"><label>Notes (optional)</label><textarea id="reflection-notes" placeholder="How was your breathing today?">' +
    esc(dailyLog?.notes || '') +
    '</textarea></div></div>';
  h +=
    '<div style="padding:0 18px 18px"><button class="btn-primary" onclick="saveReflection()">Save reflection</button></div></div>';
  wrap.innerHTML = h;
  wrap.querySelectorAll('.mood-btn').forEach((b) =>
    b.addEventListener('click', () => {
      wrap.querySelectorAll('.mood-btn').forEach((x) => x.classList.remove('selected'));
      b.classList.add('selected');
    })
  );
  const colorSel = document.getElementById('mucus-color');
  if (colorSel)
    colorSel.addEventListener('change', () => {
      document.getElementById('mucus-custom-wrap').style.display = colorSel.value === 'Other' ? '' : 'none';
    });
}

async function saveReflection() {
  const mood = document.querySelector('.mood-btn.selected')?.dataset.mood || '';
  const mucusColor = document.getElementById('mucus-color')?.value || '';
  const mucusCustomColor = document.getElementById('mucus-custom')?.value || '';
  const mucusVolume = document.getElementById('mucus-volume')?.value || '';
  const mucusConsistency = document.getElementById('mucus-consistency')?.value || '';
  const notes = (document.getElementById('reflection-notes')?.value || '').substring(0, 500);
  dailyLog = {
    date: today(),
    mood,
    mucusColor,
    mucusCustomColor,
    mucusVolume,
    mucusConsistency,
    notes,
    ts: Date.now()
  };
  await DB.put('dailylog', dailyLog);
  if (navigator.vibrate) navigator.vibrate(20);
  renderReflection();
  renderReflectionHistory();
}

async function renderReflectionHistory() {
  const all = await DB.getAll('dailylog');
  const recent = all
    .filter((l) => l.date !== today() && l.mood)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);
  const existing = document.getElementById('reflection-history-card');
  if (existing) existing.remove();
  if (!recent.length) return;
  const wrap = document.getElementById('reflection-wrap');
  const card = document.createElement('div');
  card.className = 'card';
  card.style.margin = '0 16px 16px';
  card.id = 'reflection-history-card';
  let h = '<div class="card-header"><span class="card-title">Recent reflections</span></div>';
  recent.forEach((l) => {
    const mood = MOODS.find((m) => m.id === l.mood);
    h +=
      '<div class="reflection-log-item"><div class="reflection-log-emoji">' +
      (mood ? mood.emoji : '&mdash;') +
      '</div><div class="reflection-log-info"><div class="reflection-log-date">' +
      esc(fmtDate(l.date)) +
      '</div>';
    if (mood) h += '<div class="reflection-log-mood">' + mood.label + '</div>';
    let det = [];
    if (l.mucusColor) det.push(l.mucusColor === 'Other' ? l.mucusCustomColor || 'Other' : l.mucusColor);
    if (l.mucusVolume) det.push(l.mucusVolume);
    if (l.notes) det.push(l.notes);
    if (det.length) h += '<div class="reflection-log-details">' + esc(det.join(' \u00B7 ')) + '</div>';
    h += '</div></div>';
  });
  card.innerHTML = h;
  wrap.appendChild(card);
}

/* ── Progress ── */
async function renderProgress() {
  const { summaries: sm } = await renderStreak();
  const wk = dateRange(7),
    ts = today();
  document.getElementById('week-grid').innerHTML = wk
    .map((d) => {
      const p = sm[d] || 0,
        iT = d === ts,
        iF = d > ts;
      let c = iF ? 'future' : p >= 80 ? 'great' : p >= 50 ? 'good' : p >= 20 ? 'partial' : 'miss';
      if (iT) c += ' today';
      return (
        '<div class="week-day"><div class="week-label">' +
        dayLabel(d) +
        '</div><div class="week-dot ' +
        c +
        '">' +
        (iF ? '' : p ? p + '%' : '\u2014') +
        '</div></div>'
      );
    })
    .join('');
  const vw = wk.filter((d) => d <= ts && sm[d] !== undefined),
    avg = vw.length ? Math.round(vw.reduce((s, d) => s + (sm[d] || 0), 0) / vw.length) : 0;
  document.getElementById('stat-avg').textContent = avg + '%';
  const all30 = dateRange(30);
  const tracked = all30.filter((d) => d <= ts && sm[d] !== undefined);
  document.getElementById('stat-total').textContent = tracked.length;
  document.getElementById('stat-partial').textContent = tracked.filter(
    (d) => (sm[d] || 0) >= 50 && (sm[d] || 0) < 70
  ).length;
  document.getElementById('stat-perfect').textContent = tracked.filter((d) => (sm[d] || 0) === 100).length;
  const hist = dateRange(14)
      .filter((d) => d <= ts)
      .reverse(),
    hEl = document.getElementById('history-list');
  if (!hist.some((d) => sm[d])) {
    hEl.innerHTML = '<div class="empty-state" style="padding:24px"><p>Complete some tasks to see history.</p></div>';
    return;
  }
  hEl.innerHTML = hist
    .map((d) => {
      const p = sm[d] || 0,
        clr = p >= 80 ? 'var(--pri)' : p >= 50 ? 'var(--warn)' : 'var(--danger)';
      return (
        '<div class="history-item"><div class="history-date">' +
        esc(fmtDate(d)) +
        '</div><div class="history-bar-wrap"><div class="history-bar" style="width:' +
        p +
        '%;background:' +
        clr +
        '"></div></div><div class="history-pct" style="color:' +
        clr +
        '">' +
        p +
        '%</div></div>'
      );
    })
    .join('');
  renderMoodCalendar();
}

/* ── Mood Calendar ── */
let moodCalMonth = new Date().getMonth();
let moodCalYear = new Date().getFullYear();

async function renderMoodCalendar() {
  const el = document.getElementById('mood-calendar');
  if (!el) return;
  const all = await DB.getAll('dailylog');
  const moodMap = {};
  all.forEach((l) => {
    if (l.mood) {
      const m = MOODS.find((x) => x.id === l.mood);
      if (m) moodMap[l.date] = m.emoji;
    }
  });

  const yr = moodCalYear,
    mo = moodCalMonth;
  const firstDay = new Date(yr, mo, 1).getDay();
  const daysInMonth = new Date(yr, mo + 1, 0).getDate();
  const todayStr = today();
  const monthName = new Date(yr, mo).toLocaleString('en-US', { month: 'long', year: 'numeric' });

  let h = '<div class="mcal-nav">';
  h += '<button class="mcal-btn" onclick="moodCalPrev()">&lsaquo;</button>';
  h += '<div class="mcal-title">' + esc(monthName) + '</div>';
  h += '<button class="mcal-btn" onclick="moodCalNext()">&rsaquo;</button>';
  h += '</div>';
  h += '<div class="mcal-grid">';
  ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach((d) => {
    h += '<div class="mcal-head">' + d + '</div>';
  });
  for (let i = 0; i < firstDay; i++) h += '<div class="mcal-cell empty"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = yr + '-' + String(mo + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    const isToday = ds === todayStr;
    const emoji = moodMap[ds] || '';
    h += '<div class="mcal-cell' + (isToday ? ' today' : '') + (emoji ? ' has-mood' : '') + '">';
    h += '<div class="mcal-day">' + d + '</div>';
    if (emoji) h += '<div class="mcal-emoji">' + emoji + '</div>';
    h += '</div>';
  }
  h += '</div>';
  el.innerHTML = h;
}

function moodCalPrev() {
  moodCalMonth--;
  if (moodCalMonth < 0) {
    moodCalMonth = 11;
    moodCalYear--;
  }
  renderMoodCalendar();
}

function moodCalNext() {
  const now = new Date();
  if (moodCalYear > now.getFullYear() || (moodCalYear === now.getFullYear() && moodCalMonth >= now.getMonth())) return;
  moodCalMonth++;
  if (moodCalMonth > 11) {
    moodCalMonth = 0;
    moodCalYear++;
  }
  renderMoodCalendar();
}

/* ── FCM Notifications (multi-device) ── */
function getDeviceId() {
  let id = localStorage.getItem('lc_device_id');
  if (!id) {
    id = Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    localStorage.setItem('lc_device_id', id);
  }
  return id;
}

function isNotifEnabled() {
  return localStorage.getItem('lc_fcm_enabled') === '1';
}

async function toggleNotifications() {
  const deviceId = getDeviceId();
  if (isNotifEnabled()) {
    // Disable
    try {
      await fbMessaging.deleteToken();
    } catch {}
    try {
      await fsDb.collection('devices').doc(deviceId).delete();
    } catch {}
    localStorage.removeItem('lc_fcm_enabled');
  } else {
    // Enable
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      document.getElementById('notif-status').textContent = 'Permission denied. Enable in browser settings.';
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const token = await fbMessaging.getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
      await fsDb
        .collection('devices')
        .doc(deviceId)
        .set({ token, uid: currentUid, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
      localStorage.setItem('lc_fcm_enabled', '1');
      document.getElementById('notif-status').textContent =
        'Notifications enabled! You\u2019ll get reminders for each task.';
    } catch (e) {
      void 0; /* FCM setup error */
      document.getElementById('notif-status').textContent = 'Setup failed: ' + e.message;
      return;
    }
  }
  updateNotifToggle();
}

function updateNotifToggle() {
  const el = document.getElementById('notif-toggle');
  if (el) el.classList.toggle('on', isNotifEnabled());
  const status = document.getElementById('notif-status');
  if (status) status.textContent = isNotifEnabled() ? 'Reminders active \u2014 15 daily notifications' : '';
}

// Refresh FCM token on each app start (tokens can rotate)
async function refreshFCMToken() {
  if (!isNotifEnabled()) return;
  try {
    const deviceId = getDeviceId();
    const reg = await navigator.serviceWorker.ready;
    const token = await fbMessaging.getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    await fsDb
      .collection('devices')
      .doc(deviceId)
      .set({ token, uid: currentUid, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
  } catch (e) {
    console.warn('FCM refresh:', e);
  }
}

// Notification icon (shared by foreground handler + test)
const NOTIF_ICON = './icons/icon-192.svg';

// Handle foreground messages
fbMessaging.onMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || 'LungCare';
  const body = payload.notification?.body || payload.data?.body || '';
  // Show native notification even in foreground
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: NOTIF_ICON, tag: payload.data?.tag || 'lungcare' });
  }
});

/* ── Test Notification ── */

async function testNotification() {
  const status = document.getElementById('notif-status');
  if (!isNotifEnabled()) {
    status.textContent = 'Enable push reminders first, then test.';
    return;
  }
  status.textContent = 'Sending test via Firebase...';
  try {
    const sendTest = firebase.functions().httpsCallable('sendTestNotification');
    await sendTest();
    status.textContent = 'Test notification sent via Firebase! Check your notifications.';
  } catch (e) {
    status.textContent = 'Test failed: ' + (e.message || e);
  }
}

/* ── Notification Schedule ── */
const NOTIF_SCHEDULE = [
  { time: '06:30 AM', title: 'Morning Routine', body: 'SpO2 check, postural drainage, nasal saline wash' },
  { time: '07:00 AM', title: 'Core & Breakfast', body: 'Belly breathing + pelvic tilts, then high-calorie breakfast' },
  { time: '07:30 AM', title: 'Morning Walk', body: '20 min walk (pursed-lip breathing) + doorway chest stretch' },
  {
    time: '09:00 AM',
    title: 'Morning Medication',
    body: 'Forocot G morning puff \u2014 wait 10\u201315 min. Rinse mouth after.'
  },
  { time: '10:30 AM', title: 'Mid-Morning Snack', body: 'Nuts + groundnut chikki + coconut water \u2014 never skip!' },
  { time: '01:00 PM', title: 'Lunch Time', body: 'Biggest meal \u2014 rice + sambar + dal + curd + ghee (650 kcal)' },
  {
    time: '01:30 PM',
    title: 'Post-Lunch Check',
    body: 'Log SpO2 reading + 30 min rest. Sit upright, don\u2019t lie flat.'
  },
  { time: '03:00 PM', title: 'Hydration Check', body: 'Target 2.5L by 4 PM \u2014 warm or room temp water only' },
  { time: '04:00 PM', title: 'Afternoon Tasks', body: 'Afternoon snack + chin tuck exercises (10 reps \u00D7 3)' },
  { time: '06:00 PM', title: 'Evening Routine', body: 'Aerobika 5 cycles + core + strength exercises' },
  { time: '06:30 PM', title: 'Evening Walk', body: '20\u201330 min walk, then dinner before 8 PM' },
  { time: '07:30 PM', title: 'Dinner Time', body: 'Eat before 8 PM \u2014 ragi roti + kurma + dal + ghee' },
  { time: '08:15 PM', title: 'Post-Dinner Walk', body: '10 min walk. Don\u2019t lie flat for 45 min after eating.' },
  {
    time: '09:00 PM',
    title: 'Night Medication',
    body: 'Forocot G night puff \u2014 wait 10\u201315 min. Rinse mouth after.'
  },
  { time: '10:00 PM', title: 'Bedtime', body: 'Huff cough, clean devices, sleep \u2014 2 pillows, right side.' }
];

function renderNotifSchedule() {
  const el = document.getElementById('notif-schedule');
  if (!el) return;
  el.innerHTML =
    '<div style="font-size:11px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:1px;margin:14px 0 8px">Schedule (IST) \u2014 15 daily reminders</div>' +
    NOTIF_SCHEDULE.map(
      (s) =>
        '<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)"><div style="min-width:68px;font-size:12px;font-weight:700;color:var(--pri)">' +
        esc(s.time) +
        '</div><div><div style="font-size:13px;font-weight:600;color:var(--text)">' +
        esc(s.title) +
        '</div><div style="font-size:11px;color:var(--text-3);line-height:1.4">' +
        esc(s.body) +
        '</div></div></div>'
    ).join('');
}

/* ── Settings ── */
function showSettings() {
  renderMedConfig();
  updateNotifToggle();
  renderNotifSchedule();
  const user = fbAuth.currentUser;
  const emailEl = document.getElementById('auth-user-email');
  if (emailEl && user) emailEl.textContent = user.email;
  document.getElementById('settings-modal').classList.add('visible');
}
function hideSettings() {
  document.getElementById('settings-modal').classList.remove('visible');
}
async function signOut() {
  await fbAuth.signOut();
  currentUid = null;
  location.reload();
}

/* ── Export / Import ── */
async function exportData() {
  const data = {
    version: 3,
    exported: new Date().toISOString(),
    checklist: await DB.getAll('checklist'),
    spo2: await DB.getAll('spo2'),
    meds: await DB.getAll('meds'),
    dailylog: await DB.getAll('dailylog'),
    customMeds: localStorage.getItem('lc_custom_meds') || null
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'lungcare-backup-' + today() + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
}
async function importData(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    showSpo2Error('Backup file too large (max 10MB)');
    input.value = '';
    return;
  }
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!Array.isArray(data.checklist) || !Array.isArray(data.spo2)) throw new Error('Invalid backup format');
    // Clear Firestore collections
    for (const col of ['checklist', 'spo2', 'meds', 'dailylog']) {
      const snap = await fsDb.collection(userCol(col)).get();
      for (let i = 0; i < snap.docs.length; i += 400) {
        const batch = fsDb.batch();
        snap.docs.slice(i, i + 400).forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      }
    }
    for (const item of data.checklist) await DB.put('checklist', item);
    for (const item of data.spo2) {
      if (item.id) await fsDb.collection(userCol('spo2')).doc(String(item.id)).set(item);
      else await DB.add('spo2', item);
    }
    if (data.meds) for (const item of data.meds) await DB.put('meds', item);
    if (data.dailylog) for (const item of data.dailylog) await DB.put('dailylog', item);
    if (data.customMeds) localStorage.setItem('lc_custom_meds', data.customMeds);
    location.reload();
  } catch (e) {
    showSpo2Error('Import failed: ' + e.message);
  }
  input.value = '';
}

/* ── SW update ── */
function initSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW:', e));
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'SW_UPDATED') {
      const prev = localStorage.getItem('lc_sw_version');
      if (prev && prev !== e.data.version) document.getElementById('update-banner').classList.add('visible');
      localStorage.setItem('lc_sw_version', e.data.version);
    }
  });
}

/* ── PWA install ── */
function updateHeader() {
  document.getElementById('header-date').textContent = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
}
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById('install-banner').classList.remove('hidden');
});
document.getElementById('install-btn').onclick = async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') dismissInstall();
  deferredPrompt = null;
};
function dismissInstall() {
  document.getElementById('install-banner').classList.add('hidden');
}
window.addEventListener('appinstalled', dismissInstall);

/* ── Init ── */
async function startApp() {
  await DB.open();
  updateHeader();
  await loadTodayChecklist();
  await loadTodayMeds();
  await loadDailyLog();
  buildChecklist();
  updateProgress();
  await renderStreak();
  renderMeds();
  renderReflection();
  renderReflectionHistory();
  if (validCompletionCount() > 0) await saveStreak();
  // Refresh FCM token silently
  refreshFCMToken();
}
initSW();
Auth.initAuth();
