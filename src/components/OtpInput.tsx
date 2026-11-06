import React, { useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts } from '../config/theme';

/**
 * 6 separate boxes backed by one hidden input, so paste and SMS auto-fill
 * (iOS oneTimeCode, Android sms-otp autofill) fill every box at once.
 */
export function OtpInput({
  value,
  onChange,
  length = 6,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  length?: number;
  error?: boolean;
}) {
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  return (
    <Pressable onPress={() => input.current?.focus()} accessibilityLabel="One-time password" accessibilityHint="Enter the 6-digit code">
      <View style={styles.row}>
        {Array.from({ length }, (_, i) => {
          const active = i === Math.min(value.length, length - 1);
          return (
            <View key={i} style={[styles.box, active && styles.active, error && styles.error]}>
              <Text style={styles.digit}>{value[i] ?? ''}</Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={input}
        value={value}
        onChangeText={t => onChange(t.replace(/\D/g, '').slice(0, length))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={length}
        autoFocus
        style={styles.hidden}
        caretHidden
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  box: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  active: { borderWidth: 2, borderColor: colors.primary },
  error: { borderColor: colors.errorText },
  digit: { fontFamily: fonts.bold, fontSize: 22, color: colors.text },
  hidden: { position: 'absolute', opacity: 0.01, width: '100%', height: '100%' },
});
