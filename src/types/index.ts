export interface User {
  id: string;
  email: string;
  role: 'admin' | 'seller' | 'delivery' | 'farmer';
  name: string;
  phone: string;
  address?: string;
  pincode?: string;
  shopName?: string;
  deliveryRadius?: number;
  coveredPincodes?: string[];
  upiId?: string;
  createdAt: Date;
  isActive: boolean;
}

export interface Product {
  id: string;
  sellerId: string;
  sellerName: string;
  sellerPincode?: string;
  sellerAddress?: string;
  sellerShopName?: string;
  sellerDeliveryRadius?: number;
  name: string;
  description: string;
  category: string;
  price: number;
  unit: string;
  stock: number;
  images: string[];
  coveredPincodes: string[];
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface CartItem {
  productId: string;
  product: Product;
  quantity: number;
}

export interface Order {
  id: string;
  orderId: string; // Unique order ID for tracking
  customerId?: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerPincode: string;
  sellerId: string;
  sellerName: string;
  sellerShopName: string;
  sellerAddress: string;
  sellerPincode?: string;
  deliveryBoyId?: string;
  deliveryBoyName?: string;
  assignedDeliveryBoys?: string[]; // Array of delivery boy IDs
  items: OrderItem[];
  totalAmount: number;
  status: 'received' | 'packed' | 'out_for_delivery' | 'delivered' | 'not_delivered';
  cancelledAt?: Date;
  cancelledBy?: string;
  paymentMethod: 'cod';
  deliveryPaymentMethod?: 'cash' | 'upi';
  cashCollected?: number;
  upiTransactionId?: string;
  deliveryReason?: string; // For not_delivered orders
  retryAttempts?: number; // Number of delivery retry attempts
  retryAt?: Date; // Last retry timestamp
  qrCode?: string; // QR code for the order
  createdAt: Date;
  updatedAt: Date;
  packedAt?: Date;
  outForDeliveryAt?: Date;
  deliveredAt?: Date;
}

export interface OrderItem {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  unit: string;
}

export interface DeliveryAssignment {
  deliveryBoyId: string;
  orderIds: string[];
  assignedAt: Date;
  completedAt?: Date;
}

export interface DeliveryRecord {
  id: string;
  orderId: string;
  orderNumber: string;
  sellerId: string;
  sellerName: string;
  deliveryBoyId: string;
  deliveryBoyName: string;
  paymentMethod: 'cash' | 'upi';
  amount: number;
  cashCollected?: number;
  upiTransactionId?: string;
  timestamp: Date;
  customerName: string;
  customerAddress: string;
}