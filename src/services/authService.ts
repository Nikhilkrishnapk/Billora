/**
 * Mobile number + OTP sign-in (PRD section 3).
 *
 * The confirmation object from Firebase is not serialisable, so it lives here
 * (module state) instead of navigation params.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { signInWithPhoneNumber, signOut as fbSignOut, type ConfirmationResult } from '@react-native-firebase/auth';
import { doc, getDoc } from '@react-native-firebase/firestore';
import { auth, db, UserFacingError } from './firebase';
import { OTP_EXPIRY_MS, OTP_LOCK_MS, OTP_MAX_ATTEMPTS } from '../config/app';

type Confirmation = ConfirmationResult;

let pending: { mobile: string; confirmation: Confirmation; sentAt: number } | null = null;
/** Owner name typed on the Register screen, used when the merchant record is created after OTP. */
let pendingOwnerName: string | null = null;

export const setPendingOwnerName = (name: string | null) => {
  pendingOwnerName = name;
};
export const takePendingOwnerName = () => {
  const n = pendingOwnerName;
  pendingOwnerName = null;
  return n;
};

/**
 * Registered-number check before sending the OTP (PRD 3.1). Reads registeredNumbers/{+91…},
 * a public "phone book" that only says whether an account exists (rules allow a single-document
 * read, never a list). Free-plan replacement for a Cloud Function.
 */
export async function isRegistered(mobile: string): Promise<boolean> {
  const snap = await getDoc(doc(db(), 'registeredNumbers', `+91${mobile}`));
  return snap.exists();
}

export async function sendOtp(mobile: string): Promise<void> {
  const lockedFor = await lockRemainingMs(mobile);
  if (lockedFor > 0) throw new OtpLockedError(lockedFor);
  const confirmation = await signInWithPhoneNumber(auth(), `+91${mobile}`);
  pending = { mobile, confirmation, sentAt: Date.now() };
}

export const otpSentAt = () => pending?.sentAt ?? 0;

export class OtpLockedError extends UserFacingError {
  constructor(public remainingMs: number) {
    super(`Too many wrong attempts. Try again in ${Math.ceil(remainingMs / 60_000)} min.`);
  }
}
export class OtpExpiredError extends UserFacingError {
  constructor() {
    super('This OTP has expired. Tap Resend OTP to get a new one.');
  }
}
export class OtpIncorrectError extends UserFacingError {
  constructor(public attemptsLeft: number) {
    super('Incorrect OTP. Try again.');
  }
}

export async function verifyOtp(code: string): Promise<void> {
  if (!pending) throw new OtpExpiredError();
  const { mobile, confirmation, sentAt } = pending;
  const lockedFor = await lockRemainingMs(mobile);
  if (lockedFor > 0) throw new OtpLockedError(lockedFor);
  if (Date.now() - sentAt > OTP_EXPIRY_MS) throw new OtpExpiredError();
  try {
    await confirmation.confirm(code);
    await AsyncStorage.removeItem(lockKey(mobile));
    pending = null;
  } catch (e) {
    const c = (e as { code?: string }).code ?? '';
    if (c.includes('invalid-verification-code')) {
      const left = await recordWrongAttempt(mobile);
      if (left <= 0) throw new OtpLockedError(OTP_LOCK_MS);
      throw new OtpIncorrectError(left);
    }
    if (c.includes('session-expired') || c.includes('code-expired')) throw new OtpExpiredError();
    throw e;
  }
}

export async function signOut() {
  pending = null;
  await fbSignOut(auth());
}

/* ---- 5 wrong attempts → 15 minute lock (stored per number on this device) ---- */

const lockKey = (mobile: string) => `otp-lock:${mobile}`;

interface LockState {
  attempts: number;
  lockedUntil: number;
}

async function readLock(mobile: string): Promise<LockState> {
  const raw = await AsyncStorage.getItem(lockKey(mobile));
  return raw ? JSON.parse(raw) : { attempts: 0, lockedUntil: 0 };
}

export async function lockRemainingMs(mobile: string): Promise<number> {
  const s = await readLock(mobile);
  if (s.lockedUntil && s.lockedUntil <= Date.now()) {
    await AsyncStorage.removeItem(lockKey(mobile));
    return 0;
  }
  return Math.max(0, s.lockedUntil - Date.now());
}

async function recordWrongAttempt(mobile: string): Promise<number> {
  const s = await readLock(mobile);
  s.attempts += 1;
  if (s.attempts >= OTP_MAX_ATTEMPTS) {
    s.lockedUntil = Date.now() + OTP_LOCK_MS;
    pending = null;
  }
  await AsyncStorage.setItem(lockKey(mobile), JSON.stringify(s));
  return OTP_MAX_ATTEMPTS - s.attempts;
}
