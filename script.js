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
function readJSON(key, fallback) {
  const raw = localStorage.getItem(key);
  if (!raw) return typeof fallback === 'function' ? fallback() : fallback;
  try { return JSON.parse(raw); } catch (_) { return typeof fallback === 'function' ? fallback() : fallback; }
}
const DAY_ABBR = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
function chipHtml(type) {
  return '<span class="chip ' + (CHIP_CLASS[type] || 'chip-mon') + '">' + (CHIP_LABEL[type] || '') + '</span>';
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
      } else {
        document.getElementById('auth-screen').classList.remove('hidden');
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
const DEFAULT_TASKS = [
  {
    id: 'spo2-wake',
    s: 'morning',
    n: 'Check SpO2 on waking',
    d: 'Target \u2265 95%. Below 93% \u2192 sit upright, call doctor.',
    t: 'mon'
  },
  {
    id: 'nasal-wash',
    s: 'morning',
    n: 'Nasal saline wash',
    d: 'Lukewarm 37\u00B0C RO water + Jala Neti salt. Alternate days (Tue/Thu/Sat).',
    t: 'nasal',
    days: [2, 4, 6]
  },
  {
    id: 'forocot-am',
    s: 'morning',
    n: 'Forocot G \u2014 1 puff (9 AM)',
    d: 'Opens airways first. Wait 10\u201315 min. Rinse mouth after.',
    t: 'med'
  },
  {
    id: 'aerobika-am',
    s: 'morning',
    n: 'Aerobika \u2014 5 cycles',
    d: 'Inhale \u2192 hold 2s \u2192 exhale through device \u2192 huff cough. Loosens mucus.',
    t: 'clear'
  },
  {
    id: 'postural',
    s: 'morning',
    n: 'Postural drainage \u2014 10 min',
    d: 'Head lower than chest. Drains mucus loosened by Aerobika.',
    t: 'clear'
  },
  {
    id: 'spiro',
    s: 'morning',
    n: 'Spirometer \u2014 10 deep breaths',
    d: 'Hold 3s each. Mon/Wed/Fri only.',
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
    id: 'stretch',
    s: 'morning',
    n: 'Doorway chest stretch \u2014 3\u00D730s',
    d: 'Lean through doorway, chest opens. Fixes posture.',
    t: 'pos'
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

/* ── Task Configuration (add/edit/delete/hide/reorder) ── */
const DEFAULT_TASK_CONFIG = { customTasks: [], edits: {}, hidden: [], order: {}, deleted: [] };
let _cachedTaskConfig = null;
function getTaskConfig() {
  if (_cachedTaskConfig) return _cachedTaskConfig;
  const parsed = readJSON('lc_task_config', null);
  if (!parsed) { _cachedTaskConfig = { ...DEFAULT_TASK_CONFIG, edits: {} }; return _cachedTaskConfig; }
  _cachedTaskConfig = {
    customTasks: parsed.customTasks || [],
    edits: parsed.edits || {},
    hidden: parsed.hidden || [],
    order: parsed.order || {},
    deleted: parsed.deleted || []
  };
  return _cachedTaskConfig;
}
function saveTaskConfig(config) {
  localStorage.setItem('lc_task_config', JSON.stringify(config));
  _cachedTaskConfig = null;
  _cachedEffectiveTasks = null;
}
let _cachedEffectiveTasks = null;
function getEffectiveTasks() {
  if (_cachedEffectiveTasks) return _cachedEffectiveTasks;
  const config = getTaskConfig();
  const deleted = config.deleted;
  let tasks = DEFAULT_TASKS
    .filter(t => !deleted.includes(t.id))
    .map(t => {
      const edit = config.edits[t.id];
      if (!edit) return t;
      const merged = { id: t.id, s: edit.s, n: edit.n, d: edit.d, t: edit.t, _edited: true };
      if (edit.days) merged.days = edit.days;
      return merged;
    });
  tasks = tasks.concat(config.customTasks.map(t => ({ ...t, _custom: true })));
  if (Object.keys(config.order).length) {
    const grouped = {};
    SESSION_ORDER.forEach(s => (grouped[s] = []));
    tasks.forEach(t => { if (grouped[t.s]) grouped[t.s].push(t); });
    const ordered = [];
    SESSION_ORDER.forEach(s => {
      const orderArr = config.order[s];
      if (orderArr && orderArr.length) {
        const orderMap = {};
        orderArr.forEach((id, i) => (orderMap[id] = i));
        grouped[s].sort((a, b) => {
          const ai = orderMap[a.id] !== undefined ? orderMap[a.id] : 999;
          const bi = orderMap[b.id] !== undefined ? orderMap[b.id] : 999;
          return ai - bi;
        });
      }
      ordered.push(...grouped[s]);
    });
    tasks = ordered;
  }
  _cachedEffectiveTasks = tasks;
  return tasks;
}

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
  return readJSON('lc_custom_meds', DEFAULT_MEDS);
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
const dayLabel = (d) => DAY_ABBR[new Date(d + 'T00:00:00').getDay()];
function _chartColors() {
  const s = getComputedStyle(document.documentElement);
  return {
    pri: s.getPropertyValue('--pri').trim() || '#40916C',
    text: s.getPropertyValue('--text').trim() || '#1A1814',
    text3: s.getPropertyValue('--text-3').trim() || '#78706A'
  };
}
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
  const hidden = getTaskConfig().hidden;
  return getEffectiveTasks().filter(t => !hidden.includes(t.id) && (!t.days || t.days.includes(dow)));
}
function getAllTasksForDisplay() {
  const dow = new Date().getDay();
  const hidden = getTaskConfig().hidden;
  return getEffectiveTasks()
    .filter(t => !hidden.includes(t.id))
    .map(t => ({ ...t, skipped: t.days && !t.days.includes(dow) }));
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
  if (tab === 'spo2') refreshSpo2Views();
  if (tab === 'meds') renderMeds();
}

/* ── Checklist ── */
let editMode = false;
function toggleEditMode() {
  editMode = !editMode;
  const btn = document.getElementById('edit-routine-btn');
  btn.innerHTML = editMode
    ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>'
    : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
  btn.classList.toggle('active', editMode);
  document.getElementById('edit-mode-banner').classList.toggle('hidden', !editMode);
  buildChecklist();
}
function buildChecklist() {
  const body = document.getElementById('checklist-body');
  body.innerHTML = '';
  const config = getTaskConfig();
  const allTasks = getEffectiveTasks();
  const dow = new Date().getDay();
  const tasksToShow = editMode
    ? allTasks.map(t => ({ ...t, skipped: t.days && !t.days.includes(dow) }))
    : allTasks.filter(t => !config.hidden.includes(t.id)).map(t => ({ ...t, skipped: t.days && !t.days.includes(dow) }));
  const g = {};
  SESSION_ORDER.forEach(s => (g[s] = []));
  tasksToShow.forEach(t => (g[t.s] || []).push(t));
  SESSION_ORDER.forEach(s => {
    if (!g[s].length && !editMode) return;
    const l = document.createElement('div');
    l.className = 'session-label';
    l.textContent = SESSIONS[s];
    body.appendChild(l);
    const c = document.createElement('div');
    c.className = 'card sortable-group';
    c.style.margin = '0 16px';
    c.dataset.session = s;
    g[s].forEach(task => {
      const hidden = config.hidden.includes(task.id);
      const it = document.createElement('div');
      if (editMode) {
        it.className = 'task-item edit-mode' + (hidden ? ' task-hidden' : '');
        it.dataset.id = task.id;
        const daysHtml = task.days
          ? '<span class="chip chip-days">' + task.days.map(d => DAY_ABBR[d]).join(', ') + '</span>'
          : '';
        it.innerHTML =
          '<div class="drag-handle"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg></div>' +
          '<div class="task-content"><div class="task-name">' + esc(task.n) + '</div>' +
          '<div class="task-detail">' + esc(task.d) + '</div>' +
          chipHtml(task.t) +
          daysHtml +
          (hidden ? '<span class="chip chip-hidden">Hidden</span>' : '') +
          '</div>' +
          '<div class="task-actions">' +
          '<button class="task-action-btn task-edit-btn" data-id="' + esc(task.id) + '" title="Edit"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>' +
          '<button class="task-action-btn task-hide-btn' + (hidden ? ' active' : '') + '" data-id="' + esc(task.id) + '" title="' + (hidden ? 'Show' : 'Hide') + '"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
          (hidden
            ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
            : '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 01-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>') +
          '</svg></button>' +
          '<button class="task-action-btn task-del-btn" data-id="' + esc(task.id) + '" title="Delete"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>' +
          '</div>';
      } else if (task.skipped) {
        it.className = 'task-item skipped';
        it.innerHTML =
          '<div class="task-check"></div><div class="task-content"><div class="task-name">' +
          esc(task.n) + '</div><div class="task-skip-note">Not scheduled today</div></div>';
      } else {
        it.className = 'task-item' + (completions.has(task.id) ? ' done' : '');
        it.dataset.id = task.id;
        it.innerHTML =
          '<div class="task-check"></div><div class="task-content"><div class="task-name">' +
          esc(task.n) + '</div><div class="task-detail">' + esc(task.d) +
          '</div>' + chipHtml(task.t) + '</div>';
        it.addEventListener('click', () => toggleTask(task.id, it));
      }
      c.appendChild(it);
    });
    if (editMode) {
      const addRow = document.createElement('div');
      addRow.className = 'task-add-row';
      addRow.innerHTML = '<button class="task-add-btn" data-session="' + s +
        '"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add task</button>';
      c.appendChild(addRow);
    }
    body.appendChild(c);
  });
  if (editMode) {
    body.querySelectorAll('.task-edit-btn').forEach(btn =>
      btn.addEventListener('click', e => { e.stopPropagation(); openTaskEditor(btn.dataset.id); })
    );
    body.querySelectorAll('.task-hide-btn').forEach(btn =>
      btn.addEventListener('click', e => { e.stopPropagation(); toggleHideTask(btn.dataset.id); })
    );
    body.querySelectorAll('.task-del-btn').forEach(btn =>
      btn.addEventListener('click', e => { e.stopPropagation(); confirmDeleteTask(btn.dataset.id); })
    );
    body.querySelectorAll('.task-add-btn').forEach(btn =>
      btn.addEventListener('click', () => openTaskEditor(null, btn.dataset.session))
    );
    initSortable();
  }
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
  const el = document.querySelector('[data-id="' + taskId + '"]');
  if (el) el.classList.add('done');
  else buildChecklist();
  updateProgress();
  saveStreak();
}

const _toggleLock = new Set();
async function toggleTask(id, el) {
  if (_toggleLock.has(id)) return;
  _toggleLock.add(id);
  try {
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
  saveStreak();
  } finally { _toggleLock.delete(id); }
}

function updateProgress() {
  const todayTasks = getTodayTasks();
  const valid = new Set(todayTasks.map(t => t.id));
  let done = 0;
  for (const id of completions) if (valid.has(id)) done++;
  const total = todayTasks.length,
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
  const valid = new Set(getEffectiveTasks().map((t) => t.id));
  completions = new Set(r.map((x) => x.taskId).filter((id) => valid.has(id)));
}

let _streakTimer = null;
function saveStreak() {
  clearTimeout(_streakTimer);
  _streakTimer = setTimeout(async () => {
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
  }, 2000);
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

/* ── Task Editor (add/edit/delete/hide) ── */
let editingTaskId = null;
function openTaskEditor(taskId, defaultSession) {
  editingTaskId = taskId;
  const modal = document.getElementById('task-editor-modal');
  const title = document.getElementById('task-editor-title');
  const deleteBtn = document.getElementById('task-edit-delete');
  const everyday = document.getElementById('task-edit-everyday');
  const dayChecks = document.querySelectorAll('#task-edit-days input[type="checkbox"]');
  if (taskId) {
    title.textContent = 'Edit Task';
    deleteBtn.style.display = 'block';
    const allTasks = getEffectiveTasks();
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;
    document.getElementById('task-edit-name').value = task.n;
    document.getElementById('task-edit-desc').value = task.d || '';
    document.getElementById('task-edit-session').value = task.s;
    document.getElementById('task-edit-cat').value = task.t;
    if (!task.days) {
      everyday.checked = true;
      dayChecks.forEach(cb => { cb.checked = false; cb.disabled = true; });
    } else {
      everyday.checked = false;
      dayChecks.forEach(cb => { cb.disabled = false; cb.checked = task.days.includes(parseInt(cb.value)); });
    }
  } else {
    title.textContent = 'Add Task';
    deleteBtn.style.display = 'none';
    document.getElementById('task-edit-name').value = '';
    document.getElementById('task-edit-desc').value = '';
    document.getElementById('task-edit-session').value = defaultSession || 'morning';
    document.getElementById('task-edit-cat').value = 'med';
    everyday.checked = true;
    dayChecks.forEach(cb => { cb.checked = false; cb.disabled = true; });
  }
  modal.classList.add('visible');
}
function closeTaskEditor() {
  document.getElementById('task-editor-modal').classList.remove('visible');
  editingTaskId = null;
}
function saveTaskEdit() {
  const name = document.getElementById('task-edit-name').value.trim();
  if (!name) return;
  const desc = document.getElementById('task-edit-desc').value.trim();
  const session = document.getElementById('task-edit-session').value;
  const cat = document.getElementById('task-edit-cat').value;
  const everyday = document.getElementById('task-edit-everyday').checked;
  let days = null;
  if (!everyday) {
    days = [];
    document.querySelectorAll('#task-edit-days input[type="checkbox"]').forEach(cb => {
      if (cb.checked) days.push(parseInt(cb.value));
    });
    if (!days.length) days = null;
  }
  const config = getTaskConfig();
  if (editingTaskId) {
    const isDefault = DEFAULT_TASKS.some(t => t.id === editingTaskId);
    if (isDefault) {
      const editObj = { n: name, d: desc, s: session, t: cat };
      if (days) editObj.days = days;
      config.edits[editingTaskId] = editObj;
    } else {
      const idx = config.customTasks.findIndex(t => t.id === editingTaskId);
      if (idx !== -1) {
        config.customTasks[idx] = { id: editingTaskId, s: session, n: name, d: desc, t: cat };
        if (days) config.customTasks[idx].days = days;
      }
    }
  } else {
    const newTask = { id: 'custom-' + Date.now(), s: session, n: name, d: desc, t: cat };
    if (days) newTask.days = days;
    config.customTasks.push(newTask);
  }
  saveTaskConfig(config);
  closeTaskEditor();
  buildChecklist();
  updateProgress();
}
function toggleHideTask(taskId) {
  const config = getTaskConfig();
  const idx = config.hidden.indexOf(taskId);
  if (idx === -1) config.hidden.push(taskId);
  else config.hidden.splice(idx, 1);
  saveTaskConfig(config);
  buildChecklist();
  updateProgress();
}
function confirmDeleteTask(taskId) {
  const allTasks = getEffectiveTasks();
  const task = allTasks.find(t => t.id === taskId);
  if (!task) return;
  if (!confirm('Delete "' + task.n + '"?')) return;
  const config = getTaskConfig();
  const isDefault = DEFAULT_TASKS.some(t => t.id === taskId);
  if (isDefault) {
    config.deleted.push(taskId);
    delete config.edits[taskId];
  } else {
    config.customTasks = config.customTasks.filter(t => t.id !== taskId);
  }
  config.hidden = config.hidden.filter(id => id !== taskId);
  // Remove from order
  SESSION_ORDER.forEach(s => {
    if (config.order[s]) config.order[s] = config.order[s].filter(id => id !== taskId);
  });
  saveTaskConfig(config);
  buildChecklist();
  updateProgress();
}
function resetTasksToDefault() {
  if (!confirm('Reset all tasks to default? Custom tasks will be removed and all edits undone.')) return;
  localStorage.removeItem('lc_task_config');
  _cachedTaskConfig = null;
  _cachedEffectiveTasks = null;
  buildChecklist();
  updateProgress();
}

/* ── Drag & Drop (SortableJS) ── */
let sortableInstances = [];
function initSortable() {
  sortableInstances.forEach(s => s.destroy());
  sortableInstances = [];
  if (typeof Sortable === 'undefined') return;
  document.querySelectorAll('.sortable-group').forEach(el => {
    const s = new Sortable(el, {
      handle: '.drag-handle',
      animation: 200,
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      dragClass: 'sortable-drag',
      filter: '.task-add-row',
      onEnd() {
        const session = el.dataset.session;
        const ids = [];
        el.querySelectorAll('.task-item[data-id]').forEach(item => ids.push(item.dataset.id));
        const config = getTaskConfig();
        config.order[session] = ids;
        saveTaskConfig(config);
      }
    });
    sortableInstances.push(s);
  });
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
  const rawPulse = parseInt(document.getElementById('inp-pulse').value);
  const pulse = rawPulse && rawPulse >= 40 && rawPulse <= 200 ? rawPulse : null;
  if (document.getElementById('inp-pulse').value && !pulse) {
    showSpo2Error('Enter a valid pulse (40\u2013200 bpm)');
    return;
  }
  await DB.add('spo2', {
    date: today(),
    time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    spo2: v,
    pulse,
    feeling: document.getElementById('inp-feeling').value,
    notes: (document.getElementById('inp-notes').value || '').substring(0, 500),
    ts: Date.now()
  });
  if (navigator.vibrate) navigator.vibrate(20);
  ['inp-spo2', 'inp-pulse', 'inp-feeling', 'inp-notes'].forEach((id) => (document.getElementById(id).value = ''));
  document.getElementById('spo2-display').innerHTML = '&mdash;';
  document.getElementById('spo2-status').textContent = '';
  refreshSpo2Views();
}

async function refreshSpo2Views() {
  const days14 = dateRange(14);
  const allRecs = await DB.cachedGetRange('spo2', 'date', days14[0], days14[days14.length - 1]);
  const days7 = dateRange(7);
  const recs7 = allRecs.filter((r) => r.date >= days7[0]);
  renderSpo2Avg(recs7);
  renderSpo2Chart(recs7);
  renderSpo2History(allRecs);
}

function renderSpo2Avg(recs) {
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
function renderSpo2Chart(recs) {
  const wrap = document.getElementById('spo2-chart-wrap');
  const cc = _chartColors();
  const days = dateRange(7);
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
      '" stroke="rgba(0,0,0,0.06)" stroke-width="0.5" stroke-dasharray="3,3"/>';
    svg +=
      '<text x="' +
      (pL - 5) +
      '" y="' +
      (ly + 3) +
      '" text-anchor="end" font-size="8" font-family="Figtree,sans-serif" fill="' + cc.text3 + '" font-weight="700">' +
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
    '<defs><linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="' + cc.pri + '"/><stop offset="100%" stop-color="' + cc.pri + '" stop-opacity="0"/></linearGradient></defs>';
  let pathD = points.map((p, i) => (i === 0 ? 'M' : 'L') + fx(i).toFixed(1) + ',' + fy(p.avg).toFixed(1)).join(' ');
  svg +=
    '<path d="' +
    pathD +
    '" fill="none" stroke="' + cc.pri + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>';
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
      '" text-anchor="middle" font-size="9" font-family="Figtree,sans-serif" fill="' + cc.text + '" font-weight="800">' +
      p.avg +
      '</text>';
  });
  points.forEach((p, i) => {
    svg +=
      '<text x="' +
      fx(i) +
      '" y="' +
      (H - 6) +
      '" text-anchor="middle" font-size="9" font-family="Figtree,sans-serif" fill="' + cc.text3 + '" font-weight="700">' +
      p.label +
      '</text>';
  });
  svg += '</svg>';
  wrap.innerHTML =
    '<div class="spo2-chart"><div class="card-header"><span class="card-title">7-Day SpO2 Trend</span></div>' +
    svg +
    '</div>';
}

function renderSpo2History(recs) {
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
const _medToggleLock = new Set();
async function toggleMed(id) {
  if (_medToggleLock.has(id)) return;
  _medToggleLock.add(id);
  try {
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
  } finally { _medToggleLock.delete(id); }
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
    '<div style="padding:0 18px 18px"><button class="btn-primary" id="save-reflection-btn">Save reflection</button></div></div>';
  wrap.innerHTML = h;
  document.getElementById('save-reflection-btn').addEventListener('click', saveReflection);
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
  const days = dateRange(14);
  const all = await DB.cachedGetRange('dailylog', 'date', days[0], days[days.length - 1]);
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
  // Only fetch current displayed month
  const rangeStart = moodCalYear + '-' + String(moodCalMonth + 1).padStart(2, '0') + '-01';
  const daysInMo = new Date(moodCalYear, moodCalMonth + 1, 0).getDate();
  const rangeEnd = moodCalYear + '-' + String(moodCalMonth + 1).padStart(2, '0') + '-' + String(daysInMo).padStart(2, '0');
  const all = await DB.cachedGetRange('dailylog', 'date', rangeStart, rangeEnd);
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
  h += '<button class="mcal-btn" id="mcal-prev">&lsaquo;</button>';
  h += '<div class="mcal-title">' + esc(monthName) + '</div>';
  h += '<button class="mcal-btn" id="mcal-next">&rsaquo;</button>';
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
  document.getElementById('mcal-prev').addEventListener('click', moodCalPrev);
  document.getElementById('mcal-next').addEventListener('click', moodCalNext);
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

async function saveFCMToken() {
  const deviceId = getDeviceId();
  const reg = await navigator.serviceWorker.ready;
  const token = await fbMessaging.getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
  await fsDb
    .collection('devices')
    .doc(deviceId)
    .set({ token, uid: currentUid, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
}

async function toggleNotifications() {
  const deviceId = getDeviceId();
  if (isNotifEnabled()) {
    try { await fbMessaging.deleteToken(); } catch (e) { console.warn('FCM delete:', e); }
    try { await fsDb.collection('devices').doc(deviceId).delete(); } catch (e) { console.warn('Device delete:', e); }
    localStorage.removeItem('lc_fcm_enabled');
  } else {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      document.getElementById('notif-status').textContent = 'Permission denied. Enable in browser settings.';
      return;
    }
    try {
      await saveFCMToken();
      localStorage.setItem('lc_fcm_enabled', '1');
      document.getElementById('notif-status').textContent =
        'Notifications enabled! You\u2019ll get reminders for each task.';
    } catch (e) {
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

async function refreshFCMToken() {
  if (!isNotifEnabled()) return;
  try {
    await saveFCMToken();
  } catch (e) {
    console.warn('FCM refresh:', e);
  }
}

// Notification icon (shared by foreground handler + test)
const NOTIF_ICON = './icons/icon-192.svg';

// Handle foreground messages (must use SW showNotification — new Notification() fails on mobile)
fbMessaging.onMessage(async (payload) => {
  const title = payload.notification?.title || payload.data?.title || 'LungCare';
  const body = payload.notification?.body || payload.data?.body || '';
  if (Notification.permission === 'granted') {
    const reg = await navigator.serviceWorker.ready;
    reg.showNotification(title, {
      body,
      icon: NOTIF_ICON,
      tag: payload.data?.tag || 'lungcare',
      vibrate: [200, 100, 200],
      renotify: true
    });
  }
});


/* ── Notification Schedule (customizable times) ── */
const DEFAULT_NOTIF_SCHEDULE = [
  { key: '06:30', title: 'Morning Routine', body: 'SpO2 check, postural drainage, nasal saline wash' },
  { key: '07:00', title: 'Core & Breakfast', body: 'Belly breathing + pelvic tilts, then high-calorie breakfast' },
  { key: '07:30', title: 'Morning Walk', body: '20 min walk (pursed-lip breathing) + doorway chest stretch' },
  { key: '09:00', title: 'Morning Medication', body: 'Forocot G morning puff \u2014 wait 10\u201315 min. Rinse mouth after.' },
  { key: '10:30', title: 'Mid-Morning Snack', body: 'Nuts + groundnut chikki + coconut water \u2014 never skip!' },
  { key: '13:00', title: 'Lunch Time', body: 'Biggest meal \u2014 rice + sambar + dal + curd + ghee (650 kcal)' },
  { key: '13:30', title: 'Post-Lunch Check', body: 'Log SpO2 reading + 30 min rest. Sit upright, don\u2019t lie flat.' },
  { key: '15:00', title: 'Hydration Check', body: 'Target 2.5L by 4 PM \u2014 warm or room temp water only' },
  { key: '16:00', title: 'Afternoon Tasks', body: 'Afternoon snack + chin tuck exercises (10 reps \u00D7 3)' },
  { key: '18:00', title: 'Evening Routine', body: 'Aerobika 5 cycles + core + strength exercises' },
  { key: '18:30', title: 'Evening Walk', body: '20\u201330 min walk, then dinner before 8 PM' },
  { key: '19:30', title: 'Dinner Time', body: 'Eat before 8 PM \u2014 ragi roti + kurma + dal + ghee' },
  { key: '20:15', title: 'Post-Dinner Walk', body: '10 min walk. Don\u2019t lie flat for 45 min after eating.' },
  { key: '21:00', title: 'Night Medication', body: 'Forocot G night puff \u2014 wait 10\u201315 min. Rinse mouth after.' },
  { key: '22:00', title: 'Bedtime', body: 'Huff cough, clean devices, sleep \u2014 2 pillows, right side.' }
];
function fmt12h(t24) {
  let [h, m] = t24.split(':').map(Number);
  const p = h >= 12 ? 'PM' : 'AM';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ' ' + p;
}
function roundTo15(t24) {
  let [h, m] = t24.split(':').map(Number);
  m = Math.round(m / 15) * 15;
  if (m === 60) { m = 0; h = (h + 1) % 24; }
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
function getNotifSchedule() {
  return readJSON('lc_notif_schedule', () => DEFAULT_NOTIF_SCHEDULE.map(s => ({ ...s })));
}
function saveNotifSchedule(schedule) {
  localStorage.setItem('lc_notif_schedule', JSON.stringify(schedule));
  if (!currentUid) return;
  const fsSchedule = {};
  schedule.forEach(s => { fsSchedule[s.key] = { title: s.title, body: s.body }; });
  fsDb.collection(userCol('settings')).doc('notifSchedule').set({
    schedule: fsSchedule,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }).catch(e => console.warn('Failed to save notif schedule:', e));
}
async function loadNotifSchedule() {
  if (!currentUid) return;
  try {
    const doc = await fsDb.collection(userCol('settings')).doc('notifSchedule').get();
    if (doc.exists && doc.data().schedule) {
      const fsSchedule = doc.data().schedule;
      const schedule = DEFAULT_NOTIF_SCHEDULE.map(s => {
        const match = Object.entries(fsSchedule).find(([, v]) => v.title === s.title);
        if (match) return { key: match[0], title: match[1].title, body: match[1].body };
        return { ...s };
      });
      localStorage.setItem('lc_notif_schedule', JSON.stringify(schedule));
    }
  } catch (e) { console.warn('Failed to load notif schedule:', e); }
}
function renderNotifSchedule() {
  const el = document.getElementById('notif-schedule');
  if (!el) return;
  const schedule = getNotifSchedule();
  el.innerHTML =
    '<div style="font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:1px;margin:14px 0 8px">Schedule (IST) \u2014 tap time to change</div>' +
    schedule.map((s, i) =>
      '<div class="notif-sched-row">' +
      '<input type="time" class="notif-time-input" data-idx="' + i + '" value="' + esc(s.key) + '" step="900" />' +
      '<div class="notif-sched-text"><div class="notif-sched-title">' + esc(s.title) +
      '</div><div class="notif-sched-body">' + esc(s.body) + '</div></div></div>'
    ).join('') +
    '<button class="btn-secondary" id="reset-notif-btn" style="margin-top:12px;font-size:12px;padding:8px 16px">Reset to default times</button>';
  el.querySelectorAll('.notif-time-input').forEach(input => {
    input.addEventListener('change', function () {
      const idx = parseInt(this.dataset.idx);
      const sched = getNotifSchedule();
      sched[idx].key = roundTo15(this.value);
      this.value = sched[idx].key;
      saveNotifSchedule(sched);
    });
  });
  const resetBtn = document.getElementById('reset-notif-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      localStorage.removeItem('lc_notif_schedule');
      saveNotifSchedule(DEFAULT_NOTIF_SCHEDULE.map(s => ({ ...s })));
      renderNotifSchedule();
    });
  }
}

/* ── Settings ── */
/* ── Theme Swatches ── */
const THEME_COLORS = [
  { id: 'auto', label: 'Auto', hex: null },
  { id: 'sage', label: 'Sage', hex: '#40916C' },
  { id: 'blue', label: 'Blue', hex: '#3b82f6' },
  { id: 'teal', label: 'Teal', hex: '#14b8a6' },
  { id: 'green', label: 'Green', hex: '#22c55e' },
  { id: 'orange', label: 'Orange', hex: '#f97316' },
  { id: 'rose', label: 'Rose', hex: '#f43f5e' },
  { id: 'purple', label: 'Purple', hex: '#a855f7' },
  { id: 'amber', label: 'Amber', hex: '#f59e0b' }
];
function renderThemeSwatches() {
  const wrap = document.getElementById('theme-swatches');
  if (!wrap) return;
  const saved = localStorage.getItem('lc_theme_color');
  let savedId = localStorage.getItem('lc_theme_id') || (saved ? null : 'auto');
  // Migrate legacy theme IDs
  if (savedId && !THEME_COLORS.some(t => t.id === savedId)) savedId = 'auto';
  wrap.innerHTML = THEME_COLORS.map((t) => {
    const active = t.id === savedId ? ' active' : '';
    const cls = t.id === 'auto' ? ' auto-swatch' : '';
    const bg = t.hex ? 'background:' + t.hex : '';
    return '<div class="theme-swatch' + cls + active + '" data-theme="' + t.id + '" data-hex="' + (t.hex || '') + '" style="' + bg + '" title="' + t.label + '"></div>';
  }).join('');
  wrap.querySelectorAll('.theme-swatch').forEach((sw) => {
    sw.addEventListener('click', () => {
      const id = sw.dataset.theme;
      const hex = sw.dataset.hex;
      if (id === 'auto') {
        localStorage.removeItem('lc_theme_color');
        localStorage.setItem('lc_theme_id', 'auto');
      } else {
        localStorage.setItem('lc_theme_color', hex);
        localStorage.setItem('lc_theme_id', id);
      }
      // Re-apply theme
      applyThemeFromStorage();
      wrap.querySelectorAll('.theme-swatch').forEach((s) => s.classList.remove('active'));
      sw.classList.add('active');
    });
  });
}
function applyThemeFromStorage() {
  function hexToHsl(hex) {
    let r = parseInt(hex.slice(1, 3), 16) / 255;
    let g = parseInt(hex.slice(3, 5), 16) / 255;
    let b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }
    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
  }
  function rgbToHex(str) {
    const m = str.match(/(\d+)/g);
    if (!m || m.length < 3) return null;
    return '#' + m.slice(0, 3).map((v) => parseInt(v).toString(16).padStart(2, '0')).join('');
  }
  function hsl(h, s, l) { return 'hsl(' + h + ',' + s + '%,' + l + '%)'; }
  function applyPalette(h, s) {
    const root = document.documentElement.style;
    // M3 primary tones
    root.setProperty('--pri', hsl(h, Math.min(s, 70), 55));
    root.setProperty('--pri-d', hsl(h, Math.min(s, 75), 40));
    root.setProperty('--pri-dd', hsl(h, Math.min(s, 80), 20));
    root.setProperty('--pri-l', hsl(h, Math.min(s, 50), 94));
    root.setProperty('--pri-ll', hsl(h, Math.min(s, 40), 97));
    // M3 surface tints
    root.setProperty('--bg', hsl(h, Math.min(s, 20), 98));
    root.setProperty('--surface', hsl(h, Math.min(s, 15), 99));
    root.setProperty('--surface-2', hsl(h, Math.min(s, 25), 96));
    root.setProperty('--surface-3', hsl(h, Math.min(s, 20), 92));
    root.setProperty('--border', hsl(h, Math.min(s, 15), 90));
    // Info uses primary hue
    root.setProperty('--info', hsl(h, Math.min(s, 65), 55));
    root.setProperty('--info-bg', hsl(h, Math.min(s, 50), 94));
    root.setProperty('--info-t', hsl(h, Math.min(s, 75), 30));
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', hsl(h, Math.min(s, 25), 96));
  }

  const saved = localStorage.getItem('lc_theme_color');
  let hex = saved;
  if (!hex) {
    // Auto-detect system accent
    try {
      const probe = document.createElement('div');
      probe.style.color = 'AccentColor';
      probe.style.position = 'absolute';
      probe.style.visibility = 'hidden';
      document.documentElement.appendChild(probe);
      hex = rgbToHex(getComputedStyle(probe).color);
      document.documentElement.removeChild(probe);
    } catch (_) {}
  }
  if (hex && hex !== '#000000' && hex !== '#ffffff') {
    const [h, s] = hexToHsl(hex);
    if (s > 5) applyPalette(h, s);
  } else {
    // Reset to CSS defaults
    ['--pri', '--pri-d', '--pri-dd', '--pri-l', '--pri-ll', '--bg', '--surface', '--surface-2', '--surface-3', '--border', '--info', '--info-bg', '--info-t'].forEach(
      (v) => document.documentElement.style.removeProperty(v)
    );
  }
}

function showSettings() {
  renderMedConfig();
  updateNotifToggle();
  renderNotifSchedule();
  renderThemeSwatches();
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
  const [checklist, spo2, meds, dailylog] = await Promise.all([
    DB.getAll('checklist'), DB.getAll('spo2'), DB.getAll('meds'), DB.getAll('dailylog')
  ]);
  const data = {
    version: 3,
    exported: new Date().toISOString(),
    checklist, spo2, meds, dailylog,
    customMeds: localStorage.getItem('lc_custom_meds') || null,
    taskConfig: localStorage.getItem('lc_task_config') || null,
    notifSchedule: localStorage.getItem('lc_notif_schedule') || null
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
    // Validate records before importing
    const isDateStr = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
    const isNum = (v) => typeof v === 'number' && isFinite(v);
    const isStr = (v, max) => typeof v === 'string' && v.length <= (max || 1000);
    const validChecklist = data.checklist.filter((r) => r && isDateStr(r.date) && isNum(r.ts));
    const validSpo2 = data.spo2.filter(
      (r) => r && isDateStr(r.date) && isNum(r.spo2) && r.spo2 >= 70 && r.spo2 <= 100 && isNum(r.ts)
    );
    const validMeds = Array.isArray(data.meds) ? data.meds.filter((r) => r && isDateStr(r.date) && isNum(r.ts)) : [];
    const validDailylog = Array.isArray(data.dailylog)
      ? data.dailylog.filter((r) => r && isDateStr(r.date) && isNum(r.ts))
      : [];
    // Validate customMeds JSON if present
    let validCustomMeds = null;
    if (data.customMeds) {
      try {
        const parsed = JSON.parse(data.customMeds);
        if (Array.isArray(parsed) && parsed.every((m) => m && isStr(m.id, 100) && isStr(m.n, 200))) {
          validCustomMeds = data.customMeds;
        }
      } catch (_) {}
    }
    // Clear Firestore collections
    for (const col of ['checklist', 'spo2', 'meds', 'dailylog']) {
      const snap = await fsDb.collection(userCol(col)).get();
      for (let i = 0; i < snap.docs.length; i += 400) {
        const batch = fsDb.batch();
        snap.docs.slice(i, i + 400).forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      }
    }
    // Batch writes for performance
    for (let i = 0; i < validChecklist.length; i += 400) {
      const batch = fsDb.batch();
      validChecklist.slice(i, i + 400).forEach((item) => {
        batch.set(fsDb.collection(userCol('checklist')).doc(item.key || (item.date + '_' + (item.taskId || ''))), item);
      });
      await batch.commit();
    }
    for (let i = 0; i < validSpo2.length; i += 400) {
      const batch = fsDb.batch();
      validSpo2.slice(i, i + 400).forEach((item) => {
        const ref = item.id ? fsDb.collection(userCol('spo2')).doc(String(item.id)) : fsDb.collection(userCol('spo2')).doc();
        batch.set(ref, item);
      });
      await batch.commit();
    }
    for (let i = 0; i < validMeds.length; i += 400) {
      const batch = fsDb.batch();
      validMeds.slice(i, i + 400).forEach((item) => {
        batch.set(fsDb.collection(userCol('meds')).doc(item.key || (item.date + '_' + (item.medId || ''))), item);
      });
      await batch.commit();
    }
    for (let i = 0; i < validDailylog.length; i += 400) {
      const batch = fsDb.batch();
      validDailylog.slice(i, i + 400).forEach((item) => {
        batch.set(fsDb.collection(userCol('dailylog')).doc(item.key || item.date), item);
      });
      await batch.commit();
    }
    if (validCustomMeds) localStorage.setItem('lc_custom_meds', validCustomMeds);
    if (data.taskConfig) {
      try {
        const tc = JSON.parse(data.taskConfig);
        if (tc && typeof tc === 'object') localStorage.setItem('lc_task_config', data.taskConfig);
      } catch (_) {}
    }
    if (data.notifSchedule) {
      try {
        const ns = JSON.parse(data.notifSchedule);
        if (Array.isArray(ns)) localStorage.setItem('lc_notif_schedule', data.notifSchedule);
      } catch (_) {}
    }
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
document.getElementById('install-btn').addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') dismissInstall();
  deferredPrompt = null;
});
function dismissInstall() {
  document.getElementById('install-banner').classList.add('hidden');
}
window.addEventListener('appinstalled', dismissInstall);

/* ── Init ── */
async function startApp() {
  await DB.open();
  updateHeader();
  await Promise.all([loadTodayChecklist(), loadTodayMeds(), loadDailyLog()]);
  buildChecklist();
  updateProgress();
  await renderStreak();
  renderMeds();
  renderReflection();
  renderReflectionHistory();
  if (validCompletionCount() > 0) await saveStreak();
  // Load custom notification schedule + refresh FCM token silently
  loadNotifSchedule();
  refreshFCMToken();
}
/* ── Event listeners (no inline handlers) ── */
document.getElementById('settings-btn').addEventListener('click', showSettings);
document.getElementById('save-spo2-btn').addEventListener('click', saveSpo2);
document.querySelectorAll('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', function () { switchTab(this.dataset.tab, this); });
});
document.getElementById('undo-btn').addEventListener('click', undoLastAction);
document.getElementById('settings-modal').addEventListener('click', function (e) {
  if (e.target === this) hideSettings();
});
document.getElementById('settings-close-btn').addEventListener('click', hideSettings);
document.getElementById('export-btn').addEventListener('click', exportData);
document.getElementById('import-btn').addEventListener('click', function () {
  document.getElementById('import-file').click();
});
document.getElementById('import-file').addEventListener('change', function () { importData(this); });
document.getElementById('notif-toggle').addEventListener('click', toggleNotifications);
document.getElementById('add-med-btn').addEventListener('click', addCustomMed);
document.getElementById('signout-btn').addEventListener('click', signOut);
document.getElementById('update-btn').addEventListener('click', function () { location.reload(); });
document.getElementById('install-close-btn').addEventListener('click', dismissInstall);
document.getElementById('edit-routine-btn').addEventListener('click', toggleEditMode);
document.getElementById('reset-defaults-btn').addEventListener('click', resetTasksToDefault);
document.getElementById('task-editor-close').addEventListener('click', closeTaskEditor);
document.getElementById('task-edit-save').addEventListener('click', saveTaskEdit);
document.getElementById('task-edit-delete').addEventListener('click', function () { confirmDeleteTask(editingTaskId); closeTaskEditor(); });
document.getElementById('task-editor-modal').addEventListener('click', function (e) { if (e.target === this) closeTaskEditor(); });
document.getElementById('task-edit-everyday').addEventListener('change', function () {
  document.querySelectorAll('#task-edit-days input[type="checkbox"]').forEach(cb => {
    cb.disabled = this.checked;
    if (this.checked) cb.checked = false;
  });
});

applyThemeFromStorage();
initSW();
Auth.initAuth();
