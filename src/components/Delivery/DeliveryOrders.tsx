import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Order } from '../../types';
import { ORDER_STATUSES } from '../../config/constants';
import { sortOrdersByDistance } from '../../utils/pincodeUtils';
import { format } from 'date-fns';
import { MapPin, Package, Navigation, Store, CreditCard, Building2 } from 'lucide-react';

interface SellerAssignment {
  id: string;
  sellerId: string;
  sellerName: string;
  deliveryBoyId: string;
  deliveryBoyName: string;
  deliveryBoyPhone: string;
  deliveryBoyPincode: string;
  deliveryBoyUpi: string;
  assignedAt: Date;
  isActive: boolean;
}

const DeliveryOrders: React.FC = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [scannedOrders, setScannedOrders] = useState<Order[]>([]);
  const [sellerAssignments, setSellerAssignments] = useState<SellerAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('');

  useEffect(() => {
    if (user) {
      fetchSellerAssignments();
      fetchScannedOrders();
    }
  }, [user]);

  const fetchSellerAssignments = async () => {
    if (!user) return;
    
    try {
      const q = query(
        collection(db, 'sellerDeliveryPartners'),
        where('deliveryBoyId', '==', user.id),
        where('isActive', '==', true)
      );
      const snapshot = await getDocs(q);
      const assignmentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        assignedAt: doc.data().assignedAt?.toDate() || new Date()
      })) as SellerAssignment[];
      
      setSellerAssignments(assignmentsData);
    } catch (error) {
      console.error('Error fetching seller assignments:', error);
    }
  };

  const fetchScannedOrders = async () => {
    if (!user) return;
    
    try {
      // Only show orders that are assigned to this delivery boy
      const q = query(
        collection(db, 'orders'),
        where('deliveryBoyId', '==', user.id)
      );
      const snapshot = await getDocs(q);
      let ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      })) as Order[];

      // Frontend sorting by creation date (newest first)
      ordersData.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      setScannedOrders(ordersData);
    } catch (error) {
      console.error('Error fetching scanned orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = selectedStatus
    ? scannedOrders.filter(order => order.status === selectedStatus)
    : scannedOrders;

  const getStatusColor = (status: string) => {
    switch (status) {
      case ORDER_STATUSES.PACKED:
        return 'bg-yellow-900 text-yellow-300';
      case ORDER_STATUSES.OUT_FOR_DELIVERY:
        return 'bg-purple-900 text-purple-300';
      case ORDER_STATUSES.DELIVERED:
        return 'bg-green-900 text-green-300';
      case ORDER_STATUSES.NOT_DELIVERED:
        return 'bg-red-900 text-red-300';
      default:
        return 'bg-gray-900 text-gray-300';
    }
  };

  const openMaps = (address: string, pincode: string) => {
    const query = encodeURIComponent(`${address}, ${pincode}`);
    const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
    window.open(url, '_blank');
  };

  // Get seller info for an order from assignments
  const getSellerInfo = (sellerId: string) => {
    return sellerAssignments.find(a => a.sellerId === sellerId);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">My Assigned Orders</h2>
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">All Status</option>
          <option value={ORDER_STATUSES.PACKED}>Ready for Pickup</option>
          <option value={ORDER_STATUSES.OUT_FOR_DELIVERY}>Out for Delivery</option>
          <option value={ORDER_STATUSES.DELIVERED}>Delivered</option>
          <option value={ORDER_STATUSES.NOT_DELIVERED}>Not Delivered</option>
        </select>
      </div>

      {/* Seller Assignments Section */}
      {sellerAssignments.length > 0 && (
        <div className="bg-gradient-to-r from-blue-900 to-purple-900 border border-blue-700 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
            <Building2 className="w-5 h-5 mr-2" />
            Your Assigned Sellers ({sellerAssignments.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sellerAssignments.map((assignment) => (
              <div key={assignment.id} className="bg-gray-800 bg-opacity-50 border border-gray-700 rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <Store className="w-5 h-5 text-blue-400" />
                    <h4 className="font-semibold text-white">{assignment.sellerName}</h4>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center text-gray-300">
                    <span className="text-gray-400 w-24">Assigned:</span>
                    <span>{format(assignment.assignedAt, 'MMM dd, yyyy')}</span>
                  </div>
                  
                  {assignment.deliveryBoyUpi && (
                    <div className="flex items-start text-gray-300 mt-3 pt-3 border-t border-gray-600">
                      <CreditCard className="w-4 h-4 mr-2 mt-0.5 text-green-400" />
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Payment UPI ID:</div>
                        <div className="font-mono text-green-300 font-semibold bg-gray-900 px-2 py-1 rounded">
                          {assignment.deliveryBoyUpi}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-blue-900 border border-blue-700 text-blue-300 p-4 rounded-lg mb-6">
        <p className="text-sm">
          📦 <strong>Note:</strong> Orders appear here only after you scan them for pickup. 
          Use the Scanner tab to scan package QR codes and start deliveries.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="w-8 h-8 border-2 border-green-200 border-t-green-400 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading orders...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order, index) => {
            const sellerInfo = getSellerInfo(order.sellerId);
            return (
              <div key={order.id} className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center text-white font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">{order.orderId}</h3>
                      <p className="text-gray-400 text-sm">{format(order.createdAt, 'PPP')}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(order.status)}`}>
                    {order.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                  <div>
                    <h4 className="font-semibold text-white mb-2 flex items-center">
                      <MapPin className="w-4 h-4 mr-2" />
                      Customer Details
                    </h4>
                    <div className="text-sm text-gray-300 space-y-1">
                      <p><strong>Name:</strong> {order.customerName}</p>
                      <p><strong>Phone:</strong> {order.customerPhone}</p>
                      <p><strong>Address:</strong> {order.customerAddress}</p>
                      <p><strong>PIN Code:</strong> {order.customerPincode}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-white mb-2 flex items-center">
                      <Package className="w-4 h-4 mr-2" />
                      Order Details
                    </h4>
                    <div className="text-sm text-gray-300 space-y-1">
                      <p><strong>Seller:</strong> {order.sellerName}</p>
                      <p><strong>Items:</strong> {order.items.length} products</p>
                      <p><strong>Amount:</strong> ₹{order.totalAmount}</p>
                      <p><strong>Payment:</strong> Cash on Delivery</p>
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <h4 className="font-semibold text-white mb-2">Items to Deliver</h4>
                  <div className="bg-gray-700 rounded-lg p-3">
                    <div className="space-y-1">
                      {order.items.map((item, itemIndex) => (
                        <div key={itemIndex} className="flex justify-between text-sm text-gray-300">
                          <span>{item.productName} x {item.quantity} {item.unit}</span>
                          <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Seller Payment Info */}
                {sellerInfo && sellerInfo.deliveryBoyUpi && (
                  <div className="mb-4 bg-green-900 bg-opacity-30 border border-green-700 rounded-lg p-3">
                    <h4 className="font-semibold text-green-300 mb-2 flex items-center text-sm">
                      <CreditCard className="w-4 h-4 mr-2" />
                      Collect Payment & Transfer to Seller
                    </h4>
                    <div className="text-sm text-green-200">
                      <p className="mb-1">After collecting ₹{order.totalAmount} from customer:</p>
                      <div className="bg-gray-900 bg-opacity-50 rounded px-3 py-2 mt-2">
                        <p className="text-xs text-gray-400 mb-1">Transfer to UPI ID:</p>
                        <p className="font-mono text-green-300 font-semibold text-base">{sellerInfo.deliveryBoyUpi}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-400">
                    {order.deliveryReason && (
                      <p><strong>Delivery Note:</strong> {order.deliveryReason}</p>
                    )}
                  </div>
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={() => openMaps(order.customerAddress, order.customerPincode)}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Navigation className="w-4 h-4" />
                      <span>Navigate</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {filteredOrders.length === 0 && !loading && (
        <div className="text-center py-12">
          <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No scanned orders</h3>
          <p className="text-gray-400">
            {selectedStatus 
              ? `No scanned orders with "${selectedStatus}" status`
              : 'Scan package QR codes to see orders here'
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default DeliveryOrders;