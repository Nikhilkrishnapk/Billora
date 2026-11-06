import { getAuth } from '@react-native-firebase/auth';
import { getFirestore } from '@react-native-firebase/firestore';

export const auth = () => getAuth();
export const db = () => getFirestore();

export function currentUid(): string {
  const uid = getAuth().currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  return uid;
}

/** Firestore Timestamp | Date | null → Date | null */
export function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof (v as { toDate?: () => Date }).toDate === 'function') return (v as { toDate: () => Date }).toDate();
  return null;
}

/**
 * An error whose message is written for the merchant and can be shown as-is
 * (e.g. "Incorrect OTP"). Anything else goes through friendlyError's code map.
 */
export class UserFacingError extends Error {}

const GENERIC = 'Something went wrong. Please try again.';
const SERVER = 'Server error. Please try again in a few minutes.';
const NO_NETWORK = 'No internet connection. Check your network and try again.';
const OTP_UNAVAILABLE = "We couldn't send the OTP right now. Please try again later.";
const DEVICE_CHECK = "We couldn't verify this device. Update the app or try again later.";
const SESSION = 'Your session has expired. Please sign in again.';

/** Keyed by the error code without its "auth/" or "firestore/" prefix. */
const MESSAGES: Record<string, string> = {
  // Sign-in / OTP
  'operation-not-allowed': OTP_UNAVAILABLE,
  'billing-not-enabled': OTP_UNAVAILABLE,
  'app-not-authorized': DEVICE_CHECK,
  'invalid-app-credential': DEVICE_CHECK,
  'missing-client-identifier': DEVICE_CHECK,
  'captcha-check-failed': DEVICE_CHECK,
  'missing-verification-id': 'Please request a new OTP and try again.',
  'invalid-verification-id': 'Please request a new OTP and try again.',
  'invalid-phone-number': 'That mobile number is not valid.',
  'missing-phone-number': 'Enter your mobile number.',
  'invalid-verification-code': 'Incorrect OTP. Try again.',
  'missing-verification-code': 'Enter the OTP sent to your number.',
  'code-expired': 'This OTP has expired. Tap Resend OTP to get a new one.',
  'session-expired': 'This OTP has expired. Tap Resend OTP to get a new one.',
  'too-many-requests': 'Too many attempts. Please wait a while and try again.',
  'quota-exceeded': 'OTP limit reached for today. Please try again later.',
  'user-disabled': 'This account has been blocked. Please contact support.',
  'user-token-expired': SESSION,
  'requires-recent-login': SESSION,
  'network-request-failed': NO_NETWORK,
  // Database
  'permission-denied': "This wasn't allowed. Check your phone's date and time are set automatically, then try again.",
  unauthenticated: SESSION,
  unavailable: 'Server is not reachable. Check your internet and try again.',
  'deadline-exceeded': 'The server took too long to respond. Please try again.',
  'resource-exhausted': 'Server is busy right now. Please try again later.',
  'not-found': "We couldn't find that record. It may have been deleted.",
  'already-exists': 'This record already exists.',
  cancelled: 'The request was interrupted. Please try again.',
  aborted: 'The request was interrupted. Please try again.',
  'failed-precondition': SERVER,
  internal: SERVER,
  'internal-error': SERVER,
  'data-loss': SERVER,
  unknown: SERVER,
};

/**
 * Turns any error into a short message a merchant can act on. Never shows raw
 * library text (which mentions Firebase, consoles, etc.); the real code is
 * logged in development builds instead.
 */
export function friendlyError(e: unknown): string {
  if (e instanceof UserFacingError) return e.message;
  const rawCode = (e as { code?: string })?.code ?? '';
  const code = rawCode.replace(/^[a-z-]+\//, '');
  const message = (e as { message?: string })?.message ?? '';
  if (__DEV__) console.warn('[friendlyError]', rawCode || '(no code)', message);
  if (MESSAGES[code]) return MESSAGES[code];
  if (/network|offline|timed? ?out/i.test(code) || /network|offline/i.test(message)) return NO_NETWORK;
  return rawCode ? SERVER : GENERIC;
}
