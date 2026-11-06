import { fetchAndActivate, getRemoteConfig, getValue } from '@react-native-firebase/remote-config';
import { DEFAULT_GST_RATES } from '../config/app';

/** GST slabs live in Remote Config (`gst_rates`, a JSON array) so they can change without an app update. */
export async function loadGstRates(): Promise<number[]> {
  try {
    const rc = getRemoteConfig();
    rc.defaultConfig = { gst_rates: JSON.stringify(DEFAULT_GST_RATES) };
    await fetchAndActivate(rc);
    const parsed = JSON.parse(getValue(rc, 'gst_rates').asString());
    if (Array.isArray(parsed) && parsed.every(n => typeof n === 'number' && n >= 0 && n <= 100)) {
      return [...parsed].sort((a, b) => a - b);
    }
  } catch {
    // offline or bad value: fall back to defaults
  }
  return DEFAULT_GST_RATES;
}
