import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { FileText, Pencil, Plus, Printer, ScanBarcode, Trash2 } from 'lucide-react-native';
import { Banner, Button, Card, CardTitle, Field, IconButton } from '../../components/ui';
import { AddItemSheet } from './AddItemSheet';
import { useApp, useProfile } from '../../context/AppContext';
import { useDraftBill, type ItemFormPrefill } from '../../context/DraftBillContext';
import { calculateBill } from '../../lib/billing';
import { formatAmount, formatDate, formatQty, formatTime, signed } from '../../lib/format';
import { digitsOnly, isMobile, validateLength } from '../../lib/validation';
import { cacheBill, createBill, peekNextBillNumber } from '../../services/billService';
import { findCustomerName } from '../../services/catalogService';
import { currentUid, friendlyError } from '../../services/firebase';
import { colors, fonts, space, type } from '../../config/theme';
import type { RootScreen } from '../../navigation/types';

/** PRD 6.2–6.3 */
export function CreateBillScreen({ navigation }: RootScreen<'CreateBill'>) {
  const profile = useProfile();
  const { gstRates } = useApp();
  const draft = useDraftBill();
  const gst = profile.isGstRegistered;

  const [billNumber, setBillNumber] = useState('');
  const [now, setNow] = useState(new Date());
  const [form, setForm] = useState<ItemFormPrefill | null>(null);
  const [touched, setTouched] = useState({ mobile: false, name: false });
  const [saving, setSaving] = useState<null | 'print' | 'pdf'>(null);
  const [error, setError] = useState<string | null>(null);
  const autoFilledName = useRef<string | null>(null);
  const leaving = useRef(false);

  useEffect(() => {
    peekNextBillNumber(currentUid()).then(setBillNumber);
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Open the item sheet when the scanner hands over an item.
  useFocusEffect(
    useCallback(() => {
      const p = draft.consumePendingForm();
      if (p) setForm(p);
    }, [draft]),
  );

  // "Discard this bill?" when leaving with unsaved changes (PRD 5).
  useEffect(
    () =>
      navigation.addListener('beforeRemove', e => {
        if (leaving.current || !draft.isDirty) return;
        e.preventDefault();
        Alert.alert('Discard this bill?', 'The customer and items you added will be lost.', [
          { text: 'Keep editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              leaving.current = true;
              draft.reset();
              navigation.dispatch(e.data.action);
            },
          },
        ]);
      }),
    [navigation, draft],
  );

  // Auto-fill the customer's name from an earlier bill (PRD 6.2).
  const { customerMobile, customerName, setCustomerName } = draft;
  useEffect(() => {
    if (!isMobile(customerMobile)) return;
    let cancelled = false;
    findCustomerName(currentUid(), customerMobile)
      .then(name => {
        if (cancelled || !name) return;
        if (!customerName.trim() || customerName === autoFilledName.current) {
          autoFilledName.current = name;
          setCustomerName(name);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerMobile]);

  const totals = useMemo(() => calculateBill(draft.items, gst), [draft.items, gst]);
  const mobileError = isMobile(customerMobile) ? null : 'Enter a valid 10-digit mobile number';
  const nameError = validateLength(customerName, 2, 50, 'Customer name');
  const ready = !mobileError && !nameError && draft.items.length > 0;

  const save = async (action: 'print' | 'pdf') => {
    setSaving(action);
    setError(null);
    try {
      const bill = await createBill(currentUid(), {
        requestId: draft.requestId,
        customerName: customerName.trim(),
        customerMobile,
        items: draft.items.map(({ key: _k, ...i }) => i),
      });
      cacheBill(bill);
      leaving.current = true;
      draft.reset();
      navigation.replace('BillSuccess', { billId: bill.billId, action });
    } catch (e) {
      setError(`The bill was not saved. ${friendlyError(e)}`);
      setSaving(null);
    }
  };

  const confirmRemove = (key: string, name: string) =>
    Alert.alert('Remove this item?', name, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => draft.removeItem(key) },
    ]);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.billHeader}>
            <View>
              <Text style={type.label}>Bill number</Text>
              <Text style={[type.mono, { fontFamily: fonts.monoBold, fontSize: 15 }]}>{billNumber || '…'}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={type.label}>{formatDate(now)}</Text>
              <Text style={type.bodyStrong}>{formatTime(now)}</Text>
            </View>
          </View>

          <Card>
            <CardTitle title="Customer" />
            <Field
              label="Mobile number"
              prefix="+91"
              value={customerMobile}
              onChangeText={t => draft.setCustomerMobile(digitsOnly(t))}
              onBlur={() => setTouched(s => ({ ...s, mobile: true }))}
              keyboardType="number-pad"
              maxLength={10}
              placeholder="10-digit mobile"
              error={mobileError}
              showError={touched.mobile}
            />
            <Field
              label="Customer name"
              value={customerName}
              onChangeText={setCustomerName}
              onBlur={() => setTouched(s => ({ ...s, name: true }))}
              autoCapitalize="words"
              maxLength={50}
              placeholder="Full name"
              error={nameError}
              showError={touched.name}
              helper={customerName && customerName === autoFilledName.current ? 'Filled from an earlier bill' : undefined}
              containerStyle={{ marginBottom: 0 }}
            />
          </Card>

          <Card>
            <CardTitle title={`Items${draft.items.length ? ` (${draft.items.length})` : ''}`} />
            <View style={styles.addRow}>
              <Button
                title="Scan barcode"
                variant="tint"
                compact
                style={{ flex: 1 }}
                icon={<ScanBarcode size={20} color={colors.primaryDark} />}
                onPress={() => navigation.navigate('Scanner')}
              />
              <Button
                title="Add manually"
                variant="secondary"
                compact
                style={{ flex: 1 }}
                icon={<Plus size={20} color={colors.primary} />}
                onPress={() => setForm({})}
              />
            </View>
            {draft.items.length === 0 ? (
              <Text style={[type.caption, styles.empty]}>No items yet. Scan a barcode or add an item manually.</Text>
            ) : (
              totals.items.map((item, i) => {
                const d = draft.items[i];
                return (
                  <Pressable
                    key={d.key}
                    style={({ pressed }) => [styles.itemRow, pressed && { backgroundColor: colors.background }]}
                    onPress={() => setForm({ ...d })}
                    accessibilityRole="button"
                    accessibilityLabel={`${d.productName}, quantity ${formatQty(d.quantity)}, ${formatAmount(item.lineTotal)} rupees. Tap to edit.`}>
                    <View style={{ flex: 1 }}>
                      <Text style={type.bodyStrong}>{d.productName}</Text>
                      <Text style={type.caption}>
                        {formatQty(d.quantity)} × ₹{formatAmount(d.unitPrice)}
                        {gst ? `  ·  GST ${d.gstRate}%` : ''}
                      </Text>
                    </View>
                    <Text style={styles.amount}>₹{formatAmount(item.lineTotal)}</Text>
                    <IconButton icon={<Pencil size={18} color={colors.textSecondary} />} label={`Edit ${d.productName}`} onPress={() => setForm({ ...d })} />
                    <IconButton
                      icon={<Trash2 size={18} color={colors.destructive} />}
                      label={`Remove ${d.productName}`}
                      onPress={() => confirmRemove(d.key, d.productName)}
                    />
                  </Pressable>
                );
              })
            )}
          </Card>
          {error ? <Banner kind="error" text={error} /> : null}
        </ScrollView>

        <View style={styles.summary}>
          <View style={styles.sumRow}>
            <Text style={type.label}>Subtotal</Text>
            <Text style={type.bodyStrong}>₹{formatAmount(totals.subtotal)}</Text>
          </View>
          {gst ? (
            <View style={styles.sumRow}>
              <Text style={type.label}>GST (CGST ₹{formatAmount(totals.totalCgst)} + SGST ₹{formatAmount(totals.totalSgst)})</Text>
              <Text style={type.bodyStrong}>₹{formatAmount(totals.totalCgst + totals.totalSgst)}</Text>
            </View>
          ) : null}
          {totals.roundOff !== 0 ? (
            <View style={styles.sumRow}>
              <Text style={type.label}>Round-off</Text>
              <Text style={type.bodyStrong}>{signed(totals.roundOff)}</Text>
            </View>
          ) : null}
          <View style={[styles.sumRow, { marginTop: 2 }]}>
            <Text style={[type.bodyStrong, { fontSize: 16 }]}>Grand total</Text>
            <Text style={styles.grand}>₹{formatAmount(totals.grandTotal)}</Text>
          </View>
          <View style={styles.actions}>
            <Button
              title="Print bill"
              style={{ flex: 1 }}
              disabled={!ready || !!saving}
              loading={saving === 'print'}
              icon={<Printer size={20} color={colors.white} />}
              onPress={() => save('print')}
            />
            <Button
              title="PDF invoice"
              variant="secondary"
              style={{ flex: 1 }}
              disabled={!ready || !!saving}
              loading={saving === 'pdf'}
              icon={<FileText size={20} color={colors.primary} />}
              onPress={() => save('pdf')}
            />
          </View>
        </View>
      </KeyboardAvoidingView>

      <AddItemSheet
        prefill={form}
        gst={gst}
        gstRates={gstRates}
        onClose={() => setForm(null)}
        onSubmit={item => {
          draft.upsertItem(item);
          setForm(null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xl },
  billHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  addRow: { flexDirection: 'row', gap: space.sm, marginBottom: space.sm },
  empty: { textAlign: 'center', paddingVertical: space.xl },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    gap: 4,
  },
  amount: { fontFamily: fonts.bold, fontSize: 15, color: colors.text, marginLeft: space.sm },
  summary: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.md,
  },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 24, gap: space.sm },
  grand: { fontFamily: fonts.bold, fontSize: 26, color: colors.text },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
});
