/* =============================================================
   StitchLuxe Extra Lite — app.js  (bulletproof v2.2)
   - Global error boundary
   - Auto-fallback to LOCAL mode on any Supabase structural error
   - Never lets the app get stuck on login
   ============================================================= */

/* ---------- GLOBAL ERROR BOUNDARY (runs before anything else) ---------- */
window.addEventListener('error', (e) => {
  console.error('[GLOBAL ERROR]', e.message, '@', e.filename, ':', e.lineno, ':', e.colno);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[UNHANDLED PROMISE]', e.reason);
});

/* ---------- CONFIG ---------- */
const CONFIG = {
  SUPABASE_URL:        window.STITCHLUXE_SUPABASE_URL      || '',
  SUPABASE_ANON_KEY:   window.STITCHLUXE_SUPABASE_ANON_KEY || '',
  PAYSTACK_PUBLIC_KEY: window.STITCHLUXE_PAYSTACK_KEY      || '',
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

const state = {
  user: null,
  orders: [],
  listings: [],
  applications: [],
  payments: [],
  messages: {},
  activeOrderId: null,
  activeTab: 'orders'
};

/* ---------- UTIL ---------- */
const $ = (id) => document.getElementById(id);
const uid = () => 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const money = (n) => '₦' + Number(n || 0).toLocaleString('en-NG');
const escapeHtml = (s='') => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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
    info:    'bg-black text-white',
    success: 'bg-green-600 text-white',
    error:   'bg-red-600 text-white',
    warn:    'bg-[#c9a227] text-black'
  };
  const el = document.createElement('div');
  el.className = `toast ${colors[type]} text-sm font-medium px-4 py-3 rounded-xl shadow-lg max-w-xs`;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

/* ---------- SAFE LOCALSTORAGE ---------- */
function lsRead(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function lsWrite(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); return true; }
  catch (e) { console.warn('[StitchLuxe] localStorage write failed:', e.name); return false; }
}

/* ---------- SUPABASE CLIENT (with self-heal) ---------- */
let sb = null;
let useLocal = true;

function supabaseReady() {
  return !useLocal
    && sb
    && sb.auth
    && typeof sb.auth.signUp === 'function'
    && typeof sb.auth.signInWithPassword === 'function';
}

function forceLocalMode(reason) {
  if (!useLocal) console.warn('[StitchLuxe] Switching to LOCAL mode:', reason);
  useLocal = true;
  sb = null;
}

if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY && window.supabase) {
  try {
    sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    if (sb && sb.auth && typeof sb.auth.signUp === 'function' && typeof sb.auth.signInWithPassword === 'function') {
      useLocal = false;
      console.log('[StitchLuxe] Supabase client OK — connected to real backend');
    } else {
      console.warn('[StitchLuxe] Supabase client missing .auth — falling back to LOCAL mode');
      sb = null; useLocal = true;
    }
  } catch (e) {
    console.warn('[StitchLuxe] Supabase init threw:', e);
    sb = null; useLocal = true;
  }
}

/* Detect "the library broke" vs "the user typed wrong password" */
function isStructuralError(e) {
  const msg = String(e?.message || e || '');
  return msg.includes('Cannot read properties')
      || msg.includes('is not a function')
      || msg.includes('undefined')
      || msg.includes('Failed to fetch')
      || msg.includes('NetworkError');
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
   UNIFIED DB ADAPTER
   Every Supabase call is wrapped so structural failures
   self-heal into LOCAL mode and retry transparently.
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
        if (isStructuralError(e)) {
          forceLocalMode('signIn: ' + e.message);
        } else {
          throw e;
        }
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
          email, password,
          options: { data: { full_name: fullName, role } }
        });
        if (error) throw error;
        return { user: data.user, profile: { id: data.user?.id, email, full_name: fullName, role } };
      } catch (e) {
        if (isStructuralError(e)) {
          forceLocalMode('signUp: ' + e.message);
        } else {
          throw e;
        }
      }
    }
    const store = seedLocal();
    const profile = { id: uid(), email, full_name: fullName, role: role || 'client' };
    store.profiles[email] = profile;
    lsWrite(CONFIG.LS_KEY, store);
    return { user: { id: profile.id, email }, profile };
  },

  async signOut() {
    if (supabaseReady()) {
      try { await sb.auth.signOut(); } catch (e) { console.warn('[StitchLuxe] signOut error:', e); }
    }
    try { localStorage.removeItem(CONFIG.LS_SESSION); } catch {}
  },

  async listOrders() {
    if (supabaseReady()) {
      try {
        const { data, error } = await sb.from('bespoke_orders').select('*').order('created_at', { ascending:false });
        if (error) throw error;
        return data || [];
      } catch (e) {
        if (isStructuralError(e)) forceLocalMode('listOrders');
        else throw e;
      }
    }
    const store = seedLocal();
    return (store.orders || []).filter(o =>
      o.client_id === state.user?.id || o.tailor_id === state.user?.id || !o.tailor_id);
  },

  async createOrder(payload) {
    if (supabaseReady()) {
      try {
        const { data, error } = await sb.from('bespoke_orders').insert(payload).select().single();
        if (error) throw error;
        return data;
      } catch (e) {
        if (isStructuralError(e)) forceLocalMode('createOrder');
        else throw e;
      }
    }
    const store = seedLocal();
    const row = { id: uid(), created_at: Date.now(), updated_at: Date.now(), milestone: 1, status:'pending', ...payload };
    store.orders.push(row);
    lsWrite(CONFIG.LS_KEY, store);
    return row;
  },

  async updateOrder(id, patch) {
    if (supabaseReady()) {
      try {
        const { data, error } = await sb.from('bespoke_orders')
          .update({ ...patch, updated_at: new Date().toISOString() })
          .eq('id', id).select().single();
        if (error) throw error;
        return data;
      } catch (e) {
        if (isStructuralError(e)) forceLocalMode('updateOrder');
        else throw e;
      }
    }
    const store = seedLocal();
    const idx = store.orders.findIndex(o => o.id === id);
    if (idx >= 0) {
      store.orders[idx] = { ...store.orders[idx], ...patch, updated_at: Date.now() };
      lsWrite(CONFIG.LS_KEY, store);
      return store.orders[idx];
    }
  },

  async listMessages(orderId) {
    if (supabaseReady()) {
      try {
        const { data, error } = await sb.from('order_messages').select('*')
          .eq('order_id', orderId).order('created_at', { ascending:true });
        if (error) throw error;
        return data || [];
      } catch (e) {
        if (isStructuralError(e)) forceLocalMode('listMessages');
        else throw e;
      }
    }
    const store = seedLocal();
    return store.messages[orderId] || [];
  },

  async createMessage(payload) {
    if (supabaseReady()) {
      try {
        const { data, error } = await sb.from('order_messages').insert(payload).select().single();
        if (error) throw error;
        return data;
      } catch (e) {
        if (isStructuralError(e)) forceLocalMode('createMessage');
        else throw e;
      }
    }
    const store = seedLocal();
    const row = { id: uid(), created_at: Date.now(), ...payload };
    store.messages[row.order_id] = [...(store.messages[row.order_id] || []), row];
    lsWrite(CONFIG.LS_KEY, store);
    return row;
  },

  async listPayments() {
    if (supabaseReady()) {
      try {
        const { data, error } = await sb.from('payment_requests').select('*').order('created_at', { ascending:false });
        if (error) throw error;
        return data || [];
      } catch (e) {
        if (isStructuralError(e)) forceLocalMode('listPayments');
        else throw e;
      }
    }
    const store = seedLocal();
    return (store.payments || []).filter(p =>
      p.client_id === state.user?.id || p.tailor_id === state.user?.id);
  },

  async createPayment(payload) {
    if (supabaseReady()) {
      try {
        const { data, error } = await sb.from('payment_requests').insert(payload).select().single();
        if (error) throw error;
        return data;
      } catch (e) {
        if (isStructuralError(e)) forceLocalMode('createPayment');
        else throw e;
      }
    }
    const store = seedLocal();
    const row = { id: uid(), created_at: Date.now(), status:'pending', ...payload };
    store.payments.push(row);
    lsWrite(CONFIG.LS_KEY, store);
    return row;
  },

  async updatePayment(id, patch) {
    if (supabaseReady()) {
      try {
        const { data, error } = await sb.from('payment_requests').update(patch).eq('id', id).select().single();
        if (error) throw error;
        return data;
      } catch (e) {
        if (isStructuralError(e)) forceLocalMode('updatePayment');
        else throw e;
      }
    }
    const store = seedLocal();
    const idx = store.payments.findIndex(p => p.id === id);
    if (idx >= 0) {
      store.payments[idx] = { ...store.payments[idx], ...patch };
      lsWrite(CONFIG.LS_KEY, store);
      return store.payments[idx];
    }
  },

  async listListings() {
    if (supabaseReady()) {
      try {
        const { data, error } = await sb.from('marketplace_listings').select('*').order('created_at', { ascending:false });
        if (error) throw error;
        return data || [];
      } catch (e) {
        if (isStructuralError(e)) forceLocalMode('listListings');
        else throw e;
      }
    }
    const store = seedLocal();
    return store.listings || [];
  },

  async createListing(payload) {
    if (supabaseReady()) {
      try {
        const { data, error } = await sb.from('marketplace_listings').insert(payload).select().single();
        if (error) throw error;
        return data;
      } catch (e) {
        if (isStructuralError(e)) forceLocalMode('createListing');
        else throw e;
      }
    }
    const store = seedLocal();
    const row = { id: uid(), created_at: Date.now(), status:'available', ...payload };
    store.listings.push(row);
    lsWrite(CONFIG.LS_KEY, store);
    return row;
  },

  async listApplications() {
    if (supabaseReady()) {
      try {
        const { data, error } = await sb.from('apprentice_applications').select('*').order('created_at', { ascending:false });
        if (error) throw error;
        return data || [];
      } catch (e) {
        if (isStructuralError(e)) forceLocalMode('listApplications');
        else throw e;
      }
    }
    const store = seedLocal();
    return (store.applications || []).filter(a =>
      a.applicant_id === state.user?.id || a.mentor_id === state.user?.id);
  },

  async createApplication(payload) {
    if (supabaseReady()) {
      try {
        const { data, error } = await sb.from('apprentice_applications').insert(payload).select().single();
        if (error) throw error;
        return data;
      } catch (e) {
        if (isStructuralError(e)) forceLocalMode('createApplication');
        else throw e;
      }
    }
    const store = seedLocal();
    const row = { id: uid(), created_at: Date.now(), status:'pending', ...payload };
    store.applications.push(row);
    lsWrite(CONFIG.LS_KEY, store);
    return row;
  }
};

/* =============================================================
   AUTH UI HANDLERS
   ============================================================= */
function showAuthError(msg) {
  const el = $('auth-error');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
}
function hideAuthError() {
  const el = $('auth-error');
  if (el) el.classList.add('hidden');
}

async function handleLogin(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
  hideAuthError();

  const email    = ($('auth-email')?.value || '').trim();
  const password = $('auth-password')?.value || '';
  const role     = $('auth-role')?.value || 'client';

  console.log('[StitchLuxe] login attempt', { email, role, mode: useLocal ? 'LOCAL' : 'SUPABASE' });

  if (!email)              return showAuthError('Please enter your email.');
  if (password.length < 6) return showAuthError('Password must be at least 6 characters.');

  try {
    const { user, profile } = await db.signIn(email, password, role);
    console.log('[StitchLuxe] sign-in resolved', { user, profile });
    startSession({
      id:        user.id,
      email,
      full_name: profile?.full_name || email.split('@')[0],
      role:      profile?.role || role
    });
  } catch (err) {
    console.error('[StitchLuxe] sign-in failed', err);
    showAuthError(err?.message || 'Sign-in failed. Check your credentials.');
  }
}

async function handleSignup() {
  hideAuthError();
  const name     = ($('auth-name')?.value || '').trim();
  const email    = ($('auth-email')?.value || '').trim();
  const password = $('auth-password')?.value || '';
  const role     = $('auth-role')?.value || 'client';

  if (!name)               return showAuthError('Please enter your full name to create an account.');
  if (!email)              return showAuthError('Please enter your email.');
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
  const e = $('auth-email'); if (e) e.value = 'designer@stitchluxe.com';
  const p = $('auth-password'); if (p) p.value = 'stitchluxe123';
  const r = $('auth-role'); if (r) r.value = 'client';
  handleLogin();
}

/* =============================================================
   SESSION START — UI first, storage second. Never stuck.
   ============================================================= */
function startSession(user) {
  state.user = user;

  // 1) swap UI FIRST
  const gate  = $('auth-gate');
  const shell = $('app-shell');
  if (gate)  gate.classList.add('hidden');
  if (shell) {
    shell.classList.remove('hidden');
    shell.style.display = 'flex';
    shell.style.flexDirection = 'column';
  }

  // 2) persist best-effort
  const persisted = lsWrite(CONFIG.LS_SESSION, user);
  if (!persisted) console.warn('[StitchLuxe] Session not persisted — will need re-login after refresh.');

  // 3) header identity
  const nameEl   = $('user-name-display');
  const roleEl   = $('user-role-display');
  const avatarEl = $('user-avatar');
  if (nameEl)   nameEl.textContent   = user.full_name || user.email;
  if (roleEl)   roleEl.textContent   = user.role;
  if (avatarEl) avatarEl.textContent = initials(user.full_name || user.email);

  // 4) hydrate rest
  refreshAll().catch(err => console.warn('[StitchLuxe] refreshAll error:', err));
}

async function handleLogout() {
  try { await db.signOut(); } catch (e) { console.warn('[StitchLuxe] logout error:', e); }
  state.user = null;
  const shell = $('app-shell');
  const gate  = $('auth-gate');
  if (shell) { shell.classList.add('hidden'); shell.style.display = 'none'; }
  if (gate)  { gate.classList.remove('hidden'); gate.style.display = 'flex'; }
  toast('Signed out.', 'info');
}

/* =============================================================
   TABS
   ============================================================= */
function switchTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('tab-active', b.dataset.tab === tab);
  });
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
  const panel = $('tab-' + tab);
  if (panel) panel.classList.remove('hidden');

  if (tab === 'payments')   renderPayments();
  if (tab === 'market')     renderMarket();
  if (tab === 'apprentice') renderApplications();
}

/* =============================================================
   RENDER: ORDERS
   ============================================================= */
function renderOrders() {
  const root = $('list-root');
  if (!root) return;
  const q = ($('order-search')?.value || '').toLowerCase().trim();
  let rows = [...state.orders];
  if (q) rows = rows.filter(o => (String(o.garment_type||'') + ' ' + String(o.description||'')).toLowerCase().includes(q));
  root.innerHTML = '';
  if (!rows.length) {
    root.innerHTML = `<li class="text-sm text-black/40 italic text-center py-8">No orders yet. Create your first bespoke order.</li>`;
    return;
  }
  rows.forEach(o => {
    const li = document.createElement('li');
    li.className = 'bg-[#faf8f3] rounded-xl p-4 cursor-pointer hover:bg-[#f5f2ea] transition border border-black/5';
    li.onclick = () => openOrder(o.id);
    const total = MILESTONES.length;
    const pct = Math.round(((o.milestone || 1) / total) * 100);
    li.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="font-semibold text-sm truncate">${escapeHtml(o.garment_type || 'Garment')}</div>
          <div class="text-xs text-black/50 truncate mt-0.5">${escapeHtml((o.description||'').slice(0,50) || 'No description')}</div>
        </div>
        <span class="badge ${o.status==='completed'?'bg-green-100 text-green-700':'bg-[#c9a227]/20 text-[#8a6d00]'}">${escapeHtml(o.status || 'pending')}</span>
      </div>
      <div class="mt-3 h-1.5 bg-black/5 rounded-full overflow-hidden">
        <div class="h-full bg-[#c9a227]" style="width:${pct}%"></div>
      </div>
      <div class="flex justify-between text-[10px] text-black/40 mt-1">
        <span>Milestone ${o.milestone || 1}/${total}</span>
        <span>${money(o.budget)}</span>
      </div>
    `;
    root.appendChild(li);
  });
}

function renderMilestoneBar(order) {
  const bar = $('milestone-bar');
  if (!bar) return;
  bar.innerHTML = '';
  MILESTONES.forEach((label, i) => {
    const step = i + 1;
    const span = document.createElement('div');
    let cls = 'ms-step flex-1 text-[9px] sm:text-[10px] font-semibold text-center py-1.5 px-1 rounded-md bg-black/5 text-black/50 transition';
    if (step < order.milestone)       cls += ' done';
    else if (step === order.milestone) cls += ' active';
    span.className = cls;
    span.textContent = (step < order.milestone ? '✓ ' : '') + label;
    span.title = label;
    bar.appendChild(span);
  });
}

async function openOrder(orderId) {
  const o = state.orders.find(x => x.id === orderId);
  if (!o) return;
  state.activeOrderId = orderId;

  $('modal-order')?.classList.remove('hidden');
  if ($('modal-order-title')) $('modal-order-title').textContent = o.garment_type || 'Bespoke Order';
  if ($('modal-order-meta'))  $('modal-order-meta').textContent  = `Created ${fmtDate(o.created_at)} • Budget ${money(o.budget)}`;

  renderMilestoneBar(o);

  if (o.pinterest_url) {
    if ($('modal-pinterest')) $('modal-pinterest').href = o.pinterest_url;
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

  await loadChat(orderId);
}

async function loadChat(orderId) {
  state.messages[orderId] = await db.listMessages(orderId);
  renderChat();
}

function renderChat() {
  const log = $('chat-log');
  if (!log) return;
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
    let bubble;
    if (m.message_type === 'payment_request') {
      bubble = `
        <div class="max-w-[85%] bg-[#c9a227]/15 border border-[#c9a227]/40 rounded-2xl p-3 text-sm">
          <div class="font-bold text-xs uppercase tracking-wide text-[#8a6d00] mb-1">💳 Payment Request</div>
          <div class="font-bold">${money(m.amount)}</div>
          <div class="text-xs text-black/60 mt-1">Method: <b>${escapeHtml((m.method||'').replace(/_/g,' '))}</b></div>
          ${m.message ? `<div class="text-xs text-black/60 mt-1">${escapeHtml(m.message)}</div>` : ''}
          ${isMe ? '' : `<button class="mt-2 bg-black text-white text-xs font-semibold px-3 py-1.5 rounded-lg pay-now" data-amount="${m.amount}" data-method="${m.method}">Pay Now</button>`}
        </div>`;
    } else if (m.message_type === 'ask_payment') {
      bubble = `<div class="max-w-[85%] bg-blue-50 border border-blue-200 rounded-2xl p-3 text-sm">
        <div class="font-bold text-xs uppercase tracking-wide text-blue-600 mb-1">💬 Payment Question</div>
        <div>${escapeHtml(m.message)}</div>
      </div>`;
    } else if (m.message_type === 'system') {
      bubble = `<div class="text-[11px] text-black/40 italic text-center w-full">${escapeHtml(m.message)}</div>`;
    } else {
      bubble = `<div class="max-w-[85%] ${isMe?'bg-black text-white':'bg-white border border-black/10'} rounded-2xl px-3 py-2 text-sm">
        <div class="text-[10px] opacity-70 mb-0.5">${escapeHtml(m.sender_name || '')}</div>
        ${escapeHtml(m.message)}
      </div>`;
    }
    wrap.innerHTML = bubble;
    log.appendChild(wrap);
  });
  log.scrollTop = log.scrollHeight;
  log.querySelectorAll('.pay-now').forEach(b => {
    b.onclick = () => startPaystack(Number(b.dataset.amount), b.dataset.method);
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
    message: text,
    message_type: 'text'
  });
  await loadChat(state.activeOrderId);
}

async function askBestWayToPay() {
  if (!state.activeOrderId) return;
  await db.createMessage({
    order_id: state.activeOrderId,
    sender_id: state.user.id,
    sender_name: state.user.full_name,
    message: `${state.user.full_name} is asking: please advise the best way to pay for this order.`,
    message_type: 'ask_payment'
  });
  await loadChat(state.activeOrderId);
  toast('Your tailor has been asked. Await their payment options.', 'success');
}

async function sendPaymentRequest() {
  const amount = Number($('pr-amount')?.value);
  const method = $('pr-method')?.value || 'bank_transfer';
  const notes  = $('pr-notes')?.value.trim() || '';
  if (!amount || amount <= 0) return toast('Enter a valid amount.', 'error');
  const order = state.orders.find(o => o.id === state.activeOrderId);
  if (!order) return;

  await db.createMessage({
    order_id: state.activeOrderId,
    sender_id: state.user.id,
    sender_name: state.user.full_name,
    message: notes || `Payment requested via ${method.replace('_',' ')}`,
    message_type: 'payment_request',
    amount, method
  });

  await db.createPayment({
    order_id: state.activeOrderId,
    client_id: order.client_id,
    tailor_id: state.user.id,
    amount, method, notes
  });

  $('pay-request-form')?.classList.add('hidden');
  if ($('pr-amount')) $('pr-amount').value = '';
  if ($('pr-notes'))  $('pr-notes').value = '';

  await loadChat(state.activeOrderId);
  toast('Payment request sent.', 'success');
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
   PAYSTACK
   ============================================================= */
function startPaystack(amount, method) {
  if (method !== 'paystack_card') {
    toast(`Follow the ${String(method||'').replace('_',' ')} instructions from your tailor.`, 'info');
    return;
  }
  if (typeof PaystackPop === 'undefined') {
    return toast('Paystack SDK not loaded.', 'error');
  }
  if (!CONFIG.PAYSTACK_PUBLIC_KEY || CONFIG.PAYSTACK_PUBLIC_KEY.includes('PASTE')) {
    return toast('Paystack key not configured.', 'warn');
  }
  const ref = 'SLX-' + Date.now();
  const handler = PaystackPop.setup({
    key: CONFIG.PAYSTACK_PUBLIC_KEY,
    email: state.user.email,
    amount: Math.round(amount * 100),
    currency: 'NGN',
    ref,
    metadata: {
      order_id: state.activeOrderId,
      custom_fields: [
        { display_name: 'Order', variable_name: 'order_id', value: state.activeOrderId || '' }
      ]
    },
    callback: async function (response) {
      toast('Payment successful! Ref: ' + response.reference, 'success');
      await db.createMessage({
        order_id: state.activeOrderId,
        sender_id: state.user.id,
        sender_name: 'System',
        message: `Card payment confirmed (${money(amount)}) — Ref: ${response.reference}`,
        message_type: 'payment_confirmed',
        amount, method: 'paystack_card'
      });
      const pending = state.payments.filter(p => p.order_id === state.activeOrderId && p.status === 'pending');
      for (const p of pending) await db.updatePayment(p.id, { status: 'paid', paystack_ref: response.reference });
      await loadChat(state.activeOrderId);
      await renderPayments();
    },
    onClose: function () { toast('Payment window closed.', 'info'); }
  });
  handler.openIframe();
}

/* =============================================================
   RENDER: PAYMENTS
   ============================================================= */
async function renderPayments() {
  state.payments = await db.listPayments();
  const el = $('payments-list');
  if (!el) return;
  if (!state.payments.length) {
    el.innerHTML = `<div class="text-sm text-black/40 italic text-center py-8">No payment requests yet. Open an order and ask your tailor how best to pay.</div>`;
    return;
  }
  el.innerHTML = state.payments.map(p => `
    <div class="bg-[#faf8f3] rounded-xl p-4 border border-black/5 flex items-center justify-between gap-4">
      <div class="min-w-0">
        <div class="text-sm font-semibold">${money(p.amount)}</div>
        <div class="text-xs text-black/50 mt-0.5">Method: <b>${escapeHtml((p.method||'').replace(/_/g,' '))}</b> • ${escapeHtml(p.notes||'')}</div>
      </div>
      <span class="badge ${p.status==='paid'?'bg-green-100 text-green-700':p.status==='failed'?'bg-red-100 text-red-700':'bg-[#c9a227]/20 text-[#8a6d00]'}">${escapeHtml(p.status)}</span>
    </div>
  `).join('');
}

/* =============================================================
   RENDER: MARKET
   ============================================================= */
async function renderMarket() {
  state.listings = await db.listListings();
  const q = ($('market-search')?.value || '').toLowerCase().trim();
  let items = state.listings;
  if (q) items = items.filter(l => (String(l.title||'') + ' ' + String(l.description||'')).toLowerCase().includes(q));
  const grid = $('market-grid');
  if (!grid) return;
  if (!items.length) {
    grid.innerHTML = `<div class="col-span-full text-sm text-black/40 italic text-center py-8">No listings yet. Be the first to list a pre-loved piece.</div>`;
    return;
  }
  grid.innerHTML = items.map(l => `
    <div class="bg-white rounded-2xl border border-black/5 overflow-hidden shadow-sm hover:shadow-md transition">
      <div class="aspect-square bg-black/5 flex items-center justify-center text-4xl text-black/20">
        ${l.image_url ? `<img src="${escapeHtml(l.image_url)}" class="w-full h-full object-cover" onerror="this.style.display='none';this.parentElement.textContent='👜'" />` : '👜'}
      </div>
      <div class="p-3">
        <div class="font-semibold text-sm truncate">${escapeHtml(l.title)}</div>
        <div class="text-xs text-black/50 truncate mt-0.5">${escapeHtml(l.size||'')} • ${escapeHtml(l.condition||'')}</div>
        <div class="flex items-center justify-between mt-2">
          <div class="font-bold text-sm">${money(l.price)}</div>
          <span class="badge ${l.status==='available'?'bg-green-100 text-green-700':'bg-black/10 text-black/50'}">${escapeHtml(l.status)}</span>
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
  const el = $('apps-list');
  if (!el) return;
  if (!state.applications.length) {
    el.innerHTML = `<li class="text-sm text-black/40 italic text-center py-8">No applications yet.</li>`;
    return;
  }
  el.innerHTML = state.applications.map(a => `
    <li class="bg-[#faf8f3] rounded-xl p-4 border border-black/5">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="font-semibold text-sm">${escapeHtml(a.full_name||'Applicant')}</div>
          <div class="text-xs text-black/50 truncate">${escapeHtml(a.email||'')} • ${a.years_experience || 0} yr exp</div>
          ${a.portfolio_url ? `<a href="${escapeHtml(a.portfolio_url)}" target="_blank" class="text-xs text-[#8a6d00] underline mt-1 inline-block">Portfolio →</a>` : ''}
        </div>
        <span class="badge ${a.status==='accepted'?'bg-green-100 text-green-700':a.status==='rejected'?'bg-red-100 text-red-700':'bg-[#c9a227]/20 text-[#8a6d00]'}">${escapeHtml(a.status)}</span>
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
    milestone: 1,
    status: 'pending'
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
    applicant_id: state.user.id,
    mentor_id:    null,
    full_name:    $('app-name')?.value.trim() || '',
    email:        $('app-email')?.value.trim() || '',
    portfolio_url:$('app-portfolio')?.value.trim() || '',
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
    renderOrders();
    renderMarket();
    renderApplications();
    renderPayments();
  } catch (err) {
    console.error('[StitchLuxe] refresh error', err);
  }
}

/* =============================================================
   INIT
   ============================================================= */
function init() {
  const yearEl = $('footer-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  console.log('[StitchLuxe] init • mode:', useLocal ? 'LOCAL FALLBACK' : 'SUPABASE');

  try {
    const saved = lsRead(CONFIG.LS_SESSION, null);
    if (saved && saved.id && saved.email) {
      console.log('[StitchLuxe] restoring session for', saved.email);
      startSession(saved);
    }
  } catch (e) {
    console.warn('[StitchLuxe] session restore failed:', e);
  }

  $('auth-form')?.addEventListener('submit', handleLogin);
  $('btn-signup')?.addEventListener('click', handleSignup);
  $('btn-demo')?.addEventListener('click', handleDemo);
  $('btn-logout')?.addEventListener('click', handleLogout);

  document.querySelectorAll('.tab-btn').forEach(b => {
    b.addEventListener('click', () => switchTab(b.dataset.tab));
  });

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
  $('btn-request-pay')?.addEventListener('click', () => $('pay-request-form')?.classList.toggle('hidden'));
  $('btn-cancel-pay-req')?.addEventListener('click', () => $('pay-request-form')?.classList.add('hidden'));
  $('btn-send-pay-req')?.addEventListener('click', sendPaymentRequest);
  $('btn-advance-ms')?.addEventListener('click', advanceMilestone);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
