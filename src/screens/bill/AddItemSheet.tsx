import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from '../../components/BottomSheet';
import { Button, Field, QuantityStepper, SegmentedPicker } from '../../components/ui';
import { decimalInput, validateLength, validatePrice, validateQuantity } from '../../lib/validation';
import { formatAmount } from '../../lib/format';
import { suggestProducts } from '../../services/catalogService';
import { currentUid } from '../../services/firebase';
import { colors, fonts, space, type } from '../../config/theme';
import type { ItemFormPrefill } from '../../context/DraftBillContext';
import type { DraftItem, Product } from '../../types';

/** PRD 7.1 / 7.3: product name with suggestions, quantity stepper, price, GST picker, barcode, live line total. */
export function AddItemSheet({
  prefill,
  gst,
  gstRates,
  onSubmit,
  onClose,
}: {
  prefill: ItemFormPrefill | null;
  gst: boolean;
  gstRates: number[];
  onSubmit: (item: Omit<DraftItem, 'key'> & { key?: string }) => void;
  onClose: () => void;
}) {
  const visible = prefill !== null;
  const [name, setName] = useState('');
  const [qty, setQty] = useState('1');
  const [price, setPrice] = useState('');
  const [rate, setRate] = useState<number | null>(null);
  const [barcode, setBarcode] = useState('');
  const [touched, setTouched] = useState(false);
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const suppressSuggest = useRef(false);

  useEffect(() => {
    if (!prefill) return;
    setName(prefill.productName ?? '');
    setQty(prefill.quantity ? String(prefill.quantity) : '1');
    setPrice(prefill.unitPrice !== undefined ? String(prefill.unitPrice) : '');
    setRate(prefill.gstRate !== undefined && gstRates.includes(prefill.gstRate) ? prefill.gstRate : null);
    setBarcode(prefill.barcode ?? '');
    setTouched(false);
    setSuggestions([]);
    suppressSuggest.current = true;
  }, [prefill, gstRates]);

  // Suggest items used on earlier bills while typing (debounced).
  useEffect(() => {
    if (suppressSuggest.current) {
      suppressSuggest.current = false;
      return;
    }
    if (!visible || name.trim().length < 2 || prefill?.key) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(() => {
      suggestProducts(currentUid(), name)
        .then(list => setSuggestions(list.filter(p => p.name.toLowerCase() !== name.trim().toLowerCase())))
        .catch(() => setSuggestions([]));
    }, 250);
    return () => clearTimeout(t);
  }, [name, visible, prefill?.key]);

  const pickSuggestion = (p: Product) => {
    suppressSuggest.current = true;
    setName(p.name);
    setPrice(String(p.unitPrice));
    if (gst && gstRates.includes(p.gstRate)) setRate(p.gstRate);
    if (p.barcode && !barcode) setBarcode(p.barcode);
    setSuggestions([]);
  };

  const errors = {
    name: validateLength(name, 1, 60, 'Product name'),
    qty: validateQuantity(qty),
    price: validatePrice(price),
    rate: gst && rate === null ? 'Pick a GST rate' : null,
  };
  const valid = !Object.values(errors).some(Boolean);
  const lineTotal = (Number(qty) || 0) * (Number(price) || 0);

  const submit = () => {
    setTouched(true);
    if (!valid) return;
    onSubmit({
      key: prefill?.key,
      productName: name.trim(),
      quantity: Number(qty),
      unitPrice: Number(price),
      gstRate: gst ? rate ?? 0 : 0,
      barcode: barcode.trim() || null,
    });
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={prefill?.key ? 'Edit item' : 'Add item'}
      footer={
        <View style={styles.footer}>
          <View style={styles.totalRow}>
            <Text style={type.label}>Line total</Text>
            <Text style={styles.total}>₹{formatAmount(lineTotal)}</Text>
          </View>
          <Button title={prefill?.key ? 'Save changes' : 'Add to bill'} onPress={submit} disabled={touched && !valid} />
        </View>
      }>
      <Field
        label="Product name"
        value={name}
        onChangeText={setName}
        maxLength={60}
        placeholder="e.g. Basmati rice 1kg"
        autoFocus={!prefill?.productName}
        error={errors.name}
        showError={touched}
        containerStyle={suggestions.length ? { marginBottom: 4 } : undefined}
      />
      {suggestions.length ? (
        <View style={styles.suggestions} accessibilityLabel="Suggestions">
          {suggestions.map(s => (
            <Pressable key={s.productId} style={styles.suggestion} onPress={() => pickSuggestion(s)} accessibilityRole="button">
              <Text style={[type.bodyStrong, { flex: 1 }]} numberOfLines={1}>
                {s.name}
              </Text>
              <Text style={type.caption}>
                ₹{formatAmount(s.unitPrice)}
                {gst ? ` · ${s.gstRate}%` : ''}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <View style={{ flex: 1, marginBottom: space.lg }}>
          <Text style={[type.label, { marginBottom: 6 }]}>Quantity</Text>
          <QuantityStepper value={qty} onChange={v => setQty(decimalInput(v, 3))} />
          {touched && errors.qty ? <Text style={[type.caption, { color: colors.errorText, marginTop: 4 }]}>{errors.qty}</Text> : null}
        </View>
        <Field
          label={gst ? 'Unit price (excl. GST)' : 'Unit price'}
          prefix="₹"
          value={price}
          onChangeText={v => setPrice(decimalInput(v, 2))}
          keyboardType="decimal-pad"
          placeholder="0.00"
          error={errors.price}
          showError={touched}
          containerStyle={{ flex: 1 }}
        />
      </View>
      {gst ? (
        <View style={{ marginBottom: space.lg }}>
          <Text style={[type.label, { marginBottom: 6 }]}>GST rate</Text>
          <SegmentedPicker options={gstRates} value={rate} onChange={setRate} format={r => `${r}%`} />
          {touched && errors.rate ? <Text style={[type.caption, { color: colors.errorText, marginTop: 4 }]}>{errors.rate}</Text> : null}
        </View>
      ) : null}
      <Field
        label="Barcode (optional)"
        value={barcode}
        onChangeText={setBarcode}
        mono
        autoCapitalize="none"
        autoCorrect={false}
        helper={prefill?.barcode ? 'Filled from the scan' : undefined}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  suggestions: { borderWidth: 1, borderColor: colors.divider, borderRadius: 12, marginBottom: space.lg, overflow: 'hidden' },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 48,
    paddingHorizontal: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    backgroundColor: colors.surface,
  },
  footer: { paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.divider },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.md },
  total: { fontFamily: fonts.bold, fontSize: 20, color: colors.text },
});
