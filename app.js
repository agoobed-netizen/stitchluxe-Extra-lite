/* =============================================================
   StitchLuxe Extra Lite — app.js  (v2.3)
   - Paystack removed
   - Nigerian bank + fintech USSD/transfer payment flow
   - Direct Pinterest buttons
   ============================================================= */

/* ---------- GLOBAL ERROR BOUNDARY ---------- */
window.addEventListener('error', e =>
  console.error('[GLOBAL ERROR]', e.message, '@', e.filename, ':', e.lineno));
window.addEventListener('unhandledrejection', e =>
  console.error('[UNHANDLED PROMISE]', e.reason));

/* ---------- CONFIG ---------- */
const CONFIG = {
  SUPABASE_URL:      window.STITCHLUXE_SUPABASE_URL      || '',
  SUPABASE_ANON_KEY: window.STITCHLUXE_SUPABASE_ANON_KEY || '',
  LS_KEY:     'stitchluxe_extra_lite_v1',
  LS_SESSION: 'stitchluxe_session_v1'
};

const MILESTONES = [
  'Consultation & Design',
  'Measurement & Fabric',
  'Cutting & Pattern',
  'Sewing & Assembly',
  'Fitting & Adjustments',
  'Final Delivery'
];

/* ---------- NIGERIAN BANKS (USSD patterns) ---------- */
/* {amount} and {account} get substituted at runtime */
const BANKS = [
  // Commercial banks
  { id:'gtb',        name:'GTBank',     ussd:'*737*1*{amount}*{account}#',     color:'#dd4b39', type:'commercial' },
  { id:'firstbank',  name:'First Bank', ussd:'*894*{amount}*{account}#',       color:'#003d6b', type:'commercial' },
  { id:'uba',        name:'UBA',        ussd:'*919*4*{amount}*{account}#',     color:'#c8102e', type:'commercial' },
  { id:'zenith',     name:'Zenith',     ussd:'*966*{amount}*{account}#',       color:'#e4002b', type:'commercial' },
  { id:'access',     name:'Access',     ussd:'*901*{amount}*{account}#',       color:'#f58220', type:'commercial' },
  { id:'fidelity',   name:'Fidelity',   ussd:'*770*{amount}*{account}#',       color:'#005b8e', type:'commercial' },
  { id:'union',      name:'Union Bank', ussd:'*826*{amount}*{account}#',       color:'#1b3b6f', type:'commercial' },
  { id:'sterling',   name:'Sterling',   ussd:'*822*{amount}*{account}#',       color:'#e6003d', type:'commercial' },
  { id:'wema',       name:'Wema / ALAT',ussd:'*945*{amount}*{account}#',       color:'#7b1a54', type:'commercial' },
  { id:'stanbic',    name:'Stanbic IBTC',ussd:'*909*{amount}*{account}#',      color:'#0033a0', type:'commercial' },
  // Fintechs
  { id:'opay',       name:'Opay',       ussd:'*955*{amount}*{account}#',       color:'#1dc468', type:'fintech' },
  { id:'palmpay',    name:'PalmPay',    ussd:'*861*{amount}*{account}#',       color:'#6b1f8a', type:'fintech' },
  { id:'moniepoint', name:'Moniepoint', ussd:'*5573*{amount}*{account}#',      color:'#2e3a8a', type:'fintech' },
  { id:'kuda',       name:'Kuda',       ussd:null,                              color:'#40196d', type:'fintech',
    note:'Open Kuda app → Transfer → Send to bank → paste account' },
];

/* ---------- STATE ---------- */
const state = {
  user: null,
  orders: [], listings: [], applications: [], payments: [],
  messages: {}, activeOrderId: null, activeTab: 'orders'
};

/* ---------- UTIL ---------- */
const $ = (id) => document.getElementById(id);
const uid = () => 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const money = (n) => '₦' + Number(n || 0).toLocaleString('en-NG');
const escapeHtml = (s='') => String(s).replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const initials = (name='') => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
};
const fmtDate = (ts) => new Date(ts).toLocaleDateString('en-NG', { month:'short', day:'numeric', year:'numeric' });

function toast(msg, type='info') {
  const wrap = $('toast-wrap');
  if (!wrap) return;
  const colors = {
    info:'bg-black text-white', success:'bg-green-600 text-white',
    error:'bg-red-600 text-white', warn:'bg-[#c9a227] text-black'
  };
  const el = document.createElement('div');
  el.className = `toast ${colors[type]} text-sm font-medium px-4 py-3 rounded-xl shadow-lg`;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function copyText(text, btn) {
  const done = () => {
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = '✓ Copied';
      btn.classList.add('copy-ok');
      setTimeout(() => { btn.textContent = orig; btn.classList.remove('copy-ok'); }, 1500);
    }
    toast('Copied to clipboard', 'success');
  };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallback());
  } else fallback();

  function fallback() {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch { toast('Copy failed', 'error'); }
    ta.remove();
  }
}

/* ---------- SAFE LOCALSTORAGE ---------- */
function lsRead(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function lsWrite(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); return true; }
  catch (e) { console.warn('[StitchLuxe] lsWrite failed:', e.name); return false; }
}

/* ---------- SUPABASE CLIENT ---------- */
let sb = null;
let useLocal = true;

function supabaseReady() {
  return !useLocal && sb && sb.auth
    && typeof sb.auth.signUp === 'function'
    && typeof sb.auth.signInWithPassword === 'function';
}
function forceLocalMode(reason) {
  if (!useLocal) console.warn('[StitchLuxe] Switching to LOCAL mode:', reason);
  useLocal = true; sb = null;
}
function isStructuralError(e) {
  const msg = String(e?.message || e || '');
  return msg.includes('Cannot read properties')
      || msg.includes('is not a function')
      || msg.includes('undefined')
      || msg.includes('Failed to fetch')
      || msg.includes('NetworkError');
}

if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY && window.supabase) {
  try {
    sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    if (sb?.auth && typeof sb.auth.signUp === 'function' && typeof sb.auth.signInWithPassword === 'function') {
      useLocal = false;
      console.log('[StitchLuxe] Supabase client OK — connected to real backend');
    } else {
      console.warn('[StitchLuxe] Supabase client missing .auth — LOCAL mode');
      sb = null; useLocal = true;
    }
  } catch (e) {
    console.warn('[StitchLuxe] Supabase init threw:', e);
    sb = null; useLocal = true;
  }
}

/* ---------- LOCAL SEED ---------- */
function seedLocal() {
  const db = lsRead(CONFIG.LS_KEY, null);
  if (db) return db;
  const seed = { orders: [], listings: [], applications: [], payments: [], messages: {}, profiles: {} };
  seed.profiles['mastertailor@stitchluxe.com'] = {
    id: 'tailor-demo-001', email: 'mastertailor@stitchluxe.com',
    full_name: 'Master Ade Tailor', role: 'tailor'
  };
  seed.profiles['designer@stitchluxe.com'] = {
    id: 'client-demo-001', email: 'designer@stitchluxe.com',
    full_name: 'Ada Designer', role: 'client'
  };
  lsWrite(CONFIG.LS_KEY, seed);
  return seed;
}

/* =============================================================
   DB ADAPTER
   ============================================================= */
const db = {
  async signIn(email, password, role) {
    if (supabaseReady()) {
      try {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        let profile = null;
        try {
          const { data: p } = await sb.from('profiles').select('*').eq('id', data.user.id).single();
          profile = p;
        } catch {}
        return { user: data.user, profile: profile || { id: data.user.id, email, full_name: email, role } };
      } catch (e) {
        if (isStructuralError(e)) forceLocalMode('signIn: ' + e.message);
        else throw e;
      }
    }
    const store = seedLocal();
    let profile = store.profiles[email];
    if (!profile) {
      profile = { id: uid(), email, full_name: email.split('@')[0], role: role || 'client' };
      store.profiles[email] = profile;
      lsWrite(CONFIG.LS_KEY, store);
    }
    return { user: { id: profile.id, email }, profile };
  },
  async signUp(email, password, fullName, role) {
    if (supabaseReady()) {
      try {
        const { data, error } = await sb.auth.signUp({
          email, password, options: { data: { full_name: fullName, role } }
        });
        if (error) throw error;
        return { user: data.user, profile: { id: data.user?.id, email, full_name: fullName, role } };
      } catch (e) {
        if (isStructuralError(e)) forceLocalMode('signUp');
        else throw e;
      }
    }
    const store = seedLocal();
    const profile = { id: uid(), email, full_name: fullName, role: role || 'client' };
    store.profiles[email] = profile;
    lsWrite(CONFIG.LS_KEY, store);
    return { user: { id: profile.id, email }, profile };
  },
  async signOut() {
    if (supabaseReady()) try { await sb.auth.signOut(); } catch {}
    try { localStorage.removeItem(CONFIG.LS_SESSION); } catch {}
  },
  async listOrders() {
    if (supabaseReady()) {
      try {
        const { data, error } = await sb.from('bespoke_orders').select('*').order('created_at', { ascending:false });
        if (error) throw error; return data || [];
      } catch (e) { if (isStructuralError(e)) forceLocalMode('listOrders'); else throw e; }
    }
    const store = seedLocal();
    return (store.orders || []).filter(o =>
      o.client_id === state.user?.id || o.tailor_id === state.user?.id || !o.tailor_id);
  },
  async createOrder(payload) {
    if (supabaseReady()) {
      try {
        const { data, error } = await sb.from('bespoke_orders').insert(payload).select().single();
        if (error) throw error; return data;
      } catch (e) { if (isStructuralError(e)) forceLocalMode('createOrder'); else throw e; }
    }
    const store = seedLocal();
    const row = { id: uid(), created_at: Date.now(), updated_at: Date.now(), milestone: 1, status:'pending', ...payload };
    store.orders.push(row); lsWrite(CONFIG.LS_KEY, store); return row;
  },
  async updateOrder(id, patch) {
    if (supabaseReady()) {
      try {
        const { data, error } = await sb.from('bespoke_orders')
          .update({ ...patch, updated_at: new Date().toISOString() })
          .eq('id', id).select().single();
        if (error) throw error; return data;
      } catch (e) { if (isStructuralError(e)) forceLocalMode('updateOrder'); else throw e; }
    }
    const store = seedLocal();
    const idx = store.orders.findIndex(o => o.id === id);
    if (idx >= 0) {
      store.orders[idx] = { ...store.orders[idx], ...patch, updated_at: Date.now() };
      lsWrite(CONFIG.LS_KEY, store); return store.orders[idx];
    }
  },
  async listMessages(orderId) {
    if (supabaseReady()) {
      try {
        const { data, error } = await sb.from('order_messages').select('*')
          .eq('order_id', orderId).order('created_at', { ascending:true });
        if (error) throw error; return data || [];
      } catch (e) { if (isStructuralError(e)) forceLocalMode('listMessages'); else throw e; }
    }
    const store = seedLocal();
    return store.messages[orderId] || [];
  },
  async createMessage(payload) {
    if (supabaseReady()) {
      try {
        const { data, error } = await sb.from('order_messages').insert(payload).select().single();
        if (error) throw error; return data;
      } catch (e) { if (isStructuralError(e)) forceLocalMode('createMessage'); else throw e; }
    }
    const store = seedLocal();
    const row = { id: uid(), created_at: Date.now(), ...payload };
    store.messages[row.order_id] = [...(store.messages[row.order_id] || []), row];
    lsWrite(CONFIG.LS_KEY, store); return row;
  },
  async listPayments() {
    if (supabaseReady()) {
      try {
        const { data, error } = await sb.from('payment_requests').select('*').order('created_at', { ascending:false });
        if (error) throw error; return data || [];
      } catch (e) { if (isStructuralError(e)) forceLocalMode('listPayments'); else throw e; }
    }
    const store = seedLocal();
    return (store.payments || []).filter(p =>
      p.client_id === state.user?.id || p.tailor_id === state.user?.id);
  },
  async createPayment(payload) {
    if (supabaseReady()) {
      try {
        const { data, error } = await sb.from('payment_requests').insert(payload).select().single();
        if (error) throw error; return data;
      } catch (e) { if (isStructuralError(e)) forceLocalMode('createPayment'); else throw e; }
    }
    const store = seedLocal();
    const row = { id: uid(), created_at: Date.now(), status:'pending', ...payload };
    store.payments.push(row); lsWrite(CONFIG.LS_KEY, store); return row;
  },
  async updatePayment(id, patch) {
    if (supabaseReady()) {
      try {
        const { data, error } = await sb.from('payment_requests').update(patch).eq('id', id).select().single();
        if (error) throw error; return data;
      } catch (e) { if (isStructuralError(e)) forceLocalMode('updatePayment'); else throw e; }
    }
    const store = seedLocal();
    const idx = store.payments.findIndex(p => p.id === id);
    if (idx >= 0) {
      store.payments[idx] = { ...store.payments[idx], ...patch };
      lsWrite(CONFIG.LS_KEY, store); return store.payments[idx];
    }
  },
  async listListings() {
    if (supabaseReady()) {
      try {
        const { data, error } = await sb.from('marketplace_listings').select('*').order('created_at', { ascending:false });
        if (error) throw error; return data || [];
      } catch (e) { if (isStructuralError(e)) forceLocalMode('listListings'); else throw e; }
    }
    const store = seedLocal();
    return store.listings || [];
  },
  async createListing(payload) {
    if (supabaseReady()) {
      try {
        const { data, error } = await sb.from('marketplace_listings').insert(payload).select().single();
        if (error) throw error; return data;
      } catch (e) { if (isStructuralError(e)) forceLocalMode('createListing'); else throw e; }
    }
    const store = seedLocal();
    const row = { id: uid(), created_at: Date.now(), status:'available', ...payload };
    store.listings.push(row); lsWrite(CONFIG.LS_KEY, store); return row;
  },
  async listApplications() {
    if (supabaseReady()) {
      try {
        const { data, error } = await sb.from('apprentice_applications').select('*').order('created_at', { ascending:false });
        if (error) throw error; return data || [];
      } catch (e) { if (isStructuralError(e)) forceLocalMode('listApplications'); else throw e; }
    }
    const store = seedLocal();
    return (store.applications || []).filter(a =>
      a.applicant_id === state.user?.id || a.mentor_id === state.user?.id);
  },
  async createApplication(payload) {
    if (supabaseReady()) {
      try {
        const { data, error } = await sb.from('apprentice_applications').insert(payload).select().single();
        if (error) throw error; return data;
      } catch (e) { if (isStructuralError(e)) forceLocalMode('createApplication'); else throw e; }
    }
    const store = seedLocal();
    const row = { id: uid(), created_at: Date.now(), status:'pending', ...payload };
    store.applications.push(row); lsWrite(CONFIG.LS_KEY, store); return row;
  }
};

/* =============================================================
   AUTH
   ============================================================= */
function showAuthError(msg) {
  const el = $('auth-error'); if (!el) return;
  el.textContent = msg; el.classList.remove('hidden');
}
function hideAuthError() { $('auth-error')?.classList.add('hidden'); }

async function handleLogin(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
  hideAuthError();
  const email = ($('auth-email')?.value || '').trim();
  const password = $('auth-password')?.value || '';
  const role = $('auth-role')?.value || 'client';
  console.log('[StitchLuxe] login attempt', { email, role, mode: useLocal ? 'LOCAL' : 'SUPABASE' });
  if (!email) return showAuthError('Please enter your email.');
  if (password.length < 6) return showAuthError('Password must be at least 6 characters.');
  try {
    const { user, profile } = await db.signIn(email, password, role);
    startSession({
      id: user.id, email,
      full_name: profile?.full_name || email.split('@')[0],
      role: profile?.role || role
    });
  } catch (err) {
    console.error('[StitchLuxe] sign-in failed', err);
    showAuthError(err?.message || 'Sign-in failed. Check your credentials.');
  }
}

async function handleSignup() {
  hideAuthError();
  const name = ($('auth-name')?.value || '').trim();
  const email = ($('auth-email')?.value || '').trim();
  const password = $('auth-password')?.value || '';
  const role = $('auth-role')?.value || 'client';
  if (!name) return showAuthError('Please enter your full name.');
  if (!email) return showAuthError('Please enter your email.');
  if (password.length < 6) return showAuthError('Password must be at least 6 characters.');
  try {
    const { user, profile } = await db.signUp(email, password, name, role);
    startSession({ id: user.id || 'local-' + Date.now(), email, full_name: name, role: profile?.role || role });
    toast('Welcome to StitchLuxe!', 'success');
  } catch (err) {
    console.error('[StitchLuxe] signup failed', err);
    showAuthError(err?.message || 'Signup failed. Try a different email.');
  }
}

function handleDemo() {
  if ($('auth-email'))    $('auth-email').value    = 'designer@stitchluxe.com';
  if ($('auth-password')) $('auth-password').value = 'stitchluxe123';
  if ($('auth-role'))     $('auth-role').value     = 'client';
  handleLogin();
}

function startSession(user) {
  state.user = user;
  const gate = $('auth-gate');
  const shell = $('app-shell');
  if (gate) gate.classList.add('hidden');
  if (shell) {
    shell.classList.remove('hidden');
    shell.style.display = 'flex';
    shell.style.flexDirection = 'column';
  }
  lsWrite(CONFIG.LS_SESSION, user);
  if ($('user-name-display')) $('user-name-display').textContent = user.full_name || user.email;
  if ($('user-role-display')) $('user-role-display').textContent = user.role;
  if ($('user-avatar'))       $('user-avatar').textContent = initials(user.full_name || user.email);
  refreshAll().catch(err => console.warn('[StitchLuxe] refreshAll error:', err));
}

async function handleLogout() {
  try { await db.signOut(); } catch {}
  state.user = null;
  const shell = $('app-shell'), gate = $('auth-gate');
  if (shell) { shell.classList.add('hidden'); shell.style.display = 'none'; }
  if (gate)  { gate.classList.remove('hidden'); gate.style.display = 'flex'; }
  toast('Signed out.', 'info');
}

/* =============================================================
   TABS
   ============================================================= */
function switchTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b =>
    b.classList.toggle('tab-active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
  $('tab-' + tab)?.classList.remove('hidden');
  if (tab === 'payments')   renderPayments();
  if (tab === 'market')     renderMarket();
  if (tab === 'apprentice') renderApplications();
}

/* =============================================================
   RENDER: ORDERS
   ============================================================= */
function renderOrders() {
  const root = $('list-root'); if (!root) return;
  const q = ($('order-search')?.value || '').toLowerCase().trim();
  let rows = [...state.orders];
  if (q) rows = rows.filter(o =>
    (String(o.garment_type||'') + ' ' + String(o.description||'')).toLowerCase().includes(q));
  root.innerHTML = '';
  if (!rows.length) {
    root.innerHTML = `<li class="empty-state">No orders yet.<br/>Create your first bespoke order →</li>`;
    return;
  }
  rows.forEach(o => {
    const li = document.createElement('li');
    li.className = 'order-card';
    li.onclick = () => openOrder(o.id);
    const total = MILESTONES.length;
    const pct = Math.round(((o.milestone || 1) / total) * 100);
    const statusClass = o.status === 'completed' ? 'badge-green' : 'badge-gold';
    li.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="font-bold text-sm truncate">${escapeHtml(o.garment_type || 'Garment')}</div>
          <div class="text-xs text-black/50 truncate mt-0.5">${escapeHtml((o.description||'').slice(0,60) || 'No description')}</div>
        </div>
        <span class="badge ${statusClass}">${escapeHtml(o.status || 'pending')}</span>
      </div>
      <div class="mt-3 h-1.5 bg-black/5 rounded-full overflow-hidden">
        <div class="h-full bg-[#c9a227] transition-all" style="width:${pct}%"></div>
      </div>
      <div class="flex justify-between text-[10px] text-black/40 mt-1.5 font-medium">
        <span>Milestone ${o.milestone || 1} of ${total}</span>
        <span class="text-black/70 font-semibold">${money(o.budget)}</span>
      </div>
    `;
    root.appendChild(li);
  });
}

function renderMilestoneBar(order) {
  const bar = $('milestone-bar'); if (!bar) return;
  bar.innerHTML = '';
  MILESTONES.forEach((label, i) => {
    const step = i + 1;
    const span = document.createElement('div');
    let cls = 'ms-step';
    if (step < order.milestone) cls += ' done';
    else if (step === order.milestone) cls += ' active';
    span.className = cls;
    span.textContent = (step < order.milestone ? '✓ ' : '') + label;
    bar.appendChild(span);
  });
}

async function openOrder(orderId) {
  const o = state.orders.find(x => x.id === orderId); if (!o) return;
  state.activeOrderId = orderId;
  $('modal-order')?.classList.remove('hidden');
  if ($('modal-order-title')) $('modal-order-title').textContent = o.garment_type || 'Bespoke Order';
  if ($('modal-order-meta'))  $('modal-order-meta').textContent  =
    `Created ${fmtDate(o.created_at)} · Budget ${money(o.budget)}`;
  renderMilestoneBar(o);

  // Pinterest direct button
  if (o.pinterest_url) {
    const pin = $('modal-pinterest');
    if (pin) {
      pin.href = o.pinterest_url;
      pin.setAttribute('rel', 'noopener noreferrer');
      pin.setAttribute('target', '_blank');
    }
    $('modal-pinterest-wrap')?.classList.remove('hidden');
  } else {
    $('modal-pinterest-wrap')?.classList.add('hidden');
  }

  const m = o.measurements || {};
  const mtxt = ['bust','waist','hips'].filter(k => m[k]).map(k => `${k}: ${m[k]}in`).join(' · ') || '—';
  if ($('modal-measurements')) $('modal-measurements').textContent = mtxt;

  const isTailor = state.user?.role === 'tailor';
  $('btn-request-pay')?.classList.toggle('hidden', !isTailor);
  $('btn-advance-ms')?.classList.toggle('hidden', !isTailor);
  $('pay-request-form')?.classList.add('hidden');

  populateBankSelect();
  await loadChat(orderId);
}

/* Populate tailor-side bank dropdown once */
function populateBankSelect() {
  const sel = $('pr-bank'); if (!sel || sel.dataset.filled === '1') return;
  sel.innerHTML = '<option value="">Select your bank…</option>';
  const commercial = BANKS.filter(b => b.type === 'commercial');
  const fintech = BANKS.filter(b => b.type === 'fintech');
  const optg1 = document.createElement('optgroup'); optg1.label = 'Commercial Banks';
  commercial.forEach(b => optg1.appendChild(new Option(b.name, b.id)));
  const optg2 = document.createElement('optgroup'); optg2.label = 'Fintech / Neobanks';
  fintech.forEach(b => optg2.appendChild(new Option(b.name, b.id)));
  sel.appendChild(optg1); sel.appendChild(optg2);
  sel.dataset.filled = '1';
}

/* =============================================================
   CHAT + PAYMENT RENDERING
   ============================================================= */
async function loadChat(orderId) {
  state.messages[orderId] = await db.listMessages(orderId);
  renderChat();
}

function renderChat() {
  const log = $('chat-log'); if (!log) return;
  const msgs = state.messages[state.activeOrderId] || [];
  log.innerHTML = '';
  if (!msgs.length) {
    log.innerHTML = `<div class="text-xs text-black/40 italic text-center py-6">No messages yet. Start the conversation.</div>`;
    return;
  }
  msgs.forEach(m => {
    const isMe = m.sender_id === state.user.id;
    const wrap = document.createElement('div');
    wrap.className = `flex ${isMe ? 'justify-end' : 'justify-start'}`;

    if (m.message_type === 'payment_request') {
      wrap.classList.add('!justify-start');
      wrap.appendChild(buildPaymentCard(m, isMe));
    } else if (m.message_type === 'ask_payment') {
      wrap.innerHTML = `<div class="bubble-them bg-blue-50 border-blue-200">
        <div class="font-bold text-xs uppercase tracking-wide text-blue-600 mb-1">💬 Payment Question</div>
        <div>${escapeHtml(m.message)}</div>
      </div>`;
    } else if (m.message_type === 'payment_confirmed') {
      wrap.innerHTML = `<div class="bubble-them bg-green-50 border-green-200">
        <div class="font-bold text-xs uppercase tracking-wide text-green-700 mb-1">✓ Payment Confirmed</div>
        <div>${escapeHtml(m.message)}</div>
      </div>`;
    } else if (m.message_type === 'system') {
      wrap.innerHTML = `<div class="text-[11px] text-black/40 italic text-center w-full">${escapeHtml(m.message)}</div>`;
    } else {
      wrap.innerHTML = `<div class="${isMe ? 'bubble-me' : 'bubble-them'}">
        <div class="text-[10px] opacity-70 mb-0.5">${escapeHtml(m.sender_name || '')}</div>
        ${escapeHtml(m.message)}
      </div>`;
    }
    log.appendChild(wrap);
  });
  log.scrollTop = log.scrollHeight;
}

/* Rich payment card with USSD + transfer flow */
function buildPaymentCard(m, isMe) {
  const card = document.createElement('div');
  card.className = 'pay-card';
  const bank = BANKS.find(b => b.id === m.bank_id) || null;
  const bankName = bank?.name || m.bank_name || '—';
  const acct = m.account_number || '—';
  const acctName = m.account_name || '—';
  const amount = Number(m.amount || 0);

  const header = `
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <span class="w-8 h-8 rounded-lg bg-[#c9a227]/20 text-[#7a5c0f] flex items-center justify-center text-sm font-bold">₦</span>
        <span class="text-[11px] font-bold uppercase tracking-wider text-[#7a5c0f]">Payment Request</span>
      </div>
      <span class="badge ${m._paid ? 'badge-green' : 'badge-gold'}">${m._paid ? 'paid' : 'pending'}</span>
    </div>
    <div class="text-3xl font-black tracking-tight serif">${money(amount)}</div>
    ${m.message ? `<div class="text-xs text-black/60 mt-2 italic">"${escapeHtml(m.message)}"</div>` : ''}
  `;

  const details = `
    <div class="mt-4 space-y-2 text-sm bg-[#faf8f3] rounded-xl p-3 border border-black/5">
      <div class="flex items-center justify-between gap-3">
        <span class="text-black/50 text-xs uppercase tracking-wider">Bank</span>
        <span class="font-semibold">${escapeHtml(bankName)}</span>
      </div>
      <div class="flex items-center justify-between gap-3">
        <span class="text-black/50 text-xs uppercase tracking-wider">Account</span>
        <div class="flex items-center gap-2">
          <span class="font-mono font-bold">${escapeHtml(acct)}</span>
          <button class="btn btn-ghost btn-sm !py-1 !px-2 !text-[11px] copy-acct" data-text="${escapeHtml(acct)}">Copy</button>
        </div>
      </div>
      <div class="flex items-center justify-between gap-3">
        <span class="text-black/50 text-xs uppercase tracking-wider">Name</span>
        <span class="font-semibold text-right">${escapeHtml(acctName)}</span>
      </div>
    </div>
  `;

  const actions = !isMe && !m._paid ? `
    <div class="mt-4 grid grid-cols-2 gap-2">
      <button class="btn btn-gold btn-sm pay-ussd-btn">📱 Pay via USSD</button>
      <button class="btn btn-ghost btn-sm pay-transfer-btn">🏦 Bank Transfer</button>
    </div>
    <div class="ussd-panel hidden mt-3"></div>
    <div class="transfer-panel hidden mt-3">
      <div class="text-xs font-bold uppercase tracking-wider text-black/60 mb-2">Transfer details</div>
      <div class="text-xs text-black/60 mb-3">
        Open your bank app or dial your bank's USSD, and send <b>${money(amount)}</b> to the account above.
        Tap <b>Ask tailor</b> in the chat if anything is unclear.
      </div>
      <button class="btn btn-ghost btn-sm w-full mark-paid">✓ I have sent the payment</button>
    </div>
  ` : isMe && !m._paid ? `
    <div class="mt-3 text-xs text-black/50 text-center italic">Waiting for client to confirm payment…</div>
  ` : '';

  card.innerHTML = header + details + actions;

  // Wire copy button
  card.querySelector('.copy-acct')?.addEventListener('click', (e) => {
    e.stopPropagation();
    copyText(acct, e.currentTarget);
  });

  // USSD toggle
  card.querySelector('.pay-ussd-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const panel = card.querySelector('.ussd-panel');
    panel.classList.toggle('hidden');
    if (!panel.dataset.filled) {
      panel.innerHTML = buildUssdPanel(acct, amount);
      panel.dataset.filled = '1';
      wireUssdPanel(panel, acct, amount);
    }
  });

  // Transfer toggle
  card.querySelector('.pay-transfer-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    card.querySelector('.transfer-panel')?.classList.toggle('hidden');
  });

  // Mark paid
  card.querySelector('.mark-paid')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    await db.createMessage({
      order_id: state.activeOrderId,
      sender_id: state.user.id,
      sender_name: 'System',
      message: `Client marked payment of ${money(amount)} as sent. Awaiting tailor confirmation.`,
      message_type: 'payment_confirmed',
      amount
    });
    await loadChat(state.activeOrderId);
    toast('Tailor notified — awaiting confirmation.', 'success');
  });

  return card;
}

/* USSD picker panel — shows all banks with USSD codes pre-filled */
function buildUssdPanel(account, amount) {
  const rows = BANKS.map(b => {
    if (!b.ussd) {
      return `
        <div class="bank-chip" data-bank="${b.id}" data-app="1">
          <span class="bank-dot" style="background:${b.color}"></span>
          <span>${escapeHtml(b.name)}</span>
        </div>`;
    }
    const code = b.ussd.replace('{amount}', amount).replace('{account}', account);
    return `
      <div class="bank-chip" data-bank="${b.id}" data-ussd="${escapeHtml(code)}">
        <span class="bank-dot" style="background:${b.color}"></span>
        <span>${escapeHtml(b.name)}</span>
      </div>`;
  }).join('');

  return `
    <div class="text-xs font-bold uppercase tracking-wider text-black/60 mb-2">Step 1 · Pick your bank</div>
    <div class="bank-grid">${rows}</div>
    <div class="ussd-result hidden mt-4">
      <div class="text-xs font-bold uppercase tracking-wider text-black/60 mb-2">Step 2 · Dial this code</div>
      <div class="ussd-code" id="ussd-display">—</div>
      <button class="btn btn-primary btn-sm w-full mt-3 copy-ussd">Copy USSD code</button>
      <p class="text-[11px] text-black/50 mt-3 text-center leading-relaxed">
        If dialing doesn't work, open your bank app and transfer <b>${money(amount)}</b> to
        <b>${escapeHtml(account)}</b> instead.
      </p>
    </div>
  `;
}

function wireUssdPanel(panel, account, amount) {
  panel.querySelectorAll('.bank-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      panel.querySelectorAll('.bank-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');

      const result = panel.querySelector('.ussd-result');
      const display = panel.querySelector('#ussd-display');
      const copyBtn = panel.querySelector('.copy-ussd');
      result.classList.remove('hidden');

      if (chip.dataset.ussd) {
        display.textContent = chip.dataset.ussd;
        copyBtn.classList.remove('hidden');
        copyBtn.onclick = () => copyText(chip.dataset.ussd, copyBtn);
      } else {
        const bank = BANKS.find(b => b.id === chip.dataset.bank);
        display.textContent = bank?.note || 'Open the app to transfer.';
        copyBtn.classList.add('hidden');
      }
    });
  });
}

async function sendChat() {
  const input = $('chat-input');
  const text = input?.value.trim();
  if (!text || !state.activeOrderId) return;
  input.value = '';
  await db.createMessage({
    order_id: state.activeOrderId,
    sender_id: state.user.id,
    sender_name: state.user.full_name,
    message: text, message_type: 'text'
  });
  await loadChat(state.activeOrderId);
}

async function askBestWayToPay() {
  if (!state.activeOrderId) return;
  await db.createMessage({
    order_id: state.activeOrderId,
    sender_id: state.user.id,
    sender_name: state.user.full_name,
    message: `${state.user.full_name} is asking: please advise the best way to pay — bank transfer or USSD?`,
    message_type: 'ask_payment'
  });
  await loadChat(state.activeOrderId);
  toast('Your tailor has been asked.', 'success');
}

async function sendPaymentRequest() {
  const amount = Number($('pr-amount')?.value);
  const method = $('pr-method')?.value || 'bank_transfer';
  const bankId = $('pr-bank')?.value || '';
  const acctNum = ($('pr-account-number')?.value || '').trim();
  const acctName = ($('pr-account-name')?.value || '').trim();
  const notes = ($('pr-notes')?.value || '').trim();

  if (!amount || amount <= 0) return toast('Enter a valid amount.', 'error');
  if (!bankId)                return toast('Select your bank.', 'error');
  if (!acctNum)               return toast('Enter account number.', 'error');
  if (!acctName)              return toast('Enter account name.', 'error');

  const bank = BANKS.find(b => b.id === bankId);
  const order = state.orders.find(o => o.id === state.activeOrderId);
  if (!order) return;

  await db.createMessage({
    order_id: state.activeOrderId,
    sender_id: state.user.id,
    sender_name: state.user.full_name,
    message: notes || `Please pay ${money(amount)} to complete this order.`,
    message_type: 'payment_request',
    amount, method,
    bank_id: bankId,
    bank_name: bank?.name || '',
    account_number: acctNum,
    account_name: acctName
  });

  await db.createPayment({
    order_id: state.activeOrderId,
    client_id: order.client_id,
    tailor_id: state.user.id,
    amount, method, notes,
    bank_id: bankId,
    bank_name: bank?.name || '',
    account_number: acctNum,
    account_name: acctName,
    status: 'pending'
  });

  $('pay-request-form')?.classList.add('hidden');
  ['pr-amount','pr-account-number','pr-account-name','pr-notes'].forEach(id => {
    const el = $(id); if (el) el.value = '';
  });
  await loadChat(state.activeOrderId);
  toast('Payment request sent to client.', 'success');
}

async function advanceMilestone() {
  const order = state.orders.find(o => o.id === state.activeOrderId);
  if (!order) return;
  if (order.milestone >= MILESTONES.length) return toast('Already at final delivery.', 'warn');
  const next = order.milestone + 1;
  const updated = await db.updateOrder(order.id, {
    milestone: next,
    status: next === MILESTONES.length ? 'completed' : 'in_progress',
    tailor_id: state.user.id
  });
  Object.assign(order, updated || {});
  renderMilestoneBar(order);
  renderOrders();
  await db.createMessage({
    order_id: order.id,
    sender_id: state.user.id,
    sender_name: 'System',
    message: `Milestone advanced to ${next}: ${MILESTONES[next-1]}`,
    message_type: 'system'
  });
  await loadChat(order.id);
  toast(`Advanced to ${MILESTONES[next-1]}`, 'success');
}

/* =============================================================
   RENDER: PAYMENTS TAB (with bank details + quick USSD)
   ============================================================= */
async function renderPayments() {
  state.payments = await db.listPayments();
  const el = $('payments-list'); if (!el) return;
  if (!state.payments.length) {
    el.innerHTML = `<div class="empty-state">No payment requests yet.<br/>Open an order and tap <b>Ask tailor best way to pay</b>.</div>`;
    return;
  }
  el.innerHTML = '';
  state.payments.forEach(p => {
    const card = document.createElement('div');
    card.className = 'surface-soft p-4 border border-black/5';
    const bank = BANKS.find(b => b.id === p.bank_id);
    card.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="text-xl font-black serif">${money(p.amount)}</div>
          <div class="text-xs text-black/50 mt-1">
            ${escapeHtml(bank?.name || p.bank_name || 'Bank')} · <span class="font-mono">${escapeHtml(p.account_number||'—')}</span>
          </div>
          ${p.notes ? `<div class="text-xs text-black/60 mt-1 italic">"${escapeHtml(p.notes)}"</div>` : ''}
        </div>
        <span class="badge ${p.status === 'paid' ? 'badge-green' : p.status === 'failed' ? 'badge-red' : 'badge-gold'}">
          ${escapeHtml(p.status)}
        </span>
      </div>
      ${p.status !== 'paid' && p.account_number ? `
        <div class="mt-3 flex gap-2">
          <button class="btn btn-ghost btn-sm flex-1 quick-ussd">📱 USSD options</button>
          <button class="btn btn-ghost btn-sm flex-1 quick-copy">Copy account</button>
        </div>
        <div class="quick-ussd-panel hidden mt-3"></div>
      ` : ''}
    `;

    card.querySelector('.quick-copy')?.addEventListener('click', (e) =>
      copyText(p.account_number || '', e.currentTarget));

    card.querySelector('.quick-ussd')?.addEventListener('click', (e) => {
      const panel = card.querySelector('.quick-ussd-panel');
      panel.classList.toggle('hidden');
      if (!panel.dataset.filled) {
        panel.innerHTML = buildUssdPanel(p.account_number || '', p.amount || 0);
        panel.dataset.filled = '1';
        wireUssdPanel(panel, p.account_number || '', p.amount || 0);
      }
    });

    el.appendChild(card);
  });
}

/* =============================================================
   RENDER: MARKET
   ============================================================= */
async function renderMarket() {
  state.listings = await db.listListings();
  const q = ($('market-search')?.value || '').toLowerCase().trim();
  let items = state.listings;
  if (q) items = items.filter(l =>
    (String(l.title||'') + ' ' + String(l.description||'')).toLowerCase().includes(q));
  const grid = $('market-grid'); if (!grid) return;
  if (!items.length) {
    grid.innerHTML = `<div class="col-span-full empty-state">No listings yet. Be the first to list a pre-loved piece.</div>`;
    return;
  }
  grid.innerHTML = items.map(l => `
    <div class="surface overflow-hidden group">
      <div class="aspect-square bg-[#f3efe4] flex items-center justify-center text-5xl text-black/15">
        ${l.image_url
          ? `<img src="${escapeHtml(l.image_url)}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onerror="this.style.display='none';this.parentElement.textContent='👜'" />`
          : '👜'}
      </div>
      <div class="p-4">
        <div class="font-bold text-sm truncate">${escapeHtml(l.title)}</div>
        <div class="text-xs text-black/50 truncate mt-0.5">${escapeHtml(l.size||'')} · ${escapeHtml(l.condition||'')}</div>
        <div class="flex items-center justify-between mt-3">
          <div class="font-black text-base">${money(l.price)}</div>
          <span class="badge ${l.status==='available'?'badge-green':'badge-gray'}">${escapeHtml(l.status)}</span>
        </div>
      </div>
    </div>
  `).join('');
}

/* =============================================================
   RENDER: APPLICATIONS
   ============================================================= */
async function renderApplications() {
  state.applications = await db.listApplications();
  const el = $('apps-list'); if (!el) return;
  if (!state.applications.length) {
    el.innerHTML = `<li class="empty-state">No applications yet.</li>`;
    return;
  }
  el.innerHTML = state.applications.map(a => `
    <li class="surface-soft p-4">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="font-bold text-sm">${escapeHtml(a.full_name||'Applicant')}</div>
          <div class="text-xs text-black/50 truncate mt-0.5">${escapeHtml(a.email||'')} · ${a.years_experience || 0} yr exp</div>
          ${a.portfolio_url
            ? `<a href="${escapeHtml(a.portfolio_url)}" target="_blank" rel="noopener" class="text-xs text-[#8a6d00] underline mt-1 inline-block">Portfolio →</a>`
            : ''}
        </div>
        <span class="badge ${a.status==='accepted'?'badge-green':a.status==='rejected'?'badge-red':'badge-gold'}">${escapeHtml(a.status)}</span>
      </div>
    </li>
  `).join('');
}

/* =============================================================
   FORM HANDLERS
   ============================================================= */
async function submitOrder(e) {
  e.preventDefault();
  const payload = {
    client_id: state.user.id,
    garment_type: $('order-garment')?.value || '',
    description:  $('order-desc')?.value.trim() || '',
    pinterest_url:$('order-pinterest')?.value.trim() || '',
    measurements: {
      bust:  $('m-bust')?.value  ? Number($('m-bust').value)  : null,
      waist: $('m-waist')?.value ? Number($('m-waist').value) : null,
      hips:  $('m-hips')?.value  ? Number($('m-hips').value)  : null
    },
    budget: Number($('order-budget')?.value) || 0,
    milestone: 1, status: 'pending'
  };
  if (!payload.garment_type) return toast('Please select a garment type.', 'error');
  const row = await db.createOrder(payload);
  state.orders.unshift(row);
  e.target.reset();
  renderOrders();
  toast('Bespoke order submitted.', 'success');
}

async function submitListing(e) {
  e.preventDefault();
  const payload = {
    seller_id:   state.user.id,
    seller_name: state.user.full_name,
    title:       $('list-title')?.value.trim() || '',
    description: $('list-desc')?.value.trim() || '',
    price:       Number($('list-price')?.value) || 0,
    size:        $('list-size')?.value.trim() || '',
    condition:   $('list-condition')?.value || '',
    image_url:   $('list-image')?.value.trim() || '',
    status:      'available'
  };
  if (!payload.title || !payload.price) return toast('Title and price required.', 'error');
  const row = await db.createListing(payload);
  state.listings.unshift(row);
  e.target.reset();
  renderMarket();
  toast('Listing published.', 'success');
}

async function submitApplication(e) {
  e.preventDefault();
  const payload = {
    applicant_id: state.user.id, mentor_id: null,
    full_name: $('app-name')?.value.trim() || '',
    email: $('app-email')?.value.trim() || '',
    portfolio_url: $('app-portfolio')?.value.trim() || '',
    cover_letter: $('app-cover')?.value.trim() || '',
    years_experience: Number($('app-years')?.value) || 0,
    status: 'pending'
  };
  if (!payload.full_name || !payload.email) return toast('Name and email are required.', 'error');
  const row = await db.createApplication(payload);
  state.applications.unshift(row);
  e.target.reset();
  renderApplications();
  toast('Application submitted.', 'success');
}

/* =============================================================
   REFRESH
   ============================================================= */
async function refreshAll() {
  if (!state.user) return;
  try {
    state.orders       = await db.listOrders();
    state.listings     = await db.listListings();
    state.applications = await db.listApplications();
    state.payments     = await db.listPayments();
    renderOrders(); renderMarket(); renderApplications(); renderPayments();
  } catch (err) { console.error('[StitchLuxe] refresh error', err); }
}

/* =============================================================
   INIT
   ============================================================= */
function init() {
  const yearEl = $('footer-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
  console.log('[StitchLuxe] init · mode:', useLocal ? 'LOCAL FALLBACK' : 'SUPABASE');

  try {
    const saved = lsRead(CONFIG.LS_SESSION, null);
    if (saved?.id && saved?.email) {
      console.log('[StitchLuxe] restoring session for', saved.email);
      startSession(saved);
    }
  } catch (e) { console.warn('[StitchLuxe] session restore failed:', e); }

  $('auth-form')?.addEventListener('submit', handleLogin);
  $('btn-signup')?.addEventListener('click', handleSignup);
  $('btn-demo')?.addEventListener('click', handleDemo);
  $('btn-logout')?.addEventListener('click', handleLogout);

  document.querySelectorAll('.tab-btn').forEach(b =>
    b.addEventListener('click', () => switchTab(b.dataset.tab)));

  $('form-order')?.addEventListener('submit', submitOrder);
  $('form-listing')?.addEventListener('submit', submitListing);
  $('form-apprentice')?.addEventListener('submit', submitApplication);

  $('order-search')?.addEventListener('input', renderOrders);
  $('market-search')?.addEventListener('input', renderMarket);

  $('btn-close-order')?.addEventListener('click', () => {
    $('modal-order')?.classList.add('hidden');
    state.activeOrderId = null;
  });
  $('btn-send-chat')?.addEventListener('click', sendChat);
  $('chat-input')?.addEventListener('keypress', e => { if (e.key === 'Enter') sendChat(); });
  $('btn-ask-pay')?.addEventListener('click', askBestWayToPay);
  $('btn-request-pay')?.addEventListener('click', () => {
    populateBankSelect();
    $('pay-request-form')?.classList.toggle('hidden');
  });
  $('btn-cancel-pay-req')?.addEventListener('click', () => $('pay-request-form')?.classList.add('hidden'));
  $('btn-send-pay-req')?.addEventListener('click', sendPaymentRequest);
  $('btn-advance-ms')?.addEventListener('click', advanceMilestone);

  // hygiene
  delete window.STITCHLUXE_SUPABASE_URL;
  delete window.STITCHLUXE_SUPABASE_ANON_KEY;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
