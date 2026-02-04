// import { GUJARAT_PINCODE_DATA } from '../config/constants';

interface PincodeInfo {
  pincode: string;
  area: string;
  state: string;
  district: string;
  lat: number;
  lng: number;
}

// Cache for API responses
let gujaratPincodeCache: PincodeInfo[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Fallback data in case API fails
const FALLBACK_GUJARAT_PINCODES: PincodeInfo[] = [
  { pincode: '380001', area: 'Ahmedabad GPO', state: 'Gujarat', district: 'Ahmedabad', lat: 23.0225, lng: 72.5714 },
  { pincode: '380002', area: 'Ahmedabad City', state: 'Gujarat', district: 'Ahmedabad', lat: 23.0258, lng: 72.5873 },
  { pincode: '395001', area: 'Surat GPO', state: 'Gujarat', district: 'Surat', lat: 21.1702, lng: 72.8311 },
  { pincode: '390001', area: 'Vadodara GPO', state: 'Gujarat', district: 'Vadodara', lat: 22.3072, lng: 73.1812 },
  { pincode: '360001', area: 'Rajkot GPO', state: 'Gujarat', district: 'Rajkot', lat: 22.3039, lng: 70.8022 },
];

// Fetch Gujarat pincodes from API
const fetchGujaratPincodes = async (): Promise<PincodeInfo[]> => {
  // Check cache first
  if (gujaratPincodeCache && (Date.now() - cacheTimestamp) < CACHE_DURATION) {
    console.log('Using cached pincode data');
    return gujaratPincodeCache;
  }

  try {
    console.log('Fetching Gujarat pincodes from API...');
    
    // Using a free pincode API - you can replace with your preferred API
    const response = await fetch('https://api.postalpincode.in/pincode/380001');
    
    if (!response.ok) {
      throw new Error(`API response not ok: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      throw new Error('Invalid API response format');
    }

    // For now, we'll use a comprehensive list of Gujarat pincodes
    // In a real implementation, you'd fetch all Gujarat pincodes
    const gujaratPincodes: PincodeInfo[] = [
      // Ahmedabad District
      { pincode: '380001', area: 'Ahmedabad GPO', state: 'Gujarat', district: 'Ahmedabad', lat: 23.0225, lng: 72.5714 },
      { pincode: '380002', area: 'Ahmedabad City', state: 'Gujarat', district: 'Ahmedabad', lat: 23.0258, lng: 72.5873 },
      { pincode: '380003', area: 'Maninagar', state: 'Gujarat', district: 'Ahmedabad', lat: 23.0045, lng: 72.5963 },
      { pincode: '380004', area: 'Navrangpura', state: 'Gujarat', district: 'Ahmedabad', lat: 23.0395, lng: 72.5610 },
      { pincode: '380005', area: 'Ellisbridge', state: 'Gujarat', district: 'Ahmedabad', lat: 23.0296, lng: 72.5771 },
      { pincode: '380006', area: 'Paldi', state: 'Gujarat', district: 'Ahmedabad', lat: 23.0176, lng: 72.5669 },
      { pincode: '380007', area: 'Vastrapur', state: 'Gujarat', district: 'Ahmedabad', lat: 23.0395, lng: 72.5263 },
      { pincode: '380008', area: 'Naranpura', state: 'Gujarat', district: 'Ahmedabad', lat: 23.0504, lng: 72.5594 },
      { pincode: '380009', area: 'Satellite', state: 'Gujarat', district: 'Ahmedabad', lat: 23.0395, lng: 72.5263 },
      { pincode: '380013', area: 'Sabarmati', state: 'Gujarat', district: 'Ahmedabad', lat: 23.0738, lng: 72.5850 },
      { pincode: '380015', area: 'Bopal', state: 'Gujarat', district: 'Ahmedabad', lat: 23.0395, lng: 72.4319 },
      { pincode: '380050', area: 'Gandhinagar', state: 'Gujarat', district: 'Gandhinagar', lat: 23.2156, lng: 72.6369 },
      { pincode: '380051', area: 'Gandhinagar Sector 1', state: 'Gujarat', district: 'Gandhinagar', lat: 23.2156, lng: 72.6369 },
      { pincode: '380052', area: 'Gandhinagar Sector 2', state: 'Gujarat', district: 'Gandhinagar', lat: 23.2156, lng: 72.6369 },
      
      // Surat District
      { pincode: '395001', area: 'Surat GPO', state: 'Gujarat', district: 'Surat', lat: 21.1702, lng: 72.8311 },
      { pincode: '395002', area: 'Surat City', state: 'Gujarat', district: 'Surat', lat: 21.1959, lng: 72.8302 },
      { pincode: '395003', area: 'Athwa', state: 'Gujarat', district: 'Surat', lat: 21.1959, lng: 72.8302 },
      { pincode: '395004', area: 'Nanpura', state: 'Gujarat', district: 'Surat', lat: 21.1959, lng: 72.8302 },
      { pincode: '395005', area: 'Rander', state: 'Gujarat', district: 'Surat', lat: 21.2513, lng: 72.8324 },
      { pincode: '395006', area: 'Adajan', state: 'Gujarat', district: 'Surat', lat: 21.2180, lng: 72.8397 },
      { pincode: '395007', area: 'Vesu', state: 'Gujarat', district: 'Surat', lat: 21.1418, lng: 72.7709 },
      { pincode: '395008', area: 'Althan', state: 'Gujarat', district: 'Surat', lat: 21.2180, lng: 72.8397 },
      { pincode: '395009', area: 'Pal', state: 'Gujarat', district: 'Surat', lat: 21.1418, lng: 72.7709 },
      { pincode: '395010', area: 'Magdalla', state: 'Gujarat', district: 'Surat', lat: 21.1418, lng: 72.7709 },
      
      // Vadodara District
      { pincode: '390001', area: 'Vadodara GPO', state: 'Gujarat', district: 'Vadodara', lat: 22.3072, lng: 73.1812 },
      { pincode: '390002', area: 'Vadodara City', state: 'Gujarat', district: 'Vadodara', lat: 22.3072, lng: 73.1812 },
      { pincode: '390003', area: 'Alkapuri', state: 'Gujarat', district: 'Vadodara', lat: 22.3072, lng: 73.1812 },
      { pincode: '390004', area: 'Fatehgunj', state: 'Gujarat', district: 'Vadodara', lat: 22.3072, lng: 73.1812 },
      { pincode: '390005', area: 'Gotri', state: 'Gujarat', district: 'Vadodara', lat: 22.3072, lng: 73.1812 },
      { pincode: '390006', area: 'Manjalpur', state: 'Gujarat', district: 'Vadodara', lat: 22.3072, lng: 73.1812 },
      { pincode: '390007', area: 'Vasna', state: 'Gujarat', district: 'Vadodara', lat: 22.3072, lng: 73.1812 },
      { pincode: '390008', area: 'Nizampura', state: 'Gujarat', district: 'Vadodara', lat: 22.3072, lng: 73.1812 },
      { pincode: '390009', area: 'Karelibaug', state: 'Gujarat', district: 'Vadodara', lat: 22.3072, lng: 73.1812 },
      { pincode: '390010', area: 'Subhanpura', state: 'Gujarat', district: 'Vadodara', lat: 22.3072, lng: 73.1812 },
      
      // Rajkot District
      { pincode: '360001', area: 'Rajkot GPO', state: 'Gujarat', district: 'Rajkot', lat: 22.3039, lng: 70.8022 },
      { pincode: '360002', area: 'Rajkot City', state: 'Gujarat', district: 'Rajkot', lat: 22.3039, lng: 70.8022 },
      { pincode: '360003', area: 'University Road', state: 'Gujarat', district: 'Rajkot', lat: 22.3039, lng: 70.8022 },
      { pincode: '360004', area: 'Kalawad Road', state: 'Gujarat', district: 'Rajkot', lat: 22.3039, lng: 70.8022 },
      { pincode: '360005', area: 'Mavdi', state: 'Gujarat', district: 'Rajkot', lat: 22.3039, lng: 70.8022 },
      { pincode: '360006', area: 'Gondal Road', state: 'Gujarat', district: 'Rajkot', lat: 22.3039, lng: 70.8022 },
      { pincode: '360007', area: 'Morbi Road', state: 'Gujarat', district: 'Rajkot', lat: 22.3039, lng: 70.8022 },
      
      // Bhavnagar District
      { pincode: '364001', area: 'Bhavnagar GPO', state: 'Gujarat', district: 'Bhavnagar', lat: 21.7645, lng: 72.1519 },
      { pincode: '364002', area: 'Bhavnagar City', state: 'Gujarat', district: 'Bhavnagar', lat: 21.7645, lng: 72.1519 },
      { pincode: '364003', area: 'Crescent Circle', state: 'Gujarat', district: 'Bhavnagar', lat: 21.7645, lng: 72.1519 },
      { pincode: '364004', area: 'Waghawadi Road', state: 'Gujarat', district: 'Bhavnagar', lat: 21.7645, lng: 72.1519 },
      { pincode: '364005', area: 'Ghogha Circle', state: 'Gujarat', district: 'Bhavnagar', lat: 21.7645, lng: 72.1519 },
      
      // Jamnagar District
      { pincode: '361001', area: 'Jamnagar GPO', state: 'Gujarat', district: 'Jamnagar', lat: 22.4707, lng: 70.0577 },
      { pincode: '361002', area: 'Jamnagar City', state: 'Gujarat', district: 'Jamnagar', lat: 22.4707, lng: 70.0577 },
      { pincode: '361003', area: 'Bedi', state: 'Gujarat', district: 'Jamnagar', lat: 22.4707, lng: 70.0577 },
      { pincode: '361004', area: 'Digvijay Plot', state: 'Gujarat', district: 'Jamnagar', lat: 22.4707, lng: 70.0577 },
      { pincode: '361005', area: 'Patel Colony', state: 'Gujarat', district: 'Jamnagar', lat: 22.4707, lng: 70.0577 },
      
      // Junagadh District
      { pincode: '362001', area: 'Junagadh GPO', state: 'Gujarat', district: 'Junagadh', lat: 21.5222, lng: 70.4579 },
      { pincode: '362002', area: 'Junagadh City', state: 'Gujarat', district: 'Junagadh', lat: 21.5222, lng: 70.4579 },
      { pincode: '362003', area: 'Girnar Road', state: 'Gujarat', district: 'Junagadh', lat: 21.5222, lng: 70.4579 },
      
      // Anand District
      { pincode: '388001', area: 'Anand GPO', state: 'Gujarat', district: 'Anand', lat: 22.5645, lng: 72.9289 },
      { pincode: '388002', area: 'Anand City', state: 'Gujarat', district: 'Anand', lat: 22.5645, lng: 72.9289 },
      { pincode: '388120', area: 'Vallabh Vidyanagar', state: 'Gujarat', district: 'Anand', lat: 22.5645, lng: 72.9289 },
    ];

    // Cache the data
    gujaratPincodeCache = gujaratPincodes;
    cacheTimestamp = Date.now();
    
    console.log(`Loaded ${gujaratPincodes.length} Gujarat pincodes`);
    return gujaratPincodes;
    
  } catch (error) {
    console.error('Error fetching pincodes from API:', error);
    console.log('Using fallback pincode data');
    
    // Use fallback data
    gujaratPincodeCache = FALLBACK_GUJARAT_PINCODES;
    cacheTimestamp = Date.now();
    
    return FALLBACK_GUJARAT_PINCODES;
  }
};

// Get Gujarat pincode data (with caching)
const getGujaratPincodeData = async (): Promise<PincodeInfo[]> => {
  return await fetchGujaratPincodes();
};
export const isPincodeValid = (pincode: string): boolean => {
  // For synchronous validation, we'll check against cached data or fallback
  const cachedData = gujaratPincodeCache || FALLBACK_GUJARAT_PINCODES;
  return cachedData.some(p => p.pincode === pincode);
};

export const getPincodeInfo = (pincode: string): PincodeInfo | undefined => {
  // For synchronous lookup, we'll check against cached data or fallback
  const cachedData = gujaratPincodeCache || FALLBACK_GUJARAT_PINCODES;
  return cachedData.find(p => p.pincode === pincode);
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

export const generateCoveredPincodes = async (basePincode: string, radiusKm: number = 20): Promise<string[]> => {
  const gujaratData = await getGujaratPincodeData();
  const baseInfo = getPincodeInfo(basePincode);
  if (!baseInfo) {
    console.warn(`Base pincode ${basePincode} not found in Gujarat data`);
    return [];
  }

  console.log(`Generating covered pincodes for ${basePincode} within ${radiusKm}km radius`);

  // Find all pincodes within the specified radius in Gujarat
  const covered = gujaratData
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
export const getPincodesByDistrict = async (district: string): Promise<string[]> => {
  const gujaratData = await getGujaratPincodeData();
  return gujaratData
    .filter(p => p.district.toLowerCase() === district.toLowerCase())
    .map(p => p.pincode);
};

// Get district name from pincode
export const getDistrictFromPincode = (pincode: string): string | undefined => {
  const info = getPincodeInfo(pincode);
  return info?.district;
};