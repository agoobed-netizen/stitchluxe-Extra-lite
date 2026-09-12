/* =============================================================
   PHONE PICKER COMPONENT  (fixed — no TDZ on `api`)
   ============================================================= */
function createPhonePicker(container, opts = {}) {
  if (!container) return null;
  const countrySel = container.querySelector('.phone-country');
  const stateSel   = container.querySelector('.phone-state');
  const stateText  = container.querySelector('.phone-state-text');
  const dialEl     = container.querySelector('.dial-code');
  const numberEl   = container.querySelector('.phone-number');
  if (!countrySel || !stateSel || !stateText || !dialEl || !numberEl) return null;

  countrySel.innerHTML = COUNTRIES.map(c =>
    `<option value="${c.iso}">${c.flag}  ${c.name}  ${c.dial}</option>`).join('');
  countrySel.value = opts.defaultCountry || 'NG';

  // ---- internal helpers (hoisted function declarations) ----
  function getValue() {
    const country = COUNTRIES.find(c => c.iso === countrySel.value);
    const stateVal = (Array.isArray(country?.states) && country.states.length
      ? stateSel.value
      : stateText.value).trim();
    const raw = cleanPhone(numberEl.value);
    const localRaw = raw.replace(/^0+/, '');
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
  }

  function updatePreview() {
    if (opts.onChange) opts.onChange(getValue());
  }

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

  // ---- public API object (nothing inside references `api`) ----
  const api = {
    getValue,
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
      const v = getValue();
      return !!(v.country_iso && v.whatsapp && v.phone_raw.length >= 6);
    }
  };

  // ---- attach listeners ----
  countrySel.addEventListener('change', refreshStates);
  stateSel.addEventListener('change', updatePreview);
  stateText.addEventListener('input', updatePreview);
  numberEl.addEventListener('input', updatePreview);

  // ---- initial paint (safe: updatePreview calls getValue, not api) ----
  refreshStates();

  return api;
}
