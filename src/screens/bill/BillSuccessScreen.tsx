import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { House, Plus, Printer, Share2, X } from 'lucide-react-native';
import { Button } from '../../components/ui';
import { SuccessCheck } from '../../components/SuccessCheck';
import { useDraftBill } from '../../context/DraftBillContext';
import { loadBill } from '../../services/billService';
import { currentUid } from '../../services/firebase';
import { formatAmount, formatTime } from '../../lib/format';
import { colors, fonts, radius, space, type } from '../../config/theme';
import type { RootScreen } from '../../navigation/types';
import type { Bill } from '../../types';

/**
 * Shown right after a bill is saved: animated tick, the key details, then the next step —
 * print / share this bill, start a new bill, or go back Home (X and Back also go Home,
 * because Create Bill was replaced by this screen).
 */
export function BillSuccessScreen({ navigation, route }: RootScreen<'BillSuccess'>) {
  const { billId, action } = route.params;
  const draft = useDraftBill();
  const [bill, setBill] = useState<Bill | null>(null);
  const [shown, setShown] = useState(0);
  const content = useRef(new Animated.Value(0)).current;
  const amount = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Usually instant: Create Bill put the saved bill in the in-memory cache.
    loadBill(currentUid(), billId).then(setBill).catch(() => setBill(null));
  }, [billId]);

  useEffect(() => {
    Animated.timing(content, { toValue: 1, duration: 420, delay: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [content]);

  // Amount counts up to the bill total.
  useEffect(() => {
    if (!bill) return;
    const id = amount.addListener(({ value }) => setShown(value));
    Animated.timing(amount, { toValue: bill.grandTotal, duration: 900, delay: 450, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(
      () => setShown(bill.grandTotal),
    );
    return () => amount.removeListener(id);
  }, [bill, amount]);

  const goHome = () => navigation.popToTop();
  const openBill = () => navigation.replace('BillView', { billId, mode: 'saved', action });
  const newBill = () => {
    draft.reset();
    navigation.replace('CreateBill');
  };

  const fadeUp = (offset: number) => ({
    opacity: content,
    transform: [{ translateY: content.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] }) }],
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Pressable onPress={goHome} style={({ pressed }) => [styles.close, pressed && { backgroundColor: colors.divider }]} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close and go to Home">
        <X size={22} color={colors.text} />
      </Pressable>

      <View style={styles.center}>
        <SuccessCheck />
        <Animated.View style={[{ alignItems: 'center' }, fadeUp(16)]}>
          <Text style={styles.title} accessibilityRole="header">
            Bill saved!
          </Text>
          <Text style={[type.body, { color: colors.textSecondary, marginTop: 4 }]}>Your bill has been created successfully.</Text>
        </Animated.View>

        <Animated.View style={[styles.summary, fadeUp(24)]}>
          <Text style={type.caption}>Amount</Text>
          <Text style={styles.amount} accessibilityLabel={bill ? `${formatAmount(bill.grandTotal)} rupees` : undefined}>
            ₹{formatAmount(bill ? shown : 0)}
          </Text>
          <View style={styles.divider} />
          <Detail label="Bill no." value={bill?.billNumber ?? '…'} mono />
          <Detail label="Customer" value={bill ? bill.customerName : '…'} />
          <Detail label="Items" value={bill ? String(bill.items.length) : '…'} />
          <Detail label="Time" value={bill ? formatTime(bill.billDatetime) : '…'} />
        </Animated.View>
      </View>

      <Animated.View style={[styles.footer, fadeUp(32)]}>
        <Button
          title={action === 'print' ? 'Print bill' : 'Share PDF invoice'}
          icon={action === 'print' ? <Printer size={20} color={colors.white} /> : <Share2 size={20} color={colors.white} />}
          onPress={openBill}
        />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button title="Home" variant="secondary" style={{ flex: 1 }} icon={<House size={18} color={colors.primary} />} onPress={goHome} />
          <Button title="New bill" variant="tint" style={{ flex: 1 }} icon={<Plus size={18} color={colors.primaryDark} />} onPress={newBill} />
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.detail}>
      <Text style={type.caption}>{label}</Text>
      <Text style={[mono ? [type.mono, { fontSize: 13.5 }] : type.bodyStrong, { flexShrink: 1, textAlign: 'right' }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  close: {
    position: 'absolute',
    top: 52,
    right: space.lg,
    zIndex: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  title: { fontFamily: fonts.bold, fontSize: 28, color: colors.text, marginTop: -space.lg },
  summary: {
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: space.lg,
    marginTop: space.xl,
    alignItems: 'center',
  },
  amount: { fontFamily: fonts.bold, fontSize: 34, color: colors.primary, marginTop: 2 },
  divider: { alignSelf: 'stretch', height: 1, backgroundColor: colors.divider, marginVertical: space.md },
  detail: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between', gap: space.md, paddingVertical: 4 },
  footer: { padding: space.lg, gap: space.sm },
});
