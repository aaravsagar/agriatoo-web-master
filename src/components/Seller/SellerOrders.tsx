import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Order } from '../../types';
import { ORDER_STATUSES } from '../../config/constants';
import { generateOrderQR } from '../../utils/qrUtils';
import { format } from 'date-fns';
import { Eye, Package, Printer, QrCode } from 'lucide-react';

const SellerOrders: React.FC = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [user]);

  const fetchOrders = async () => {
    if (!user) return;

    try {
      // Simplified query without orderBy
      const q = query(
        collection(db, 'orders'),
        where('sellerId', '==', user.id)
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
      
      setOrders(ordersData);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const updateData: any = {
        status: newStatus,
        updatedAt: new Date()
      };

      if (newStatus === ORDER_STATUSES.PACKED) {
        updateData.packedAt = new Date();
      } else if (newStatus === ORDER_STATUSES.OUT_FOR_DELIVERY) {
        updateData.outForDeliveryAt = new Date();
      }

      await updateDoc(doc(db, 'orders', orderId), updateData);
      await fetchOrders();
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  };

  const printReceipt = (order: Order) => {
    const qrCode = generateOrderQR(order.orderId);
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Shipping Receipt - ${order.orderId}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              .header { text-align: center; margin-bottom: 20px; }
              .section { margin-bottom: 15px; }
              .qr-code { text-align: center; margin: 20px 0; }
              table { width: 100%; border-collapse: collapse; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
            </style>
          </head>
          <body>
            <div class="header">
              <h2>AGRIATOO - Shipping Receipt</h2>
              <h3>Order ID: ${order.orderId}</h3>
            </div>
            
            <div class="section">
              <h4>Customer Details:</h4>
              <p><strong>Name:</strong> ${order.customerName}</p>
              <p><strong>Phone:</strong> ${order.customerPhone}</p>
              <p><strong>Address:</strong> ${order.customerAddress}</p>
              <p><strong>PIN Code:</strong> ${order.customerPincode}</p>
            </div>
            
            <div class="section">
              <h4>Seller Details:</h4>
              <p><strong>Shop:</strong> ${order.sellerShopName}</p>
              <p><strong>Seller:</strong> ${order.sellerName}</p>
            </div>
            
            <div class="section">
              <h4>Order Items:</h4>
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Quantity</th>
                    <th>Unit Price</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${order.items.map(item => `
                    <tr>
                      <td>${item.productName}</td>
                      <td>${item.quantity} ${item.unit}</td>
                      <td>₹${item.price}</td>
                      <td>₹${(item.price * item.quantity).toFixed(2)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              <p><strong>Total Amount: ₹${order.totalAmount}</strong></p>
              <p><strong>Payment Method:</strong> Cash on Delivery</p>
            </div>
            
            <div class="qr-code">
              <img src="${qrCode}" alt="Order QR Code" />
              <p>Scan QR code for order tracking</p>
            </div>
            
            <div class="section">
              <p><strong>Order Date:</strong> ${format(order.createdAt, 'PPP')}</p>
              <p><strong>Status:</strong> ${order.status.replace('_', ' ').toUpperCase()}</p>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
      
      // Mark as packed after printing
      if (order.status === ORDER_STATUSES.RECEIVED) {
        updateOrderStatus(order.id, ORDER_STATUSES.PACKED);
      }
    }
  };

  const filteredOrders = selectedStatus
    ? orders.filter(order => order.status === selectedStatus)
    : orders;

  const getStatusColor = (status: string) => {
    switch (status) {
      case ORDER_STATUSES.RECEIVED:
        return 'bg-blue-900 text-blue-300';
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

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">My Orders</h2>
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">All Status</option>
          <option value={ORDER_STATUSES.RECEIVED}>Received</option>
          <option value={ORDER_STATUSES.PACKED}>Packed</option>
          <option value={ORDER_STATUSES.OUT_FOR_DELIVERY}>Out for Delivery</option>
          <option value={ORDER_STATUSES.DELIVERED}>Delivered</option>
          <option value={ORDER_STATUSES.NOT_DELIVERED}>Not Delivered</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="w-8 h-8 border-2 border-green-200 border-t-green-400 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading orders...</p>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Order ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                {filteredOrders.map(order => (
                  <tr key={order.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                      {order.orderId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-white">{order.customerName}</div>
                        <div className="text-sm text-gray-400">{order.customerPhone}</div>
                        <div className="text-sm text-gray-400">{order.customerPincode}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                      ₹{order.totalAmount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.status)}`}>
                        {order.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {format(order.createdAt, 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="text-blue-400 hover:text-blue-300"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => printReceipt(order)}
                          className="text-green-400 hover:text-green-300"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        {order.status === ORDER_STATUSES.RECEIVED && (
                          <button
                            onClick={() => updateOrderStatus(order.id, ORDER_STATUSES.PACKED)}
                            className="text-yellow-400 hover:text-yellow-300"
                          >
                            <Package className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filteredOrders.length === 0 && !loading && (
        <div className="text-center py-12">
          <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No orders found</h3>
          <p className="text-gray-400">
            {selectedStatus 
              ? `No orders with "${selectedStatus}" status`
              : 'No orders available'
            }
          </p>
        </div>
      )}

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-96 overflow-y-auto border border-gray-700">
            <h3 className="text-lg font-medium mb-4 text-white">Order Details - {selectedOrder.orderId}</h3>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <h4 className="font-semibold text-white mb-2">Customer Information</h4>
                <p className="text-sm text-gray-300">Name: {selectedOrder.customerName}</p>
                <p className="text-sm text-gray-300">Phone: {selectedOrder.customerPhone}</p>
                <p className="text-sm text-gray-300">Address: {selectedOrder.customerAddress}</p>
                <p className="text-sm text-gray-300">PIN: {selectedOrder.customerPincode}</p>
              </div>
              
              <div>
                <h4 className="font-semibold text-white mb-2">Order Information</h4>
                <p className="text-sm text-gray-300">Date: {format(selectedOrder.createdAt, 'PPP')}</p>
                <p className="text-sm text-gray-300">Payment: Cash on Delivery</p>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedOrder.status)}`}>
                  {selectedOrder.status.replace('_', ' ')}
                </span>
              </div>
            </div>

            <div className="mb-4">
              <h4 className="font-semibold text-white mb-2">Order Items</h4>
              <div className="space-y-2">
                {selectedOrder.items.map((item, index) => (
                  <div key={index} className="flex justify-between text-sm text-gray-300">
                    <span>{item.productName} x {item.quantity} {item.unit}</span>
                    <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-600 pt-2 mt-2">
                <div className="flex justify-between font-semibold text-white">
                  <span>Total Amount</span>
                  <span>₹{selectedOrder.totalAmount}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <div className="flex space-x-2">
                <button
                  onClick={() => printReceipt(selectedOrder)}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center space-x-2"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Receipt</span>
                </button>
                
                {selectedOrder.status === ORDER_STATUSES.RECEIVED && (
                  <button
                    onClick={() => {
                      updateOrderStatus(selectedOrder.id, ORDER_STATUSES.PACKED);
                      setSelectedOrder(null);
                    }}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 flex items-center space-x-2"
                  >
                    <Package className="w-4 h-4" />
                    <span>Mark as Packed</span>
                  </button>
                )}
              </div>
              
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SellerOrders;