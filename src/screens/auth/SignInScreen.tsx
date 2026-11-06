import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { AuthLayout } from './AuthLayout';
import { Banner, Button, Field, LinkText } from '../../components/ui';
import { digitsOnly, isMobile } from '../../lib/validation';
import { isRegistered, sendOtp } from '../../services/authService';
import { friendlyError } from '../../services/firebase';
import { type } from '../../config/theme';
import type { RootScreen } from '../../navigation/types';

/** PRD 3.1: number → registered? → OTP, otherwise → Register with the number pre-filled. */
export function SignInScreen({ navigation }: RootScreen<'SignIn'>) {
  const [mobile, setMobile] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = isMobile(mobile);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (await isRegistered(mobile)) {
        await sendOtp(mobile);
        navigation.navigate('Otp', { mobile, flow: 'signin' });
      } else {
        navigation.navigate('Register', { mobile });
      }
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Enter your mobile number. We'll send you a one-time password."
      footer={<Button title="Send OTP" onPress={submit} disabled={!valid} loading={busy} />}>
      {error ? <Banner kind="error" text={error} /> : null}
      <Field
        label="Mobile number"
        prefix="+91"
        large
        value={mobile}
        onChangeText={t => setMobile(digitsOnly(t))}
        keyboardType="number-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        placeholder="10-digit mobile number"
        maxLength={10}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={() => valid && submit()}
        error={mobile.length === 10 && !valid ? 'Enter a valid 10-digit mobile number' : null}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
        <Text style={type.caption}>New to the app?</Text>
        <LinkText title="Create an account" onPress={() => navigation.navigate('Register', { mobile })} style={{ fontSize: 13 }} />
      </View>
    </AuthLayout>
  );
}
