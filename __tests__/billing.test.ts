import { calculateBill, financialYear, formatBillNumber } from '../src/lib/billing';

describe('calculateBill', () => {
  it('reproduces the PRD worked example (section 8.3)', () => {
    const t = calculateBill(
      [
        { productName: 'Item A', quantity: 2, unitPrice: 100, gstRate: 18 },
        { productName: 'Item B', quantity: 1, unitPrice: 50, gstRate: 5 },
      ],
      true,
    );
    expect(t.items.map(i => [i.taxableValue, i.cgst, i.sgst, i.lineTotal])).toEqual([
      [200, 18, 18, 236],
      [50, 1.25, 1.25, 52.5],
    ]);
    expect(t.subtotal).toBe(250);
    expect(t.totalCgst).toBe(19.25);
    expect(t.totalSgst).toBe(19.25);
    expect(t.exactTotal).toBe(288.5);
    expect(t.roundOff).toBe(0.5);
    expect(t.grandTotal).toBe(289);
    expect(t.gstSummary).toEqual([
      { rate: 5, taxableValue: 50, cgst: 1.25, sgst: 1.25 },
      { rate: 18, taxableValue: 200, cgst: 18, sgst: 18 },
    ]);
  });

  it('ignores GST for non-GST merchants and rounds to the nearest rupee', () => {
    const t = calculateBill([{ productName: 'Rice', quantity: 1.5, unitPrice: 45.3, gstRate: 18 }], false);
    expect(t.items[0].gstRate).toBe(0);
    expect(t.totalCgst).toBe(0);
    expect(t.subtotal).toBe(67.95);
    expect(t.grandTotal).toBe(68);
    expect(t.roundOff).toBe(0.05);
    expect(t.gstSummary).toEqual([]);
  });

  it('has no floating point noise', () => {
    const t = calculateBill([{ productName: 'x', quantity: 3, unitPrice: 0.1, gstRate: 0 }], false);
    expect(t.subtotal).toBe(0.3);
    expect(t.roundOff).toBe(-0.3);
    expect(t.grandTotal).toBe(0);
  });

  it('rounds down below .5', () => {
    const t = calculateBill([{ productName: 'x', quantity: 1, unitPrice: 10.49, gstRate: 0 }], false);
    expect(t.grandTotal).toBe(10);
    expect(t.roundOff).toBe(-0.49);
  });
});

describe('bill numbers', () => {
  it('uses the Indian financial year in IST', () => {
    expect(financialYear(new Date('2026-11-05T10:00:00Z'))).toBe('2026-27');
    expect(financialYear(new Date('2027-03-31T18:00:00Z'))).toBe('2026-27'); // 23:30 IST 31 Mar
    expect(financialYear(new Date('2027-03-31T18:31:00Z'))).toBe('2027-28'); // 00:01 IST 1 Apr
    expect(financialYear(new Date('2099-01-01T00:00:00Z'))).toBe('2098-99');
    expect(financialYear(new Date('2099-06-01T00:00:00Z'))).toBe('2099-00');
  });
  it('formats as INV/2026-27/0001', () => {
    expect(formatBillNumber('2026-27', 1)).toBe('INV/2026-27/0001');
    expect(formatBillNumber('2026-27', 12345)).toBe('INV/2026-27/12345');
  });
});
