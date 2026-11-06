/** Saved products (barcode lookup, name suggestions) and customers (name auto-fill). */
import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from '@react-native-firebase/firestore';
import { db } from './firebase';
import type { Product } from '../types';

/** Product document id: one per barcode, or one per normalised name for manual items. */
export const productDocId = (name: string, barcode: string | null) =>
  barcode ? `bc_${barcode.replace(/[^A-Za-z0-9_-]/g, '_')}` : `nm_${normaliseName(name).replace(/[^a-z0-9]+/g, '_').slice(0, 120)}`;

export const normaliseName = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');

const mapProduct = (id: string, d: Record<string, any>): Product => ({
  productId: id,
  name: d.name,
  barcode: d.barcode ?? null,
  unitPrice: Number(d.unitPrice ?? 0),
  gstRate: Number(d.gstRate ?? 0),
});

export async function findProductByBarcode(uid: string, barcode: string): Promise<Product | null> {
  const snap = await getDoc(doc(db(), 'merchants', uid, 'products', productDocId('', barcode)));
  const d = snap.data();
  return d ? mapProduct(snap.id, d) : null;
}

export async function suggestProducts(uid: string, text: string): Promise<Product[]> {
  const prefix = normaliseName(text);
  if (prefix.length < 1) return [];
  const q = query(
    collection(db(), 'merchants', uid, 'products'),
    where('nameLower', '>=', prefix),
    where('nameLower', '<=', `${prefix}`),
    orderBy('nameLower'),
    limit(6),
  );
  const res = await getDocs(q);
  return res.docs.map((d: any) => mapProduct(d.id, d.data()));
}

export async function findCustomerName(uid: string, mobile: string): Promise<string | null> {
  const snap = await getDoc(doc(db(), 'merchants', uid, 'customers', mobile));
  return snap.data()?.name ?? null;
}
