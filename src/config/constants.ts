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
export const PINCODE_DATA = [
  { pincode: '110001', area: 'New Delhi', state: 'Delhi' },
  { pincode: '110002', area: 'Delhi Cantt', state: 'Delhi' },
  { pincode: '110003', area: 'Delhi GPO', state: 'Delhi' },
  { pincode: '400001', area: 'Mumbai Fort', state: 'Maharashtra' },
  { pincode: '400002', area: 'Mumbai CST', state: 'Maharashtra' },
  { pincode: '560001', area: 'Bangalore GPO', state: 'Karnataka' },
  { pincode: '600001', area: 'Chennai GPO', state: 'Tamil Nadu' },
  { pincode: '700001', area: 'Kolkata GPO', state: 'West Bengal' },
  { pincode: '380052', area: 'Ahmedabad', state: 'Gujarat' },
  { pincode: '302001', area: 'Jaipur', state: 'Rajasthan' },
];
