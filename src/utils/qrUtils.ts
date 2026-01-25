import QRCode from 'qrcode-generator';

export const generateOrderQR = (orderId: string): string => {
  const qr = QRCode(0, 'M');
  qr.addData(orderId);
  qr.make();
  return qr.createDataURL(4);
};

export const generateUniqueOrderId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `AGR${timestamp}${random}`.toUpperCase();
};