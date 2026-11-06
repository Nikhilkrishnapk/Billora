/** Field rules from PRD sections 4.1, 6.2 and 7.1. Each returns an error message or null. */

export const isMobile = (v: string) => /^[6-9]\d{9}$/.test(v);

export function validateMobile(v: string): string | null {
  if (!v) return 'Enter a mobile number';
  return isMobile(v) ? null : 'Enter a valid 10-digit mobile number';
}

export function validateLength(v: string, min: number, max: number, label: string): string | null {
  const len = v.trim().length;
  if (len === 0) return `Enter ${label.toLowerCase()}`;
  if (len < min || len > max) return `${label} must be ${min}–${max} characters`;
  return null;
}

export function validateEmail(v: string): string | null {
  if (!v.trim()) return null; // optional
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? null : 'Enter a valid email address';
}

export function validatePincode(v: string): string | null {
  if (!v) return 'Enter PIN code';
  return /^[1-9]\d{5}$/.test(v) ? null : 'PIN code must be 6 digits';
}

export function validateGstin(v: string): string | null {
  const g = v.trim().toUpperCase();
  if (!g) return 'Enter GSTIN';
  if (g.length !== 15) return 'GSTIN must be 15 characters';
  if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g)) return 'Enter a valid GSTIN, e.g. 22AAAAA0000A1Z5';
  return null;
}

export function validateUpiId(v: string): string | null {
  if (!v.trim()) return null; // optional
  return /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/.test(v.trim())
    ? null
    : 'UPI ID must look like name@bank';
}

export function validateQuantity(v: string): string | null {
  const n = Number(v);
  if (!v || Number.isNaN(n)) return 'Enter quantity';
  return n > 0 ? null : 'Quantity must be more than 0';
}

export function validatePrice(v: string): string | null {
  if (v === '') return 'Enter unit price';
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return 'Price must be a number with up to 2 decimals';
  return null;
}

/** Keeps only digits, capped at `max` characters. */
export const digitsOnly = (v: string, max = 10) => v.replace(/\D/g, '').slice(0, max);

/** Allows a decimal number while typing ("1.", "0.5"). */
export const decimalInput = (v: string, decimals?: number) => {
  let s = v.replace(/[^\d.]/g, '');
  const [whole, ...rest] = s.split('.');
  if (rest.length) s = `${whole}.${rest.join('').slice(0, decimals ?? 3)}`;
  return s;
};
