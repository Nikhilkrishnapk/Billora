import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, type User } from '@react-native-firebase/auth';
import { auth } from '../services/firebase';
import { ensureMerchant, subscribeMerchant, subscribeProfile } from '../services/merchantService';
import { takePendingOwnerName } from '../services/authService';
import { loadGstRates } from '../services/remoteConfigService';
import { DEFAULT_GST_RATES } from '../config/app';
import type { BusinessProfile, Merchant, PaymentQr } from '../types';

export type AppStatus = 'loading' | 'signedOut' | 'needsProfile' | 'ready';

interface AppState {
  status: AppStatus;
  user: User | null;
  merchant: Merchant | null;
  profile: BusinessProfile | null;
  gstRates: number[];
  /** The merchant's current payment details, used on every print and share (including reprints). Null until the profile loads. */
  paymentQr: PaymentQr | null;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [profile, setProfile] = useState<BusinessProfile | null | undefined>(undefined);
  const [gstRates, setGstRates] = useState(DEFAULT_GST_RATES);

  useEffect(() => {
    loadGstRates().then(setGstRates);
  }, []);

  useEffect(
    () =>
      onAuthStateChanged(auth(), u => {
        if (u) {
          // Don't block start-up on this: Firestore writes only resolve once the server confirms,
          // so awaiting it offline kept the splash up forever. The write is queued and syncs later.
          ensureMerchant(u, takePendingOwnerName()).catch(() => {
            // Offline or rejected: the merchant record already exists for returning users; retried next launch.
          });
        }
        setProfile(undefined);
        setUser(u);
      }),
    [],
  );

  useEffect(() => {
    if (!user) {
      setMerchant(null);
      setProfile(user === null ? null : undefined);
      return;
    }
    const unsubMerchant = subscribeMerchant(user.uid, setMerchant);
    const unsubProfile = subscribeProfile(user.uid, p => setProfile(p), () => setProfile(null));
    return () => {
      unsubMerchant();
      unsubProfile();
    };
  }, [user]);

  const value = useMemo<AppState>(() => {
    let status: AppStatus = 'loading';
    if (user === null) status = 'signedOut';
    else if (user && profile !== undefined) status = profile?.complete ? 'ready' : 'needsProfile';
    return {
      status,
      user: user ?? null,
      merchant,
      profile: profile ?? null,
      gstRates,
      paymentQr: profile ? { payload: profile.qrPayload || null, upiId: profile.upiId } : null,
    };
  }, [user, merchant, profile, gstRates]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside AppProvider');
  return v;
}

/** For screens that only render once the profile is complete. */
export function useProfile(): BusinessProfile {
  const { profile } = useApp();
  if (!profile) throw new Error('Profile not loaded');
  return profile;
}
