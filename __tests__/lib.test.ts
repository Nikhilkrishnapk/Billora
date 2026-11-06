import { numberToIndianWords, rupeesInWords } from '../src/lib/numberToWords';
import { parseUpiQr } from '../src/lib/upi';
import { formatAmount, invoiceFileName, signed } from '../src/lib/format';
import { validateGstin, validateUpiId, validateMobile, validateEmail, validatePincode, validatePrice } from '../src/lib/validation';
import { customRange, quickRange } from '../src/lib/dateRanges';

test('amount in words', () => {
  expect(rupeesInWords(289)).toBe('Rupees Two Hundred Eighty-Nine Only');
  expect(numberToIndianWords(0)).toBe('Zero');
  expect(numberToIndianWords(100000)).toBe('One Lakh');
  expect(numberToIndianWords(12345678)).toBe('One Crore Twenty-Three Lakh Forty-Five Thousand Six Hundred Seventy-Eight');
  expect(numberToIndianWords(8450)).toBe('Eight Thousand Four Hundred Fifty');
});

test('UPI QR parsing', () => {
  expect(parseUpiQr('upi://pay?pa=shop@okaxis&pn=Ravi%20Stores&cu=INR')).toEqual({ upiId: 'shop@okaxis', payeeName: 'Ravi Stores' });
  expect(parseUpiQr('UPI://pay?pn=A+B&pa=x@ybl')).toEqual({ upiId: 'x@ybl', payeeName: 'A B' });
  expect(parseUpiQr('https://example.com')).toBeNull();
  expect(parseUpiQr('upi://pay?pn=NoId')).toBeNull();
});

test('formatting', () => {
  expect(formatAmount(8450)).toBe('8,450.00');
  expect(formatAmount(1234567.891)).toBe('12,34,567.89');
  expect(formatAmount(0.5)).toBe('0.50');
  expect(signed(0.5)).toBe('+0.50');
  expect(signed(-0.25)).toBe('-0.25');
  expect(invoiceFileName('INV/2026-27/0001', 'Ravi')).toBe('INV-2026-27-0001_Ravi.pdf');
});

test('validation', () => {
  expect(validateGstin('22AAAAA0000A1Z5')).toBeNull();
  expect(validateGstin('22aaaaa0000a1z5')).toBeNull();
  expect(validateGstin('2AAAAA0000A1Z55')).toMatch(/valid GSTIN/);
  expect(validateGstin('22AAAAA0000A1Z')).toMatch(/15/);
  expect(validateUpiId('ravi.stores@okaxis')).toBeNull();
  expect(validateUpiId('ravi')).not.toBeNull();
  expect(validateUpiId('')).toBeNull();
  expect(validateMobile('9876543210')).toBeNull();
  expect(validateMobile('12345')).not.toBeNull();
  expect(validateEmail('')).toBeNull();
  expect(validateEmail('a@b.in')).toBeNull();
  expect(validateEmail('a@b')).not.toBeNull();
  expect(validatePincode('560001')).toBeNull();
  expect(validatePincode('056001')).not.toBeNull();
  expect(validatePrice('10.5')).toBeNull();
  expect(validatePrice('10.555')).not.toBeNull();
});

test('date ranges', () => {
  const now = new Date(2026, 10, 5, 21, 0); // Thu 5 Nov 2026
  expect(quickRange('today', now)).toEqual({ start: new Date(2026, 10, 5), end: new Date(2026, 10, 6) });
  expect(quickRange('yesterday', now)).toEqual({ start: new Date(2026, 10, 4), end: new Date(2026, 10, 5) });
  expect(quickRange('week', now).start).toEqual(new Date(2026, 10, 2)); // Monday
  expect(quickRange('month', now).start).toEqual(new Date(2026, 10, 1));
  expect(customRange(new Date(2026, 10, 3), new Date(2026, 10, 1))).toEqual({ start: new Date(2026, 10, 1), end: new Date(2026, 10, 4) });
});
