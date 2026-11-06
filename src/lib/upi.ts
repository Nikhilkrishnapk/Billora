export interface UpiInfo {
  upiId: string;
  payeeName: string | null;
}

/** Parses a UPI QR payload such as `upi://pay?pa=shop@okbank&pn=My%20Shop&cu=INR`. */
export function parseUpiQr(payload: string): UpiInfo | null {
  const trimmed = payload.trim();
  if (!/^upi:\/\/pay\?/i.test(trimmed)) return null;
  const query = trimmed.slice(trimmed.indexOf('?') + 1);
  const params: Record<string, string> = {};
  for (const pair of query.split('&')) {
    const eq = pair.indexOf('=');
    if (eq < 0) continue;
    const key = pair.slice(0, eq).toLowerCase();
    const raw = pair.slice(eq + 1).replace(/\+/g, ' ');
    try {
      params[key] = decodeURIComponent(raw);
    } catch {
      params[key] = raw;
    }
  }
  if (!params.pa) return null;
  return { upiId: params.pa, payeeName: params.pn?.trim() || null };
}
