/** Image picking, cropping and QR decoding (PRD 4.1, 12.2). */
import ImagePicker from 'react-native-image-crop-picker';
import BarcodeScanning, { BarcodeFormat } from '@react-native-ml-kit/barcode-scanning';

export interface PickedImage {
  path: string;
  mime: string;
  size: number;
  /** data: URI, when requested with `base64: true` */
  dataUri?: string;
}

export class ImageRuleError extends Error {}

export async function pickImage(
  source: 'camera' | 'gallery',
  opts: { maxBytes: number; maxWidth: number; base64?: boolean; quality?: number },
): Promise<PickedImage | null> {
  const options = {
    mediaType: 'photo' as const,
    cropping: true,
    freeStyleCropEnabled: true,
    compressImageMaxWidth: opts.maxWidth,
    compressImageMaxHeight: opts.maxWidth,
    compressImageQuality: opts.quality ?? 0.9,
    forceJpg: !!opts.base64,
    includeBase64: !!opts.base64,
    cropperToolbarTitle: 'Crop image',
  };
  try {
    const img = source === 'camera' ? await ImagePicker.openCamera(options) : await ImagePicker.openPicker(options);
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(img.mime)) {
      throw new ImageRuleError('Use a PNG or JPG image.');
    }
    if (img.size > opts.maxBytes) {
      throw new ImageRuleError(`Image is too large. The limit is ${Math.round(opts.maxBytes / 1024 / 1024)} MB.`);
    }
    const mime = img.mime === 'image/jpg' ? 'image/jpeg' : img.mime;
    return { path: img.path, mime, size: img.size, dataUri: img.data ? `data:${mime};base64,${img.data}` : undefined };
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === 'E_PICKER_CANCELLED') return null;
    if (code === 'E_NO_CAMERA_PERMISSION' || code === 'E_NO_LIBRARY_PERMISSION') {
      throw new ImageRuleError('Allow access in Settings to choose an image.');
    }
    throw e;
  }
}

/** Returns the QR code text in the image, or null if no readable QR code is found. */
export async function readQrFromImage(path: string): Promise<string | null> {
  const codes = await BarcodeScanning.scan(path.startsWith('file://') ? path : `file://${path}`);
  const qr = codes.find(c => c.format === BarcodeFormat.QR_CODE && c.value);
  return qr?.value ?? null;
}
