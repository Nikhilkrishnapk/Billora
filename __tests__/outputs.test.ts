import { calculateBill } from '../src/lib/billing';
import { buildThermalBill, encodeEscPos, wrap, leftRight, PAPER } from '../src/lib/thermal';
import { buildInvoiceHtml, paginate } from '../src/lib/invoiceHtml';
import type { Bill, BusinessDetails } from '../src/types';

const business = (gst: boolean): BusinessDetails => ({
  ownerName: 'Ravi Kumar', companyName: 'Sri Lakshmi General Stores and Provisions', contactNumber: '9876543210', email: '',
  addressLine: '12, MG Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560001',
  isGstRegistered: gst, gstin: gst ? '22AAAAA0000A1Z5' : '', logoDataUri: null,
});

function makeBill(gst: boolean, count = 2, longName = false): Bill {
  const base = [
    { productName: 'Item A', quantity: 2, unitPrice: 100, gstRate: 18, barcode: null },
    { productName: 'Item B', quantity: 1, unitPrice: 50, gstRate: 5, barcode: null },
  ];
  const input = Array.from({ length: count }, (_, i) => ({
    ...base[i % 2],
    productName: longName ? `Extra long product name number ${i} that keeps going and going beyond one line` : `Item ${i + 1}`,
  }));
  const t = calculateBill(count === 2 && !longName ? base : input, gst);
  return {
    billId: 'b1', billNumber: 'INV/2026-27/0001', billDatetime: new Date(2026, 10, 5, 21, 2),
    customerName: 'Ravi', customerMobile: '9123456789',
    items: t.items.map(i => ({ productName: i.productName, barcode: null, quantity: i.quantity, unitPrice: i.unitPrice, gstRate: i.gstRate, taxableValue: i.taxableValue, cgst: i.cgst, sgst: i.sgst, lineTotal: i.lineTotal })),
    subtotal: t.subtotal, totalCgst: t.totalCgst, totalSgst: t.totalSgst, roundOff: t.roundOff, grandTotal: t.grandTotal,
    businessSnapshot: business(gst),
  };
}
const qr = { payload: 'upi://pay?pa=ravi@okaxis&pn=Ravi', upiId: 'ravi@okaxis' };

describe('thermal bill', () => {
  it('never exceeds the line width and never cuts text', () => {
    expect(wrap('a'.repeat(70), 32)).toEqual(['a'.repeat(32), 'a'.repeat(32), 'a'.repeat(6)]);
    expect(leftRight('Customer:', 'A very long customer name here', 32).every(l => l.length <= 32)).toBe(true);
    for (const w of [58, 80] as const) {
      for (const gst of [true, false]) {
        const lines = buildThermalBill(makeBill(gst, 5, true), qr, w);
        for (const l of lines) if (l.kind === 'text') expect(l.text.length).toBeLessThanOrEqual(PAPER[w].cols);
        const all = lines.map(l => (l.kind === 'text' ? l.text : '')).join(' ').replace(/\s+/g, ' ');
        expect(all).toContain('Extra long product name number 0 that keeps going and going beyond one line'.split(' ').slice(0, 5).join(' '));
      }
    }
  });

  it('shows the worked example figures for a GST merchant', () => {
    const text = buildThermalBill(makeBill(true), qr, 58).map(l => (l.kind === 'text' ? l.text : `[${l.kind}]`)).join('\n');
    expect(text).toContain('TAX INVOICE');
    expect(text).toContain('GSTIN: 22AAAAA0000A1Z5');
    expect(text).toMatch(/Subtotal\s+250\.00/);
    expect(text).toMatch(/CGST\s+19\.25/);
    expect(text).toMatch(/Round off\s+\+0\.50/);
    expect(text).toMatch(/TOTAL\s+Rs\.289\.00/);
    expect(text).toContain('[qr]');
    expect(text).not.toContain('₹');
  });

  it('has no GST anywhere for a non-GST merchant', () => {
    const text = buildThermalBill(makeBill(false), qr, 58).map(l => (l.kind === 'text' ? l.text : '')).join('\n');
    expect(text).toContain('BILL');
    expect(text).not.toMatch(/GST|CGST|SGST|%/);
  });

  it('encodes ESC/POS with a raster QR', () => {
    const bytes = encodeEscPos(buildThermalBill(makeBill(true), qr, 58));
    expect(bytes[0]).toBe(0x1b);
    expect(bytes[1]).toBe(0x40);
    const hasRaster = bytes.some((b, i) => b === 0x1d && bytes[i + 1] === 0x76 && bytes[i + 2] === 0x30);
    expect(hasRaster).toBe(true);
  });
});

describe('A4 invoice', () => {
  it('fits 20 items on one page and paginates beyond', () => {
    expect(paginate(makeBill(true, 20).items, true)).toHaveLength(1);
    expect(paginate(makeBill(false, 20).items, false)).toHaveLength(1);
    const pages = paginate(makeBill(true, 60).items, true);
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.flatMap(p => p.items).length).toBe(60);
    expect(pages.filter(p => p.showBottom)).toHaveLength(1);
  });

  it('renders titles, totals and page numbers', () => {
    const html = buildInvoiceHtml({ bill: makeBill(true), qr });
    expect(html).toContain('Tax Invoice');
    expect(html).toContain('Rupees Two Hundred Eighty-Nine Only');
    expect(html).toContain('₹289.00');
    expect(html).toContain('Page 1 of 1');
    expect(html).toContain('22AAAAA0000A1Z5');
    const plain = buildInvoiceHtml({ bill: makeBill(false), qr });
    expect(plain).not.toMatch(/GSTIN|CGST|SGST|GST %/);
    expect(plain).toContain('>Invoice<');
  });

  it('works without a payment QR (it is optional)', () => {
    const upiOnly = buildInvoiceHtml({ bill: makeBill(false), qr: { payload: null, upiId: 'ravi@okaxis' } });
    expect(upiOnly).toContain('Pay by UPI');
    expect(upiOnly).toContain('ravi@okaxis');
    expect(upiOnly).not.toContain('Scan to pay');
    const none = buildInvoiceHtml({ bill: makeBill(false), qr: { payload: null, upiId: '' } });
    expect(none).not.toMatch(/Scan to pay|Pay by UPI/);

    const thermal = (q: { payload: string | null; upiId: string }) =>
      buildThermalBill(makeBill(false), q, 58).map(l => (l.kind === 'text' ? l.text : `[${l.kind}]`)).join('\n');
    expect(thermal({ payload: null, upiId: 'ravi@okaxis' })).not.toContain('[qr]');
    expect(thermal({ payload: null, upiId: 'ravi@okaxis' })).toContain('UPI: ravi@okaxis');
    const bare = thermal({ payload: null, upiId: '' });
    expect(bare).not.toMatch(/\[qr\]|Scan to pay|Pay by UPI/);
    expect(bare).toContain('Thank you, visit again');
    expect(() => encodeEscPos(buildThermalBill(makeBill(false), { payload: null, upiId: '' }, 80))).not.toThrow();
  });

  it('escapes HTML in user text', () => {
    const bill = makeBill(false);
    bill.customerName = '<script>x</script>';
    expect(buildInvoiceHtml({ bill, qr })).not.toContain('<script>');
  });
});
