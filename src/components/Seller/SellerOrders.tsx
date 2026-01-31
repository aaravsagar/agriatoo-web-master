import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, addDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Order, User, DeliveryRecord } from '../../types';
import { ORDER_STATUSES } from '../../config/constants';
import { generateOrderQR } from '../../utils/qrUtils';
import { format } from 'date-fns';
import { Eye, Package, Printer, QrCode, UserPlus, Users } from 'lucide-react';

const SellerOrders: React.FC = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [deliveryBoys, setDeliveryBoys] = useState<User[]>([]);
  const [deliveryRecords, setDeliveryRecords] = useState<DeliveryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningOrderId, setAssigningOrderId] = useState<string>('');

  useEffect(() => {
    if (user) {
      fetchOrders();
      fetchDeliveryBoys();
      fetchDeliveryRecords();
    }
  }, [user]);

  const fetchDeliveryBoys = async () => {
    try {
      const q = query(
        collection(db, 'users'),
        where('role', '==', 'delivery'),
        where('isActive', '==', true)
      );
      const snapshot = await getDocs(q);
      const deliveryBoysData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as User[];
      setDeliveryBoys(deliveryBoysData);
    } catch (error) {
      console.error('Error fetching delivery boys:', error);
    }
  };

  const fetchDeliveryRecords = async () => {
    if (!user) return;
    try {
      const q = query(
        collection(db, 'deliveryRecords'),
        where('sellerId', '==', user.id)
      );
      const snapshot = await getDocs(q);
      const recordsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      })) as DeliveryRecord[];
      setDeliveryRecords(recordsData);
    } catch (error) {
      console.error('Error fetching delivery records:', error);
    }
  };

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

  const assignDeliveryBoy = async (orderId: string, deliveryBoyId: string) => {
    try {
      const deliveryBoy = deliveryBoys.find(db => db.id === deliveryBoyId);
      if (!deliveryBoy) return;

      await updateDoc(doc(db, 'orders', orderId), {
        assignedDeliveryBoys: [deliveryBoyId],
        deliveryBoyId: deliveryBoyId,
        deliveryBoyName: deliveryBoy.name,
        updatedAt: new Date()
      });

      await fetchOrders();
      setShowAssignModal(false);
      setAssigningOrderId('');
    } catch (error) {
      console.error('Error assigning delivery boy:', error);
    }
  };

  const printReceipt = (order: Order) => {
    const qrCode = generateOrderQR(order.orderId);
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Delivery Sticker - ${order.orderId}</title>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                margin: 0; 
                padding: 10px; 
                font-size: 12px;
                width: 4in;
                background: white;
              }
              .sticker {
                border: 2px solid #000;
                padding: 8px;
                background: white;
              }
              .header {
                text-align: center;
                border-bottom: 1px solid #000;
                padding-bottom: 5px;
                margin-bottom: 8px;
              }
              .brand {
                font-weight: bold;
                font-size: 14px;
                color: #000;
              }
              .order-id {
                font-weight: bold;
                font-size: 11px;
                margin: 2px 0;
              }
              .section {
                margin-bottom: 8px;
                font-size: 10px;
              }
              .label {
                font-weight: bold;
                display: inline-block;
                width: 60px;
              }
              .qr-section {
                text-align: center;
                margin: 8px 0;
                border: 1px solid #000;
                padding: 5px;
              }
              .cod-amount {
                font-size: 14px;
                font-weight: bold;
                text-align: center;
                background: #f0f0f0;
                padding: 5px;
                border: 1px solid #000;
                margin: 5px 0;
              }
              .barcode {
                text-align: center;
                font-family: 'Courier New', monospace;
                font-size: 8px;
                letter-spacing: 1px;
                margin: 5px 0;
              }
            </style>
          </head>
          <body>
            <div class="sticker">
              <div class="header">
                <div class="brand">AGRIATOO</div>
                <div class="order-id">Order: ${order.orderId}</div>
              </div>
              
              <div class="section">
                <div><span class="label">To:</span> ${order.customerName}</div>
                <div><span class="label">Phone:</span> ${order.customerPhone}</div>
                <div style="margin-top: 3px;">${order.customerAddress}</div>
                <div><span class="label">PIN:</span> ${order.customerPincode}</div>
              </div>
              
              <div class="section">
                <div><span class="label">From:</span> ${order.sellerShopName}</div>
                <div><span class="label">Seller:</span> ${order.sellerName}</div>
              </div>
              
              <div class="cod-amount">
                COD: ₹${order.totalAmount}
              </div>
              
              <div class="qr-section">
                <img src="${qrCode}" alt="QR" style="width: 60px; height: 60px;" />
                <div style="font-size: 8px; margin-top: 2px;">Scan to Track</div>
              </div>
              
              <div class="barcode">
                ||||| ${order.orderId} |||||
              </div>
              
              <div style="text-align: center; font-size: 8px; margin-top: 5px;">
                ${format(order.createdAt, 'dd/MM/yyyy HH:mm')} | ${order.items.length} items
              </div>
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
                          onClick={() => {
                            setAssigningOrderId(order.id);
                            setShowAssignModal(true);
                          }}
                          className="text-blue-400 hover:text-blue-300"
                          title="Assign Delivery Boy"
                        >
                          <UserPlus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="text-blue-400 hover:text-blue-300"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => printReceipt(order)}
                          className="text-green-400 hover:text-green-300"
                          title="Print Sticker"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        {order.status === ORDER_STATUSES.RECEIVED && (
                          <button
                            onClick={() => updateOrderStatus(order.id, ORDER_STATUSES.PACKED)}
                            className="text-yellow-400 hover:text-yellow-300"
                            title="Mark as Packed"
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

      {/* Delivery Records Section */}
      <div className="mt-8 bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h3 className="text-lg font-medium mb-4 text-white flex items-center">
          <Users className="w-5 h-5 mr-2" />
          Delivery Records ({deliveryRecords.length})
        </h3>
        {deliveryRecords.length === 0 ? (
          <p className="text-gray-400">No delivery records yet</p>
        ) : (
          <div className="text-gray-300 text-sm">Recent deliveries will appear here</div>
        )}
      </div>

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

      {/* Assign Delivery Boy Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700">
            <h3 className="text-lg font-medium mb-4 text-white">Assign Delivery Boy</h3>
            
            <div className="space-y-3 mb-6">
              {deliveryBoys.map(deliveryBoy => (
                <button
                  key={deliveryBoy.id}
                  onClick={() => assignDeliveryBoy(assigningOrderId, deliveryBoy.id)}
                  className="w-full text-left p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  <div className="text-white font-medium">{deliveryBoy.name}</div>
                  <div className="text-gray-400 text-sm">{deliveryBoy.phone}</div>
                  <div className="text-gray-400 text-sm">Area: {deliveryBoy.pincode}</div>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowAssignModal(false)}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
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