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

function getToken() {
  const params = new URLSearchParams(location.search);
  return params.get('token') || '';
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
  if (el) el.textContent = msg || '';
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
  const token = getToken();
  if (!token) {
    document.getElementById('app').innerHTML = '<p>Нет токена восстановления. Обратитесь к администратору.</p>';
    return;
  }

  let phoneE164 = null;

  function checkPhone() {
    const country = document.getElementById('country')?.value || 'RU';
    const national = (document.getElementById('phone_national')?.value || '').replace(/\D/g, '');
    const e164 = validatePhone(country, national);
    const btn = document.getElementById('btn-request-otp');
    setError('phone-error', e164 ? '' : (national.length ? 'Некорректный номер' : ''));
    btn.disabled = !e164;
    return e164;
  }
  document.getElementById('phone_national')?.addEventListener('input', () => checkPhone());
  document.getElementById('country')?.addEventListener('change', () => checkPhone());

  document.getElementById('btn-request-otp')?.addEventListener('click', async () => {
    phoneE164 = checkPhone();
    if (!phoneE164) return;
    const btn = document.getElementById('btn-request-otp');
    btn.disabled = true;
    const res = await fetch('/api/recover/request-otp', {
      method: 'POST',
      headers: apiHeaders(true),
      body: JSON.stringify({ token, phone_e164: phoneE164 }),
    });
    const data = await res.json().catch(() => ({}));
    setError('phone-error', '');
    showStep('step-otp');
    document.getElementById('otp_code').value = '';
    document.getElementById('otp_code').focus();
    btn.disabled = false;
  });

  document.getElementById('btn-verify-otp')?.addEventListener('click', async () => {
    const code = (document.getElementById('otp_code')?.value || '').replace(/\D/g, '');
    if (code.length !== 6) {
      setError('otp-error', 'Введите 6 цифр');
      return;
    }
    setError('otp-error', '');
    const res = await fetch('/api/recover/verify-otp', {
      method: 'POST',
      headers: apiHeaders(true),
      body: JSON.stringify({ token, phone_e164: phoneE164, otp: code }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      showStep('step-pin');
      document.getElementById('pin').value = '';
    } else {
      setError('otp-error', data.message || 'Неверный код');
    }
  });

  document.getElementById('btn-verify-pin')?.addEventListener('click', async () => {
    const pin = (document.getElementById('pin')?.value || '').replace(/\D/g, '');
    if (!pin.length) {
      setError('pin-error', 'Введите PIN');
      return;
    }
    setError('pin-error', '');
    const res = await fetch('/api/recover/verify-pin', {
      method: 'POST',
      headers: apiHeaders(true),
      body: JSON.stringify({ token, phone_e164: phoneE164, pin }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      showStep('step-success');
      if (window.Telegram?.WebApp) window.Telegram.WebApp.close();
    } else if (data.error === 'attempts_exceeded' || data.error === 'recovery_locked') {
      document.getElementById('error-text').textContent = data.message || 'Превышено число попыток.';
      showStep('step-error');
    } else {
      setError('pin-error', data.message || 'Неверный PIN');
    }
  });
});
