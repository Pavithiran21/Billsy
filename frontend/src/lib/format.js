// Display formatting. Money arrives from the API as a decimal string ("485320.50") and is formatted
// as a string, never through a JS number, so no float ever touches an amount.

/** Indian digit grouping of a whole-number string: "48532050" → "4,85,32,050". */
function groupIndian(digits) {
  if (digits.length <= 3) {
    return digits;
  }
  const lastThree = digits.slice(-3);
  let rest = digits.slice(0, -3);
  const groups = [];
  while (rest.length > 2) {
    groups.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest) {
    groups.unshift(rest);
  }
  return `${groups.join(',')},${lastThree}`;
}

/** "485320.5" → "4,85,320.50"; "-1180" → "−1,180.00" (a real minus sign). Null or blank → "". */
export function formatMoney(value) {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  let text = String(value).trim();
  const negative = text.startsWith('-');
  if (negative) {
    text = text.slice(1);
  }
  const [whole, fraction = ''] = text.split('.');
  const paise = `${fraction}00`.slice(0, 2);
  return `${negative ? '−' : ''}${groupIndian(whole || '0')}.${paise}`;
}

/** "₹4,85,320.50". */
export function formatInr(value) {
  const text = formatMoney(value);
  return text.startsWith('−') ? `−₹${text.slice(1)}` : `₹${text}`;
}

/** A quantity without trailing zeros: "200.000" → "200", "1.250" → "1.25". */
export function formatQuantity(value) {
  const text = String(value ?? '');
  if (!text.includes('.')) {
    return text;
  }
  return text.replace(/\.?0+$/, '');
}

/** A GST rate from the API ("18.00", "0.25") → "18%", "0.25%". */
export function formatRate(value) {
  return `${formatQuantity(value)}%`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** An invoice date ("2026-10-17", a calendar day, not an instant) → "17 Oct 2026". */
export function formatDate(isoDate) {
  if (!isoDate) {
    return '—';
  }
  const [year, month, day] = isoDate.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/** "2026-10-17" → "17 Oct". */
export function formatShortDate(isoDate) {
  if (!isoDate) {
    return '—';
  }
  const [, month, day] = isoDate.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]}`;
}

const IST_DATE_TIME = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** A UTC timestamp from the API → "17 Oct 2026, 16:20" in India time. */
export function formatDateTime(timestamp) {
  return timestamp ? IST_DATE_TIME.format(new Date(timestamp)) : '—';
}

const IST_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });

/** Today in India as "YYYY-MM-DD" (the business's calendar), for date defaults. */
export function todayInIndia() {
  return IST_DAY.format(new Date());
}

/** "2026-10-23" → "FRI 23 OCT 2026" (the dashboard's date line). */
export function formatLongDay(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' });
  return `${weekday} ${day} ${MONTHS[month - 1]} ${year}`.toUpperCase();
}

/** The Indian financial year of a date: "2027-03-31" → "2026-27". */
export function financialYear(isoDate) {
  const [year, month] = isoDate.split('-').map(Number);
  const start = month >= 4 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/** "Good morning" by the hour in India. */
export function greeting() {
  const hour = Number(new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Initials for an avatar or the business tile: "Kaveri Studio Pvt Ltd" → "KS". */
export function initials(name) {
  const words = String(name ?? '')
    .split(/\s+/)
    .filter((word) => /^[A-Za-z]/.test(word));
  return words
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

/** "Kaveri Studio Pvt Ltd" → "Kaveri Studio" for tight spaces (sidebar). */
export function shortBusinessName(name) {
  return String(name ?? '').replace(/\s+(Pvt\.?\s+Ltd\.?|Private Limited|LLP|Ltd\.?)$/i, '');
}

export const ROLE_LABELS = { owner: 'Owner', accountant: 'Accountant', staff: 'Staff' };

/** A state code → "Karnataka (29)", from the /api/meta list. */
export function stateLabel(states, code) {
  const state = states?.find((item) => item.code === code);
  return state ? `${state.name} (${state.code})` : code;
}

/** "1 of 20" style counts: plural helper. */
export function plural(count, one, many = `${one}s`) {
  return `${count} ${Number(count) === 1 ? one : many}`;
}
