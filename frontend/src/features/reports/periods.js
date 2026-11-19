import { financialYear, formatDate, formatShortDate, todayInIndia } from '../../lib/format';

// Names for a report or dashboard period. The server sends the period's first and last day
// (calendar dates in India); these only turn them into headings.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const parts = (isoDate) => isoDate.split('-').map(Number);
const lastDayOfMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** "November 2026", "Oct–Dec 2026", "FY 2026-27", or "3 Oct 2026 – 19 Oct 2026". */
export function periodTitle(period, from, to) {
  const [fromYear, fromMonth, fromDay] = parts(from);
  const [toYear, toMonth, toDay] = parts(to);
  const wholeMonths = fromDay === 1 && toDay === lastDayOfMonth(toYear, toMonth);
  if (wholeMonths && fromYear === toYear && fromMonth === toMonth) {
    return `${MONTHS[fromMonth - 1]} ${fromYear}`;
  }
  if (period === 'fy') {
    return `FY ${financialYear(from)}`;
  }
  if (wholeMonths) {
    const start = MONTHS[fromMonth - 1].slice(0, 3) + (fromYear !== toYear ? ` ${fromYear}` : '');
    return `${start}–${MONTHS[toMonth - 1].slice(0, 3)} ${toYear}`;
  }
  return `${formatDate(from)} – ${formatDate(to)}`;
}

/** "1 OCT – 31 DEC" for the receipt header. */
export function periodRange(from, to) {
  return `${formatShortDate(from)} – ${formatShortDate(to)}`.toUpperCase();
}

/** The labels of the period select, with this month's and quarter's names in brackets. */
export function periodOptions() {
  const today = todayInIndia();
  const [year, month] = parts(today);
  const quarterStart = month - ((month - 1) % 3);
  const quarterEnd = quarterStart + 2;
  const quarter = `${MONTHS[quarterStart - 1].slice(0, 3)}–${MONTHS[quarterEnd - 1].slice(0, 3)} ${year}`;
  return [
    { value: 'month', label: `This month (${MONTHS[month - 1]} ${year})` },
    { value: 'quarter', label: `This quarter (${quarter})` },
    { value: 'fy', label: `This FY (${financialYear(today)})` },
    { value: 'custom', label: 'Custom dates…' },
  ];
}
