/**
 * Bluetooth ESC/POS printing (PRD 10.1, 12.4).
 *
 * Uses Bluetooth Low Energy, which works on both Android and iOS. Most current
 * 58/80 mm portable printers expose a BLE "serial" characteristic; we pick the
 * first writable one. The paired printer is remembered on this device.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, PermissionsAndroid, Platform } from 'react-native';
import { BleManager, State, type Device } from 'react-native-ble-plx';
import { Buffer } from 'buffer';

export interface SavedPrinter {
  id: string;
  name: string;
  serviceUUID: string;
  charUUID: string;
  withResponse: boolean;
}

export type PrinterErrorKind = 'bluetooth-off' | 'not-found' | 'failed' | 'no-printer' | 'permission';

export class PrinterError extends Error {
  constructor(public kind: PrinterErrorKind) {
    super(
      {
        'bluetooth-off': 'Turn on Bluetooth to print',
        'not-found': 'Printer not found. Check it is on and nearby.',
        failed: 'Printing failed. Try again.',
        'no-printer': 'No printer set up yet.',
        permission: 'Allow Bluetooth access in Settings to print.',
      }[kind],
    );
  }
}

const KEY = 'printer';
let manager: BleManager | null = null;
const ble = () => (manager ??= new BleManager());

export async function getSavedPrinter(): Promise<SavedPrinter | null> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function forgetPrinter() {
  await AsyncStorage.removeItem(KEY);
}

async function ensurePermissions() {
  if (Platform.OS !== 'android') return;
  const perms =
    Number(Platform.Version) >= 31
      ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  const res = await PermissionsAndroid.requestMultiple(perms);
  if (!Object.values(res).every(r => r === PermissionsAndroid.RESULTS.GRANTED)) throw new PrinterError('permission');
}

async function ensurePoweredOn() {
  let state = await ble().state();
  if (state === State.Unknown || state === State.Resetting) {
    await new Promise<void>(r => setTimeout(() => r(), 600));
    state = await ble().state();
  }
  if (state === State.Unauthorized) throw new PrinterError('permission');
  if (state !== State.PoweredOn) throw new PrinterError('bluetooth-off');
}

/** "Turn on Bluetooth" shortcut. Android can switch it on directly; iOS opens Settings. */
export async function turnOnBluetooth() {
  if (Platform.OS === 'android') {
    try {
      await ble().enable();
      return;
    } catch {
      // fall through to settings
    }
    await Linking.sendIntent('android.settings.BLUETOOTH_SETTINGS').catch(() => Linking.openSettings());
  } else {
    await Linking.openSettings();
  }
}

/** Scans for nearby devices for `ms` milliseconds. Returns a stop function. */
export async function scanPrinters(onFound: (d: { id: string; name: string }) => void, ms = 10_000) {
  await ensurePermissions();
  await ensurePoweredOn();
  const seen = new Set<string>();
  ble().startDeviceScan(null, { allowDuplicates: false }, (err, device) => {
    if (err || !device) return;
    const name = device.name ?? device.localName;
    if (!name || seen.has(device.id)) return;
    seen.add(device.id);
    onFound({ id: device.id, name });
  });
  const timer = setTimeout(() => ble().stopDeviceScan(), ms);
  return () => {
    clearTimeout(timer);
    ble().stopDeviceScan();
  };
}

async function connect(id: string): Promise<Device> {
  try {
    const already = await ble().isDeviceConnected(id);
    let device = already
      ? (await ble().devices([id]))[0]
      : await ble().connectToDevice(id, { timeout: 5000 });
    device = await device.discoverAllServicesAndCharacteristics();
    if (Platform.OS === 'android') {
      device = await device.requestMTU(512).catch(() => device);
    }
    return device;
  } catch {
    throw new PrinterError('not-found');
  }
}

/** Connects, finds a writable characteristic and saves the printer. */
export async function pairPrinter(id: string, name: string): Promise<SavedPrinter> {
  await ensurePermissions();
  await ensurePoweredOn();
  ble().stopDeviceScan();
  const device = await connect(id);
  for (const service of await device.services()) {
    for (const c of await service.characteristics()) {
      if (c.isWritableWithoutResponse || c.isWritableWithResponse) {
        const printer: SavedPrinter = {
          id,
          name,
          serviceUUID: service.uuid,
          charUUID: c.uuid,
          withResponse: !c.isWritableWithoutResponse,
        };
        await AsyncStorage.setItem(KEY, JSON.stringify(printer));
        return printer;
      }
    }
  }
  throw new Error('This device does not accept print data. Pick a thermal printer.');
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(() => r(), ms));

export async function printBytes(bytes: Uint8Array) {
  const printer = await getSavedPrinter();
  if (!printer) throw new PrinterError('no-printer');
  await ensurePermissions();
  await ensurePoweredOn();
  const device = await connect(printer.id);
  const chunk = Math.max(20, Math.min(180, (device.mtu ?? 23) - 3));
  try {
    for (let i = 0; i < bytes.length; i += chunk) {
      const b64 = Buffer.from(bytes.subarray(i, i + chunk)).toString('base64');
      if (printer.withResponse) {
        await ble().writeCharacteristicWithResponseForDevice(printer.id, printer.serviceUUID, printer.charUUID, b64);
      } else {
        await ble().writeCharacteristicWithoutResponseForDevice(printer.id, printer.serviceUUID, printer.charUUID, b64);
        // Give slow printers time to drain their buffer.
        await sleep(8);
      }
    }
  } catch {
    throw new PrinterError('failed');
  }
}
