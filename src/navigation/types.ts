import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { QuickFilter } from '../lib/dateRanges';

export type TabParams = {
  Home: undefined;
  /** Optional quick filter to open with (e.g. Home → "This month"). */
  History: { filter?: Exclude<QuickFilter, 'custom'> } | undefined;
  Profile: undefined;
};

export type RootParams = {
  SignIn: undefined;
  Register: { mobile: string };
  Otp: { mobile: string; flow: 'signin' | 'register' };
  ProfileSetup: undefined;
  Tabs: NavigatorScreenParams<TabParams>;
  CreateBill: undefined;
  Scanner: undefined;
  /** Animated "Bill saved" confirmation; `action` is the button tapped on Create Bill. */
  BillSuccess: { billId: string; action: 'print' | 'pdf' };
  BillView: { billId: string; mode: 'saved' | 'detail'; action?: 'print' | 'pdf' };
  PrintPreview: { billId: string };
  EditProfile: { section: 'personal' | 'business' };
  ReplaceQr: { path: string; mime: string; payload: string };
  PrinterSettings: { fromBill?: boolean } | undefined;
};

export type RootScreen<K extends keyof RootParams> = NativeStackScreenProps<RootParams, K>;
export type TabScreen<K extends keyof TabParams> = CompositeScreenProps<
  BottomTabScreenProps<TabParams, K>,
  NativeStackScreenProps<RootParams>
>;
