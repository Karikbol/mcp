const PIN_LENGTH = 6;

const countries = [
  { code: 'RU', dial: '+7', name: 'RU' },
  { code: 'KZ', dial: '+7', name: 'KZ' },
  { code: 'BY', dial: '+375', name: 'BY' },
  { code: 'UA', dial: '+380', name: 'UA' },
  { code: 'US', dial: '+1', name: 'US' },
  { code: 'GB', dial: '+44', name: 'GB' },
  { code: 'DE', dial: '+49', name: 'DE' },
  { code: 'FR', dial: '+33', name: 'FR' },
  { code: 'UZ', dial: '+998', name: 'UZ' },
  { code: 'TJ', dial: '+992', name: 'TJ' },
  { code: 'GE', dial: '+995', name: 'GE' },
  { code: 'AM', dial: '+374', name: 'AM' },
  { code: 'AZ', dial: '+994', name: 'AZ' },
];

let parsePhoneNumber;
(async () => {
  try {
    const lib = await import('https://cdn.jsdelivr.net/npm/libphonenumber-js@1.11.14/bundle/libphonenumber-max.min.js');
    parsePhoneNumber = lib.parsePhoneNumber;
  } catch (_) {}
})();

function getSession() {
  const params = new URLSearchParams(location.search);
  return params.get('session') || '';
}

function apiHeaders(includeContentType) {
  const h = {};
  if (includeContentType) h['Content-Type'] = 'application/json';
  const initData = typeof window !== 'undefined' && window.Telegram?.WebApp?.initData;
  if (initData) h['x-telegram-init-data'] = initData;
  return h;
}

function showStep(stepId) {
  document.querySelectorAll('.step').forEach(el => el.classList.remove('active'));
  const el = document.getElementById(stepId);
  if (el) el.classList.add('active');
}

function setError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg || ''; el.classList.toggle('error-msg', !!msg); }
}

function validatePhone(countryCode, national) {
  const digits = national.replace(/\D/g, '');
  if (!digits.length) return null;
  const full = countries.find(c => c.code === countryCode)?.dial + digits;
  if (!parsePhoneNumber) return full;
  try {
    const p = parsePhoneNumber(full, countryCode);
    return p && p.isValid() ? p.format('E.164') : null;
  } catch {
    return null;
  }
}

function fillCountrySelect() {
  const sel = document.getElementById('country');
  if (!sel) return;
  sel.innerHTML = countries.map(c => `<option value="${c.code}">${c.code} ${c.dial}</option>`).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  fillCountrySelect();
  const session = getSession();
  if (!session) {
    document.getElementById('app').innerHTML = '<p>Нет сессии. Откройте из бота.</p>';
    return;
  }

  let phoneE164 = null;
  let pinValue = '';

  document.getElementById('btn-next-name')?.addEventListener('click', () => {
    const fn = (document.getElementById('first_name')?.value || '').trim();
    const ln = (document.getElementById('last_name')?.value || '').trim();
    if (!fn || !ln) return;
    showStep('step-phone');
  });

  function checkPhone() {
    const country = document.getElementById('country')?.value || 'RU';
    const national = (document.getElementById('phone_national')?.value || '').replace(/\D/g, '');
    const e164 = validatePhone(country, national);
    const errEl = document.getElementById('phone-error');
    const btn = document.getElementById('btn-next-phone');
    if (!e164) {
      errEl.textContent = national.length ? 'Некорректный номер' : 'Введите номер';
      btn.disabled = true;
      return null;
    }
    errEl.textContent = '';
    btn.disabled = false;
    return e164;
  }
  document.getElementById('phone_national')?.addEventListener('input', () => checkPhone());
  document.getElementById('country')?.addEventListener('change', () => checkPhone());

  document.getElementById('btn-next-phone')?.addEventListener('click', () => {
    phoneE164 = checkPhone();
    if (!phoneE164) return;
    showStep('step-phone-confirm');
  });

  function checkConfirm() {
    const country = document.getElementById('country')?.value || 'RU';
    const national = (document.getElementById('phone_confirm')?.value || '').replace(/\D/g, '');
    const e164 = validatePhone(country, national);
    const match = phoneE164 && e164 === phoneE164;
    const errEl = document.getElementById('confirm-error');
    const btn = document.getElementById('btn-next-confirm');
    errEl.textContent = !e164 ? 'Введите номер' : !match ? 'Номер не совпадает' : '';
    btn.disabled = !match;
  }
  document.getElementById('phone_confirm')?.addEventListener('input', checkConfirm);

  document.getElementById('btn-next-confirm')?.addEventListener('click', () => showStep('step-pin'));

  function checkPin() {
    const pin = (document.getElementById('pin')?.value || '').replace(/\D/g, '');
    const ok = pin.length === PIN_LENGTH;
    document.getElementById('pin-error').textContent = !ok && pin.length ? `Введите ${PIN_LENGTH} цифр` : '';
    document.getElementById('btn-next-pin').disabled = !ok;
    return ok ? pin : null;
  }
  document.getElementById('pin')?.addEventListener('input', () => { checkPin(); });
  document.getElementById('pin').setAttribute('maxlength', String(PIN_LENGTH));

  document.getElementById('btn-next-pin')?.addEventListener('click', () => {
    pinValue = (document.getElementById('pin')?.value || '').replace(/\D/g, '');
    if (pinValue.length !== PIN_LENGTH) return;
    showStep('step-pin-confirm');
  });

  function checkPinConfirm() {
    const pin = (document.getElementById('pin_confirm')?.value || '').replace(/\D/g, '');
    const match = pin === pinValue;
    document.getElementById('pin-confirm-error').textContent = !match && pin.length ? 'PIN не совпадает' : '';
    document.getElementById('btn-submit').disabled = !match;
  }
  document.getElementById('pin_confirm')?.addEventListener('input', checkPinConfirm);
  document.getElementById('pin_confirm').setAttribute('maxlength', String(PIN_LENGTH));

  document.getElementById('btn-submit')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-submit');
    btn.disabled = true;
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: apiHeaders(true),
      body: JSON.stringify({
        session_id: session,
        first_name: (document.getElementById('first_name')?.value || '').trim(),
        last_name: (document.getElementById('last_name')?.value || '').trim(),
        phone_e164: phoneE164,
        pin: pinValue,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      showStep('step-success');
      if (window.Telegram?.WebApp) window.Telegram.WebApp.close();
    } else if (data.error === 'phone_exists') {
      document.getElementById('pin-confirm-error').textContent = 'Номер телефона уже зарегистрирован.';
      btn.disabled = false;
    } else {
      document.getElementById('pin-confirm-error').textContent = data.message || 'Ошибка регистрации';
      btn.disabled = false;
    }
  });
});
