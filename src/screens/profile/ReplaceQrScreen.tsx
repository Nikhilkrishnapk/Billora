import React, { useLayoutEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Banner, Button, Card } from '../../components/ui';
import { PayeeConfirmation } from './profileForm';
import { useProfile } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { savePaymentQr } from '../../services/merchantService';
import { currentUid, friendlyError } from '../../services/firebase';
import { parseUpiQr } from '../../lib/upi';
import { colors, fonts, space, type } from '../../config/theme';
import { QrView } from '../../components/QrView';
import type { RootScreen } from '../../navigation/types';

/** PRD 12.2 steps 4–6: old vs new side by side, payee confirmation, Save or Cancel. */
export function ReplaceQrScreen({ navigation, route }: RootScreen<'ReplaceQr'>) {
  const { path, payload } = route.params;
  const p = useProfile();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const upi = parseUpiQr(payload);
  const hasCurrent = !!p.qrPayload;

  useLayoutEffect(() => {
    if (!hasCurrent) navigation.setOptions({ title: 'Add payment QR' });
  }, [hasCurrent, navigation]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await savePaymentQr(currentUid(), { payload, upiId: upi?.upiId ?? p.upiId });
      toast(hasCurrent ? 'Payment QR code updated' : 'Payment QR code added');
      navigation.goBack();
    } catch (e) {
      setError(friendlyError(e));
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <View style={styles.compare}>
            <View style={styles.col}>
              <Text style={type.label}>Current</Text>
              <View style={styles.qrBox}>
                {hasCurrent ? <QrView payload={p.qrPayload} size={130} dimmed /> : <Text style={type.caption}>No QR yet</Text>}
              </View>
              <Text style={[type.mono, styles.upi]} numberOfLines={2}>
                {p.upiId || '—'}
              </Text>
            </View>
            <View style={styles.col}>
              <Text style={[type.label, { color: colors.primary }]}>New</Text>
              <Image source={{ uri: path }} style={[styles.qr, styles.newQr]} resizeMode="contain" />
              <Text style={[type.mono, styles.upi]} numberOfLines={2}>
                {upi?.upiId ?? p.upiId ?? '—'}
              </Text>
            </View>
          </View>
        </Card>
        <PayeeConfirmation payload={payload} />
        <Banner
          kind="warning"
          text={`The ${hasCurrent ? 'new ' : ''}QR code will print on every bill from now on, including reprints and re-shares of older bills.`}
        />
        {error ? <Banner kind="error" text={error} /> : null}
      </ScrollView>
      <View style={styles.footer}>
        <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => navigation.goBack()} disabled={saving} />
        <Button title={hasCurrent ? 'Save new QR' : 'Save QR'} style={{ flex: 1.4 }} onPress={save} loading={saving} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.lg, gap: space.lg },
  compare: { flexDirection: 'row', gap: space.md },
  col: { flex: 1, alignItems: 'center', gap: space.sm },
  qr: { width: '100%', aspectRatio: 1, borderRadius: 12, backgroundColor: colors.background },
  qrBox: { width: '100%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.background },
  newQr: { borderWidth: 2, borderColor: colors.primary },
  upi: { fontSize: 12, textAlign: 'center', fontFamily: fonts.mono },
  footer: { flexDirection: 'row', gap: space.sm, padding: space.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider },
});
