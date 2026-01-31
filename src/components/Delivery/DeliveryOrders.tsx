import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Order } from '../../types';
import { ORDER_STATUSES } from '../../config/constants';
import { sortOrdersByDistance } from '../../utils/pincodeUtils';
import { format } from 'date-fns';
import { MapPin, Package, Navigation } from 'lucide-react';

const DeliveryOrders: React.FC = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [scannedOrders, setScannedOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('');

  useEffect(() => {
    if (user) {
      fetchScannedOrders();
    }
  }, [user]);

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
          {filteredOrders.map((order, index) => (
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
          ))}
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