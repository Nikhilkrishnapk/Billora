import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Banner, Button, Card, CardTitle, Field } from '../../components/ui';
import {
  BusinessFields,
  LogoPickerField,
  PersonalFields,
  QrPickerField,
  hasErrors,
  useProfileForm,
  type PickedQr,
} from './profileForm';
import { useApp } from '../../context/AppContext';
import { currentUid, friendlyError } from '../../services/firebase';
import { saveProfile, savePaymentQr, updateOwnerName } from '../../services/merchantService';
import { parseUpiQr } from '../../lib/upi';
import { colors, space } from '../../config/theme';
import type { PickedImage } from '../../services/imageService';

/** PRD 4: one scrollable form, sticky "Save and continue", lands on Home. */
export function ProfileSetupScreen() {
  const { merchant, profile } = useApp();
  const registered = merchant?.mobileNumber?.replace(/^\+91/, '') ?? '';
  const form = useProfileForm({
    ownerName: profile?.ownerName || merchant?.ownerName || '',
    contactNumber: profile?.contactNumber || registered,
    email: profile?.email ?? '',
    companyName: profile?.companyName ?? '',
    addressLine: profile?.addressLine ?? '',
    city: profile?.city ?? '',
    state: profile?.state ?? '',
    pincode: profile?.pincode ?? '',
    isGstRegistered: profile?.isGstRegistered ?? false,
    gstin: profile?.gstin ?? '',
    upiId: profile?.upiId ?? '',
  });
  // The merchant record (owner name from Register, registered number) can arrive just after the first render.
  const { set: setField, values } = form;
  useEffect(() => {
    if (!merchant) return;
    if (!values.ownerName && merchant.ownerName) setField('ownerName', merchant.ownerName);
    if (!values.contactNumber && registered) setField('contactNumber', registered);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchant]);
  const [qr, setQr] = useState<PickedQr | null>(null);
  const [logo, setLogo] = useState<PickedImage | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The payment QR is optional; bills simply skip the QR when there isn't one.
  const valid = !hasErrors(form.errors);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const uid = currentUid();
      const v = form.values;
      if (qr) await savePaymentQr(uid, { payload: qr.payload, upiId: v.upiId.trim() });
      const logoDataUri = logo?.dataUri ?? profile?.logoDataUri ?? null;
      await updateOwnerName(uid, v.ownerName.trim());
      await saveProfile(uid, {
        ownerName: v.ownerName.trim(),
        contactNumber: v.contactNumber,
        email: v.email.trim(),
        companyName: v.companyName.trim(),
        addressLine: v.addressLine.trim(),
        city: v.city.trim(),
        state: v.state.trim(),
        pincode: v.pincode,
        isGstRegistered: v.isGstRegistered,
        gstin: v.isGstRegistered ? v.gstin.toUpperCase() : '',
        upiId: v.upiId.trim(),
        logoDataUri,
        printerPaperWidth: profile?.printerPaperWidth ?? 58,
        complete: true,
      });
      // AppContext sees complete: true and opens Home.
    } catch (e) {
      // The save shows Home straight away (local-first), so if the server then rejects it this
      // screen has already closed and come back fresh. An alert makes sure the reason is seen.
      const message = friendlyError(e);
      setError(message);
      setSaving(false);
      Alert.alert('Profile not saved', message);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Banner kind="success" text="Add your business details once. They print on every bill and invoice." />
          <Card>
            <CardTitle title="Owner & contact" />
            <PersonalFields form={form} />
          </Card>
          <Card>
            <CardTitle title="Shop details" />
            <BusinessFields form={form} />
          </Card>
          <Card>
            <CardTitle title="Payment QR code (optional)" />
            <QrPickerField
              qr={qr}
              existingPayload={profile?.qrPayload}
              onPicked={q => {
                setQr(q);
                const upi = parseUpiQr(q.payload);
                if (upi) form.set('upiId', upi.upiId);
              }}
              onRemove={() => setQr(null)}
            />
            <View style={{ height: space.lg }} />
            <Field
              label="UPI ID (optional)"
              {...form.field('upiId')}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="name@bank"
              helper="Printed on bills so customers can pay you"
              mono
            />
            <LogoPickerField uri={logo?.dataUri ?? profile?.logoDataUri ?? null} onPicked={setLogo} onRemove={() => setLogo(null)} />
          </Card>
          {error ? <Banner kind="error" text={error} /> : null}
        </ScrollView>
        <View style={styles.footer}>
          <Button title="Save and continue" onPress={save} disabled={!valid} loading={saving} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },
  footer: { padding: space.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider },
});
