/** Data model (PRD section 13). Firestore field names are camelCase. */

export type PaperWidth = 58 | 80;

export interface Merchant {
  mobileNumber: string; // +91XXXXXXXXXX
  ownerName: string;
  createdAt: Date | null; // server timestamp, "Registered on"
  lastLoginAt: Date | null;
}

/** Business details that are copied onto every bill (business_snapshot). */
export interface BusinessDetails {
  ownerName: string;
  companyName: string;
  contactNumber: string; // 10 digits
  email: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  isGstRegistered: boolean;
  gstin: string;
  /** Small JPEG of the shop logo as a data: URI (kept in Firestore; no Cloud Storage on the free plan). */
  logoDataUri: string | null;
}

export interface BusinessProfile extends BusinessDetails {
  /** Decoded QR content, or '' when the merchant has not added a QR (it is optional). */
  qrPayload: string;
  qrCodeUpdatedAt: Date | null;
  upiId: string;
  printerPaperWidth: PaperWidth;
  complete: boolean;
}

/**
 * The payment block printed on bills. Always the merchant's *current* QR (section 12.2).
 * Both parts are optional: no QR prints just the UPI ID, and neither prints no payment block.
 */
export interface PaymentQr {
  payload: string | null;
  upiId: string;
}

export interface BillItem {
  productName: string;
  barcode: string | null;
  quantity: number;
  unitPrice: number;
  gstRate: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  lineTotal: number;
}

export interface Bill {
  billId: string;
  billNumber: string;
  billDatetime: Date;
  customerName: string;
  customerMobile: string;
  items: BillItem[];
  subtotal: number;
  totalCgst: number;
  totalSgst: number;
  roundOff: number;
  grandTotal: number;
  businessSnapshot: BusinessDetails;
}

export interface Product {
  productId: string;
  name: string;
  barcode: string | null;
  unitPrice: number;
  gstRate: number;
}

/** An item on a bill that is still being created. */
export interface DraftItem {
  key: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
  barcode: string | null;
}
