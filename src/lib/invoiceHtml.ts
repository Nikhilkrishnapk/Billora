/**
 * A4 invoice (PRD sections 9.2 and 16.5), rendered as HTML and converted to PDF on the device.
 *
 * Pagination is done here rather than by the browser engine so that every page
 * gets the repeated header and a reliable "Page X of Y" footer. Row heights are
 * fixed in mm, which lets us budget page space: up to 20 single-line items fit
 * on page 1 together with the totals, GST summary and payment block.
 */
import { formatAmount, formatDate, formatQty, formatTime, signed } from './format';
import { rupeesInWords } from './numberToWords';
import { qrSvg } from './qr';
import { gstSummaryFromItems } from './thermal';
import type { Bill, BillItem, PaymentQr } from '../types';

export const PRIMARY = '#0E6A4E';
const TEXT = '#14211B';
const MUTED = '#56625B';
const DIVIDER = '#E2E6E1';

/** Layout budget in mm (A4 297 mm tall, 15 mm margins). */
export const LAYOUT = {
  content: 267,
  header: 22,
  footer: 8,
  parties: 26,
  tableHead: 8,
  row: 5.5,
  extraLine: 3.6,
  bottomGst: 90,
  bottomPlain: 84,
};

export function nameCharsPerLine(gst: boolean) {
  return gst ? 40 : 62;
}

export function rowHeight(item: BillItem, gst: boolean): number {
  const lines = Math.max(1, Math.ceil(item.productName.length / nameCharsPerLine(gst)));
  return LAYOUT.row + (lines - 1) * LAYOUT.extraLine;
}

export interface InvoicePage {
  items: { item: BillItem; index: number }[];
  showParties: boolean;
  showBottom: boolean;
}

export function paginate(items: BillItem[], gst: boolean): InvoicePage[] {
  const base = LAYOUT.content - LAYOUT.header - LAYOUT.footer;
  const bottom = gst ? LAYOUT.bottomGst : LAYOUT.bottomPlain;
  const pages: InvoicePage[] = [];
  let page: InvoicePage = { items: [], showParties: true, showBottom: false };
  let space = base - LAYOUT.parties - LAYOUT.tableHead;

  items.forEach((item, index) => {
    const h = rowHeight(item, gst);
    if (h > space && page.items.length > 0) {
      pages.push(page);
      page = { items: [], showParties: false, showBottom: false };
      space = base - LAYOUT.tableHead;
    }
    page.items.push({ item, index });
    space -= h;
  });

  if (space >= bottom) {
    page.showBottom = true;
    pages.push(page);
  } else {
    pages.push(page);
    pages.push({ items: [], showParties: false, showBottom: true });
  }
  return pages;
}

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface InvoiceInput {
  bill: Bill;
  qr: PaymentQr;
  /** data: URI of the shop logo, if any. */
  logoDataUri?: string | null;
}

export function buildInvoiceHtml({ bill, qr, logoDataUri }: InvoiceInput): string {
  const b = bill.businessSnapshot;
  const gst = b.isGstRegistered;
  const e = escapeHtml;
  const title = gst ? 'Tax Invoice' : 'Invoice';
  const pages = paginate(bill.items, gst);
  const date = `${formatDate(bill.billDatetime)}, ${formatTime(bill.billDatetime)}`;

  const header = `
    <div class="band"></div>
    <div class="header">
      <div class="brand">
        ${logoDataUri ? `<img class="logo" src="${logoDataUri}"/>` : ''}
        <div class="shop">${e(b.companyName)}</div>
      </div>
      <div class="meta">
        <div class="title">${title}</div>
        <div><span class="muted">Invoice No.</span> <span class="mono">${e(bill.billNumber)}</span></div>
        <div><span class="muted">Date</span> ${date}</div>
      </div>
    </div>`;

  const parties = `
    <div class="parties">
      <div class="party">
        <div class="label">From</div>
        <div class="strong">${e(b.ownerName)}</div>
        <div>${e(b.addressLine)}, ${e(b.city)}, ${e(b.state)} - ${e(b.pincode)}</div>
        <div>Phone: ${e(b.contactNumber)}${b.email ? ` &nbsp;·&nbsp; ${e(b.email)}` : ''}</div>
        ${gst && b.gstin ? `<div>GSTIN: <span class="mono">${e(b.gstin)}</span></div>` : ''}
      </div>
      <div class="party">
        <div class="label">Bill to</div>
        <div class="strong">${e(bill.customerName)}</div>
        <div>Mobile: ${e(bill.customerMobile)}</div>
      </div>
    </div>`;

  const head = `<tr>
      <th class="c-sno">S.No</th><th class="c-name">Product</th><th class="num c-qty">Qty</th>
      <th class="num c-price">Unit price (₹)</th>
      ${gst ? '<th class="num c-rate">GST %</th><th class="num c-gst">GST (₹)</th>' : ''}
      <th class="num c-total">Amount (₹)</th></tr>`;

  const row = ({ item, index }: { item: BillItem; index: number }) => `<tr>
      <td class="c-sno">${index + 1}</td>
      <td class="c-name">${e(item.productName)}</td>
      <td class="num">${formatQty(item.quantity)}</td>
      <td class="num">${formatAmount(item.unitPrice)}</td>
      ${gst ? `<td class="num">${item.gstRate}%</td><td class="num">${formatAmount(item.cgst + item.sgst)}</td>` : ''}
      <td class="num">${formatAmount(item.lineTotal)}</td></tr>`;

  const totals = `
    <table class="totals">
      <tr><td>Subtotal</td><td class="num">₹${formatAmount(bill.subtotal)}</td></tr>
      ${gst ? `<tr><td>CGST</td><td class="num">₹${formatAmount(bill.totalCgst)}</td></tr>
               <tr><td>SGST</td><td class="num">₹${formatAmount(bill.totalSgst)}</td></tr>` : ''}
      <tr><td>Round-off</td><td class="num">${signed(bill.roundOff)}</td></tr>
    </table>
    <div class="grand"><span>Grand total</span><span>₹${formatAmount(bill.grandTotal)}</span></div>
    <div class="words">${rupeesInWords(bill.grandTotal)}</div>`;

  const gstSummary = gst
    ? `<div class="label">GST summary</div>
       <table class="summary">
         <tr><th>Rate</th><th class="num">Taxable (₹)</th><th class="num">CGST (₹)</th><th class="num">SGST (₹)</th></tr>
         ${gstSummaryFromItems(bill)
           .map(
             r => `<tr><td>${r.rate}%</td><td class="num">${formatAmount(r.taxableValue)}</td>
                   <td class="num">${formatAmount(r.cgst)}</td><td class="num">${formatAmount(r.sgst)}</td></tr>`,
           )
           .join('')}
       </table>`
    : '';

  // Payment block is optional: QR + UPI ID, UPI ID only, or nothing.
  const payment =
    qr.payload || qr.upiId
      ? `
    <div class="pay">
      ${qr.payload ? qrSvg(qr.payload, '35mm') : ''}
      <div class="pay-text">
        <div class="strong">${qr.payload ? 'Scan to pay' : 'Pay by UPI'}</div>
        ${qr.upiId ? `<div class="mono">${e(qr.upiId)}</div>` : ''}
        <div>Amount: ₹${formatAmount(bill.grandTotal)}</div>
      </div>
    </div>`
      : '';

  const bottom = `
    <div class="bottom">
      <div class="row">
        <div class="left">${gstSummary}</div>
        <div class="right">${totals}</div>
      </div>
      <div class="row">
        <div class="left note">Thank you for your business.</div>
        <div class="right">${payment}</div>
      </div>
    </div>`;

  const body = pages
    .map(
      (p, i) => `
    <section class="page${i === pages.length - 1 ? ' last' : ''}">
      ${header}
      ${p.showParties ? parties : ''}
      ${p.items.length ? `<table class="items">${head}${p.items.map(row).join('')}</table>` : ''}
      ${p.showBottom ? bottom : ''}
      <div class="footer"><span>This is a computer-generated invoice</span><span>Page ${i + 1} of ${pages.length}</span></div>
    </section>`,
    )
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: -apple-system, Roboto, 'Helvetica Neue', Arial, sans-serif; color: ${TEXT}; font-size: 8.5pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { position: relative; width: 210mm; height: 296.5mm; padding: 15mm; overflow: hidden; page-break-after: always; break-after: page; }
  .page.last { page-break-after: auto; break-after: auto; }
  .band { position: absolute; top: 0; left: 0; right: 0; height: 10px; background: ${PRIMARY}; }
  .header { height: ${LAYOUT.header}mm; display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid ${DIVIDER}; }
  .brand { display: flex; align-items: center; gap: 4mm; max-width: 60%; }
  .logo { max-height: 16mm; max-width: 30mm; object-fit: contain; }
  .shop { font-size: 16pt; font-weight: 700; }
  .meta { text-align: right; line-height: 1.6; }
  .title { font-size: 15pt; font-weight: 700; color: ${PRIMARY}; text-transform: uppercase; letter-spacing: 0.5px; }
  .muted, .label { color: ${MUTED}; }
  .label { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 700; margin-bottom: 1mm; }
  .strong { font-weight: 700; }
  .mono { font-family: Menlo, 'Courier New', monospace; }
  .parties { height: ${LAYOUT.parties}mm; display: flex; gap: 8mm; padding-top: 4mm; line-height: 1.45; }
  .party { flex: 1; }
  table { border-collapse: collapse; width: 100%; }
  .items th { height: ${LAYOUT.tableHead}mm; background: ${PRIMARY}; color: #fff; font-weight: 700; text-align: left; padding: 0 2mm; border: 1px solid ${PRIMARY}; }
  .items td { height: ${LAYOUT.row}mm; line-height: ${LAYOUT.extraLine}mm; padding: 1mm 2mm; border: 1px solid ${DIVIDER}; vertical-align: top; }
  .num { text-align: right !important; white-space: nowrap; }
  .c-sno { width: 10mm; } .c-qty { width: 15mm; } .c-price { width: 23mm; } .c-rate { width: 14mm; } .c-gst { width: 21mm; } .c-total { width: 26mm; }
  .c-name { word-break: break-word; }
  .bottom { margin-top: 5mm; }
  .row { display: flex; justify-content: space-between; gap: 8mm; margin-bottom: 4mm; }
  .left { flex: 1; }
  .right { width: 72mm; }
  .totals td { padding: 0.8mm 0; }
  .grand { display: flex; justify-content: space-between; background: ${PRIMARY}; color: #fff; font-weight: 700; font-size: 12pt; padding: 2mm 3mm; border-radius: 2mm; margin-top: 1mm; }
  .words { margin-top: 1.5mm; color: ${MUTED}; font-style: italic; text-align: right; }
  .summary th, .summary td { border: 1px solid ${DIVIDER}; padding: 1mm 2mm; text-align: left; }
  .summary th { background: #E3F1EA; }
  .pay { display: flex; gap: 3mm; align-items: center; justify-content: flex-end; border: 1px solid ${DIVIDER}; border-radius: 2mm; padding: 2mm; }
  .pay-text { line-height: 1.6; }
  .note { color: ${MUTED}; align-self: flex-end; }
  .footer { position: absolute; left: 15mm; right: 15mm; bottom: 10mm; display: flex; justify-content: space-between; color: ${MUTED}; font-size: 7.5pt; border-top: 1px solid ${DIVIDER}; padding-top: 2mm; }
</style></head><body>${body}</body></html>`;
}
