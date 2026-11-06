import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { AuthLayout } from './AuthLayout';
import { Banner, Button, LinkText } from '../../components/ui';
import { OtpInput } from '../../components/OtpInput';
import {
  OtpExpiredError,
  OtpIncorrectError,
  OtpLockedError,
  lockRemainingMs,
  sendOtp,
  verifyOtp,
} from '../../services/authService';
import { friendlyError } from '../../services/firebase';
import { OTP_LENGTH, OTP_RESEND_SECONDS } from '../../config/app';
import { colors, type } from '../../config/theme';
import type { RootScreen } from '../../navigation/types';

/**
 * PRD 3.2. On success Firebase signs the user in; AppContext then switches the
 * navigator to Home or Business profile setup. On Android the SMS can be read
 * automatically, which signs the user in without typing.
 */
export function OtpScreen({ navigation, route }: RootScreen<'Otp'>) {
  const { mobile } = route.params;
  const [code, setCode] = useState('');
  const [seconds, setSeconds] = useState(OTP_RESEND_SECONDS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  useEffect(() => {
    lockRemainingMs(mobile).then(ms => {
      if (ms > 0) {
        setLocked(true);
        setError(new OtpLockedError(ms).message);
      }
    });
  }, [mobile]);

  const verify = async (value = code) => {
    if (value.length !== OTP_LENGTH || busy) return;
    setBusy(true);
    setError(null);
    try {
      await verifyOtp(value);
    } catch (e) {
      setCode('');
      if (e instanceof OtpLockedError) {
        setLocked(true);
        setError(e.message);
      } else if (e instanceof OtpIncorrectError) {
        setError(e.attemptsLeft <= 2 ? `${e.message} ${e.attemptsLeft} attempt${e.attemptsLeft === 1 ? '' : 's'} left.` : e.message);
      } else if (e instanceof OtpExpiredError) {
        setError(e.message);
      } else {
        setError(friendlyError(e));
      }
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(null);
    try {
      await sendOtp(mobile);
      setSeconds(OTP_RESEND_SECONDS);
      setCode('');
    } catch (e) {
      setError(friendlyError(e));
    }
  };

  return (
    <AuthLayout
      title="Verify OTP"
      subtitle={
        <Text>
          Sent to <Text style={{ fontWeight: '700', color: colors.text }}>+91 {mobile}</Text>
        </Text>
      }
      footer={<Button title="Verify" onPress={() => verify()} disabled={code.length !== OTP_LENGTH || locked} loading={busy} />}>
      <View style={{ marginTop: -16, marginBottom: 16 }}>
        <LinkText title="Change number" onPress={() => navigation.navigate('SignIn')} />
      </View>
      {error ? <Banner kind="error" text={error} /> : null}
      <OtpInput
        value={code}
        error={!!error}
        onChange={v => {
          setCode(v);
          if (error && !locked) setError(null);
          if (v.length === OTP_LENGTH && !locked) verify(v);
        }}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 20, gap: 6 }}>
        {seconds > 0 ? (
          <Text style={type.caption}>Resend OTP in 0:{String(seconds).padStart(2, '0')}</Text>
        ) : (
          <>
            <Text style={type.caption}>Didn't get it?</Text>
            <LinkText title="Resend OTP" onPress={resend} style={{ fontSize: 14 }} />
          </>
        )}
      </View>
    </AuthLayout>
  );
}
