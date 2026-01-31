// UPI QR Code Generation Utilities

export interface UPIPaymentData {
  upiId: string;
  amount: number;
  transactionNote: string;
  merchantName: string;
}

export const generateUPIQRCode = (data: UPIPaymentData): string => {
  const { upiId, amount, transactionNote, merchantName } = data;

  // UPI URL format: upi://pay?pa=UPI_ID&pn=NAME&am=AMOUNT&tn=NOTE&cu=INR
  const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(merchantName)}&am=${amount}&tn=${encodeURIComponent(transactionNote)}&cu=INR`;

  // Return the UPI URL string. QR generation (SVG/img) should be done by a QR library
  // or a React component so it renders properly in the UI.
  return upiUrl;
};

export const validateUPIId = (upiId: string): boolean => {
  // Basic UPI ID validation: format should be like user@bank
  const upiRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/;
  return upiRegex.test(upiId);
};

export const generateTransactionId = (): string => {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `UPI${timestamp.slice(-6)}${random}`;
};