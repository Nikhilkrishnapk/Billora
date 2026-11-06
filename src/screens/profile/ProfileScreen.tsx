import React, { useCallback, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ChevronRight, LogOut, Pencil, Printer, QrCode, X } from 'lucide-react-native';
import { Banner, Button, Card, CardTitle, Field, IconButton, InfoRow } from '../../components/ui';
import { BottomSheet } from '../../components/BottomSheet';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { pickPaymentQr } from './profileForm';
import { useApp, useProfile } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { signOut } from '../../services/authService';
import { getSavedPrinter, type SavedPrinter } from '../../services/printerService';
import { saveProfile } from '../../services/merchantService';
import { currentUid, friendlyError } from '../../services/firebase';
import { validateUpiId } from '../../lib/validation';
import { formatDateTime } from '../../lib/format';
import { colors, fonts, space, type } from '../../config/theme';
import { QrView } from '../../components/QrView';
import type { TabScreen } from '../../navigation/types';

/** PRD 12: Personal, Business, Payment QR, Account information, Printer settings, Log out. */
export function ProfileScreen({ navigation }: TabScreen<'Profile'>) {
  const p = useProfile();
  const { merchant } = useApp();
  const toast = useToast();
  const [printer, setPrinter] = useState<SavedPrinter | null>(null);
  const [qrFull, setQrFull] = useState(false);
  const [upiOpen, setUpiOpen] = useState(false);
  const [upi, setUpi] = useState('');
  const [savingUpi, setSavingUpi] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getSavedPrinter().then(setPrinter);
    }, []),
  );

  const replaceQr = async () => {
    setQrError(null);
    setPicking(true);
    try {
      const picked = await pickPaymentQr();
      if (picked) navigation.navigate('ReplaceQr', { path: picked.path, mime: picked.mime, payload: picked.payload });
    } catch (e) {
      setQrError(e instanceof Error ? e.message : 'Could not read the image.');
    } finally {
      setPicking(false);
    }
  };

  const saveUpi = async () => {
    setSavingUpi(true);
    try {
      await saveProfile(currentUid(), { upiId: upi.trim() });
      setUpiOpen(false);
      toast('Profile updated');
    } catch (e) {
      Alert.alert('Could not save', friendlyError(e));
    } finally {
      setSavingUpi(false);
    }
  };

  const logout = async () => {
    try {
      await signOut();
      // The app switches to Sign in on its own; the toast (above the navigator) still shows.
      toast('Logged out successfully');
    } catch (e) {
      setLogoutOpen(false);
      toast(friendlyError(e));
    }
  };

  const mobile = merchant?.mobileNumber?.replace(/^\+91/, '') ?? '';
  const initials =
    p.ownerName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0]!.toUpperCase())
      .join('') || 'B';

  const editButton = (section: 'personal' | 'business') => (
    <Button
      title="Edit"
      variant="tint"
      compact
      style={{ height: 36, paddingHorizontal: 14 }}
      icon={<Pencil size={16} color={colors.primaryDark} />}
      onPress={() => navigation.navigate('EditProfile', { section })}
      accessibilityLabel={`Edit ${section} details`}
    />
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(p.ownerName || '?').trim().charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={type.tabTitle} numberOfLines={1} accessibilityRole="header">
              {p.ownerName}
            </Text>
            <Text style={type.caption} numberOfLines={1}>
              {p.companyName}
            </Text>
          </View>
        </View>

        <Card>
          <CardTitle title="Personal details" right={editButton('personal')} />
          <InfoRow label="Owner name" value={p.ownerName} />
          <InfoRow label="Contact mobile (on bills)" value={`+91 ${p.contactNumber}`} />
          <InfoRow label="Email" value={p.email} />
        </Card>

        <Card>
          <CardTitle title="Business details" right={editButton('business')} />
          <InfoRow label="Company / shop name" value={p.companyName} />
          <InfoRow label="Address" value={`${p.addressLine}, ${p.city}, ${p.state} - ${p.pincode}`} />
          <InfoRow label="GST registered" value={p.isGstRegistered ? 'Yes' : 'No'} />
          {p.isGstRegistered ? <InfoRow label="GSTIN" value={p.gstin} mono /> : null}
          <View style={{ paddingVertical: 8 }}>
            <Text style={type.label}>Shop logo</Text>
            {p.logoDataUri ? (
              <Image source={{ uri: p.logoDataUri }} style={styles.logo} resizeMode="contain" accessibilityLabel="Shop logo" />
            ) : (
              <Text style={type.bodyStrong}>—</Text>
            )}
          </View>
        </Card>

        <Card style={styles.qrCard}>
          <CardTitle title="Payment QR code" right={<QrCode size={20} color={colors.primary} />} />
          {qrError ? <Banner kind="error" text={qrError} /> : null}
          {p.qrPayload ? (
            <>
              <Pressable onPress={() => setQrFull(true)} accessibilityRole="imagebutton" accessibilityLabel="Show payment QR code full screen">
                <View style={styles.qr}>
                  <QrView payload={p.qrPayload} size={200} />
                </View>
              </Pressable>
              {p.upiId ? <Text style={[type.mono, { textAlign: 'center', marginTop: space.sm }]}>{p.upiId}</Text> : null}
              <Text style={[type.caption, { textAlign: 'center', marginTop: 4 }]}>
                Last updated: {p.qrCodeUpdatedAt ? formatDateTime(p.qrCodeUpdatedAt) : '—'}
              </Text>
              <Text style={[type.caption, { textAlign: 'center', marginTop: 2 }]}>Printed on every bill and invoice</Text>
            </>
          ) : (
            <>
              {p.upiId ? <Text style={[type.mono, { textAlign: 'center', marginTop: space.sm }]}>{p.upiId}</Text> : null}
              <Text style={[type.caption, { textAlign: 'center', marginTop: 4 }]}>
                No QR code added. It's optional — add one to print a "Scan to pay" code on bills.
              </Text>
            </>
          )}
          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.lg }}>
            <Button title={p.qrPayload ? 'Replace QR code' : 'Add QR code'} compact style={{ flex: 1 }} onPress={replaceQr} loading={picking} />
            <Button
              title="Edit UPI ID"
              variant="secondary"
              compact
              style={{ flex: 1 }}
              onPress={() => {
                setUpi(p.upiId);
                setUpiOpen(true);
              }}
            />
          </View>
        </Card>

        <Card>
          <CardTitle title="Account information" />
          <InfoRow label="Registered on" value={merchant?.createdAt ? formatDateTime(merchant.createdAt) : '—'} />
          <InfoRow label="Registered mobile number" value={merchant?.mobileNumber?.replace(/^\+91/, '+91 ') ?? ''} />
        </Card>

        <Pressable onPress={() => navigation.navigate('PrinterSettings')} accessibilityRole="button">
          <Card style={styles.linkCard}>
            <Printer size={22} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={type.cardTitle}>Printer settings</Text>
              <Text style={type.caption}>
                {printer ? printer.name : 'No printer paired'} · {p.printerPaperWidth} mm paper
              </Text>
            </View>
            <ChevronRight size={20} color={colors.textSecondary} />
          </Card>
        </Pressable>

        <Button title="Log out" variant="destructive" icon={<LogOut size={20} color={colors.destructive} />} onPress={() => setLogoutOpen(true)} />
      </ScrollView>

      <ConfirmDialog
        visible={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={logout}
        tone="danger"
        renderIcon={c => <LogOut size={30} color={c} strokeWidth={2.25} />}
        title="Log out of Billora?"
        message="You can sign in again anytime with your mobile number. Your bills stay saved."
        cancelLabel="Stay signed in"
        confirmLabel="Log out">
        <View style={styles.account}>
          <View style={styles.accountAvatar}>
            <Text style={styles.accountInitials}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={type.bodyStrong} numberOfLines={1}>
              {p.ownerName || p.companyName}
            </Text>
            <Text style={type.caption} numberOfLines={1}>
              {mobile ? `+91 ${mobile}` : p.companyName}
            </Text>
          </View>
        </View>
      </ConfirmDialog>

      <Modal visible={qrFull} animationType="fade" onRequestClose={() => setQrFull(false)}>
        <SafeAreaView style={styles.fullQr}>
          <IconButton icon={<X size={26} color={colors.text} />} label="Close" onPress={() => setQrFull(false)} style={{ alignSelf: 'flex-end', margin: space.lg }} />
          <View style={{ flex: 1, justifyContent: 'center', padding: space.xl }}>
            <Text style={[type.cardTitle, { textAlign: 'center', fontSize: 20 }]}>{p.companyName}</Text>
            <View style={{ alignItems: 'center', marginVertical: space.xl }}>
              <QrView payload={p.qrPayload} size={300} />
            </View>
            <Text style={[type.bodyStrong, { textAlign: 'center' }]}>Scan to pay</Text>
            {p.upiId ? <Text style={[type.mono, { textAlign: 'center', marginTop: 4 }]}>{p.upiId}</Text> : null}
          </View>
        </SafeAreaView>
      </Modal>

      <BottomSheet
        visible={upiOpen}
        onClose={() => setUpiOpen(false)}
        title="Edit UPI ID"
        footer={<Button title="Save" onPress={saveUpi} disabled={!!validateUpiId(upi) || upi.trim() === p.upiId} loading={savingUpi} />}>
        <Field
          label="UPI ID (optional)"
          value={upi}
          onChangeText={setUpi}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="name@bank"
          mono
          error={validateUpiId(upi)}
          helper="Printed on bills so customers can pay you"
          autoFocus
        />
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  account: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.background, borderRadius: 14, padding: space.md },
  accountAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  accountInitials: { fontFamily: fonts.bold, fontSize: 15, color: colors.primaryDark },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.xs },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.bold, fontSize: 22, color: colors.primaryDark },
  logo: { width: 80, height: 80, marginTop: 6, borderRadius: 8 },
  qrCard: { borderColor: colors.primary, borderWidth: 1.5 },
  qr: { width: 200, height: 200, alignSelf: 'center', borderRadius: 12 },
  linkCard: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  fullQr: { flex: 1, backgroundColor: colors.white },
});
