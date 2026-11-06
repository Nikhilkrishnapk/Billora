/** Formatting helpers. Amounts use Indian digit grouping (1,23,456.00). */

export function formatAmount(value: number): string {
  const fixed = (Math.round((value + Number.EPSILON) * 100) / 100).toFixed(2);
  const negative = fixed.startsWith('-');
  const [whole, frac] = fixed.replace('-', '').split('.');
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3;
  return `${negative ? '-' : ''}${grouped}.${frac}`;
}

export const rupees = (value: number) => `₹${formatAmount(value)}`;

/** Round-off is shown with an explicit sign: +0.50 / -0.25. */
export const signed = (value: number) => (value > 0 ? `+${formatAmount(value)}` : formatAmount(value));

/** Quantity without trailing zeros: 1, 1.5, 0.25. */
export const formatQty = (q: number) => String(Math.round(q * 1000) / 1000);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** 5 Nov 2026 */
export const formatDate = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

/** 9:02 PM */
export function formatTime(d: Date): string {
  const h = d.getHours();
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** 5 Nov 2026, 9:02 PM */
export const formatDateTime = (d: Date) => `${formatDate(d)}, ${formatTime(d)}`;

/** Thursday, 5 Nov 2026 */
export const formatLongDate = (d: Date) => `${DAYS[d.getDay()]}, ${formatDate(d)}`;

/** 05/11/2026 (thermal bill, saves width) */
export const formatShortDate = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

/** PDF file name: INV/2026-27/0001 + Ravi → INV-2026-27-0001_Ravi.pdf (section 9.2). */
export function invoiceFileName(billNumber: string, customerName: string): string {
  const safeName = customerName.trim().replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ');
  return `${billNumber.replace(/\//g, '-')}_${safeName}.pdf`;
}
