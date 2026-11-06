/** Business profile fields and rules (PRD 4.1), shared by setup and the Profile edit screens. */
import React, { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Camera, CircleCheck, QrCode, Store } from 'lucide-react-native';
import { Banner, Button, Field, ToggleRow } from '../../components/ui';
import {
  digitsOnly,
  validateEmail,
  validateGstin,
  validateLength,
  validateMobile,
  validatePincode,
  validateUpiId,
} from '../../lib/validation';
import { parseUpiQr } from '../../lib/upi';
import { ImageRuleError, pickImage, readQrFromImage, type PickedImage } from '../../services/imageService';
import { LOGO_MAX_BYTES, QR_MAX_BYTES } from '../../config/app';
import { colors, fonts, space, type } from '../../config/theme';
import { QrView } from '../../components/QrView';

export interface ProfileValues {
  ownerName: string;
  contactNumber: string;
  email: string;
  companyName: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  isGstRegistered: boolean;
  gstin: string;
  upiId: string;
}

export type ProfileErrors = Partial<Record<keyof ProfileValues, string | null>>;

export function validateProfile(v: ProfileValues): ProfileErrors {
  return {
    ownerName: validateLength(v.ownerName, 2, 50, 'Owner name'),
    contactNumber: validateMobile(v.contactNumber),
    email: validateEmail(v.email),
    companyName: validateLength(v.companyName, 2, 60, 'Shop name'),
    addressLine: validateLength(v.addressLine, 3, 120, 'Address'),
    city: validateLength(v.city, 2, 40, 'City'),
    state: validateLength(v.state, 2, 40, 'State'),
    pincode: validatePincode(v.pincode),
    gstin: v.isGstRegistered ? validateGstin(v.gstin) : null,
    upiId: validateUpiId(v.upiId),
  };
}

export const hasErrors = (e: ProfileErrors, keys?: (keyof ProfileValues)[]) =>
  (keys ?? (Object.keys(e) as (keyof ProfileValues)[])).some(k => !!e[k]);

export function useProfileForm(initial: ProfileValues) {
  const [values, setValues] = useState(initial);
  const [touched, setTouched] = useState<Partial<Record<keyof ProfileValues, boolean>>>({});
  const errors = validateProfile(values);
  const set = <K extends keyof ProfileValues>(k: K, v: ProfileValues[K]) => setValues(s => ({ ...s, [k]: v }));
  const field = (k: keyof ProfileValues) => ({
    value: values[k] as string,
    onChangeText: (t: string) => set(k, t as never),
    onBlur: () => setTouched(s => ({ ...s, [k]: true })),
    error: errors[k],
    showError: !!touched[k],
  });
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  return { values, set, field, errors, dirty, touchAll: () => setTouched(Object.fromEntries(Object.keys(values).map(k => [k, true]))) };
}

type Form = ReturnType<typeof useProfileForm>;

export function PersonalFields({ form, registeredMobile }: { form: Form; registeredMobile?: string }) {
  return (
    <>
      <Field label="Owner name" {...form.field('ownerName')} autoCapitalize="words" maxLength={50} placeholder="Your full name" />
      {registeredMobile ? (
        <Field label="Registered mobile (sign-in)" value={registeredMobile} editable={false} helper="Used to sign in. It can't be changed." />
      ) : null}
      <Field
        label="Contact mobile number"
        prefix="+91"
        {...form.field('contactNumber')}
        onChangeText={t => form.set('contactNumber', digitsOnly(t))}
        keyboardType="number-pad"
        maxLength={10}
        helper="Printed on bills and invoices"
      />
      <Field
        label="Email (optional)"
        {...form.field('email')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        placeholder="name@example.com"
        helper="Printed on the A4 invoice only"
      />
    </>
  );
}

export function BusinessFields({ form }: { form: Form }) {
  return (
    <>
      <Field label="Company / shop name" {...form.field('companyName')} autoCapitalize="words" maxLength={60} placeholder="e.g. Sri Lakshmi Stores" />
      <Field label="Address line" {...form.field('addressLine')} placeholder="Shop no., street, area" maxLength={120} />
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <Field label="City" {...form.field('city')} containerStyle={{ flex: 1 }} autoCapitalize="words" maxLength={40} />
        <Field
          label="PIN code"
          {...form.field('pincode')}
          onChangeText={t => form.set('pincode', digitsOnly(t, 6))}
          keyboardType="number-pad"
          maxLength={6}
          containerStyle={{ width: 130 }}
        />
      </View>
      <Field label="State" {...form.field('state')} autoCapitalize="words" maxLength={40} />
      <ToggleRow
        label="GST registered?"
        helper={form.values.isGstRegistered ? 'Bills will be Tax Invoices with CGST and SGST' : 'Bills will not show GST'}
        value={form.values.isGstRegistered}
        onChange={v => {
          form.set('isGstRegistered', v);
          if (!v) form.set('gstin', '');
        }}
      />
      {form.values.isGstRegistered ? (
        <Field
          label="GSTIN"
          {...form.field('gstin')}
          onChangeText={t => form.set('gstin', t.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 15))}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={15}
          mono
          placeholder="22AAAAA0000A1Z5"
        />
      ) : null}
    </>
  );
}

/** Asks camera or gallery. */
export function chooseImageSource(title: string): Promise<'camera' | 'gallery' | null> {
  return new Promise(resolve =>
    Alert.alert(title, undefined, [
      { text: 'Take photo', onPress: () => resolve('camera') },
      { text: 'Choose from gallery', onPress: () => resolve('gallery') },
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
    ], { cancelable: true, onDismiss: () => resolve(null) }),
  );
}

export interface PickedQr extends PickedImage {
  payload: string;
}

/** Pick + crop + check the image holds a readable QR (PRD 12.2 steps 1–3). */
export async function pickPaymentQr(): Promise<PickedQr | null> {
  const source = await chooseImageSource('Payment QR code');
  if (!source) return null;
  const img = await pickImage(source, { maxBytes: QR_MAX_BYTES, maxWidth: 1400 });
  if (!img) return null;
  const payload = await readQrFromImage(img.path).catch(() => null);
  if (!payload) throw new ImageRuleError('No QR code found. Try a clearer image.');
  return { ...img, payload };
}

/** The logo is shrunk to a small JPEG and stored in the profile (no Cloud Storage on the free plan). */
export async function pickLogo(): Promise<PickedImage | null> {
  const source = await chooseImageSource('Shop logo');
  if (!source) return null;
  return pickImage(source, { maxBytes: LOGO_MAX_BYTES, maxWidth: 240, base64: true, quality: 0.7 });
}

export function PayeeConfirmation({ payload }: { payload: string }) {
  const upi = parseUpiQr(payload);
  return upi ? (
    <Banner kind="success" text={`Payments will go to: ${upi.payeeName ? `${upi.payeeName} ` : ''}(${upi.upiId})`} style={{ marginBottom: 0 }} />
  ) : (
    <Banner kind="warning" text="This QR code is readable but is not a UPI payment QR. Check it is the right code." style={{ marginBottom: 0 }} />
  );
}

/** QR preview with readable check, used in setup. */
export function QrPickerField({
  qr,
  existingPayload,
  onPicked,
  onRemove,
  error,
}: {
  qr: PickedQr | null;
  existingPayload?: string | null;
  onPicked: (q: PickedQr) => void;
  /** Clears a newly picked QR (the QR is optional). */
  onRemove?: () => void;
  error?: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const payload = qr?.payload ?? existingPayload ?? null;
  const pick = async () => {
    setBusy(true);
    setPickError(null);
    try {
      const picked = await pickPaymentQr();
      if (picked) onPicked(picked);
    } catch (e) {
      setPickError(e instanceof Error ? e.message : 'Could not read the image.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <View>
      {pickError || error ? <Banner kind="error" text={(pickError || error)!} /> : null}
      {payload ? (
        <View style={styles.qrRow}>
          {qr ? (
            <Image source={{ uri: qr.path }} style={styles.qrImage} resizeMode="contain" accessibilityLabel="Payment QR code preview" />
          ) : (
            <QrView payload={payload} size={120} />
          )}
          <View style={{ flex: 1, gap: 8 }}>
            {qr ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <CircleCheck size={18} color={colors.statusOk} />
                <Text style={[type.bodyStrong, { color: colors.primaryDark }]}>QR code readable</Text>
              </View>
            ) : null}
            <Button title="Replace" variant="tint" compact onPress={pick} loading={busy} />
            {qr && onRemove ? <Button title="Remove" variant="secondary" compact onPress={onRemove} disabled={busy} /> : null}
          </View>
        </View>
      ) : (
        <Pressable style={styles.dropzone} onPress={pick} accessibilityRole="button" accessibilityLabel="Upload payment QR code">
          <QrCode size={32} color={colors.primary} />
          <Text style={[type.bodyStrong, { color: colors.primary, marginTop: 8 }]}>{busy ? 'Reading…' : 'Upload payment QR code'}</Text>
          <Text style={type.caption}>Optional · Photo or gallery · PNG/JPG · max 2 MB</Text>
        </Pressable>
      )}
      {qr ? <View style={{ marginTop: space.md }}><PayeeConfirmation payload={qr.payload} /></View> : null}
    </View>
  );
}

export function LogoPickerField({
  uri,
  onPicked,
  onRemove,
}: {
  uri: string | null;
  onPicked: (img: PickedImage) => void;
  onRemove: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const pick = async () => {
    setError(null);
    try {
      const img = await pickLogo();
      if (img) onPicked(img);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not use that image.');
    }
  };
  return (
    <View>
      {error ? <Banner kind="error" text={error} /> : null}
      <View style={styles.qrRow}>
        <View style={styles.logoBox}>
          {uri ? <Image source={{ uri }} style={{ width: 64, height: 64 }} resizeMode="contain" /> : <Store size={26} color={colors.textSecondary} />}
        </View>
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={type.caption}>Shop logo (optional) · A4 invoice only · PNG/JPG, max 1 MB</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title={uri ? 'Change' : 'Upload logo'} variant="tint" compact onPress={pick} icon={<Camera size={18} color={colors.primaryDark} />} style={{ flex: 1 }} />
            {uri ? <Button title="Remove" variant="ghost" compact onPress={onRemove} /> : null}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  qrRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  qrImage: { width: 120, height: 120, borderRadius: 12, backgroundColor: colors.background },
  dropzone: {
    height: 150,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});

export const sectionTitleStyle = { fontFamily: fonts.bold, fontSize: 15 };
