import {
  collection,
  runTransaction,
  serverTimestamp,
  count,
  doc,
  getAggregateFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  sum,
  Timestamp,
  where,
  type QueryDocumentSnapshot,
} from '@react-native-firebase/firestore';
import { db, toDate } from './firebase';
import { calculateBill, financialYear, formatBillNumber } from '../lib/billing';
import { normaliseName, productDocId } from './catalogService';
import type { DateRange } from '../lib/dateRanges';
import type { Bill, DraftItem } from '../types';
import { HISTORY_PAGE_SIZE } from '../config/app';

const billsCol = (uid: string) => collection(db(), 'merchants', uid, 'bills');

export function mapBill(id: string, d: Record<string, any>): Bill {
  return {
    billId: id,
    billNumber: d.billNumber,
    billDatetime: toDate(d.billDatetime) ?? new Date(),
    customerName: d.customerName,
    customerMobile: d.customerMobile,
    items: d.items ?? [],
    subtotal: d.subtotal,
    totalCgst: d.totalCgst ?? 0,
    totalSgst: d.totalSgst ?? 0,
    roundOff: d.roundOff ?? 0,
    grandTotal: d.grandTotal,
    businessSnapshot: d.businessSnapshot,
  };
}

/** Next bill number, for display while the bill is being created. The real number is issued atomically on save. */
export async function peekNextBillNumber(uid: string): Promise<string> {
  const fy = financialYear(new Date());
  try {
    const snap = await getDoc(doc(db(), 'merchants', uid, 'counters', fy));
    return formatBillNumber(fy, (snap.data()?.last ?? 0) + 1);
  } catch {
    return formatBillNumber(fy, 1);
  }
}

export interface CreateBillRequest {
  requestId: string;
  customerName: string;
  customerMobile: string;
  items: Omit<DraftItem, 'key'>[];
}

/**
 * Saves the bill in one Firestore transaction (free-plan replacement for a Cloud Function):
 *  - issues the next bill number from merchants/{uid}/counters/{fy}, so two bills can never share a number
 *  - copies the business profile into businessSnapshot (used for reprints)
 *  - remembers the customer (name auto-fill) and products (barcode lookup, suggestions)
 * Security rules check the number is exactly counter + 1, the time is the server's, and that
 * saved bills can never be changed or deleted. The bill id is `requestId`, so a retry after a
 * network error returns the bill that was already saved instead of creating a second one.
 */
export async function createBill(uid: string, req: CreateBillRequest): Promise<Bill> {
  const merchant = doc(db(), 'merchants', uid);
  const billRef = doc(billsCol(uid), req.requestId);
  const fy = financialYear(new Date());
  const counterRef = doc(db(), 'merchants', uid, 'counters', fy);

  await runTransaction(db(), async tx => {
    const existing = await tx.get(billRef);
    if (existing.exists()) return;
    const profileSnap = await tx.get(doc(db(), 'merchants', uid, 'settings', 'profile'));
    const p = profileSnap.data();
    if (!p?.complete) throw new Error('Complete your business profile first.');
    const counter = await tx.get(counterRef);
    const sequence = (counter.data()?.last ?? 0) + 1;

    const gst = !!p.isGstRegistered;
    const t = calculateBill(req.items, gst);
    tx.set(counterRef, { last: sequence, updatedAt: serverTimestamp() });
    tx.set(billRef, {
      billNumber: formatBillNumber(fy, sequence),
      fy,
      sequence,
      billDatetime: serverTimestamp(),
      customerName: req.customerName,
      customerMobile: req.customerMobile,
      items: t.items.map(i => ({
        productName: i.productName,
        barcode: i.barcode ?? null,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        gstRate: i.gstRate,
        taxableValue: i.taxableValue,
        cgst: i.cgst,
        sgst: i.sgst,
        lineTotal: i.lineTotal,
      })),
      subtotal: t.subtotal,
      totalCgst: t.totalCgst,
      totalSgst: t.totalSgst,
      roundOff: t.roundOff,
      grandTotal: t.grandTotal,
      businessSnapshot: {
        ownerName: p.ownerName ?? '',
        companyName: p.companyName ?? '',
        contactNumber: p.contactNumber ?? '',
        email: p.email ?? '',
        addressLine: p.addressLine ?? '',
        city: p.city ?? '',
        state: p.state ?? '',
        pincode: p.pincode ?? '',
        isGstRegistered: gst,
        gstin: gst ? p.gstin ?? '' : '',
        logoDataUri: p.logoDataUri ?? null,
      },
    });
    tx.set(
      doc(merchant, 'customers', req.customerMobile),
      { mobileNumber: req.customerMobile, name: req.customerName, updatedAt: serverTimestamp() },
      { merge: true },
    );
    const seen = new Set<string>();
    for (const i of req.items) {
      const id = productDocId(i.productName, i.barcode);
      if (seen.has(id)) continue;
      seen.add(id);
      tx.set(
        doc(merchant, 'products', id),
        {
          name: i.productName,
          nameLower: normaliseName(i.productName),
          barcode: i.barcode,
          unitPrice: i.unitPrice,
          gstRate: gst ? i.gstRate : 0,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    }
  });

  const saved = await getBill(uid, req.requestId);
  if (!saved) throw new Error('The bill was saved but could not be loaded. Find it in Transaction history.');
  return saved;
}

export async function getBill(uid: string, billId: string): Promise<Bill | null> {
  const snap = await getDoc(doc(billsCol(uid), billId));
  const d = snap.data();
  return d ? mapBill(snap.id, d) : null;
}

const inRange = (uid: string, range: DateRange) =>
  query(
    billsCol(uid),
    where('billDatetime', '>=', Timestamp.fromDate(range.start)),
    where('billDatetime', '<', Timestamp.fromDate(range.end)),
  );
const rangeQuery = (uid: string, range: DateRange) => query(inRange(uid, range), orderBy('billDatetime', 'desc'));

export async function listBills(
  uid: string,
  range: DateRange,
  after?: QueryDocumentSnapshot,
) {
  const base = rangeQuery(uid, range);
  const q = after ? query(base, startAfter(after), limit(HISTORY_PAGE_SIZE)) : query(base, limit(HISTORY_PAGE_SIZE));
  const res = await getDocs(q);
  return {
    bills: res.docs.map((d: any) => mapBill(d.id, d.data())),
    last: res.docs[res.docs.length - 1],
    done: res.docs.length < HISTORY_PAGE_SIZE,
  };
}

/** "12 bills · ₹8,450.00" for the selected range. */
export async function rangeStats(uid: string, range: DateRange) {
  // No orderBy: totals don't need one, and this matches the (billDatetime, grandTotal) ascending
  // index in firestore.indexes.json. Sorting desc here would need a second, descending index.
  const snap = await getAggregateFromServer(inRange(uid, range), {
    bills: count(),
    total: sum('grandTotal'),
  });
  const d = snap.data();
  return { count: Number(d.bills ?? 0), total: Number(d.total ?? 0) };
}

/* In-memory cache so Bill saved / Print preview open instantly after a save. */
const cache = new Map<string, Bill>();
export const cacheBill = (b: Bill) => cache.set(b.billId, b);
export async function loadBill(uid: string, billId: string): Promise<Bill | null> {
  const hit = cache.get(billId);
  if (hit) return hit;
  const b = await getBill(uid, billId);
  if (b) cache.set(billId, b);
  return b;
}

/* ---- Home dashboard ---- */

/** The newest `n` bills, any date (Home → Recent bills). */
export async function recentBills(uid: string, n = 3): Promise<Bill[]> {
  const res = await getDocs(query(billsCol(uid), orderBy('billDatetime', 'desc'), limit(n)));
  return res.docs.map((d: any) => mapBill(d.id, d.data()));
}

export interface DayStat {
  /** 00:00 local of that day */
  day: Date;
  count: number;
  total: number;
}

/**
 * Bills and revenue for each of the last `days` days (oldest first, today last), using
 * server-side count/sum so no bill documents are downloaded. Throws when offline.
 */
export async function dailyStats(uid: string, days = 7, now = new Date()): Promise<DayStat[]> {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const ranges = Array.from({ length: days }, (_, i) => {
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1 - i));
    return { start, end: new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1) };
  });
  const stats = await Promise.all(ranges.map(r => rangeStats(uid, r)));
  return ranges.map((r, i) => ({ day: r.start, ...stats[i] }));
}
