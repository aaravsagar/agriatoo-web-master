import { PINCODE_DATA } from '../config/constants';

export const isPincodeValid = (pincode: string): boolean => {
  return PINCODE_DATA.some(p => p.pincode === pincode);
};

export const getPincodeInfo = (pincode: string) => {
  return PINCODE_DATA.find(p => p.pincode === pincode);
};

export const generateCoveredPincodes = (basePincode: string, radius: number): string[] => {
  const baseInfo = getPincodeInfo(basePincode);
  if (!baseInfo) return [];

  // Simplified logic: return nearby pincodes based on state and numerical proximity
  const baseNum = parseInt(basePincode);
  const covered = PINCODE_DATA
    .filter(p => {
      const pNum = parseInt(p.pincode);
      const diff = Math.abs(pNum - baseNum);
      return diff <= radius * 1000; // Simplified distance calculation
    })
    .map(p => p.pincode);

  return covered;
};

export const calculatePincodeDistance = (pincode1: string, pincode2: string): number => {
  // Simplified distance calculation based on numerical difference
  const num1 = parseInt(pincode1);
  const num2 = parseInt(pincode2);
  return Math.abs(num1 - num2);
};

export const sortOrdersByDistance = (orders: any[], basePincode: string) => {
  return orders.sort((a, b) => {
    const distA = calculatePincodeDistance(basePincode, a.customerPincode);
    const distB = calculatePincodeDistance(basePincode, b.customerPincode);
    return distA - distB;
  });
};