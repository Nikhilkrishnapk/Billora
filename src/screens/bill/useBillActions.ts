/** Print / Download / Share for a saved bill (PRD 10). Used by Bill saved, Bill detail and Print preview. */
import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { buildThermalBill, encodeEscPos } from '../../lib/thermal';
import {
  PrinterError,
  getSavedPrinter,
  printBytes,
  turnOnBluetooth,
  type SavedPrinter,
} from '../../services/printerService';
import { downloadInvoice, generateInvoice, openFile, shareInvoice, type InvoiceFile } from '../../services/pdfService';
import { friendlyError } from '../../services/firebase';
import type { RootParams } from '../../navigation/types';
import type { Bill } from '../../types';

export function useBillActions(bill: Bill | null) {
  const { profile, paymentQr } = useApp();
  const navigation = useNavigation<NativeStackNavigationProp<RootParams>>();
  const toast = useToast();
  const [printer, setPrinter] = useState<SavedPrinter | null>(null);
  const [printing, setPrinting] = useState(false);
  const [pdfBusy, setPdfBusy] = useState<null | 'download' | 'share'>(null);
  const pendingPrint = useRef(false);
  const file = useRef<{ key: string; file: InvoiceFile } | null>(null);
  const paperWidth = profile?.printerPaperWidth ?? 58;

  const print = useCallback(async () => {
    if (!bill || !paymentQr) return;
    const saved = await getSavedPrinter();
    if (!saved) {
      // First use: pair a printer, then come back and print.
      pendingPrint.current = true;
      navigation.navigate('PrinterSettings', { fromBill: true });
      return;
    }
    setPrinting(true);
    try {
      await printBytes(encodeEscPos(buildThermalBill(bill, paymentQr, paperWidth)));
      toast('Bill printed');
    } catch (e) {
      const err = e instanceof PrinterError ? e : new PrinterError('failed');
      const changePrinter = { text: 'Change printer', onPress: () => navigation.navigate('PrinterSettings', { fromBill: true }) };
      const retry = { text: 'Retry', onPress: () => print() };
      Alert.alert(
        err.message,
        undefined,
        err.kind === 'bluetooth-off'
          ? [{ text: 'Turn on Bluetooth', onPress: () => turnOnBluetooth() }, changePrinter, retry]
          : [changePrinter, { text: 'Cancel', style: 'cancel' }, retry],
      );
    } finally {
      setPrinting(false);
    }
  }, [bill, paymentQr, paperWidth, navigation, toast]);

  useFocusEffect(
    useCallback(() => {
      getSavedPrinter().then(p => {
        setPrinter(p);
        if (pendingPrint.current) {
          pendingPrint.current = false;
          if (p) print();
        }
      });
    }, [print]),
  );

  /** The PDF is generated once per bill and payment QR, then reused for download and share. */
  const getFile = useCallback(async () => {
    if (!bill || !paymentQr) throw new Error('Bill not loaded');
    const key = `${bill.billId}|${paymentQr.payload}|${paymentQr.upiId}`;
    if (file.current?.key === key) return file.current.file;
    const f = await generateInvoice(bill, paymentQr);
    file.current = { key, file: f };
    return f;
  }, [bill, paymentQr]);

  const download = useCallback(async () => {
    setPdfBusy('download');
    try {
      const f = await getFile();
      const path = await downloadInvoice(f);
      Alert.alert('Invoice saved', f.fileName, [
        { text: 'OK', style: 'cancel' },
        { text: 'Open', onPress: () => openFile(path).catch(() => openFile(f.path).catch(() => toast('No app found to open PDFs'))) },
      ]);
    } catch (e) {
      Alert.alert('Could not save the invoice', friendlyError(e));
    } finally {
      setPdfBusy(null);
    }
  }, [getFile, toast]);

  const share = useCallback(async () => {
    if (!bill) return;
    setPdfBusy('share');
    try {
      await shareInvoice(await getFile(), bill);
    } catch (e) {
      Alert.alert('Could not share the invoice', friendlyError(e));
    } finally {
      setPdfBusy(null);
    }
  }, [bill, getFile]);

  return { printer, printing, pdfBusy, print, download, share, paperWidth };
}
