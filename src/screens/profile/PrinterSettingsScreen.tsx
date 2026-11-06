import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bluetooth, Check } from 'lucide-react-native';
import { Banner, Button, Card, CardTitle, SegmentedPicker } from '../../components/ui';
import { PrintingOverlay } from '../../components/PrintingOverlay';
import { useApp, useProfile } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import {
  PrinterError,
  forgetPrinter,
  getSavedPrinter,
  pairPrinter,
  printBytes,
  scanPrinters,
  turnOnBluetooth,
  type SavedPrinter,
} from '../../services/printerService';
import { saveProfile } from '../../services/merchantService';
import { currentUid } from '../../services/firebase';
import { buildTestPrint, encodeEscPos } from '../../lib/thermal';
import { colors, space, type } from '../../config/theme';
import type { RootScreen } from '../../navigation/types';
import type { PaperWidth } from '../../types';

/** PRD 12.4: paper width, pair a Bluetooth printer, test print. */
export function PrinterSettingsScreen({ navigation, route }: RootScreen<'PrinterSettings'>) {
  const fromBill = !!route.params?.fromBill;
  const p = useProfile();
  const { paymentQr } = useApp();
  const toast = useToast();
  const [saved, setSaved] = useState<SavedPrinter | null>(null);
  const [devices, setDevices] = useState<{ id: string; name: string }[]>([]);
  const [scanning, setScanning] = useState(false);
  const [pairing, setPairing] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState<{ message: string; bluetoothOff?: boolean } | null>(null);
  const stopScan = useRef<(() => void) | null>(null);

  useEffect(() => {
    getSavedPrinter().then(setSaved);
    return () => stopScan.current?.();
  }, []);

  const scan = useCallback(async () => {
    setError(null);
    setDevices([]);
    setScanning(true);
    try {
      stopScan.current?.();
      stopScan.current = await scanPrinters(d => setDevices(list => [...list, d]));
      setTimeout(() => setScanning(false), 10_000);
    } catch (e) {
      setScanning(false);
      setError({ message: e instanceof Error ? e.message : 'Could not scan', bluetoothOff: e instanceof PrinterError && e.kind === 'bluetooth-off' });
    }
  }, []);

  useEffect(() => {
    // Start looking straight away when there is no printer yet.
    getSavedPrinter().then(s => {
      if (!s) scan();
    });
  }, [scan]);

  const pair = async (d: { id: string; name: string }) => {
    setPairing(d.id);
    setError(null);
    try {
      stopScan.current?.();
      setScanning(false);
      const printer = await pairPrinter(d.id, d.name);
      setSaved(printer);
      toast(`Paired with ${d.name}`);
      if (fromBill) navigation.goBack();
    } catch (e) {
      setError({ message: e instanceof Error ? e.message : 'Could not connect to this printer.' });
    } finally {
      setPairing(null);
    }
  };

  const setWidth = async (w: PaperWidth) => {
    try {
      await saveProfile(currentUid(), { printerPaperWidth: w });
    } catch {
      toast('Could not save paper width');
    }
  };

  const testPrint = async () => {
    if (!paymentQr) return;
    setPrinting(true);
    try {
      await printBytes(encodeEscPos(buildTestPrint(p, paymentQr, p.printerPaperWidth)));
      toast('Test print sent');
    } catch (e) {
      const err = e instanceof PrinterError ? e : new PrinterError('failed');
      Alert.alert(err.message, undefined, [
        ...(err.kind === 'bluetooth-off' ? [{ text: 'Turn on Bluetooth', onPress: () => turnOnBluetooth() }] : []),
        { text: 'OK', style: 'cancel' as const },
      ]);
    } finally {
      setPrinting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {fromBill && !saved ? <Banner kind="warning" text="Pair a printer to print this bill. You'll go straight back to the bill." /> : null}

        <Card>
          <CardTitle title="Paper width" />
          <SegmentedPicker<PaperWidth> options={[58, 80]} value={p.printerPaperWidth} onChange={setWidth} format={w => `${w} mm`} />
          <Text style={[type.caption, { marginTop: space.sm }]}>
            {p.printerPaperWidth === 58 ? '32 characters per line' : '48 characters per line'}
          </Text>
        </Card>

        <Card>
          <CardTitle title="Printer" />
          {saved ? (
            <View style={styles.savedRow}>
              <View style={styles.dot} />
              <View style={{ flex: 1 }}>
                <Text style={type.bodyStrong}>{saved.name}</Text>
                <Text style={type.caption}>Saved printer</Text>
              </View>
              <Button
                title="Forget"
                variant="ghost"
                compact
                onPress={async () => {
                  await forgetPrinter();
                  setSaved(null);
                }}
              />
            </View>
          ) : (
            <Text style={[type.caption, { marginBottom: space.md }]}>No printer paired yet.</Text>
          )}
          <Button title="Test print" variant="secondary" compact onPress={testPrint} disabled={!saved} />
        </Card>

        <Card>
          <CardTitle
            title="Nearby Bluetooth printers"
            right={scanning ? <ActivityIndicator color={colors.primary} /> : <Button title="Scan" variant="ghost" compact onPress={scan} style={{ height: 36 }} />}
          />
          {error ? (
            <View>
              <Banner kind="error" text={error.message} />
              {error.bluetoothOff ? <Button title="Turn on Bluetooth" variant="tint" compact onPress={() => turnOnBluetooth().then(scan)} /> : null}
            </View>
          ) : null}
          {devices.length === 0 && !scanning && !error ? (
            <Text style={type.caption}>Turn the printer on and tap Scan. Keep it near the phone.</Text>
          ) : null}
          {devices.map(d => (
            <Pressable key={d.id} style={styles.device} onPress={() => pair(d)} disabled={!!pairing} accessibilityRole="button" accessibilityLabel={`Pair ${d.name}`}>
              <Bluetooth size={20} color={colors.primary} />
              <Text style={[type.bodyStrong, { flex: 1 }]} numberOfLines={1}>
                {d.name}
              </Text>
              {pairing === d.id ? (
                <ActivityIndicator color={colors.primary} />
              ) : saved?.id === d.id ? (
                <Check size={20} color={colors.statusOk} />
              ) : (
                <Text style={[type.caption, { color: colors.primary }]}>Pair</Text>
              )}
            </Pressable>
          ))}
        </Card>
      </ScrollView>
      <PrintingOverlay visible={printing} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.lg, gap: space.lg },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.statusOk },
  device: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52, borderBottomWidth: 1, borderBottomColor: colors.divider },
});
