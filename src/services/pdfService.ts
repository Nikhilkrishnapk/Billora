/** A4 invoice PDF: generate, download, share (PRD 9.2, 10.2, 10.3). */
import { Platform } from 'react-native';
import { generatePDF } from 'react-native-html-to-pdf';
import ReactNativeBlobUtil from 'react-native-blob-util';
import Share from 'react-native-share';
import FileViewer from 'react-native-file-viewer';
import { buildInvoiceHtml } from '../lib/invoiceHtml';
import { formatAmount, invoiceFileName } from '../lib/format';
import type { Bill, PaymentQr } from '../types';
import { APP_NAME } from '../config/app';

export interface InvoiceFile {
  path: string;
  fileName: string;
}

export async function generateInvoice(bill: Bill, qr: PaymentQr): Promise<InvoiceFile> {
  const fileName = invoiceFileName(bill.billNumber, bill.customerName);
  const html = buildInvoiceHtml({ bill, qr, logoDataUri: bill.businessSnapshot.logoDataUri });
  const res = await generatePDF({
    html,
    fileName: fileName.replace(/\.pdf$/, ''),
    width: 595, // A4 in points
    height: 842,
    padding: 0,
    bgColor: '#FFFFFF',
    shouldPrintBackgrounds: true,
  });
  return { path: res.filePath, fileName };
}

/** Android: Downloads/Billora. iOS: the app's Documents folder, visible in the Files app. */
export async function downloadInvoice(file: InvoiceFile): Promise<string> {
  if (Platform.OS === 'android') {
    await ReactNativeBlobUtil.MediaCollection.copyToMediaStore(
      { name: file.fileName, parentFolder: APP_NAME, mimeType: 'application/pdf' },
      'Download',
      file.path,
    );
    return file.path;
  }
  const dest = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/${file.fileName}`;
  if (await ReactNativeBlobUtil.fs.exists(dest)) await ReactNativeBlobUtil.fs.unlink(dest);
  await ReactNativeBlobUtil.fs.cp(file.path, dest);
  return dest;
}

export async function openFile(path: string) {
  await FileViewer.open(path, { showOpenWithDialog: true, displayName: path.split('/').pop() });
}

export async function shareInvoice(file: InvoiceFile, bill: Bill) {
  await Share.open({
    url: `file://${file.path.replace(/^file:\/\//, '')}`,
    type: 'application/pdf',
    filename: file.fileName.replace(/\.pdf$/, ''),
    message: `Invoice ${bill.billNumber} from ${bill.businessSnapshot.companyName} for ₹${formatAmount(bill.grandTotal)}.`,
    subject: `Invoice ${bill.billNumber}`,
    failOnCancel: false,
  });
}
