import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc, writeBatch } from '@react-native-firebase/firestore';
import type { User } from '@react-native-firebase/auth';
import { db, toDate } from './firebase';
import type { BusinessProfile, Merchant, PaperWidth } from '../types';

/** Layout: merchants/{uid} (account) and merchants/{uid}/settings/profile (business profile). */
const merchantRef = (uid: string) => doc(db(), 'merchants', uid);
const profileRef = (uid: string) => doc(db(), 'merchants', uid, 'settings', 'profile');

/** Creates the merchant record (and its registered-number entry) on first sign-in; afterwards records the login time. */
export async function ensureMerchant(user: User, ownerName: string | null) {
  const ref_ = merchantRef(user.uid);
  const snap = await getDoc(ref_);
  if (!snap.exists()) {
    const batch = writeBatch(db());
    batch.set(ref_, {
      mobileNumber: user.phoneNumber ?? '',
      ownerName: ownerName ?? '',
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    });
    if (user.phoneNumber) batch.set(doc(db(), 'registeredNumbers', user.phoneNumber), { uid: user.uid });
    await batch.commit();
  } else {
    await updateDoc(ref_, { lastLoginAt: serverTimestamp() });
  }
}

export function subscribeMerchant(uid: string, cb: (m: Merchant | null) => void) {
  return onSnapshot(merchantRef(uid), snap => {
    const d = snap.data();
    cb(
      d
        ? {
            mobileNumber: d.mobileNumber,
            ownerName: d.ownerName ?? '',
            createdAt: toDate(d.createdAt),
            lastLoginAt: toDate(d.lastLoginAt),
          }
        : null,
    );
  });
}

export function subscribeProfile(uid: string, cb: (p: BusinessProfile | null) => void, onError: (e: Error) => void) {
  // includeMetadataChanges: when the cache already knows "no profile" (signed up, but setup was
  // never saved), the server's confirmation changes only metadata. Without this flag Firestore
  // never reports that confirmation, so the app would wait on the splash forever.
  return onSnapshot(
    profileRef(uid),
    { includeMetadataChanges: true },
    snap => {
      const d = snap.data();
      if (!d) {
        // An empty cache result while offline does not mean "no profile"; wait for the server.
        if (snap.metadata.fromCache) return;
        return cb(null);
      }
      cb({
        ownerName: d.ownerName ?? '',
        companyName: d.companyName ?? '',
        contactNumber: d.contactNumber ?? '',
        email: d.email ?? '',
        addressLine: d.addressLine ?? '',
        city: d.city ?? '',
        state: d.state ?? '',
        pincode: d.pincode ?? '',
        isGstRegistered: !!d.isGstRegistered,
        gstin: d.gstin ?? '',
        logoDataUri: d.logoDataUri ?? null,
        qrPayload: d.qrPayload ?? '',
        qrCodeUpdatedAt: toDate(d.qrCodeUpdatedAt),
        upiId: d.upiId ?? '',
        printerPaperWidth: (d.printerPaperWidth === 80 ? 80 : 58) as PaperWidth,
        complete: !!d.complete,
      });
    },
    onError,
  );
}

export async function saveProfile(uid: string, data: Partial<BusinessProfile>) {
  // qrCodeUpdatedAt is only ever set by savePaymentQr (server timestamp).
  const rest: Partial<BusinessProfile> = { ...data };
  delete rest.qrCodeUpdatedAt;
  await setDoc(profileRef(uid), { ...rest, updatedAt: serverTimestamp() }, { merge: true });
}

export async function updateOwnerName(uid: string, ownerName: string) {
  await updateDoc(merchantRef(uid), { ownerName });
}

/**
 * Replaces the payment QR (PRD 12.2). Only the QR's text is stored; the app redraws it
 * sharply on screen, on the thermal bill and in the PDF. Applies to every future print
 * and share, including reprints.
 */
export async function savePaymentQr(uid: string, qr: { payload: string; upiId: string }) {
  await setDoc(
    profileRef(uid),
    { qrPayload: qr.payload, upiId: qr.upiId, qrCodeUpdatedAt: serverTimestamp(), updatedAt: serverTimestamp() },
    { merge: true },
  );
}
