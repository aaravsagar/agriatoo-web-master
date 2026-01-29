// Admin credentials (hardcoded outside Firebase)
export const ADMIN_CREDENTIALS = {
  email: 'admin@agriatoo.com',
  password: 'admin123',
};

// Order statuses
export const ORDER_STATUSES = {
  RECEIVED: 'received',
  PACKED: 'packed',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  DELIVERED: 'delivered',
  NOT_DELIVERED: 'not_delivered',
} as const;

// ✅ Standardized user roles (VERY IMPORTANT)
export const USER_ROLES = {
  ADMIN: 'admin',
  SELLER: 'seller',
  DELIVERY: 'delivery',
  FARMER: 'farmer', // ✅ use FARMER instead of CUSTOMER
} as const;

// Product categories
export const PRODUCT_CATEGORIES = [
  'Fertilizers',
  'Pesticides',
  'Seeds',
  'Tools',
  'Irrigation',
  'Organic Products',
];

// Sample PIN codes for Indian states (simplified dataset)
export const GUJARAT_PINCODE_DATA = [
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

// Legacy support - use Gujarat data as default
export const PINCODE_DATA = GUJARAT_PINCODE_DATA;
