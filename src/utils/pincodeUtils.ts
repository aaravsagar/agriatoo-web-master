import { GUJARAT_PINCODE_DATA } from '../config/constants';

interface PincodeInfo {
  pincode: string;
  area: string;
  state: string;
  district: string;
  lat: number;
  lng: number;
}

export const isPincodeValid = (pincode: string): boolean => {
  return GUJARAT_PINCODE_DATA.some(p => p.pincode === pincode);
};

export const getPincodeInfo = (pincode: string): PincodeInfo | undefined => {
  return GUJARAT_PINCODE_DATA.find(p => p.pincode === pincode);
};

// Calculate distance between two coordinates using Haversine formula
const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

export const generateCoveredPincodes = (basePincode: string, radiusKm: number = 20): string[] => {
  const baseInfo = getPincodeInfo(basePincode);
  if (!baseInfo) {
    console.warn(`Base pincode ${basePincode} not found in Gujarat data`);
    return [];
  }

  console.log(`Generating covered pincodes for ${basePincode} within ${radiusKm}km radius`);

  // Find all pincodes within the specified radius in Gujarat only
  const covered = GUJARAT_PINCODE_DATA
    .filter(p => {
      if (p.pincode === basePincode) return true; // Always include base pincode
      
      const distance = calculateDistance(
        baseInfo.lat, baseInfo.lng,
        p.lat, p.lng
      );
      
      const isWithinRadius = distance <= radiusKm;
      if (isWithinRadius) {
        console.log(`${p.pincode} (${p.area}) is ${distance.toFixed(2)}km away - INCLUDED`);
      }
      
      return isWithinRadius;
    })
    .map(p => p.pincode)
    .sort();

  console.log(`Found ${covered.length} pincodes within ${radiusKm}km of ${basePincode}:`, covered);
  return covered;
};

export const calculatePincodeDistance = (pincode1: string, pincode2: string): number => {
  const info1 = getPincodeInfo(pincode1);
  const info2 = getPincodeInfo(pincode2);
  
  if (!info1 || !info2) {
    // Fallback to numerical difference if coordinates not available
    const num1 = parseInt(pincode1);
    const num2 = parseInt(pincode2);
    return Math.abs(num1 - num2) / 1000; // Convert to approximate km
  }
  
  return calculateDistance(info1.lat, info1.lng, info2.lat, info2.lng);
};

export const sortOrdersByDistance = (orders: any[], basePincode: string) => {
  return orders.sort((a, b) => {
    const distA = calculatePincodeDistance(basePincode, a.customerPincode);
    const distB = calculatePincodeDistance(basePincode, b.customerPincode);
    return distA - distB;
  });
};

// Validate if a pincode is serviceable from a seller's location
export const isPincodeServiceable = (sellerPincode: string, customerPincode: string, maxRadius: number = 20): boolean => {
  const distance = calculatePincodeDistance(sellerPincode, customerPincode);
  return distance <= maxRadius;
};

// Get all pincodes within a district
export const getPincodesByDistrict = (district: string): string[] => {
  return GUJARAT_PINCODE_DATA
    .filter(p => p.district.toLowerCase() === district.toLowerCase())
    .map(p => p.pincode);
};

// Get district name from pincode
export const getDistrictFromPincode = (pincode: string): string | undefined => {
  const info = getPincodeInfo(pincode);
  return info?.district;
};