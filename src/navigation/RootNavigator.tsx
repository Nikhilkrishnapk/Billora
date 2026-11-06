import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { House, ReceiptText, UserRound } from 'lucide-react-native';
import { useApp } from '../context/AppContext';
import { DraftBillProvider } from '../context/DraftBillContext';
import { colors, fonts } from '../config/theme';
import { Loading } from '../components/ui';
import type { RootParams, TabParams } from './types';

import { SignInScreen } from '../screens/auth/SignInScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { OtpScreen } from '../screens/auth/OtpScreen';
import { ProfileSetupScreen } from '../screens/profile/ProfileSetupScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { CreateBillScreen } from '../screens/bill/CreateBillScreen';
import { ScannerScreen } from '../screens/bill/ScannerScreen';
import { BillViewScreen } from '../screens/bill/BillViewScreen';
import { BillSuccessScreen } from '../screens/bill/BillSuccessScreen';
import { PrintPreviewScreen } from '../screens/bill/PrintPreviewScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { EditProfileScreen } from '../screens/profile/EditProfileScreen';
import { ReplaceQrScreen } from '../screens/profile/ReplaceQrScreen';
import { PrinterSettingsScreen } from '../screens/profile/PrinterSettingsScreen';

const Stack = createNativeStackNavigator<RootParams>();
const Tab = createBottomTabNavigator<TabParams>();

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.background, primary: colors.primary, card: colors.surface, text: colors.text, border: colors.divider },
};

const headerOptions = {
  headerShadowVisible: false,
  headerStyle: { backgroundColor: colors.surface },
  headerTitleStyle: { fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  headerTintColor: colors.text,
  headerBackButtonDisplayMode: 'minimal' as const,
};

function TabIcon({ Icon, focused, label }: { Icon: typeof House; focused: boolean; label: string }) {
  return (
    <View style={styles.tabItem}>
      <View style={[styles.pill, focused && { backgroundColor: colors.primaryTint }]}>
        <Icon size={22} strokeWidth={2} color={focused ? colors.primary : colors.textSecondary} />
      </View>
      <Text style={[styles.tabLabel, { color: focused ? colors.primary : colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const homeIcon = ({ focused }: { focused: boolean }) => <TabIcon Icon={House} focused={focused} label="Home" />;
const historyIcon = ({ focused }: { focused: boolean }) => <TabIcon Icon={ReceiptText} focused={focused} label="History" />;
const profileIcon = ({ focused }: { focused: boolean }) => <TabIcon Icon={UserRound} focused={focused} label="Profile" />;

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: { height: 76, paddingTop: 10, borderTopColor: colors.divider, backgroundColor: colors.surface },
      }}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarAccessibilityLabel: 'Home', tabBarIcon: homeIcon }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarAccessibilityLabel: 'Transaction history',
          tabBarIcon: historyIcon,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarAccessibilityLabel: 'Profile', tabBarIcon: profileIcon }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { status } = useApp();
  if (status === 'loading') return <Loading />;

  return (
    <NavigationContainer theme={navTheme}>
      <DraftBillProvider>
        <Stack.Navigator screenOptions={headerOptions}>
          {status === 'signedOut' ? (
            <Stack.Group screenOptions={{ headerShown: false }}>
              <Stack.Screen name="SignIn" component={SignInScreen} />
              <Stack.Screen name="Register" component={RegisterScreen} />
              <Stack.Screen name="Otp" component={OtpScreen} />
            </Stack.Group>
          ) : status === 'needsProfile' ? (
            <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} options={{ title: 'Business profile' }} />
          ) : (
            <>
              <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
              <Stack.Screen name="CreateBill" component={CreateBillScreen} options={{ title: 'New bill' }} />
              <Stack.Screen name="Scanner" component={ScannerScreen} options={{ headerShown: false, animation: 'fade' }} />
              <Stack.Screen
                name="BillSuccess"
                component={BillSuccessScreen}
                options={{ headerShown: false, animation: 'fade', gestureEnabled: false }}
              />
              <Stack.Screen name="BillView" component={BillViewScreen} options={{ title: 'Bill' }} />
              <Stack.Screen name="PrintPreview" component={PrintPreviewScreen} options={{ title: 'Print preview' }} />
              <Stack.Screen name="EditProfile" component={EditProfileScreen} />
              <Stack.Screen name="ReplaceQr" component={ReplaceQrScreen} options={{ title: 'Replace payment QR' }} />
              <Stack.Screen name="PrinterSettings" component={PrinterSettingsScreen} options={{ title: 'Printer settings' }} />
            </>
          )}
        </Stack.Navigator>
      </DraftBillProvider>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabItem: { alignItems: 'center', width: 90 },
  pill: { width: 56, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontFamily: fonts.semibold, fontSize: 12, marginTop: 4 },
});
