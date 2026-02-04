// Pincode utilities using live API data

interface PincodeInfo {
  pincode: string;
  area: string;
  state: string;
  district: string;
  lat?: number;
  lng?: number;
}

interface ApiPincodeResponse {
  Message: string;
  Status: string;
  PostOffice: Array<{
    Name: string;
    Description: string | null;
    BranchType: string;
    DeliveryStatus: string;
    Circle: string;
    District: string;
    Division: string;
    Region: string;
    Block: string;
    State: string;
    Country: string;
    Pincode: string;
  }>;
}

// Cache for API responses
const pincodeCache = new Map<string, PincodeInfo>();
const nearbyPincodesCache = new Map<string, string[]>();
const cacheTimestamp = new Map<string, number>();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Comprehensive pincode coordinates database (sample - in production, use a complete database)
const PINCODE_COORDINATES: { [key: string]: { lat: number; lng: number } } = {
  // Major cities across India
  '110001': { lat: 28.6139, lng: 77.2090 }, // New Delhi
  '400001': { lat: 19.0760, lng: 72.8777 }, // Mumbai
  '700001': { lat: 22.5726, lng: 88.3639 }, // Kolkata
  '600001': { lat: 13.0827, lng: 80.2707 }, // Chennai
  '560001': { lat: 12.9716, lng: 77.5946 }, // Bangalore
  '500001': { lat: 17.3850, lng: 78.4867 }, // Hyderabad
  '411001': { lat: 18.5204, lng: 73.8567 }, // Pune
  '380001': { lat: 23.0225, lng: 72.5714 }, // Ahmedabad
  '395001': { lat: 21.1702, lng: 72.8311 }, // Surat
  '390001': { lat: 22.3072, lng: 73.1812 }, // Vadodara
  '360001': { lat: 22.3039, lng: 70.8022 }, // Rajkot
  '364001': { lat: 21.7645, lng: 72.1519 }, // Bhavnagar
  '361001': { lat: 22.4707, lng: 70.0577 }, // Jamnagar
  '362001': { lat: 21.5222, lng: 70.4579 }, // Junagadh
  '388001': { lat: 22.5645, lng: 72.9289 }, // Anand
  '302001': { lat: 26.9124, lng: 75.7873 }, // Jaipur
  '324001': { lat: 24.5854, lng: 73.7125 }, // Kota
  '313001': { lat: 24.5854, lng: 73.7125 }, // Udaipur
  '342001': { lat: 26.2389, lng: 73.0243 }, // Jodhpur
  '201001': { lat: 28.5355, lng: 77.3910 }, // Ghaziabad
  '226001': { lat: 26.8467, lng: 80.9462 }, // Lucknow
  '208001': { lat: 26.4499, lng: 80.3319 }, // Kanpur
  '221001': { lat: 25.3176, lng: 82.9739 }, // Varanasi
  '800001': { lat: 25.5941, lng: 85.1376 }, // Patna
  '751001': { lat: 20.2961, lng: 85.8245 }, // Bhubaneswar
  '682001': { lat: 9.9312, lng: 76.2673 },  // Kochi
  '695001': { lat: 8.5241, lng: 76.9366 },  // Thiruvananthapuram
  '641001': { lat: 11.0168, lng: 76.9558 }, // Coimbatore
  '620001': { lat: 10.7905, lng: 78.7047 }, // Trichy
  '530001': { lat: 17.6868, lng: 83.2185 }, // Visakhapatnam
  '515001': { lat: 14.4426, lng: 78.8242 }, // Anantapur
  '517501': { lat: 13.6288, lng: 79.4192 }, // Tirupati
  '492001': { lat: 21.2514, lng: 81.6296 }, // Raipur
  '462001': { lat: 23.2599, lng: 77.4126 }, // Bhopal
  '452001': { lat: 22.7196, lng: 75.8577 }, // Indore
  '440001': { lat: 21.1458, lng: 79.0882 }, // Nagpur
  '831001': { lat: 22.8046, lng: 86.2029 }, // Jamshedpur
  '834001': { lat: 23.3441, lng: 85.3096 }, // Ranchi
  '781001': { lat: 26.1445, lng: 91.7362 }, // Guwahati
  '793001': { lat: 25.5788, lng: 91.8933 }, // Shillong
  '796001': { lat: 23.1645, lng: 92.9376 }, // Aizawl
  '797001': { lat: 25.6751, lng: 94.1086 }, // Kohima
  '790001': { lat: 23.8315, lng: 91.2868 }, // Agartala
  '799001': { lat: 24.6637, lng: 93.9063 }, // Imphal
  '174001': { lat: 31.1048, lng: 77.1734 }, // Shimla
  '171001': { lat: 32.2432, lng: 76.3869 }, // Hamirpur HP
  '180001': { lat: 32.7266, lng: 74.8570 }, // Jammu
  '190001': { lat: 34.0837, lng: 74.7973 }, // Srinagar
  '370001': { lat: 23.0395, lng: 68.7644 }, // Kutch
  '396001': { lat: 20.6093, lng: 72.9728 }, // Navsari
  '385001': { lat: 24.1592, lng: 72.6369 }, // Patan
  '387001': { lat: 23.5880, lng: 72.3693 }, // Nadiad
  '384001': { lat: 23.7337, lng: 72.4488 }, // Mehsana
  '383001': { lat: 23.8315, lng: 72.6869 }, // Sabarkantha
  '382001': { lat: 23.2156, lng: 72.6369 }, // Gandhinagar
  '370201': { lat: 23.2420, lng: 69.6669 }, // Bhuj
  '365601': { lat: 21.5222, lng: 70.4579 }, // Porbandar
  '365801': { lat: 21.6417, lng: 69.6293 }, // Dwarka
  '360311': { lat: 21.8974, lng: 70.2020 }, // Gondal
  '363001': { lat: 22.7696, lng: 70.1167 }, // Surendranagar
  '365001': { lat: 21.5222, lng: 70.4579 }, // Amreli
  '370465': { lat: 23.0395, lng: 68.7644 }, // Mandvi
  '370020': { lat: 23.0395, lng: 68.7644 }, // Gandhidham
  '370201': { lat: 23.2420, lng: 69.6669 }, // Anjar
};

// Fetch pincode data from API
const fetchPincodeData = async (pincode: string): Promise<PincodeInfo | null> => {
  // Check cache first
  const cacheKey = pincode;
  const cached = pincodeCache.get(cacheKey);
  const timestamp = cacheTimestamp.get(cacheKey);
  
  if (cached && timestamp && (Date.now() - timestamp) < CACHE_DURATION) {
    console.log(`Using cached data for pincode ${pincode}`);
    return cached;
  }

  try {
    console.log(`Fetching data for pincode ${pincode} from API...`);
    
    const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
    
    if (!response.ok) {
      throw new Error(`API response not ok: ${response.status}`);
    }
    
    const data: ApiPincodeResponse[] = await response.json();
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      throw new Error('Invalid API response format');
    }

    const apiResponse = data[0];
    
    if (apiResponse.Status !== 'Success' || !apiResponse.PostOffice || apiResponse.PostOffice.length === 0) {
      console.warn(`No data found for pincode ${pincode}`);
      return null;
    }

    // Get the first post office data
    const postOffice = apiResponse.PostOffice[0];
    
    // Get coordinates from our database or use approximate coordinates
    const coordinates = PINCODE_COORDINATES[pincode] || getApproximateCoordinates(postOffice.State, postOffice.District);
    
    const pincodeInfo: PincodeInfo = {
      pincode: postOffice.Pincode,
      area: postOffice.Name,
      state: postOffice.State,
      district: postOffice.District,
      lat: coordinates.lat,
      lng: coordinates.lng
    };

    // Cache the result
    pincodeCache.set(cacheKey, pincodeInfo);
    cacheTimestamp.set(cacheKey, Date.now());
    
    console.log(`Successfully fetched data for pincode ${pincode}:`, pincodeInfo);
    return pincodeInfo;
    
  } catch (error) {
    console.error(`Error fetching pincode ${pincode}:`, error);
    return null;
  }
};

// Get approximate coordinates based on state and district
const getApproximateCoordinates = (state: string, district: string): { lat: number; lng: number } => {
  // Approximate coordinates for major states (center points)
  const stateCoordinates: { [key: string]: { lat: number; lng: number } } = {
    'Gujarat': { lat: 22.2587, lng: 71.1924 },
    'Maharashtra': { lat: 19.7515, lng: 75.7139 },
    'Delhi': { lat: 28.7041, lng: 77.1025 },
    'Karnataka': { lat: 15.3173, lng: 75.7139 },
    'Tamil Nadu': { lat: 11.1271, lng: 78.6569 },
    'Rajasthan': { lat: 27.0238, lng: 74.2179 },
    'Uttar Pradesh': { lat: 26.8467, lng: 80.9462 },
    'West Bengal': { lat: 22.9868, lng: 87.8550 },
    'Andhra Pradesh': { lat: 15.9129, lng: 79.7400 },
    'Telangana': { lat: 18.1124, lng: 79.0193 },
    'Kerala': { lat: 10.8505, lng: 76.2711 },
    'Punjab': { lat: 31.1471, lng: 75.3412 },
    'Haryana': { lat: 29.0588, lng: 76.0856 },
    'Madhya Pradesh': { lat: 22.9734, lng: 78.6569 },
    'Bihar': { lat: 25.0961, lng: 85.3131 },
    'Odisha': { lat: 20.9517, lng: 85.0985 },
    'Assam': { lat: 26.2006, lng: 92.9376 },
    'Jharkhand': { lat: 23.6102, lng: 85.2799 },
    'Himachal Pradesh': { lat: 31.1048, lng: 77.1734 },
    'Uttarakhand': { lat: 30.0668, lng: 79.0193 },
    'Chhattisgarh': { lat: 21.2787, lng: 81.8661 },
    'Goa': { lat: 15.2993, lng: 74.1240 },
    'Jammu and Kashmir': { lat: 34.0837, lng: 74.7973 },
    'Ladakh': { lat: 34.1526, lng: 77.5771 }
  };

  return stateCoordinates[state] || { lat: 20.5937, lng: 78.9629 }; // Default to India center
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

// Validate if a pincode exists using the API
export const isPincodeValid = async (pincode: string): Promise<boolean> => {
  if (!pincode || pincode.length !== 6 || !/^\d{6}$/.test(pincode)) {
    return false;
  }

  const pincodeInfo = await fetchPincodeData(pincode);
  return pincodeInfo !== null;
};

// Get pincode information
export const getPincodeInfo = async (pincode: string): Promise<PincodeInfo | null> => {
  return await fetchPincodeData(pincode);
};

// Generate covered pincodes within radius (this is a simplified version)
// In a real implementation, you'd need a comprehensive pincode database with coordinates
export const generateCoveredPincodes = async (basePincode: string, radiusKm: number = 20): Promise<string[]> => {
  const baseInfo = await fetchPincodeData(basePincode);
  if (!baseInfo || !baseInfo.lat || !baseInfo.lng) {
    console.warn(`Base pincode ${basePincode} not found or missing coordinates`);
    return [basePincode]; // Return at least the base pincode
  }

  console.log(`Generating covered pincodes for ${basePincode} within ${radiusKm}km radius`);

  // Check cache for nearby pincodes
  const cacheKey = `${basePincode}_${radiusKm}`;
  const cached = nearbyPincodesCache.get(cacheKey);
  const timestamp = cacheTimestamp.get(cacheKey);
  
  if (cached && timestamp && (Date.now() - timestamp) < CACHE_DURATION) {
    console.log(`Using cached nearby pincodes for ${basePincode}`);
    return cached;
  }

  // For demonstration, we'll generate nearby pincodes based on numerical proximity
  // In production, you'd use a comprehensive pincode database
  const covered = [basePincode]; // Always include base pincode
  
  try {
    // Generate potential nearby pincodes (simplified approach)
    const basePincodeNum = parseInt(basePincode);
    const potentialPincodes: string[] = [];
    
    // Generate pincodes in a range around the base pincode
    for (let i = -100; i <= 100; i++) {
      if (i === 0) continue; // Skip base pincode as it's already added
      
      const newPincode = (basePincodeNum + i).toString().padStart(6, '0');
      if (newPincode.length === 6 && newPincode !== basePincode) {
        potentialPincodes.push(newPincode);
      }
    }
    
    // Check each potential pincode (limit to avoid too many API calls)
    const checkPromises = potentialPincodes.slice(0, 50).map(async (pincode) => {
      try {
        const info = await fetchPincodeData(pincode);
        if (info && info.lat && info.lng) {
          const distance = calculateDistance(
            baseInfo.lat!, baseInfo.lng!,
            info.lat, info.lng
          );
          
          if (distance <= radiusKm) {
            console.log(`${pincode} (${info.area}) is ${distance.toFixed(2)}km away - INCLUDED`);
            return pincode;
          }
        }
        return null;
      } catch (error) {
        console.warn(`Error checking pincode ${pincode}:`, error);
        return null;
      }
    });
    
    const results = await Promise.all(checkPromises);
    const validPincodes = results.filter(p => p !== null) as string[];
    
    covered.push(...validPincodes);
    
    // Cache the result
    nearbyPincodesCache.set(cacheKey, covered);
    cacheTimestamp.set(cacheKey, Date.now());
    
  } catch (error) {
    console.error('Error generating covered pincodes:', error);
  }

  console.log(`Found ${covered.length} pincodes within ${radiusKm}km of ${basePincode}:`, covered);
  return covered.sort();
};

export const calculatePincodeDistance = async (pincode1: string, pincode2: string): Promise<number> => {
  const [info1, info2] = await Promise.all([
    fetchPincodeData(pincode1),
    fetchPincodeData(pincode2)
  ]);
  
  if (!info1 || !info2 || !info1.lat || !info1.lng || !info2.lat || !info2.lng) {
    // Fallback to numerical difference if coordinates not available
    const num1 = parseInt(pincode1);
    const num2 = parseInt(pincode2);
    return Math.abs(num1 - num2) / 1000; // Convert to approximate km
  }
  
  return calculateDistance(info1.lat, info1.lng, info2.lat, info2.lng);
};

export const sortOrdersByDistance = async (orders: any[], basePincode: string) => {
  const distancePromises = orders.map(async (order) => {
    const distance = await calculatePincodeDistance(basePincode, order.customerPincode);
    return { order, distance };
  });
  
  const ordersWithDistance = await Promise.all(distancePromises);
  
  return ordersWithDistance
    .sort((a, b) => a.distance - b.distance)
    .map(item => item.order);
};

// Validate if a pincode is serviceable from a seller's location
export const isPincodeServiceable = async (sellerPincode: string, customerPincode: string, maxRadius: number = 20): Promise<boolean> => {
  const distance = await calculatePincodeDistance(sellerPincode, customerPincode);
  return distance <= maxRadius;
};

// Get district name from pincode
export const getDistrictFromPincode = async (pincode: string): Promise<string | null> => {
  const info = await fetchPincodeData(pincode);
  return info?.district || null;
};

// Synchronous version for backward compatibility (uses cached data only)
export const isPincodeValidSync = (pincode: string): boolean => {
  if (!pincode || pincode.length !== 6 || !/^\d{6}$/.test(pincode)) {
    return false;
  }
  
  // Check if we have cached data
  const cached = pincodeCache.get(pincode);
  return cached !== undefined;
};

// Clear cache (useful for testing or manual refresh)
export const clearPincodeCache = () => {
  pincodeCache.clear();
  nearbyPincodesCache.clear();
  cacheTimestamp.clear();
  console.log('Pincode cache cleared');
};