import QRCode from 'qrcode-generator';

export const generateOrderQR = (orderId: string): string => {
  const qr = QRCode(0, 'M');
  qr.addData(orderId);
  qr.make();
  return qr.createDataURL(4);
};

export const generateUniqueOrderId = (customerPincode: string): string => {
  const now = new Date();
  
  // Format: AGRTDDMMYYY(PincodeLast2Digits)TTHH(Random4Chars)
  const day = now.getDate().toString().padStart(2, '0');
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const year = now.getFullYear().toString();
  const pincodeLastTwo = customerPincode.slice(-2);
  const hour = now.getHours().toString().padStart(2, '0');
  const minute = now.getMinutes().toString().padStart(2, '0');
  
  // Generate 4 random uppercase alphanumeric characters
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let random4 = '';
  for (let i = 0; i < 4; i++) {
    random4 += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  const orderId = `AGRT${day}${month}${year}${pincodeLastTwo}${hour}${minute}${random4}`;
  
  console.log(`Generated Order ID: ${orderId}`);
  console.log(`- Date: ${day}/${month}/${year}`);
  console.log(`- Pincode Last 2: ${pincodeLastTwo}`);
  console.log(`- Time: ${hour}:${minute}`);
  console.log(`- Random: ${random4}`);
  
  return orderId;
};

// Validate order ID format
export const validateOrderId = (orderId: string): boolean => {
  // Format: AGRTDDMMYYY(PincodeLast2Digits)TTHH(Random4Chars)
  // Example: AGRT290126621938A5DF
  const pattern = /^AGRT\d{2}\d{2}\d{4}\d{2}\d{2}\d{2}[A-Z0-9]{4}$/;
  return pattern.test(orderId);
};

// Extract information from order ID
export const parseOrderId = (orderId: string) => {
  if (!validateOrderId(orderId)) {
    return null;
  }
  
  // Remove AGRT prefix
  const data = orderId.substring(4);
  
  const day = data.substring(0, 2);
  const month = data.substring(2, 4);
  const year = data.substring(4, 8);
  const pincodeLastTwo = data.substring(8, 10);
  const hour = data.substring(10, 12);
  const minute = data.substring(12, 14);
  const random = data.substring(14, 18);
  
  return {
    day: parseInt(day),
    month: parseInt(month),
    year: parseInt(year),
    pincodeLastTwo,
    hour: parseInt(hour),
    minute: parseInt(minute),
    random,
    date: new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute))
  };
};