// Contract dates are calendar days, independent of the device timezone.
const DAY = 86400000;
export function parseContractDate(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const text = String(value).trim();
  let year, month, day, match;
  if ((match = text.match(/^Date\((\d{4}),(\d{1,2}),(\d{1,2})(?:,.*)?\)$/))) {
    [, year, month, day] = match; month = Number(month) + 1;
  } else if ((match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) {
    [, year, month, day] = match;
  } else if ((match = text.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2}|\d{4})$/))) {
    day = match[1]; month = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(match[2].toLowerCase()) + 1;
    year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
  } else if ((match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) {
    // Same US-style raw date convention used by the existing purchase source.
    [, month, day, year] = match;
  } else return null;
  year = Number(year); month = Number(month); day = Number(day);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (year < 1000 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}
export function todayInVietnam(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function displayContractDate(value) {
  const date = parseContractDate(value);
  return date ? date.split('-').reverse().join('/') : '—';
}
export function contractProgress(startValue, endValue, asOf = todayInVietnam()) {
  const start = parseContractDate(startValue), end = parseContractDate(endValue), date = parseContractDate(asOf);
  if (!start || !end || !date) return null;
  const duration = (Date.parse(end) - Date.parse(start)) / DAY;
  if (duration <= 0) return null;
  const elapsed = (Date.parse(date) - Date.parse(start)) / DAY;
  return Math.max(0, Math.min(100, elapsed / duration * 100));
}
