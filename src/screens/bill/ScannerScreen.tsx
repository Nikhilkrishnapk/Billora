import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Linking, StyleSheet, Text, Vibration, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Flashlight, FlashlightOff, X } from 'lucide-react-native';
import {
  Camera,
  isScannedCode,
  useCameraDevice,
  useCameraPermission,
  useObjectOutput,
  type ScannedObject,
  type ScannedObjectType,
} from 'react-native-vision-camera';
import { Button, IconButton, QuantityStepper } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import { useDraftBill } from '../../context/DraftBillContext';
import { useToast } from '../../context/ToastContext';
import { findProductByBarcode } from '../../services/catalogService';
import { currentUid } from '../../services/firebase';
import { decimalInput } from '../../lib/validation';
import { formatAmount } from '../../lib/format';
import { colors, fonts, space, type } from '../../config/theme';
import type { RootScreen } from '../../navigation/types';
import type { Product } from '../../types';

/** EAN-13, EAN-8, UPC-A (reported as EAN-13), UPC-E, Code 128, Code 39, QR (PRD 7.2). */
const TYPES: ScannedObjectType[] = ['ean-13', 'ean-8', 'upc-e', 'code-128', 'code-39', 'qr'];
const FRAME = 260;

export function ScannerScreen({ navigation }: RootScreen<'Scanner'>) {
  const { profile } = useApp();
  const gst = !!profile?.isGstRegistered;
  const draft = useDraftBill();
  const toast = useToast();
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission, canRequestPermission } = useCameraPermission();
  const [asked, setAsked] = useState(false);
  const [torch, setTorch] = useState(false);
  const [found, setFound] = useState<{ product: Product; qty: string } | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    if (!hasPermission && canRequestPermission && !asked) {
      setAsked(true);
      requestPermission();
    }
  }, [hasPermission, canRequestPermission, asked, requestPermission]);

  const addManually = () => {
    draft.openForm({});
    navigation.goBack();
  };

  const onCode = useCallback(
    async (value: string) => {
      busy.current = true;
      Vibration.vibrate(60);
      // Already on this bill → +1 instead of a new row.
      if (draft.incrementBarcode(value)) {
        toast('Quantity increased by 1');
        navigation.goBack();
        return;
      }
      try {
        const product = await findProductByBarcode(currentUid(), value);
        if (product) {
          setFound({ product, qty: '1' });
          return;
        }
      } catch {
        // offline lookup failed: treat as a new barcode
      }
      draft.openForm({ barcode: value });
      navigation.goBack();
    },
    [draft, navigation, toast],
  );

  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;

  const output = useObjectOutput({
    types: TYPES,
    onObjectsScanned: (objects: ScannedObject[]) => {
      if (busy.current) return;
      const code = objects.find(o => isScannedCode(o) && !!o.value);
      if (code && isScannedCode(code) && code.value) onCodeRef.current(code.value.trim());
    },
  });

  const scanLine = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLine, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(scanLine, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scanLine]);

  const permissionDenied = !hasPermission && (!canRequestPermission || asked);

  return (
    <View style={styles.root}>
      {hasPermission && device ? (
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          outputs={[output]}
          isActive={!found}
          torchMode={torch && device.hasTorch ? 'on' : 'off'}
        />
      ) : null}

      <SafeAreaView style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View style={styles.topBar}>
          <IconButton icon={<X size={24} color={colors.white} />} label="Close scanner" onPress={() => navigation.goBack()} style={styles.round} />
          <Text style={styles.title}>Scan barcode</Text>
          {device?.hasTorch ? (
            <IconButton
              icon={torch ? <FlashlightOff size={22} color={colors.white} /> : <Flashlight size={22} color={colors.white} />}
              label={torch ? 'Turn torch off' : 'Turn torch on'}
              onPress={() => setTorch(t => !t)}
              style={styles.round}
            />
          ) : (
            <View style={{ width: 44 }} />
          )}
        </View>

        {permissionDenied ? (
          <View style={styles.permission}>
            <Text style={[styles.title, { textAlign: 'center' }]}>Camera access is off</Text>
            <Text style={styles.hint}>Allow camera access in Settings to scan barcodes, or add the item by hand.</Text>
            <Button title="Open Settings" onPress={() => Linking.openSettings()} style={{ alignSelf: 'stretch' }} />
            <Button title="Add manually" variant="secondary" onPress={addManually} style={{ alignSelf: 'stretch', marginTop: space.sm }} />
          </View>
        ) : (
          <View style={styles.center} pointerEvents="none">
            <View style={styles.frame}>
              <Animated.View
                style={[styles.scanLine, { transform: [{ translateY: scanLine.interpolate({ inputRange: [0, 1], outputRange: [10, FRAME - 12] }) }] }]}
              />
              <View style={[styles.corner, { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 }]} />
              <View style={[styles.corner, { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 }]} />
              <View style={[styles.corner, { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 }]} />
              <View style={[styles.corner, { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 }]} />
            </View>
            <Text style={styles.hint}>Point the camera at a barcode</Text>
          </View>
        )}

        <View style={styles.bottom}>
          {found ? (
            <View style={styles.card}>
              <Text style={type.label}>Item found</Text>
              <Text style={[type.cardTitle, { marginTop: 2 }]}>{found.product.name}</Text>
              <Text style={type.caption}>
                ₹{formatAmount(found.product.unitPrice)}
                {gst ? ` · GST ${found.product.gstRate}%` : ''} · {found.product.barcode}
              </Text>
              <View style={{ marginVertical: space.md }}>
                <QuantityStepper value={found.qty} onChange={v => setFound(f => (f ? { ...f, qty: decimalInput(v, 3) } : f))} />
              </View>
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Button
                  title="Edit details"
                  variant="secondary"
                  compact
                  style={{ flex: 1 }}
                  onPress={() => {
                    const p = found.product;
                    draft.openForm({ productName: p.name, unitPrice: p.unitPrice, gstRate: p.gstRate, barcode: p.barcode, quantity: Number(found.qty) || 1 });
                    navigation.goBack();
                  }}
                />
                <Button
                  title="Add to bill"
                  compact
                  style={{ flex: 1 }}
                  disabled={!(Number(found.qty) > 0)}
                  onPress={() => {
                    const p = found.product;
                    draft.upsertItem({ productName: p.name, unitPrice: p.unitPrice, gstRate: gst ? p.gstRate : 0, barcode: p.barcode, quantity: Number(found.qty) });
                    toast('Added to bill');
                    navigation.goBack();
                  }}
                />
              </View>
            </View>
          ) : !permissionDenied ? (
            <Button title="Add manually instead" variant="ghost" onPress={addManually} style={{ alignSelf: 'center' }} />
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.scannerBg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingTop: space.sm },
  round: { backgroundColor: 'rgba(0,0,0,0.35)' },
  title: { fontFamily: fonts.bold, fontSize: 17, color: colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: { width: FRAME, height: FRAME, borderRadius: 16, overflow: 'hidden' },
  corner: { position: 'absolute', width: 36, height: 36, borderColor: colors.scanLine, borderRadius: 4 },
  scanLine: { position: 'absolute', left: 12, right: 12, height: 2, backgroundColor: colors.scanLine },
  hint: { fontFamily: fonts.medium, fontSize: 14, color: '#C8D3CD', marginTop: space.lg, textAlign: 'center', marginBottom: space.lg },
  permission: { flex: 1, justifyContent: 'center', padding: space.xl },
  bottom: { padding: space.lg },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: space.lg },
});
