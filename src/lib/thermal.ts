/* eslint-disable no-bitwise -- ESC/POS encoding is byte-level by nature */
/**
 * Thermal bill (PRD sections 9.1 and 16.5).
 *
 * `buildThermalBill` produces a printer-independent list of lines. The same list
 * drives the on-screen print preview and `encodeEscPos`, so what the merchant
 * previews is exactly what prints.
 */
import { formatAmount, formatQty, formatShortDate, formatTime, signed } from './format';
import { qrMatrix } from './qr';
import type { Bill, BusinessDetails, PaperWidth, PaymentQr } from '../types';

export type Align = 'left' | 'center' | 'right';

export type ThermalLine =
  | { kind: 'text'; text: string; align: Align; bold?: boolean; large?: boolean }
  | { kind: 'qr'; payload: string; widthDots: number }
  | { kind: 'feed'; lines: number };

export interface PaperSpec {
  cols: number;
  dots: number;
  qrDots: number;
}

/** 8 dots per mm. QR: ~35 mm on 58 mm paper, ~45 mm on 80 mm paper. */
export const PAPER: Record<PaperWidth, PaperSpec> = {
  58: { cols: 32, dots: 384, qrDots: 280 },
  80: { cols: 48, dots: 576, qrDots: 360 },
};

/** Thermal fonts are ASCII-only: ₹ becomes "Rs.", accents are stripped, anything else becomes "?". */
export function toPrintable(text: string): string {
  return text
    .replace(/₹/g, 'Rs.')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7E]/g, '?');
}

/** Word-wraps to `cols`; words longer than a line are split. Text is never cut off. */
export function wrap(text: string, cols: number): string[] {
  const words = toPrintable(text).trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (let word of words) {
    while (word.length > cols) {
      if (line) {
        lines.push(line);
        line = '';
      }
      lines.push(word.slice(0, cols));
      word = word.slice(cols);
    }
    if (!word) continue;
    if (!line) line = word;
    else if (line.length + 1 + word.length <= cols) line += ` ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

/** Left text and right text on one line; if they don't fit, the left wraps and the right goes on its own line. */
export function leftRight(left: string, right: string, cols: number): string[] {
  const l = toPrintable(left);
  const r = toPrintable(right);
  if (l.length + 1 + r.length <= cols) return [l + ' '.repeat(cols - l.length - r.length) + r];
  const wrapped = wrap(l, cols);
  const last = wrapped[wrapped.length - 1];
  if (last.length + 1 + r.length <= cols) {
    wrapped[wrapped.length - 1] = last + ' '.repeat(cols - last.length - r.length) + r;
    return wrapped;
  }
  return [...wrapped, r.padStart(cols)];
}

/** Fixed-width table row; first column left aligned, the rest right aligned. */
function columns(values: string[], widths: number[]): string {
  return values.map((v, i) => (i === 0 ? v.padEnd(widths[i]) : v.padStart(widths[i]))).join('');
}

const text = (t: string, align: Align = 'left', extra: { bold?: boolean; large?: boolean } = {}): ThermalLine => ({
  kind: 'text',
  text: t,
  align,
  ...extra,
});

function header(b: BusinessDetails, cols: number): ThermalLine[] {
  const lines: ThermalLine[] = [];
  wrap(b.companyName, cols).forEach(l => lines.push(text(l, 'center', { bold: true, large: true })));
  const address = `${b.addressLine}, ${b.city}, ${b.state} - ${b.pincode}`;
  wrap(address, cols).forEach(l => lines.push(text(l, 'center')));
  lines.push(text(`Ph: ${b.contactNumber}`, 'center'));
  if (b.isGstRegistered && b.gstin) lines.push(text(`GSTIN: ${b.gstin}`, 'center'));
  return lines;
}

/** QR + UPI ID when there is a QR, just the UPI ID when there isn't, nothing when neither is set. */
function paymentBlock(qr: PaymentQr, spec: PaperSpec): ThermalLine[] {
  const lines: ThermalLine[] = [];
  if (qr.payload) {
    lines.push(text('Scan to pay', 'center', { bold: true }));
    lines.push({ kind: 'qr', payload: qr.payload, widthDots: spec.qrDots });
  } else if (qr.upiId) {
    lines.push(text('Pay by UPI', 'center', { bold: true }));
  }
  if (qr.upiId) wrap(`UPI: ${qr.upiId}`, spec.cols).forEach(l => lines.push(text(l, 'center')));
  return lines;
}

export function buildThermalBill(bill: Bill, qr: PaymentQr, paperWidth: PaperWidth): ThermalLine[] {
  const spec = PAPER[paperWidth];
  const cols = spec.cols;
  const gst = bill.businessSnapshot.isGstRegistered;
  const dash = text('-'.repeat(cols));
  const lines: ThermalLine[] = [];
  const add = (strings: string[], extra: { bold?: boolean; large?: boolean } = {}) =>
    strings.forEach(s => lines.push(text(s, 'left', extra)));

  // 1–3. Shop name, address, contact, GSTIN
  lines.push(...header(bill.businessSnapshot, cols));
  lines.push({ kind: 'feed', lines: 1 });
  // 4. Title
  lines.push(text(gst ? 'TAX INVOICE' : 'BILL', 'center', { bold: true }));
  // 5. Bill number, date and time
  add(leftRight('Bill No:', bill.billNumber, cols));
  add(leftRight('Date:', `${formatShortDate(bill.billDatetime)} ${formatTime(bill.billDatetime)}`, cols));
  // 6. Customer
  add(leftRight('Customer:', bill.customerName, cols));
  add(leftRight('Mobile:', bill.customerMobile, cols));
  // 7. Dashed line
  lines.push(dash);
  add(leftRight('Item', 'Amount', cols), { bold: true });
  lines.push(dash);
  // 8. Items
  for (const item of bill.items) {
    const name = gst ? `${item.productName} (${item.gstRate}%)` : item.productName;
    add(wrap(name, cols));
    add(leftRight(`  ${formatQty(item.quantity)} x ${formatAmount(item.unitPrice)}`, formatAmount(item.taxableValue), cols));
  }
  // 9. Dashed line
  lines.push(dash);
  // 10. Subtotal, CGST, SGST, round-off
  add(leftRight('Subtotal', formatAmount(bill.subtotal), cols));
  if (gst) {
    add(leftRight('CGST', formatAmount(bill.totalCgst), cols));
    add(leftRight('SGST', formatAmount(bill.totalSgst), cols));
  }
  add(leftRight('Round off', signed(bill.roundOff), cols));
  lines.push(dash);
  // 11. Grand total
  add(leftRight('TOTAL', `Rs.${formatAmount(bill.grandTotal)}`, cols), { bold: true, large: true });
  lines.push(dash);
  // 12. GST summary by rate
  if (gst) {
    const widths = cols === 32 ? [5, 11, 8, 8] : [8, 16, 12, 12];
    lines.push(text('GST Summary', 'center', { bold: true }));
    lines.push(text(columns(['Rate', 'Taxable', 'CGST', 'SGST'], widths)));
    for (const row of gstSummaryFromItems(bill)) {
      lines.push(
        text(columns([`${row.rate}%`, formatAmount(row.taxableValue), formatAmount(row.cgst), formatAmount(row.sgst)], widths)),
      );
    }
    lines.push(dash);
  }
  // 13. Payment QR (optional)
  lines.push(...paymentBlock(qr, spec));
  // 14. Footer
  lines.push({ kind: 'feed', lines: 1 });
  lines.push(text('Thank you, visit again', 'center'));
  // 15. Feed so the bill tears off cleanly
  lines.push({ kind: 'feed', lines: 4 });
  return lines;
}

export function gstSummaryFromItems(bill: Bill) {
  const map = new Map<number, { rate: number; taxableValue: number; cgst: number; sgst: number }>();
  for (const i of bill.items) {
    const row = map.get(i.gstRate) ?? { rate: i.gstRate, taxableValue: 0, cgst: 0, sgst: 0 };
    row.taxableValue += i.taxableValue;
    row.cgst += i.cgst;
    row.sgst += i.sgst;
    map.set(i.gstRate, row);
  }
  return [...map.values()].sort((a, b) => a.rate - b.rate);
}

/** Printer settings → Test print (section 12.4). */
export function buildTestPrint(b: BusinessDetails, qr: PaymentQr, paperWidth: PaperWidth): ThermalLine[] {
  const spec = PAPER[paperWidth];
  return [
    ...header(b, spec.cols),
    text('-'.repeat(spec.cols)),
    text('TEST PRINT', 'center', { bold: true }),
    text(`Paper: ${paperWidth} mm, ${spec.cols} chars/line`, 'center'),
    text('1234567890'.repeat(5).slice(0, spec.cols)),
    text('-'.repeat(spec.cols)),
    ...paymentBlock(qr, spec),
    { kind: 'feed', lines: 4 },
  ];
}

/* ------------------------------------------------------------------ */
/* ESC/POS encoding                                                    */
/* ------------------------------------------------------------------ */

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;
const ALIGN: Record<Align, number> = { left: 0, center: 1, right: 2 };

/** Monochrome raster of the QR code, scaled to as close to `widthDots` as whole modules allow. */
export function qrRaster(payload: string, widthDots: number) {
  const matrix = qrMatrix(payload);
  const quiet = 2;
  const modules = matrix.length + quiet * 2;
  const scale = Math.max(1, Math.floor(widthDots / modules));
  const size = modules * scale;
  const bytesPerRow = Math.ceil(size / 8);
  const data = new Uint8Array(bytesPerRow * size);
  for (let y = 0; y < size; y++) {
    const r = Math.floor(y / scale) - quiet;
    for (let x = 0; x < size; x++) {
      const c = Math.floor(x / scale) - quiet;
      if (r >= 0 && c >= 0 && r < matrix.length && c < matrix.length && matrix[r][c]) {
        data[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
  }
  return { data, bytesPerRow, height: size };
}

/** Encodes thermal lines as ESC/POS bytes (works with standard 58 mm and 80 mm printers). */
export function encodeEscPos(lines: ThermalLine[]): Uint8Array {
  const out: number[] = [ESC, 0x40]; // initialise
  const ascii = (s: string) => {
    for (const ch of toPrintable(s)) out.push(ch.charCodeAt(0));
  };
  for (const line of lines) {
    if (line.kind === 'feed') {
      out.push(ESC, 0x64, line.lines);
      continue;
    }
    if (line.kind === 'qr') {
      const { data, bytesPerRow, height } = qrRaster(line.payload, line.widthDots);
      out.push(ESC, 0x61, ALIGN.center);
      // GS v 0 in bands, so printers with small buffers don't drop data.
      const band = 48;
      for (let y = 0; y < height; y += band) {
        const rows = Math.min(band, height - y);
        out.push(GS, 0x76, 0x30, 0, bytesPerRow & 0xff, bytesPerRow >> 8, rows & 0xff, rows >> 8);
        for (let i = y * bytesPerRow; i < (y + rows) * bytesPerRow; i++) out.push(data[i]);
      }
      out.push(LF);
      continue;
    }
    out.push(ESC, 0x61, ALIGN[line.align]);
    out.push(ESC, 0x21, (line.bold ? 0x08 : 0) | (line.large ? 0x10 : 0));
    ascii(line.text);
    out.push(LF);
  }
  out.push(ESC, 0x21, 0, ESC, 0x61, 0);
  return Uint8Array.from(out);
}
