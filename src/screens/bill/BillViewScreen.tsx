import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CircleCheck, Download, Eye, Printer, Share2 } from 'lucide-react-native';
import { Banner, Button, Card, CardTitle, Loading } from '../../components/ui';
import { PrintingOverlay } from '../../components/PrintingOverlay';
import { useBillActions } from './useBillActions';
import { useDraftBill } from '../../context/DraftBillContext';
import { loadBill } from '../../services/billService';
import { currentUid, friendlyError } from '../../services/firebase';
import { gstSummaryFromItems } from '../../lib/thermal';
import { formatAmount, formatDateTime, formatQty, invoiceFileName, signed } from '../../lib/format';
import { colors, fonts, space, type } from '../../config/theme';
import type { RootScreen } from '../../navigation/types';
import type { Bill } from '../../types';

/**
 * "Bill saved" after creating a bill (PRD 16.4 #9) and the read-only Bill detail
 * from Transaction History (PRD 11.3), which is the same layout plus the item
 * list and GST breakdown, without "New bill".
 */
export function BillViewScreen({ navigation, route }: RootScreen<'BillView'>) {
  const { billId, mode, action } = route.params;
  const [bill, setBill] = useState<Bill | null>(null);
  const [error, setError] = useState<string | null>(null);
  const actions = useBillActions(bill);
  const draft = useDraftBill();
  const ranAction = useRef(false);

  useEffect(() => {
    loadBill(currentUid(), billId)
      .then(b => (b ? setBill(b) : setError('This bill could not be found.')))
      .catch(e => setError(friendlyError(e)));
  }, [billId]);

  useEffect(() => {
    navigation.setOptions({ title: mode === 'saved' ? 'Bill saved' : bill?.billNumber ?? 'Bill' });
  }, [navigation, mode, bill]);

  // Run the action the merchant tapped on Create Bill (Print bill → print right away).
  useEffect(() => {
    if (bill && action === 'print' && !ranAction.current) {
      ranAction.current = true;
      actions.print();
    }
  }, [bill, action, actions]);

  if (error) {
    return (
      <View style={{ padding: space.lg }}>
        <Banner kind="error" text={error} />
      </View>
    );
  }
  if (!bill) return <Loading />;

  const gst = bill.businessSnapshot.isGstRegistered;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {mode === 'saved' ? (
          <View style={styles.success}>
            <View style={styles.check}>
              <CircleCheck size={36} color={colors.primary} />
            </View>
            <Text style={[type.cardTitle, { fontSize: 18 }]}>Bill saved</Text>
            <Text style={[type.mono, { marginTop: 2 }]}>{bill.billNumber}</Text>
            <Text style={styles.bigTotal}>₹{formatAmount(bill.grandTotal)}</Text>
            <Text style={type.caption}>
              {bill.customerName} · {bill.customerMobile}
            </Text>
          </View>
        ) : (
          <Card>
            <Text style={[type.mono, { fontFamily: fonts.monoBold }]}>{bill.billNumber}</Text>
            <Text style={type.caption}>{formatDateTime(bill.billDatetime)}</Text>
            <View style={styles.divider} />
            <Text style={type.label}>Customer</Text>
            <Text style={type.bodyStrong}>{bill.customerName}</Text>
            <Text style={type.caption}>+91 {bill.customerMobile}</Text>
          </Card>
        )}

        {mode === 'detail' ? (
          <Card>
            <CardTitle title={`Items (${bill.items.length})`} />
            {bill.items.map((item, i) => (
              <View key={i} style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={type.bodyStrong}>{item.productName}</Text>
                  <Text style={type.caption}>
                    {formatQty(item.quantity)} × ₹{formatAmount(item.unitPrice)}
                    {gst ? `  ·  GST ${item.gstRate}%` : ''}
                  </Text>
                </View>
                <Text style={type.bodyStrong}>₹{formatAmount(item.lineTotal)}</Text>
              </View>
            ))}
            <View style={{ marginTop: space.md }}>
              <Row label="Subtotal" value={`₹${formatAmount(bill.subtotal)}`} />
              {gst ? <Row label="CGST" value={`₹${formatAmount(bill.totalCgst)}`} /> : null}
              {gst ? <Row label="SGST" value={`₹${formatAmount(bill.totalSgst)}`} /> : null}
              <Row label="Round-off" value={signed(bill.roundOff)} />
              <View style={[styles.sumRow, { marginTop: 4 }]}>
                <Text style={[type.bodyStrong, { fontSize: 16 }]}>Grand total</Text>
                <Text style={[type.cardTitle, { fontSize: 22 }]}>₹{formatAmount(bill.grandTotal)}</Text>
              </View>
            </View>
            {gst ? (
              <View style={{ marginTop: space.lg }}>
                <Text style={[type.label, { marginBottom: 6 }]}>GST breakdown</Text>
                <View style={styles.gstHead}>
                  {['Rate', 'Taxable', 'CGST', 'SGST'].map((h, i) => (
                    <Text key={h} style={[type.caption, styles.gstCell, i > 0 && { textAlign: 'right' }]}>
                      {h}
                    </Text>
                  ))}
                </View>
                {gstSummaryFromItems(bill).map(r => (
                  <View key={r.rate} style={styles.gstRow}>
                    {[`${r.rate}%`, formatAmount(r.taxableValue), formatAmount(r.cgst), formatAmount(r.sgst)].map((v, i) => (
                      <Text key={i} style={[type.body, styles.gstCell, { fontSize: 14 }, i > 0 && { textAlign: 'right' }]}>
                        {v}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            ) : null}
          </Card>
        ) : null}

        <Card>
          <CardTitle title="Thermal bill" />
          <View style={styles.printerRow}>
            <View style={[styles.dot, { backgroundColor: actions.printer ? colors.statusOk : colors.border }]} />
            <Text style={[type.caption, { flex: 1 }]}>
              {actions.printer ? `Printer: ${actions.printer.name}` : 'No printer set up yet'} · {actions.paperWidth} mm
            </Text>
          </View>
          <View style={styles.btnRow}>
            <Button
              title="Preview"
              variant="secondary"
              compact
              style={{ flex: 1 }}
              icon={<Eye size={18} color={colors.primary} />}
              onPress={() => navigation.navigate('PrintPreview', { billId: bill.billId })}
            />
            <Button
              title="Print bill"
              compact
              style={{ flex: 1 }}
              icon={<Printer size={18} color={colors.white} />}
              onPress={actions.print}
            />
          </View>
        </Card>

        <Card>
          <CardTitle title="A4 invoice (PDF)" />
          <Text style={[type.mono, { fontSize: 13, marginBottom: space.md }]} numberOfLines={2}>
            {invoiceFileName(bill.billNumber, bill.customerName)}
          </Text>
          <View style={styles.btnRow}>
            <Button
              title="Download"
              variant="secondary"
              compact
              style={{ flex: 1 }}
              loading={actions.pdfBusy === 'download'}
              disabled={!!actions.pdfBusy}
              icon={<Download size={18} color={colors.primary} />}
              onPress={actions.download}
            />
            <Button
              title="Share"
              compact
              style={{ flex: 1 }}
              loading={actions.pdfBusy === 'share'}
              disabled={!!actions.pdfBusy}
              icon={<Share2 size={18} color={colors.white} />}
              onPress={actions.share}
            />
          </View>
        </Card>
      </ScrollView>

      {mode === 'saved' ? (
        <View style={styles.footer}>
          <Button
            title="New bill"
            onPress={() => {
              draft.reset();
              navigation.replace('CreateBill');
            }}
          />
          <Button title="Done" variant="ghost" onPress={() => navigation.popToTop()} />
        </View>
      ) : null}
      <PrintingOverlay visible={actions.printing} />
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.sumRow}>
      <Text style={type.label}>{label}</Text>
      <Text style={type.bodyStrong}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.lg, gap: space.lg },
  success: { alignItems: 'center', paddingVertical: space.lg },
  check: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  bigTotal: { fontFamily: fonts.bold, fontSize: 34, color: colors.text, marginVertical: 6 },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: space.md },
  itemRow: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divider, gap: space.sm },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 26 },
  gstHead: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.divider, paddingBottom: 4 },
  gstRow: { flexDirection: 'row', paddingVertical: 4 },
  gstCell: { flex: 1 },
  printerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: space.md },
  dot: { width: 10, height: 10, borderRadius: 5 },
  btnRow: { flexDirection: 'row', gap: space.sm },
  footer: { padding: space.lg, paddingBottom: space.sm, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider, gap: 4 },
});
