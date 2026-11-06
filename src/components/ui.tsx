import React, { forwardRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { colors, fonts, radius, space, type } from '../config/theme';

/* ---------------- Buttons ---------------- */

type ButtonVariant = 'primary' | 'secondary' | 'tint' | 'ghost' | 'destructive';

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  compact,
  style,
  accessibilityLabel,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  /** 48 tall (inside cards) instead of 56 */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => [
        styles.btn,
        { height: compact ? 48 : 56 },
        btnVariant[variant],
        pressed && variant === 'primary' && { backgroundColor: colors.primaryDark },
        pressed && variant !== 'primary' && { opacity: 0.75 },
        inactive && (variant === 'primary' ? styles.btnPrimaryDisabled : { opacity: 0.45 }),
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.white : colors.primary} />
      ) : (
        <>
          {icon}
          <Text style={[styles.btnText, btnText[variant], compact && { fontSize: 15 }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

const btnVariant: Record<ButtonVariant, ViewStyle> = {
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.primary },
  tint: { backgroundColor: colors.primaryTint },
  ghost: { backgroundColor: 'transparent' },
  destructive: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.destructiveBorder },
};
const btnText: Record<ButtonVariant, TextStyle> = {
  primary: { color: colors.white },
  secondary: { color: colors.primary },
  tint: { color: colors.primaryDark },
  ghost: { color: colors.primary },
  destructive: { color: colors.destructive },
};

export function LinkText({ title, onPress, style }: { title: string; onPress: () => void; style?: StyleProp<TextStyle> }) {
  return (
    <Pressable onPress={onPress} hitSlop={12} accessibilityRole="link" style={{ minHeight: 44, justifyContent: 'center' }}>
      <Text style={[styles.link, style]}>{title}</Text>
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  style,
}: {
  icon: React.ReactNode;
  onPress: () => void;
  label: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }, style]}>
      {icon}
    </Pressable>
  );
}

/* ---------------- Layout ---------------- */

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function CardTitle({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={styles.cardTitleRow}>
      <Text style={type.cardTitle} accessibilityRole="header">
        {title}
      </Text>
      {right}
    </View>
  );
}

export function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <Text style={type.label}>{label}</Text>
      <Text style={[mono ? type.mono : type.bodyStrong, styles.infoValue]}>{value || '—'}</Text>
    </View>
  );
}

export function Banner({ kind, text, style }: { kind: 'error' | 'warning' | 'success'; text: string; style?: StyleProp<ViewStyle> }) {
  const palette = {
    error: [colors.errorBg, colors.errorText],
    warning: [colors.warningBg, colors.warningText],
    success: [colors.primaryTint, colors.primaryDark],
  }[kind];
  return (
    <View style={[styles.banner, { backgroundColor: palette[0] }, style]} accessibilityRole="alert">
      <Text style={[styles.bannerText, { color: palette[1] }]}>{text}</Text>
    </View>
  );
}

/* ---------------- Inputs ---------------- */

interface FieldProps extends TextInputProps {
  label?: string;
  error?: string | null;
  helper?: string;
  /** Fixed segment inside the field, e.g. "+91" or "₹" */
  prefix?: string;
  large?: boolean;
  mono?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  /** Show the error only after the field has been touched */
  showError?: boolean;
}

export const Field = forwardRef<React.ComponentRef<typeof TextInput>, FieldProps>(function FieldImpl(
  { label, error, helper, prefix, large, mono, containerStyle, showError = true, onFocus, onBlur, editable = true, ...rest },
  ref,
) {
  const [focused, setFocused] = React.useState(false);
  const visibleError = showError ? error : null;
  return (
    <View style={[{ marginBottom: space.lg }, containerStyle]}>
      {label ? <Text style={[type.label, { marginBottom: 6 }]}>{label}</Text> : null}
      <View
        style={[
          styles.input,
          { height: rest.multiline ? undefined : large ? 56 : 48, minHeight: rest.multiline ? 80 : undefined },
          focused && styles.inputFocused,
          !!visibleError && styles.inputError,
          !editable && { backgroundColor: colors.background },
        ]}>
        {prefix ? (
          <View style={styles.prefix}>
            <Text style={[type.bodyStrong, large && { fontSize: 17 }]}>{prefix}</Text>
          </View>
        ) : null}
        <TextInput
          ref={ref}
          placeholderTextColor="#8A958F"
          editable={editable}
          accessibilityLabel={label}
          style={[styles.inputText, large && { fontSize: 17 }, mono && { fontFamily: fonts.mono }, !editable && { color: colors.textSecondary }]}
          onFocus={e => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={e => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
      </View>
      {visibleError ? (
        <Text style={[type.caption, { color: colors.errorText, marginTop: 4 }]}>{visibleError}</Text>
      ) : helper ? (
        <Text style={[type.caption, { marginTop: 4 }]}>{helper}</Text>
      ) : null}
    </View>
  );
});

export function ToggleRow({
  label,
  helper,
  value,
  onChange,
}: {
  label: string;
  helper?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Pressable style={styles.toggleRow} onPress={() => onChange(!value)} accessibilityRole="switch" accessibilityState={{ checked: value }}>
      <View style={{ flex: 1 }}>
        <Text style={type.bodyStrong}>{label}</Text>
        {helper ? <Text style={type.caption}>{helper}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.primary, false: colors.border }}
        thumbColor={colors.white}
        ios_backgroundColor={colors.border}
      />
    </Pressable>
  );
}

/** 5 equal segmented buttons (PRD 16.3). */
export function SegmentedPicker<T extends string | number>({
  options,
  value,
  onChange,
  format = v => String(v),
}: {
  options: T[];
  value: T | null;
  onChange: (v: T) => void;
  format?: (v: T) => string;
}) {
  return (
    <View style={styles.segments} accessibilityRole="radiogroup">
      {options.map(o => {
        const selected = o === value;
        return (
          <Pressable
            key={String(o)}
            onPress={() => onChange(o)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[styles.segment, selected && styles.segmentSelected]}>
            <Text style={[type.bodyStrong, selected && { color: colors.primaryDark }]}>{format(o)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** − / value / + in one 48-tall field. Accepts decimals (1.5 kg). */
export function QuantityStepper({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const n = Number(value) || 0;
  const step = (d: number) => {
    const next = Math.max(0, Math.round((n + d) * 1000) / 1000);
    onChange(next > 0 ? String(next) : value);
  };
  return (
    <View style={styles.stepper}>
      <Pressable style={styles.stepBtn} onPress={() => step(-1)} accessibilityLabel="Decrease quantity" disabled={n <= 1}>
        <Text style={[styles.stepSign, n <= 1 && { color: colors.border }]}>−</Text>
      </Pressable>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        style={styles.stepValue}
        accessibilityLabel="Quantity"
        selectTextOnFocus
      />
      <Pressable style={styles.stepBtn} onPress={() => step(1)} accessibilityLabel="Increase quantity">
        <Text style={styles.stepSign}>+</Text>
      </Pressable>
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, selected && { backgroundColor: colors.text, borderColor: colors.text }]}>
      <Text style={[styles.chipText, selected && { color: colors.white }]}>{label}</Text>
    </Pressable>
  );
}

export function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: radius.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
  },
  btnPrimaryDisabled: { backgroundColor: '#9FC2B5' },
  btnText: { fontFamily: fonts.bold, fontSize: 16 },
  link: { fontFamily: fonts.bold, fontSize: 15, color: colors.primary },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md, minHeight: 28 },
  infoRow: { paddingVertical: 8 },
  infoValue: { marginTop: 2 },
  banner: { borderRadius: 12, paddingHorizontal: space.md, paddingVertical: 10, marginBottom: space.lg },
  bannerText: { fontFamily: fonts.semibold, fontSize: 14 },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  inputFocused: { borderWidth: 2, borderColor: colors.primary },
  inputError: { borderColor: colors.errorText },
  inputText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: 'stretch',
  },
  prefix: {
    paddingHorizontal: 14,
    alignSelf: 'stretch',
    justifyContent: 'center',
    borderRightWidth: 1.5,
    borderRightColor: colors.divider,
    backgroundColor: colors.background,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48, marginBottom: space.lg },
  segments: { flexDirection: 'row', gap: space.sm },
  segment: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  segmentSelected: { backgroundColor: colors.primaryTint, borderWidth: 2, borderColor: colors.primary },
  stepper: {
    height: 48,
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.input,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  stepBtn: { width: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  stepSign: { fontFamily: fonts.bold, fontSize: 22, color: colors.primary },
  stepValue: { flex: 1, textAlign: 'center', fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  chip: {
    height: 40,
    borderRadius: radius.chip,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
});
