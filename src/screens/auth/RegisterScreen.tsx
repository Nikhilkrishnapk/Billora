import React, { useState } from 'react';
import { AuthLayout } from './AuthLayout';
import { Banner, Button, Field, LinkText } from '../../components/ui';
import { digitsOnly, isMobile, validateLength } from '../../lib/validation';
import { isRegistered, sendOtp, setPendingOwnerName } from '../../services/authService';
import { friendlyError } from '../../services/firebase';
import type { RootScreen } from '../../navigation/types';

/** PRD 3.3 */
export function RegisterScreen({ navigation, route }: RootScreen<'Register'>) {
  const [mobile, setMobile] = useState(route.params.mobile);
  const [ownerName, setOwnerName] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameError = validateLength(ownerName, 2, 50, 'Owner name');
  const valid = isMobile(mobile) && !nameError;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      // If the number was edited to one that already has an account, sign in instead of registering again.
      const registered = await isRegistered(mobile);
      setPendingOwnerName(registered ? null : ownerName.trim());
      await sendOtp(mobile);
      navigation.navigate('Otp', { mobile, flow: registered ? 'signin' : 'register' });
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      badge="Not registered yet"
      title="Create your account"
      subtitle="This number isn't registered. Add your name and verify the number to get started."
      footer={<Button title="Send OTP" onPress={submit} disabled={!valid} loading={busy} />}>
      {error ? <Banner kind="error" text={error} /> : null}
      <Field
        label="Mobile number"
        prefix="+91"
        large
        value={mobile}
        onChangeText={t => setMobile(digitsOnly(t))}
        keyboardType="number-pad"
        maxLength={10}
        error={mobile.length === 10 && !isMobile(mobile) ? 'Enter a valid 10-digit mobile number' : null}
      />
      <Field
        label="Owner name"
        value={ownerName}
        onChangeText={setOwnerName}
        onBlur={() => setTouched(true)}
        placeholder="Your full name"
        autoCapitalize="words"
        textContentType="name"
        maxLength={50}
        autoFocus
        error={nameError}
        showError={touched}
      />
      <LinkText title="Already registered? Sign in" onPress={() => navigation.navigate('SignIn')} />
    </AuthLayout>
  );
}
