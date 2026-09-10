/* =============================================================
   StitchLuxe Extra Lite — app.js
   Vanilla ES6+ • Supabase JS SDK v2 (with localStorage fallback)
   ============================================================= */

/* ---------------- CONFIG ---------------- */
const CONFIG = {
  SUPABASE_URL:      window.STITCHLUXE_SUPABASE_URL      || '',      // e.g. https://xxxx.supabase.co
  SUPABASE_ANON_KEY: window.STITCHLUXE_SUPABASE_ANON_KEY || '',      // anon public key
  PAYSTACK_PUBLIC_KEY: window.STITCHLUXE_PAYSTACK_KEY    || 'pk_test_xxAxxxxxxxxxxxxxxxxxxxxxx',
  LS_KEY: 'stitchluxe_extra_lite_v1',
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

/* ---------------- STATE ---------------- */
const state = {
  user: null,
  orders: [],
  listings: [],
  applications: [],
  payments: [],
  messages: {},          // orderId -> [msgs]
  activeOrderId: null,
  activeTab: 'orders'
};

/* ---------------- UTIL ---------------- */
const $ = (id) => document.getElementById(id);
const uid = () => 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const money = (n) => '₦' + Number(n || 0).toLocaleString('en-NG');
const escapeHtml = (s='') => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const initials = (name='') => {
  const parts = name.trim().split(/\s+/);
  if (!parts.length || !parts[0]) return '?';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
};
const fmtDate = (ts) => new Date(ts).toLocaleDateString('en-NG', { month:'short', day:'numeric', year:'numeric' });

function toast(msg, type='info') {
  const wrap = $('toast-wrap');
  const colors = { info:'bg-black text-white', success:'bg-green-600 text-white', error:'bg-red-600 text-white', warn:'bg-[#c9a227] text-black' };
  const el = document.createElement('div');
  el.className = `toast ${colors[type]} text-sm font-medium px-4 py-3 rounded-xl shadow-lg max-w-xs`;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

/* =============================================================
   DB ADAPTER — Supabase if configured, else localStorage
   ============================================================= */
let sb = null;
let useLocal = true;

if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY && window.supabase) {
  try {
    sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    useLocal = false;
  } catch (e) { console.warn('Supabase init failed, using local fallback', e); }
}

/* ---- LocalStorage helpers ---- */
function lsRead(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function lsWrite(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

/* Seed demo data on first load for local mode */
function seedLocal() {
  const db = lsRead(CONFIG.LS_KEY, null);
  if (db) return db;
  const seed = { orders: [], listings: [], applications: [], payments: [], messages: {}, profiles: {} };
  // seed demo tailor profile
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

/* ---- Unified DB API ---- */
const db = {
  /* AUTH */
  async signIn(email, password, role) {
    if (!useLocal) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
      return { user: data.user, profile: profile || { id:data.user.id, email, full_name:email, role } };
    }
    // local auth
    const store = seedLocal();
    const profile = store.profiles[email];
    if (!profile) {
      // auto-create local profile
      const newProfile = { id: uid(), email, full_name: email.split('@')[0], role: role || 'client' };
      store.profiles[email] = newProfile; lsWrite(CONFIG.LS_KEY, store);
      return { user: { id: newProfile.id, email }, profile: newProfile };
    }
    return { user: { id: profile.id, email }, profile };
  },
  async signUp(email, password, fullName, role) {
    if (!useLocal) {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: fullName, role } }
      });
      if (error) throw error;
      return { user: data.user, profile: { id: data.user.id, email, full_name: fullName, role } };
    }
    const store = seedLocal();
    const profile = { id: uid(), email, full_name: fullName, role: role || 'client' };
    store.profiles[email] = profile; lsWrite(CONFIG.LS_KEY, store);
    return { user: { id: profile.id, email }, profile };
  },
  async signOut() {
    if (!useLocal && supabase) await supabase.auth.signOut();
    localStorage.removeItem(CONFIG.LS_SESSION);
  },

  /* ORDERS */
  async listOrders() {
    if (!useLocal) {
      const { data, error } = await supabase.from('bespoke_orders').select('*').order('created_at', { ascending:false });
      if (error) throw error; return data || [];
    }
    const store = seedLocal();
    return (store.orders || []).filter(o => o.client_id === state.user.id || o.tailor_id === state.user.id || !o.tailor_id);
  },
  async createOrder(payload) {
    if (!useLocal) {
      const { data, error } = await supabase.from('bespoke_orders').insert(payload).select().single();
      if (error) throw error; return data;
    }
    const store = seedLocal();
    const row = { id: uid(), created_at: Date.now(), updated_at: Date.now(), milestone: 1, status: 'pending', ...payload };
    store.orders.push(row); lsWrite(CONFIG.LS_KEY, store);
    return row;
  },
  async updateOrder(id, patch) {
    if (!useLocal) {
      const { data, error } = await supabase.from('bespoke_orders').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select().single();
      if (error) throw error; return data;
    }
    const store = seedLocal();
    const idx = store.orders.findIndex(o => o.id === id);
    if (idx >= 0) { store.orders[idx] = { ...store.orders[idx], ...patch, updated_at: Date.now() }; lsWrite(CONFIG.LS_KEY, store); return store.orders[idx]; }
  },

  /* MESSAGES */
  async listMessages(orderId) {
    if (!useLocal) {
      const { data, error } = await supabase.from('order_messages').select('*').eq('order_id', orderId).order('created_at', { ascending:true });
      if (error) throw error; return data || [];
    }
    const store = seedLocal();
    return store.messages[orderId] || [];
  },
  async createMessage(payload) {
    if (!useLocal) {
      const { data, error } = await supabase.from('order_messages').insert(payload).select().single();
      if (error) throw error; return data;
    }
    const store = seedLocal();
    const row = { id: uid(), created_at: Date.now(), ...payload };
    store.messages[row.order_id] = [...(store.messages[row.order_id] || []), row];
    lsWrite(CONFIG.LS_KEY, store);
    return row;
  },

  /* PAYMENTS */
  async listPayments() {
    if (!useLocal) {
      const { data, error } = await supabase.from('payment_requests').select('*').order('created_at', { ascending:false });
      if (error) throw error; return data || [];
    }
    const store = seedLocal();
    return (store.payments || []).filter(p => p.client_id === state.user.id || p.tailor_id === state.user.id);
  },
  async createPayment(payload) {
    if (!useLocal) {
      const { data, error } = await supabase.from('payment_requests').insert(payload).select().single();
      if (error) throw error; return data;
    }
    const store = seedLocal();
    const row = { id: uid(), created_at: Date.now(), status: 'pending', ...payload };
    store.payments.push(row); lsWrite(CONFIG.LS_KEY, store); return row;
  },
  async updatePayment(id, patch) {
    if (!useLocal) {
      const { data, error } = await supabase.from('payment_requests').update(patch).eq('id', id).select().single();
      if (error) throw error; return data;
    }
    const store = seedLocal();
    const idx = store.payments.findIndex(p => p.id === id);
    if (idx >= 0) { store.payments[idx] = { ...store.payments[idx], ...patch }; lsWrite(CONFIG.LS_KEY, store); return store.payments[idx]; }
  },

  /* LISTINGS */
  async listListings() {
    if (!useLocal) {
      const { data, error } = await supabase.from('marketplace_listings').select('*').order('created_at', { ascending:false });
      if (error) throw error; return data || [];
    }
    const store = seedLocal();
    return store.listings || [];
  },
  async createListing(payload) {
    if (!useLocal) {
      const { data, error } = await supabase.from('marketplace_listings').insert(payload).select().single();
      if (error) throw error; return data;
    }
    const store = seedLocal();
    const row = { id: uid(), created_at: Date.now(), status: 'available', ...payload };
    store.listings.push(row); lsWrite(CONFIG.LS_KEY, store); return row;
  },

  /* APPLICATIONS */
  async listApplications() {
    if (!useLocal) {
      const { data, error } = await supabase.from('apprentice_applications').select('*').order('created_at', { ascending:false });
      if (error) throw error; return data || [];
    }
    const store = seedLocal();
    return (store.applications || []).filter(a => a.applicant_id === state.user.id || a.mentor_id === state.user.id);
  },
  async createApplication(payload) {
    if (!useLocal) {
      const { data, error } = await supabase.from('apprentice_applications').insert(payload).select().single();
      if (error) throw error; return data;
    }
    const store = seedLocal();
    const row = { id: uid(), created_at: Date.now(), status: 'pending', ...payload };
    store.applications.push(row); lsWrite(CONFIG.LS_KEY, store); return row;
  }
};

/* =============================================================
   AUTH HANDLERS
   ============================================================= */
function showAuthError(msg) {
  const el = $('auth-error');
  el.textContent = msg; el.classList.remove('hidden');
}
function hideAuthError() { $('auth-error').classList.add('hidden'); }

async function handleLogin(e) {
  e.preventDefault(); hideAuthError();
  const email = $('auth-email').value.trim();
  const password = $('auth-password').value;
  const role = $('auth-role').value;
  if (password.length < 6) return showAuthError('Password must be at least 6 characters.');
  try {
    const { user, profile } = await db.signIn(email, password, role);
    startSession({ id: user.id, email, full_name: profile.full_name || email, role: profile.role || role });
  } catch (err) {
    showAuthError(err.message || 'Sign-in failed.');
  }
}

async function handleSignup() {
  hideAuthError();
  const name = $('auth-name').value.trim();
  const email = $('auth-email').value.trim();
  const password = $('auth-password').value;
  const role = $('auth-role').value;
  if (!name) return showAuthError('Please enter your full name to create an account.');
  if (!email) return showAuthError('Please enter your email.');
  if (password.length < 6) return showAuthError('Password must be at least 6 characters.');
  try {
    const { user, profile } = await db.signUp(email, password, name, role);
    startSession({ id: user.id, email, full_name: name, role });
    toast('Account created. Welcome to StitchLuxe!', 'success');
  } catch (err) { showAuthError(err.message || 'Signup failed.'); }
}

function handleDemo() {
  $('auth-email').value = 'designer@stitchluxe.com';
  $('auth-password').value = 'stitchluxe123';
  $('auth-role').value = 'client';
  handleLogin(new Event('submit'));
}

function startSession(user) {
  state.user = user;
  lsWrite(CONFIG.LS_SESSION, user);
  $('auth-gate').classList.add('hidden');
  $('app-shell').classList.remove('hidden');
  $('user-name-display').textContent = user.full_name;
  $('user-role-display').textContent = user.role;
  $('user-avatar').textContent = initials(user.full_name);
  refreshAll();
}

async function handleLogout() {
  await db.signOut();
  state.user = null;
  $('app-shell').classList.add('hidden');
  $('auth-gate').classList.remove('hidden');
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
  $('tab-' + tab).classList.remove('hidden');
  if (tab === 'payments') renderPayments();
  if (tab === 'market') renderMarket();
  if (tab === 'apprentice') renderApplications();
}

/* =============================================================
   RENDER: ORDERS + MILESTONES + CHAT
   ============================================================= */
function renderOrders() {
  const root = $('list-root');
  const q = ($('order-search')?.value || '').toLowerCase().trim();
  let rows = [...state.orders];
  if (q) rows = rows.filter(o => (o.garment_type + ' ' + (o.description||'')).toLowerCase().includes(q));
  root.innerHTML = '';
  if (!rows.length) {
    root.innerHTML = `<li class="text-sm text-black/40 italic text-center py-8">No orders yet. Create your first bespoke order.</li>`;
    return;
  }
  rows.forEach(o => {
    const li = document.createElement('li');
    li.className = 'bg-[#faf8f3] rounded-xl p-4 cursor-pointer hover:bg-[#f5f2ea] transition border border-black/5';
    li.onclick = () => openOrder(o.id);
    const msDone = o.milestone - 1;
    const total = MILESTONES.length;
    const pct = Math.round(((o.milestone) / total) * 100);
    li.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="font-semibold text-sm truncate">${escapeHtml(o.garment_type || 'Garment')}</div>
          <div class="text-xs text-black/50 truncate mt-0.5">${escapeHtml((o.description||'').slice(0,50) || 'No description')}</div>
        </div>
        <span class="badge ${o.status==='completed'?'bg-green-100 text-green-700':'bg-[#c9a227]/20 text-[#8a6d00]'}">${o.status || 'pending'}</span>
      </div>
      <div class="mt-3 h-1.5 bg-black/5 rounded-full overflow-hidden">
        <div class="h-full bg-[#c9a227]" style="width:${pct}%"></div>
      </div>
      <div class="flex justify-between text-[10px] text-black/40 mt-1">
        <span>Milestone ${o.milestone}/${total}</span>
        <span>${money(o.budget)}</span>
      </div>
    `;
    root.appendChild(li);
  });
}

function renderMilestoneBar(order) {
  const bar = $('milestone-bar');
  bar.innerHTML = '';
  MILESTONES.forEach((label, i) => {
    const step = i + 1;
    const span = document.createElement('div');
    let cls = 'ms-step flex-1 text-[9px] sm:text-[10px] font-semibold text-center py-1.5 px-1 rounded-md bg-black/5 text-black/50 transition';
    if (step < order.milestone) cls += ' done';
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
  $('modal-order').classList.remove('hidden');
  $('modal-order-title').textContent = o.garment_type || 'Bespoke Order';
  $('modal-order-meta').textContent = `Created ${fmtDate(o.created_at)} • Budget ${money(o.budget)}`;
  renderMilestoneBar(o);
  // pinterest
  if (o.pinterest_url) {
    $('modal-pinterest').href = o.pinterest_url;
    $('modal-pinterest-wrap').classList.remove('hidden');
  } else $('modal-pinterest-wrap').classList.add('hidden');
  // measurements
  const m = o.measurements || {};
  const mtxt = ['bust','waist','hips'].filter(k => m[k]).map(k => `${k}: ${m[k]}in`).join(' · ') || '—';
  $('modal-measurements').textContent = mtxt;
  // tailor-only actions
  const isTailor = state.user.role === 'tailor';
  $('btn-request-pay').classList.toggle('hidden', !isTailor);
  $('btn-advance-ms').classList.toggle('hidden', !isTailor);
  $('pay-request-form').classList.add('hidden');
  // load chat
  await loadChat(orderId);
}

async function loadChat(orderId) {
  state.messages[orderId] = await db.listMessages(orderId);
  renderChat();
}

function renderChat() {
  const log = $('chat-log');
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
  // wire pay buttons
  log.querySelectorAll('.pay-now').forEach(b => b.onclick = () => startPaystack(Number(b.dataset.amount), b.dataset.method));
}

async function sendChat() {
  const text = $('chat-input').value.trim();
  if (!text || !state.activeOrderId) return;
  $('chat-input').value = '';
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
  const amount = Number($('pr-amount').value);
  const method = $('pr-method').value;
  const notes = $('pr-notes').value.trim();
  if (!amount || amount <= 0) return toast('Enter a valid amount.', 'error');
  const order = state.orders.find(o => o.id === state.activeOrderId);
  if (!order) return;

  // 1) chat message
  await db.createMessage({
    order_id: state.activeOrderId,
    sender_id: state.user.id,
    sender_name: state.user.full_name,
    message: notes || `Payment requested via ${method.replace('_',' ')}`,
    message_type: 'payment_request',
    amount, method
  });
  // 2) payment record
  await db.createPayment({
    order_id: state.activeOrderId,
    client_id: order.client_id,
    tailor_id: state.user.id,
    amount, method,
    notes
  });
  $('pay-request-form').classList.add('hidden');
  $('pr-amount').value = ''; $('pr-notes').value = '';
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
  Object.assign(order, updated);
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
   PAYSTACK PAYMENT
   ============================================================= */
function startPaystack(amount, method) {
  if (method !== 'paystack_card') {
    // non-card methods → informational
    toast(`Follow the ${method.replace('_',' ')} instructions from your tailor.`, 'info');
    return;
  }
  if (typeof PaystackPop === 'undefined') {
    return toast('Paystack SDK not loaded.', 'error');
  }
  if (!CONFIG.PAYSTACK_PUBLIC_KEY || CONFIG.PAYSTACK_PUBLIC_KEY.includes('xxxx')) {
    return toast('Paystack public key not configured — set STITCHLUXE_PAYSTACK_KEY.', 'warn');
  }
  const ref = 'SLX-' + Date.now();
  const handler = PaystackPop.setup({
    key: CONFIG.PAYSTACK_PUBLIC_KEY,
    email: state.user.email,
    amount: Math.round(amount * 100), // kobo
    currency: 'NGN',
    ref,
    metadata: { order_id: state.activeOrderId, custom_fields: [
      { display_name: 'Order', variable_name: 'order_id', value: state.activeOrderId || '' }
    ]},
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
      // mark any matching payment request as paid
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
   RENDER: PAYMENTS TAB
   ============================================================= */
async function renderPayments() {
  state.payments = await db.listPayments();
  const el = $('payments-list');
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
      <span class="badge ${p.status==='paid'?'bg-green-100 text-green-700':p.status==='failed'?'bg-red-100 text-red-700':'bg-[#c9a227]/20 text-[#8a6d00]'}">${p.status}</span>
    </div>
  `).join('');
}

/* =============================================================
   RENDER: MARKETPLACE
   ============================================================= */
async function renderMarket() {
  state.listings = await db.listListings();
  const q = ($('market-search')?.value || '').toLowerCase().trim();
  let items = state.listings;
  if (q) items = items.filter(l => (l.title + ' ' + (l.description||'')).toLowerCase().includes(q));
  const grid = $('market-grid');
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
          <span class="badge ${l.status==='available'?'bg-green-100 text-green-700':'bg-black/10 text-black/50'}">${l.status}</span>
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
        <span class="badge ${a.status==='accepted'?'bg-green-100 text-green-700':a.status==='rejected'?'bg-red-100 text-red-700':'bg-[#c9a227]/20 text-[#8a6d00]'}">${a.status}</span>
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
    garment_type: $('order-garment').value,
    description: $('order-desc').value.trim(),
    pinterest_url: $('order-pinterest').value.trim(),
    measurements: {
      bust: $('m-bust').value ? Number($('m-bust').value) : null,
      waist: $('m-waist').value ? Number($('m-waist').value) : null,
      hips: $('m-hips').value ? Number($('m-hips').value) : null
    },
    budget: Number($('order-budget').value) || 0,
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
    seller_id: state.user.id,
    seller_name: state.user.full_name,
    title: $('list-title').value.trim(),
    description: $('list-desc').value.trim(),
    price: Number($('list-price').value) || 0,
    size: $('list-size').value.trim(),
    condition: $('list-condition').value,
    image_url: $('list-image').value.trim(),
    status: 'available'
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
    mentor_id: null,
    full_name: $('app-name').value.trim(),
    email: $('app-email').value.trim(),
    portfolio_url: $('app-portfolio').value.trim(),
    cover_letter: $('app-cover').value.trim(),
    years_experience: Number($('app-years').value) || 0,
    status: 'pending'
  };
  if (!payload.full_name || !payload.email) return toast('Name and email are required.', 'error');
  const row = await db.createApplication(payload);
  state.applications.unshift(row);
  e.target.reset();
  renderApplications();
  toast('Application submitted. We will reach out.', 'success');
}

/* =============================================================
   REFRESH ALL
   ============================================================= */
async function refreshAll() {
  if (!state.user) return;
  try {
    state.orders = await db.listOrders();
    state.listings = await db.listListings();
    state.applications = await db.listApplications();
    state.payments = await db.listPayments();
    renderOrders();
    renderMarket();
    renderApplications();
    renderPayments();
  } catch (err) {
    console.error(err);
    toast('Failed to load data.', 'error');
  }
}

/* =============================================================
   INIT
   ============================================================= */
function init() {
  // year
  $('footer-year').textContent = new Date().getFullYear();

  // restore session
  const saved = lsRead(CONFIG.LS_SESSION, null);
  if (saved) startSession(saved);

  // auth listeners
  $('auth-form').addEventListener('submit', handleLogin);
  $('btn-signup').addEventListener('click', handleSignup);
  $('btn-demo').addEventListener('click', handleDemo);
  $('btn-logout').addEventListener('click', handleLogout);

  // tab listeners
  document.querySelectorAll('.tab-btn').forEach(b => b.onclick = () => switchTab(b.dataset.tab));

  // form listeners
  $('form-order').addEventListener('submit', submitOrder);
  $('form-listing').addEventListener('submit', submitListing);
  $('form-apprentice').addEventListener('submit', submitApplication);

  // search listeners
  $('order-search').addEventListener('input', renderOrders);
  $('market-search').addEventListener('input', renderMarket);

  // modal listeners
  $('btn-close-order').onclick = () => {
    $('modal-order').classList.add('hidden');
    state.activeOrderId = null;
  };
  $('btn-send-chat').onclick = sendChat;
  $('chat-input').addEventListener('keypress', (e) => { if (e.key === 'Enter') sendChat(); });
  $('btn-ask-pay').onclick = askBestWayToPay;
  $('btn-request-pay').onclick = () => $('pay-request-form').classList.toggle('hidden');
  $('btn-cancel-pay-req').onclick = () => $('pay-request-form').classList.add('hidden');
  $('btn-send-pay-req').onclick = sendPaymentRequest;
  $('btn-advance-ms').onclick = advanceMilestone;

  // seal env vars off window (hygiene)
  delete window.STITCHLUXE_SUPABASE_URL;
  delete window.STITCHLUXE_SUPABASE_ANON_KEY;
  delete window.STITCHLUXE_PAYSTACK_KEY;

  console.log('[StitchLuxe Extra Lite] init • mode:', useLocal ? 'LOCAL FALLBACK' : 'SUPABASE');
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
