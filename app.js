/* =============================================================
   StitchLuxe Extra Lite — app.js  (v2.5)
   - Tailors self-serve their own WhatsApp number
   - Full country + state + dial-code phone picker
   - WhatsApp payment flow (no card)
   - Direct Pinterest picker
   ============================================================= */

window.addEventListener('error', e =>
  console.error('[GLOBAL ERROR]', e.message, '@', e.filename, ':', e.lineno));
window.addEventListener('unhandledrejection', e =>
  console.error('[UNHANDLED PROMISE]', e.reason));

/* ---------- CONFIG ---------- */
const CONFIG = {
  SUPABASE_URL:      window.STITCHLUXE_SUPABASE_URL      || '',
  SUPABASE_ANON_KEY: window.STITCHLUXE_SUPABASE_ANON_KEY || '',
  TAILOR_WHATSAPP:   window.STITCHLUXE_TAILOR_WHATSAPP   || '2348012345678',
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

/* ---------- COUNTRIES + STATES ---------- */
const COUNTRIES = [
  { iso:'NG', name:'Nigeria', flag:'🇳🇬', dial:'+234', states:['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT - Abuja','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'] },
  { iso:'GH', name:'Ghana', flag:'🇬🇭', dial:'+233', states:['Greater Accra','Ashanti','Western','Western North','Eastern','Central','Volta','Oti','Northern','Savannah','North East','Upper East','Upper West','Bono','Bono East','Ahafo'] },
  { iso:'KE', name:'Kenya', flag:'🇰🇪', dial:'+254', states:['Nairobi','Mombasa','Kisumu','Nakuru','Kiambu','Machakos','Kajiado','Uasin Gishu','Meru','Nyeri','Kakamega','Kisii','Bungoma','Kilifi','Taita-Taveta','Garissa','Turkana'] },
  { iso:'ZA', name:'South Africa', flag:'🇿🇦', dial:'+27', states:['Gauteng','Western Cape','KwaZulu-Natal','Eastern Cape','Free State','Limpopo','Mpumalanga','North West','Northern Cape'] },
  { iso:'EG', name:'Egypt', flag:'🇪🇬', dial:'+20', states:['Cairo','Giza','Alexandria','Dakahlia','Sharqia','Qalyubia','Gharbia','Monufia','Beheira','Port Said','Suez','Ismailia','Damietta','Kafr El Sheikh','Fayoum','Beni Suef','Minya','Asyut','Sohag','Qena','Luxor','Aswan','Red Sea','New Valley','Matrouh','North Sinai','South Sinai'] },
  { iso:'TZ', name:'Tanzania', flag:'🇹🇿', dial:'+255', states:['Dar es Salaam','Arusha','Mwanza','Dodoma','Mbeya','Morogoro','Tanga','Kilimanjaro','Zanzibar'] },
  { iso:'UG', name:'Uganda', flag:'🇺🇬', dial:'+256', states:['Kampala','Wakiso','Mukono','Jinja','Gulu','Mbarara','Mbale','Masaka','Entebbe','Fort Portal'] },
  { iso:'CI', name:"Côte d'Ivoire", flag:'🇨🇮', dial:'+225', states:['Abidjan','Yamoussoukro','Bouaké','Daloa','San-Pédro','Korhogo'] },
  { iso:'SN', name:'Senegal', flag:'🇸🇳', dial:'+221', states:['Dakar','Thiès','Saint-Louis','Diourbel','Kaolack','Ziguinchor','Touba'] },
  { iso:'CM', name:'Cameroon', flag:'🇨🇲', dial:'+237', states:['Centre','Littoral','West','North West','South West','South','East','Adamawa','North','Far North'] },
  { iso:'US', name:'United States', flag:'🇺🇸', dial:'+1', states:['Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming'] },
  { iso:'CA', name:'Canada', flag:'🇨🇦', dial:'+1', states:['Ontario','Quebec','British Columbia','Alberta','Manitoba','Saskatchewan','Nova Scotia','New Brunswick','Newfoundland and Labrador','Prince Edward Island','Northwest Territories','Yukon','Nunavut'] },
  { iso:'GB', name:'United Kingdom', flag:'🇬🇧', dial:'+44', states:['England','Scotland','Wales','Northern Ireland'] },
  { iso:'AE', name:'United Arab Emirates', flag:'🇦🇪', dial:'+971', states:['Abu Dhabi','Dubai','Sharjah','Ajman','Umm Al Quwain','Ras Al Khaimah','Fujairah'] },
  { iso:'DE', name:'Germany', flag:'🇩🇪', dial:'+49', states:['Bavaria','Berlin','Hamburg','Hesse','North Rhine-Westphalia','Baden-Württemberg','Lower Saxony','Saxony','Rhineland-Palatinate'] },
  { iso:'FR', name:'France', flag:'🇫🇷', dial:'+33', states:['Île-de-France','Provence-Alpes-Côte d’Azur','Auvergne-Rhône-Alpes','Nouvelle-Aquitaine','Occitanie','Hauts-de-France','Grand Est','Pays de la Loire','Normandy','Brittany'] },
  { iso:'IT', name:'Italy', flag:'🇮🇹', dial:'+39', states:['Lombardy','Lazio','Campania','Sicily','Veneto','Piedmont','Emilia-Romagna','Tuscany','Puglia'] },
  { iso:'ES', name:'Spain', flag:'🇪🇸', dial:'+34', states:['Madrid','Catalonia','Andalusia','Valencia','Galicia','Basque Country','Canary Islands'] },
  { iso:'NL', name:'Netherlands', flag:'🇳🇱', dial:'+31', states:['North Holland','South Holland','Utrecht','North Brabant','Gelderland','Limburg'] },
  { iso:'BE', name:'Belgium', flag:'🇧🇪', dial:'+32', states:['Brussels','Flanders','Wallonia'] },
  { iso:'PT', name:'Portugal', flag:'🇵🇹', dial:'+351', states:['Lisbon','Porto','Braga','Coimbra','Faro','Madeira','Azores'] },
  { iso:'BR', name:'Brazil', flag:'🇧🇷', dial:'+55', states:['São Paulo','Rio de Janeiro','Minas Gerais','Bahia','Paraná','Rio Grande do Sul','Pernambuco','Ceará','Distrito Federal'] },
  { iso:'IN', name:'India', flag:'🇮🇳', dial:'+91', states:['Maharashtra','Delhi','Karnataka','Tamil Nadu','Uttar Pradesh','Gujarat','West Bengal','Rajasthan','Kerala','Telangana','Punjab','Haryana'] },
  { iso:'CN', name:'China', flag:'🇨🇳', dial:'+86', states:['Beijing','Shanghai','Guangdong','Zhejiang','Jiangsu','Sichuan','Fujian','Shandong','Hubei'] },
  { iso:'JP', name:'Japan', flag:'🇯🇵', dial:'+81', states:['Tokyo','Osaka','Kyoto','Aichi','Kanagawa','Fukuoka','Hokkaido','Hyogo'] },
  { iso:'OT', name:'Other country', flag:'🌍', dial:'+', states:null }
];

const PINTEREST_QUERIES = {
  'Agbada':          'agbada design men',
  'Ankara Gown':     'ankara gown styles',
  'Kaftan':          'kaftan styles women',
  'Bridal / Aso Ebi':'aso ebi bridal styles',
  'Suit (2-piece)':  'bespoke suit design',
  'Senator Set':     'senator kaftan men',
  'Other':           'african fashion design'
};

/* ---------- STATE ---------- */
const state = {
  user: null,
  orders: [], listings: [], applications: [], payments: [],
  messages: {}, activeOrderId: null, activeTab: 'orders',
  profile: null,
  pickers: {}          // named phone-picker instances
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
const cleanPhone = (p='') => String(p).replace(/\D/g, '');

function toast(msg, type='info') {
  const wrap = $('toast-wrap'); if (!wrap) return;
  const styles = {
    info:    'background: var(--surface-2); color: var(--text); border: 1px solid var(--gold-line);',
    success: 'background: var(--green-dim); color: var(--green); border: 1px solid rgba(74,222,128,.4);',
    error:   'background: var(--red-dim); color: var(--red); border: 1px solid rgba(248,113,113,.4);',
    warn:    'background: var(--gold-dim); color: var(--gold-hi); border: 1px solid var(--gold-line);'
  };
  const el = document.createElement('div');
  el.className = 'toast text-sm font-semibold px-4 py-3 rounded-xl shadow-lg';
  el.setAttribute('style', styles[type]);
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

/* ---------- SAFE STORAGE ---------- */
function lsRead(key, fb) { try { return JSON.parse(localStorage.getItem(key)) ?? fb; } catch { return fb; } }
function lsWrite(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); return true; }
  catch (e) { console.warn('[StitchLuxe] lsWrite failed:', e.name); return false; }
}

/* ---------- SUPABASE ---------- */
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
      console.log('[StitchLuxe] Supabase client OK');
    } else {
      console.warn('[StitchLuxe] Supabase client invalid — LOCAL mode');
      sb = null; useLocal = true;
    }
  } catch (e) { console.warn('[StitchLuxe] Supabase init threw:', e); sb = null; useLocal = true; }
}

/* ---------- LOCAL SEED ---------- */
function seedLocal() {
  const db = lsRead(CONFIG.LS_KEY, null);
  if (db) return db;
  const seed = { orders: [], listings: [], applications: [], payments: [], messages: {}, profiles: {} };
  seed.profiles['mastertailor@stitchluxe.com'] = {
    id: 'tailor-demo-001', email: 'mastertailor@stitchluxe.com',
    full_name: 'Master Ade Tailor', role: 'tailor',
    whatsapp: '2348012345678', country: 'NG', state: 'Lagos'
  };
  seed.profiles['designer@stitchluxe.com'] = {
    id: 'client-demo-001', email: 'designer@stitchluxe.com',
    full_name: 'Ada Designer', role: 'client',
    whatsapp: '2348098765432', country: 'NG', state: 'Lagos'
  };
  lsWrite(CONFIG.LS_KEY, seed);
  return seed;
}

/* ---------- DB ADAPTER ---------- */
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
      } catch (e) { if (isStructuralError(e)) forceLocalMode('signIn'); else throw e; }
    }
    const store = seedLocal();
    let profile = store.profiles[email];
    if (!profile) {
      profile = { id: uid(), email, full_name: email.split('@')[0], role: role || 'client' };
      store.profiles[email] = profile; lsWrite(CONFIG.LS_KEY, store);
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
      } catch (e) { if (isStructuralError(e)) forceLocalMode('signUp'); else throw e; }
    }
    const store = seedLocal();
    const profile = { id: uid(), email, full_name: fullName, role: role || 'client' };
    store.profiles[email] = profile; lsWrite(CONFIG.LS_KEY, store);
    return { user: { id: profile.id, email }, profile };
  },
  async signOut() {
    if (supabaseReady()) try { await sb.auth.signOut(); } catch {}
    try { localStorage.removeItem(CONFIG.LS_SESSION); } catch {}
  },

  /* ---------- PROFILES ---------- */
  async getProfile(id) {
    if (!id) return null;
    if (supabaseReady()) {
      try {
        const { data, error } = await sb.from('profiles').select('*').eq('id', id).single();
        if (error) throw error;
        return data;
      } catch (e) { if (isStructuralError(e)) forceLocalMode('getProfile'); else throw e; }
    }
    const store = seedLocal();
    const entry = Object.values(store.profiles || {}).find(p => p.id === id);
    return entry || null;
  },
  async updateProfile(id, patch) {
    if (!id) return null;
    if (supabaseReady()) {
      try {
        const { data, error } = await sb.from('profiles').update(patch).eq('id', id).select().single();
        if (error) throw error;
        return data;
      } catch (e) { if (isStructuralError(e)) forceLocalMode('updateProfile'); else throw e; }
    }
    const store = seedLocal();
    const key = Object.keys(store.profiles || {}).find(k => store.profiles[k].id === id);
    if (key) {
      store.profiles[key] = { ...store.profiles[key], ...patch };
      lsWrite(CONFIG.LS_KEY, store);
      return store.profiles[key];
    }
    return null;
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
   PHONE PICKER COMPONENT
   Wraps a DOM container with .phone-country, .phone-state,
   .phone-state-text, .dial-code, .phone-number
   ============================================================= */
function createPhonePicker(container, opts = {}) {
  if (!container) return null;
  const countrySel = container.querySelector('.phone-country');
  const stateSel   = container.querySelector('.phone-state');
  const stateText  = container.querySelector('.phone-state-text');
  const dialEl     = container.querySelector('.dial-code');
  const numberEl   = container.querySelector('.phone-number');
  if (!countrySel || !stateSel || !stateText || !dialEl || !numberEl) return null;

  // Populate countries
  countrySel.innerHTML = COUNTRIES.map(c =>
    `<option value="${c.iso}">${c.flag}  ${c.name}  ${c.dial}</option>`).join('');
  countrySel.value = opts.defaultCountry || 'NG';

  function refreshStates() {
    const country = COUNTRIES.find(c => c.iso === countrySel.value);
    if (!country) return;
    dialEl.textContent = country.dial;
    if (Array.isArray(country.states) && country.states.length) {
      stateSel.classList.remove('hidden');
      stateText.classList.add('hidden');
      const prev = stateSel.value;
      stateSel.innerHTML = '<option value="">Select state / region…</option>' +
        country.states.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
      if (prev) stateSel.value = prev;
    } else {
      stateSel.classList.add('hidden');
      stateText.classList.remove('hidden');
    }
    updatePreview();
  }

  function updatePreview() {
    if (opts.onChange) opts.onChange(api.getValue());
  }

  countrySel.addEventListener('change', refreshStates);
  stateSel.addEventListener('change', updatePreview);
  stateText.addEventListener('input', updatePreview);
  numberEl.addEventListener('input', updatePreview);

  refreshStates();

  const api = {
    getValue() {
      const country = COUNTRIES.find(c => c.iso === countrySel.value);
      const stateVal = (Array.isArray(country?.states) && country.states.length
        ? stateSel.value
        : stateText.value).trim();
      const raw = cleanPhone(numberEl.value);
      const localRaw = raw.replace(/^0+/, '');       // strip leading zeros
      const whatsapp = (raw && country?.dial)
        ? country.dial.replace('+', '') + localRaw
        : '';
      return {
        country_iso:  country?.iso || '',
        country_name: country?.name || '',
        country_dial: country?.dial || '',
        state:        stateVal,
        phone_raw:    raw,
        whatsapp
      };
    },
    setValue(v = {}) {
      if (v.country_iso) countrySel.value = v.country_iso;
      refreshStates();
      if (v.state) {
        const country = COUNTRIES.find(c => c.iso === countrySel.value);
        if (Array.isArray(country?.states) && country.states.length) stateSel.value = v.state;
        else stateText.value = v.state;
      }
      if (v.phone_raw) numberEl.value = v.phone_raw;
      updatePreview();
    },
    clear() {
      stateSel.value = '';
      stateText.value = '';
      numberEl.value = '';
      updatePreview();
    },
    isValid() {
      const v = api.getValue();
      return !!(v.country_iso && v.whatsapp && v.phone_raw.length >= 6);
    }
  };
  return api;
}

/* =============================================================
   WHATSAPP HELPERS
   ============================================================= */
function buildWhatsAppLink(phone, message) {
  const clean = cleanPhone(phone);
  const text = encodeURIComponent(message);
  return `https://wa.me/${clean}?text=${text}`;
}

async function resolveTailorWhatsApp(order) {
  // 1) Try order's assigned tailor profile
  if (order?.tailor_id) {
    try {
      const p = await db.getProfile(order.tailor_id);
      if (p?.whatsapp) return { number: p.whatsapp, name: p.full_name, isHouse: false };
    } catch (e) { console.warn('[StitchLuxe] resolve tailor failed', e); }
  }
  // 2) Fall back to house number
  return { number: CONFIG.TAILOR_WHATSAPP, name: 'StitchLuxe Atelier', isHouse: true };
}

function openWhatsAppTo(number, message) {
  window.open(buildWhatsAppLink(number, message), '_blank', 'noopener');
}

async function openWhatsAppForOrder(order) {
  const { number, name, isHouse } = await resolveTailorWhatsApp(order);
  const garment = order?.garment_type || 'my order';
  const budget  = order?.budget ? ` (budget ${money(order.budget)})` : '';
  const intro = isHouse
    ? `Hello StitchLuxe! I'm ${state.user?.full_name || 'a client'} on StitchLuxe.`
    : `Hello ${name || 'there'}! I'm ${state.user?.full_name || 'a client'} on StitchLuxe.`;
  const msg =
    `${intro}\n\n` +
    `I'd like to pay for my ${garment} order${budget}.\n` +
    `What's the best way for me to send it?\n` +
    `(bank transfer, USSD, or cash on delivery — whichever works best for you.)\n\n` +
    `Order ID: ${order?.id || 'n/a'}`;
  openWhatsAppTo(number, msg);
}

async function openWhatsAppGeneric() {
  const order = state.orders[0];
  if (order) return openWhatsAppForOrder(order);
  const msg = `Hello StitchLuxe! I'm ${state.user?.full_name || 'a client'}.\n\n` +
              `I'd like to discuss payment for my order. What's the best way to send it?`;
  openWhatsAppTo(CONFIG.TAILOR_WHATSAPP, msg);
}

/* =============================================================
   PINTEREST
   ============================================================= */
function pinterestSearchUrl(garment) {
  const q = PINTEREST_QUERIES[garment] || 'african fashion design';
  return `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(q)}`;
}

function updatePinterestPicker() {
  const sel = $('order-garment');
  const wrap = $('pinterest-picker');
  const link = $('pin-browse-btn');
  const label = $('pin-browse-label');
  const nameEl = $('pin-garment-name');
  if (!sel || !wrap || !link) return;

  const garment = sel.value;
  if (!garment) { wrap.classList.add('hidden'); return; }

  link.href = pinterestSearchUrl(garment);
  const labelText = PINTEREST_QUERIES[garment] || 'styles';
  if (label) label.textContent = labelText;
  if (nameEl) nameEl.textContent = garment.toLowerCase();
  wrap.classList.remove('hidden');
}

/* =============================================================
   TAILOR WHATSAPP SETUP
   ============================================================= */
function updateTailorSetupBanner() {
  const banner = $('tailor-setup-banner');
  const btnMyWa = $('btn-my-wa');
  if (!banner || !btnMyWa) return;
  const isTailor = state.user?.role === 'tailor';
  btnMyWa.classList.toggle('hidden', !isTailor);
  if (!isTailor) { banner.classList.add('hidden'); return; }
  const hasNumber = !!(state.profile?.whatsapp);
  banner.classList.toggle('hidden', hasNumber);
}

function openTailorWaModal(opts = {}) {
  const modal = $('modal-tailor-wa'); if (!modal) return;
  modal.classList.remove('hidden');
  const picker = state.pickers.tailor;
  if (picker) {
    picker.setValue({
      country_iso: state.profile?.country || 'NG',
      state:       state.profile?.state || '',
      phone_raw:   state.profile?.phone_raw || (state.profile?.whatsapp ? state.profile.whatsapp.replace(/^\d{1,3}/, '') : '')
    });
  }
  // lock close on first-time prompt?
  const closeBtn = $('btn-close-tailor-wa');
  const cancelBtn = $('btn-cancel-tailor-wa');
  const lock = !!opts.lock;
  if (closeBtn) closeBtn.classList.toggle('hidden', lock);
  if (cancelBtn) cancelBtn.classList.toggle('hidden', lock);
}

function closeTailorWaModal() {
  $('modal-tailor-wa')?.classList.add('hidden');
}

async function saveTailorWa() {
  const picker = state.pickers.tailor; if (!picker) return;
  const v = picker.getValue();
  if (!v.country_iso) return toast('Please pick your country.', 'error');
  if (!v.phone_raw || v.phone_raw.length < 6) return toast('Please enter your phone number.', 'error');
  if (!v.state) return toast('Please select your state / region.', 'error');

  const patch = {
    whatsapp:  v.whatsapp,
    country:   v.country_iso,
    state:     v.state,
    phone_raw: v.phone_raw
  };

  try {
    const updated = await db.updateProfile(state.user.id, patch);
    state.profile = { ...(state.profile || {}), ...(updated || patch) };
    updateTailorSetupBanner();
    closeTailorWaModal();
    toast('WhatsApp number saved. Clients can now reach you.', 'success');
  } catch (e) {
    console.error('[StitchLuxe] save tailor WA failed', e);
    toast('Could not save — try again.', 'error');
  }
}

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
  console.log('[StitchLuxe] login', { email, mode: useLocal ? 'LOCAL' : 'SUPABASE' });
  if (!email) return showAuthError('Please enter your email.');
  if (password.length < 6) return showAuthError('Password must be at least 6 characters.');
  try {
    const { user, profile } = await db.signIn(email, password, role);
    startSession({
      id: user.id, email,
      full_name: profile?.full_name || email.split('@')[0],
      role: profile?.role || role
    }, profile);
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
    startSession(
      { id: user.id || 'local-' + Date.now(), email, full_name: name, role: profile?.role || role },
      profile
    );
    toast('Welcome to StitchLuxe!', 'success');
    // Prompt tailors to set their WhatsApp right away
    if ((profile?.role || role) === 'tailor') {
      setTimeout(() => openTailorWaModal({ lock: false }), 500);
    }
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

function startSession(user, profile) {
  state.user = user;
  state.profile = profile || { id: user.id, email: user.email, full_name: user.full_name, role: user.role };
  const gate = $('auth-gate'), shell = $('app-shell');
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

  // Prefill client phone picker from profile if available
  if (state.pickers.client && state.profile) {
    state.pickers.client.setValue({
      country_iso: state.profile.country || 'NG',
      state:       state.profile.state || '',
      phone_raw:   state.profile.phone_raw || ''
    });
  }

  updateTailorSetupBanner();

  // Tailor who is missing their number → open prompt quietly after a beat
  if (user.role === 'tailor' && !state.profile?.whatsapp) {
    setTimeout(() => openTailorWaModal({ lock: false }), 700);
  }

  refreshAll().catch(err => console.warn('[StitchLuxe] refreshAll error:', err));
}

async function handleLogout() {
  try { await db.signOut(); } catch {}
  state.user = null;
  state.profile = null;
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
    root.innerHTML = `<li class="empty-state">No orders yet.<br/><span style="color:var(--gold)">Create your first bespoke order →</span></li>`;
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
          <div class="text-xs truncate mt-0.5" style="color:var(--text-3)">${escapeHtml((o.description||'').slice(0,60) || 'No description')}</div>
        </div>
        <span class="badge ${statusClass}">${escapeHtml(o.status || 'pending')}</span>
      </div>
      <div class="mt-3 h-1.5 rounded-full overflow-hidden" style="background: rgba(242,237,225,.05);">
        <div class="h-full transition-all" style="width:${pct}%; background: linear-gradient(90deg, var(--gold) 0%, #b8922a 100%);"></div>
      </div>
      <div class="flex justify-between text-[10px] mt-2 font-medium">
        <span style="color:var(--text-3); letter-spacing:.05em; text-transform:uppercase;">
          Milestone ${o.milestone || 1} / ${total}
        </span>
        <span style="color:var(--gold); font-weight:700;">${money(o.budget)}</span>
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

  if (o.pinterest_url) {
    const pin = $('modal-pinterest');
    if (pin) { pin.href = o.pinterest_url; }
    $('modal-pinterest-wrap')?.classList.remove('hidden');
  } else {
    $('modal-pinterest-wrap')?.classList.add('hidden');
  }

  const m = o.measurements || {};
  const mtxt = ['bust','waist','hips'].filter(k => m[k]).map(k => `${k}: ${m[k]}in`).join(' · ') || '—';
  if ($('modal-measurements')) $('modal-measurements').textContent = mtxt;

  const isTailor = state.user?.role === 'tailor';
  $('btn-advance-ms')?.classList.toggle('hidden', !isTailor);

  // Resolve tailor name for the WhatsApp CTA copy
  const resolved = await resolveTailorWhatsApp(o);
  const lineEl = $('wa-tailor-line');
  const subEl  = $('wa-tailor-sub');
  if (lineEl) lineEl.textContent = resolved.isHouse
    ? 'Ask the StitchLuxe atelier how best to pay'
    : `Ask ${resolved.name || 'your tailor'} how best to pay`;
  if (subEl) subEl.textContent = resolved.isHouse
    ? "We'll connect you to the atelier on WhatsApp — they'll reply with bank details or USSD."
    : "We'll open a WhatsApp chat with your tailor — they'll reply with bank details or USSD.";

  const waBtn = $('btn-modal-wa');
  if (waBtn) waBtn.onclick = () => openWhatsAppForOrder(o);

  await loadChat(orderId);
}

/* =============================================================
   CHAT
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
    log.innerHTML = `<div class="text-xs italic text-center py-6" style="color:var(--text-3)">No messages yet — say hello 👋</div>`;
    return;
  }
  msgs.forEach(m => {
    const isMe = m.sender_id === state.user.id;
    const wrap = document.createElement('div');
    wrap.className = `flex ${isMe ? 'justify-end' : 'justify-start'}`;
    if (m.message_type === 'ask_payment') {
      wrap.innerHTML = `<div class="bubble-them" style="background: rgba(59,130,246,.1); border-color: rgba(59,130,246,.3);">
        <div class="font-bold text-xs uppercase tracking-wider mb-1" style="color:#60a5fa;">💬 Payment Question</div>
        <div>${escapeHtml(m.message)}</div>
      </div>`;
    } else if (m.message_type === 'payment_confirmed') {
      wrap.innerHTML = `<div class="bubble-them" style="background: var(--green-dim); border-color: rgba(74,222,128,.3);">
        <div class="font-bold text-xs uppercase tracking-wider mb-1" style="color:var(--green);">✓ Payment Confirmed</div>
        <div>${escapeHtml(m.message)}</div>
      </div>`;
    } else if (m.message_type === 'system') {
      wrap.innerHTML = `<div class="text-[11px] italic text-center w-full" style="color:var(--text-3)">${escapeHtml(m.message)}</div>`;
    } else {
      wrap.innerHTML = `<div class="${isMe ? 'bubble-me' : 'bubble-them'}">
        <div class="text-[10px] mb-0.5" style="opacity:.65">${escapeHtml(m.sender_name || '')}</div>
        ${escapeHtml(m.message)}
      </div>`;
    }
    log.appendChild(wrap);
  });
  log.scrollTop = log.scrollHeight;
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
    message: `${state.user.full_name} is asking: please advise the best way to pay — bank transfer, USSD, or cash?`,
    message_type: 'ask_payment'
  });
  await loadChat(state.activeOrderId);
  toast('Tailor notified. Opening WhatsApp…', 'success');
  setTimeout(async () => {
    const o = state.orders.find(x => x.id === state.activeOrderId);
    if (o) await openWhatsAppForOrder(o);
  }, 600);
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
    message: `Milestone advanced → ${next}. ${MILESTONES[next-1]}`,
    message_type: 'system'
  });
  await loadChat(order.id);
  toast(`Advanced to ${MILESTONES[next-1]}`, 'success');
}

/* =============================================================
   RENDER: PAY TAILOR
   ============================================================= */
async function renderPayments() {
  state.payments = await db.listPayments();
  const el = $('payments-list'); if (!el) return;

  if (!state.payments.length) {
    if (!state.orders.length) {
      el.innerHTML = `<div class="empty-state">No orders yet.<br/>
        <span style="color: var(--gold);">Create a bespoke order to start →</span></div>`;
      return;
    }
    el.innerHTML = `<div class="text-xs uppercase tracking-wider mb-3" style="color: var(--text-3); font-weight: 800;">Your orders</div>`;
    state.orders.forEach(o => {
      const card = document.createElement('div');
      card.className = 'surface-2 p-4';
      card.innerHTML = `
        <div class="flex items-start justify-between gap-3 mb-3">
          <div class="min-w-0">
            <div class="font-bold text-sm truncate">${escapeHtml(o.garment_type || 'Order')}</div>
            <div class="text-xs mt-0.5" style="color: var(--text-3);">${escapeHtml(fmtDate(o.created_at))} · Budget ${money(o.budget)}</div>
          </div>
          <span class="badge badge-gold">No payment yet</span>
        </div>
        <button class="btn btn-whatsapp btn-sm w-full wa-order-btn">
          <svg viewBox="0 0 24 24" fill="currentColor" style="width:14px;height:14px">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/>
          </svg>
          Ask tailor on WhatsApp
        </button>
      `;
      card.querySelector('.wa-order-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        openWhatsAppForOrder(o);
      });
      el.appendChild(card);
    });
    return;
  }

  el.innerHTML = '';
  state.payments.forEach(p => {
    const card = document.createElement('div');
    card.className = 'surface-2 p-4';
    const order = state.orders.find(o => o.id === p.order_id);
    const paid = p.status === 'paid';
    card.innerHTML = `
      <div class="flex items-start justify-between gap-3 mb-3">
        <div class="min-w-0">
          <div class="text-xl font-black serif" style="color: var(--gold);">${money(p.amount)}</div>
          <div class="text-xs mt-1" style="color: var(--text-3);">
            ${escapeHtml(order?.garment_type || 'Order')} · ${escapeHtml(fmtDate(p.created_at))}
          </div>
          ${p.notes ? `<div class="text-xs mt-2 italic" style="color: var(--text-2);">"${escapeHtml(p.notes)}"</div>` : ''}
        </div>
        <span class="badge ${paid ? 'badge-green' : 'badge-gold'}">${escapeHtml(p.status)}</span>
      </div>
      ${!paid ? `
        <button class="btn btn-whatsapp btn-sm w-full wa-pay-btn">
          <svg viewBox="0 0 24 24"
