import React, { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Banner, Button, Card } from '../../components/ui';
import { BusinessFields, LogoPickerField, PersonalFields, hasErrors, useProfileForm } from './profileForm';
import { useApp, useProfile } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { saveProfile, updateOwnerName } from '../../services/merchantService';
import { currentUid, friendlyError } from '../../services/firebase';
import { colors, space } from '../../config/theme';
import type { PickedImage } from '../../services/imageService';
import type { RootScreen } from '../../navigation/types';

/**
 * PRD 12.1. Changes apply to new bills only: saved bills keep their business snapshot.
 */
export function EditProfileScreen({ navigation, route }: RootScreen<'EditProfile'>) {
  const { section } = route.params;
  const p = useProfile();
  const { merchant } = useApp();
  const toast = useToast();
  const form = useProfileForm({
    ownerName: p.ownerName,
    contactNumber: p.contactNumber,
    email: p.email,
    companyName: p.companyName,
    addressLine: p.addressLine,
    city: p.city,
    state: p.state,
    pincode: p.pincode,
    isGstRegistered: p.isGstRegistered,
    gstin: p.gstin,
    upiId: p.upiId,
  });
  const [logo, setLogo] = useState<PickedImage | null>(null);
  const [logoRemoved, setLogoRemoved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const leaving = useRef(false);

  const keys = section === 'personal'
    ? (['ownerName', 'contactNumber', 'email'] as const)
    : (['companyName', 'addressLine', 'city', 'state', 'pincode', 'gstin'] as const);
  const dirty = form.dirty || !!logo || logoRemoved;
  const valid = !hasErrors(form.errors, [...keys]);

  useEffect(() => {
    navigation.setOptions({ title: section === 'personal' ? 'Personal details' : 'Business details' });
  }, [navigation, section]);

  useEffect(
    () =>
      navigation.addListener('beforeRemove', e => {
        if (leaving.current || !dirty) return;
        e.preventDefault();
        Alert.alert('Discard changes?', undefined, [
          { text: 'Keep editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
        ]);
      }),
    [navigation, dirty],
  );

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const uid = currentUid();
      const v = form.values;
      if (section === 'personal') {
        await updateOwnerName(uid, v.ownerName.trim());
        await saveProfile(uid, { ownerName: v.ownerName.trim(), contactNumber: v.contactNumber, email: v.email.trim() });
      } else {
        const logoDataUri = logo?.dataUri ?? (logoRemoved ? null : p.logoDataUri);
        await saveProfile(uid, {
          companyName: v.companyName.trim(),
          addressLine: v.addressLine.trim(),
          city: v.city.trim(),
          state: v.state.trim(),
          pincode: v.pincode,
          isGstRegistered: v.isGstRegistered,
          gstin: v.isGstRegistered ? v.gstin.toUpperCase() : '',
          logoDataUri,
        });
      }
      toast('Profile updated');
      leaving.current = true;
      navigation.goBack();
    } catch (e) {
      setError(friendlyError(e));
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Banner kind="warning" text="Changes apply to new bills. Bills already saved keep their original details." />
          <Card>
            {section === 'personal' ? (
              <PersonalFields form={form} registeredMobile={merchant?.mobileNumber?.replace(/^\+91/, '+91 ')} />
            ) : (
              <>
                <BusinessFields form={form} />
                <LogoPickerField
                  uri={logo?.dataUri ?? (logoRemoved ? null : p.logoDataUri)}
                  onPicked={img => {
                    setLogo(img);
                    setLogoRemoved(false);
                  }}
                  onRemove={() => {
                    setLogo(null);
                    setLogoRemoved(true);
                  }}
                />
              </>
            )}
          </Card>
          {error ? <Banner kind="error" text={error} /> : null}
        </ScrollView>
        <View style={styles.footer}>
          <Button title="Save" onPress={save} disabled={!dirty || !valid} loading={saving} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.lg, gap: space.lg },
  footer: { padding: space.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider },
});
