import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Printer } from 'lucide-react-native';
import { Button, Loading } from '../../components/ui';
import { ThermalPreview } from '../../components/ThermalPreview';
import { PrintingOverlay } from '../../components/PrintingOverlay';
import { useBillActions } from './useBillActions';
import { useApp } from '../../context/AppContext';
import { loadBill } from '../../services/billService';
import { currentUid } from '../../services/firebase';
import { buildThermalBill } from '../../lib/thermal';
import { colors, space, type } from '../../config/theme';
import type { RootScreen } from '../../navigation/types';
import type { Bill } from '../../types';

/** PRD 10.1: shows the thermal layout on screen before printing. */
export function PrintPreviewScreen({ route }: RootScreen<'PrintPreview'>) {
  const { paymentQr } = useApp();
  const [bill, setBill] = useState<Bill | null>(null);
  const actions = useBillActions(bill);

  useEffect(() => {
    loadBill(currentUid(), route.params.billId).then(setBill);
  }, [route.params.billId]);

  if (!bill || !paymentQr) return <Loading />;
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[type.caption, { textAlign: 'center', marginBottom: space.md }]}>
          {actions.paperWidth} mm paper · prints in black only
        </Text>
        <ThermalPreview lines={buildThermalBill(bill, paymentQr, actions.paperWidth)} paperWidth={actions.paperWidth} />
      </ScrollView>
      <View style={styles.footer}>
        <Button title="Print bill" icon={<Printer size={20} color={colors.white} />} onPress={actions.print} />
      </View>
      <PrintingOverlay visible={actions.printing} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#E9ECE8' },
  content: { padding: space.xl },
  footer: { padding: space.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider },
});
