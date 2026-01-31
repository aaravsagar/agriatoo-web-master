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
  
  // For demo purposes, we'll create a data URL with the UPI string
  // In production, you'd use a proper QR code library
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 200;
  canvas.height = 200;
  
  if (ctx) {
    // Simple QR-like pattern for demo
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 200, 200);
    ctx.fillStyle = '#fff';
    ctx.font = '10px Arial';
    ctx.fillText('UPI QR', 80, 100);
    ctx.fillText(`₹${amount}`, 80, 120);
  }
  
  return canvas.toDataURL();
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