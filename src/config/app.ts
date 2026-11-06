/** The app name, kept in one place (PRD 16.7). Also update app.json, android strings.xml and iOS CFBundleDisplayName. */
export const APP_NAME = 'Billora';

/** Default GST slabs (GST 2.0, 22 Sep 2025). The live list comes from Remote Config key `gst_rates`. */
export const DEFAULT_GST_RATES = [0, 3, 5, 18, 40];

export const OTP_LENGTH = 6;
export const OTP_EXPIRY_MS = 5 * 60_000;
export const OTP_RESEND_SECONDS = 30;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_LOCK_MS = 15 * 60_000;

export const QR_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_MAX_BYTES = 1 * 1024 * 1024;

export const HISTORY_PAGE_SIZE = 25;
