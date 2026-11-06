import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandMark } from '../../components/BrandMark';
import { APP_NAME } from '../../config/app';
import { colors, fonts, space, type } from '../../config/theme';

export function AppMark() {
  return (
    <View style={styles.markRow}>
      <BrandMark size={48} />
      <Text style={styles.appName}>{APP_NAME}</Text>
    </View>
  );
}

export function AuthLayout({
  title,
  subtitle,
  badge,
  children,
  footer,
}: {
  title: string;
  subtitle?: React.ReactNode;
  badge?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <AppMark />
          {badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : null}
          <Text style={[type.authTitle, { marginTop: badge ? space.md : space.xxl }]} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? <Text style={[type.body, styles.subtitle]}>{subtitle}</Text> : null}
          <View style={{ marginTop: space.xl }}>{children}</View>
        </ScrollView>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.xl, paddingTop: space.xxl, flexGrow: 1 },
  markRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  appName: { fontFamily: fonts.bold, fontSize: 22, letterSpacing: -0.4, color: colors.text },
  subtitle: { color: colors.textSecondary, marginTop: space.sm, lineHeight: 22 },
  badge: { alignSelf: 'flex-start', marginTop: space.xxl, backgroundColor: colors.warningBg, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  badgeText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.warningText },
  footer: { padding: space.xl, paddingTop: space.sm },
});
