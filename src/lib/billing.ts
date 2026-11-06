/**
 * Bill calculation (PRD section 8).
 *
 * Pure functions with no dependencies, so they are easy to unit-test.
 */

export interface ItemInput {
  productName: string;
  quantity: number;
  unitPrice: number;
  /** GST rate in percent. Ignored (treated as 0) for non-GST merchants. */
  gstRate: number;
  barcode?: string | null;
}

export interface CalculatedItem extends ItemInput {
  taxableValue: number;
  gstAmount: number;
  cgst: number;
  sgst: number;
  lineTotal: number;
}

export interface GstSummaryRow {
  rate: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
}

export interface BillTotals {
  items: CalculatedItem[];
  subtotal: number;
  totalCgst: number;
  totalSgst: number;
  /** Exact total before rounding to the nearest rupee. */
  exactTotal: number;
  roundOff: number;
  grandTotal: number;
  gstSummary: GstSummaryRow[];
}

/** Removes floating-point noise (e.g. 0.1 * 3 = 0.30000000000000004) without losing real precision. */
export function clean(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

export function calculateItem(item: ItemInput, isGstRegistered: boolean): CalculatedItem {
  const rate = isGstRegistered ? item.gstRate : 0;
  const taxableValue = clean(item.quantity * item.unitPrice);
  const gstAmount = clean((taxableValue * rate) / 100);
  const half = clean(gstAmount / 2);
  return {
    ...item,
    gstRate: rate,
    taxableValue,
    gstAmount,
    cgst: half,
    sgst: half,
    lineTotal: clean(taxableValue + gstAmount),
  };
}

export function calculateBill(items: ItemInput[], isGstRegistered: boolean): BillTotals {
  const calculated = items.map(i => calculateItem(i, isGstRegistered));
  const subtotal = clean(calculated.reduce((s, i) => s + i.taxableValue, 0));
  const totalCgst = clean(calculated.reduce((s, i) => s + i.cgst, 0));
  const totalSgst = clean(calculated.reduce((s, i) => s + i.sgst, 0));
  const exactTotal = clean(subtotal + totalCgst + totalSgst);
  const grandTotal = Math.round(exactTotal);
  const roundOff = clean(grandTotal - exactTotal);

  const byRate = new Map<number, GstSummaryRow>();
  if (isGstRegistered) {
    for (const i of calculated) {
      const row = byRate.get(i.gstRate) ?? { rate: i.gstRate, taxableValue: 0, cgst: 0, sgst: 0 };
      row.taxableValue = clean(row.taxableValue + i.taxableValue);
      row.cgst = clean(row.cgst + i.cgst);
      row.sgst = clean(row.sgst + i.sgst);
      byRate.set(i.gstRate, row);
    }
  }

  return {
    items: calculated,
    subtotal,
    totalCgst,
    totalSgst,
    exactTotal,
    roundOff,
    grandTotal,
    gstSummary: [...byRate.values()].sort((a, b) => a.rate - b.rate),
  };
}

/** Indian financial year label for a date, e.g. 2026-27 for any date from 1 Apr 2026 to 31 Mar 2027. */
export function financialYear(date: Date, timeZoneOffsetMinutes = 330): string {
  // Bills are issued in India: evaluate the date in IST regardless of device / server zone.
  const ist = new Date(date.getTime() + timeZoneOffsetMinutes * 60_000);
  const year = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/** INV/2026-27/0001 */
export function formatBillNumber(fy: string, sequence: number): string {
  return `INV/${fy}/${String(sequence).padStart(4, '0')}`;
}
