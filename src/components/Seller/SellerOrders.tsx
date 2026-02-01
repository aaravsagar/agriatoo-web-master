import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, addDoc, setDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Order, User, DeliveryRecord } from '../../types';
import { ORDER_STATUSES } from '../../config/constants';
import { generateOrderQR } from '../../utils/qrUtils';
import { format } from 'date-fns';
import { Eye, Package, Printer, QrCode, UserPlus, Users, UserCheck, UserMinus } from 'lucide-react';

const SellerOrders: React.FC = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [deliveryBoys, setDeliveryBoys] = useState<User[]>([]);
  const [permanentDeliveryPartner, setPermanentDeliveryPartner] = useState<User | null>(null);
  const [deliveryRecords, setDeliveryRecords] = useState<DeliveryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showPartnerModal, setShowPartnerModal] = useState(false);

  useEffect(() => {
    if (user) {
      fetchOrders();
      fetchDeliveryBoys();
      fetchDeliveryRecords();
      fetchPermanentPartner();
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

  const fetchPermanentPartner = async () => {
    if (!user) return;
    try {
      const q = query(
        collection(db, 'sellerDeliveryPartners'),
        where('sellerId', '==', user.id)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const partnerData = snapshot.docs[0].data();
        // Fetch full delivery partner details
        const deliveryBoyDoc = await getDocs(query(
          collection(db, 'users'),
          where('__name__', '==', partnerData.deliveryBoyId)
        ));
        if (!deliveryBoyDoc.empty) {
          setPermanentDeliveryPartner({
            id: deliveryBoyDoc.docs[0].id,
            ...deliveryBoyDoc.docs[0].data(),
            createdAt: deliveryBoyDoc.docs[0].data().createdAt?.toDate() || new Date()
          } as User);
        }
      }
    } catch (error) {
      console.error('Error fetching permanent partner:', error);
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
        
        // Auto-assign permanent delivery partner if exists
        if (permanentDeliveryPartner) {
          updateData.deliveryBoyId = permanentDeliveryPartner.id;
          updateData.deliveryBoyName = permanentDeliveryPartner.name;
          updateData.assignedDeliveryBoys = [permanentDeliveryPartner.id];
        }
      } else if (newStatus === ORDER_STATUSES.OUT_FOR_DELIVERY) {
        updateData.outForDeliveryAt = new Date();
      }

      await updateDoc(doc(db, 'orders', orderId), updateData);
      await fetchOrders();
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  };

  const assignPermanentPartner = async (deliveryBoyId: string) => {
    if (!user) return;
    try {
      const deliveryBoy = deliveryBoys.find(db => db.id === deliveryBoyId);
      if (!deliveryBoy) return;

      // Create or update permanent partner assignment
      await setDoc(doc(db, 'sellerDeliveryPartners', `${user.id}_${deliveryBoyId}`), {
        sellerId: user.id,
        sellerName: user.name,
        deliveryBoyId: deliveryBoyId,
        deliveryBoyName: deliveryBoy.name,
        deliveryBoyPhone: deliveryBoy.phone,
        deliveryBoyPincode: deliveryBoy.pincode,
        deliveryBoyUpi: deliveryBoy.upiId || '',
        assignedAt: new Date(),
        isActive: true
      });

      await fetchPermanentPartner();
      setShowPartnerModal(false);
      
      alert(`${deliveryBoy.name} has been assigned as your permanent delivery partner!`);
    } catch (error) {
      console.error('Error assigning permanent partner:', error);
      alert('Failed to assign delivery partner. Please try again.');
    }
  };

  const removePermanentPartner = async () => {
    if (!user || !permanentDeliveryPartner) return;
    
    if (!confirm('Are you sure you want to remove the permanent delivery partner?')) return;

    try {
      const partnerDocId = `${user.id}_${permanentDeliveryPartner.id}`;
      await updateDoc(doc(db, 'sellerDeliveryPartners', partnerDocId), {
        isActive: false,
        removedAt: new Date()
      });

      setPermanentDeliveryPartner(null);
      alert('Permanent delivery partner removed successfully.');
    } catch (error) {
      console.error('Error removing permanent partner:', error);
      alert('Failed to remove delivery partner. Please try again.');
    }
  };

  const printReceipt = (order: Order) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const receiptHtml = generateReceiptHTML(order);
      printWindow.document.write(receiptHtml);
      printWindow.document.close();
    }
  };

  const generateReceiptHTML = (order: Order): string => {
    return `
      <html>
        <head>
          <title>Delivery Receipt - ${order.orderId}</title>
          <style>
            ${getReceiptStyles()}
          </style>
        </head>
        <body onload="window.print();">
          <div class="receipt">
            <div class="receipt-header">
              <div class="brand">AGRIATOO DELIVERY</div>
              <div class="order-id">Order: ${order.orderId}</div>
            </div>
            
            <div class="receipt-content">
              <div class="section-row">
                <div class="customer-section">
                  <div class="section-title">DELIVER TO:</div>
                  <div class="customer-name">${order.customerName}</div>
                  <div class="customer-phone">${order.customerPhone}</div>
                  <div class="customer-address">${order.customerAddress}</div>
                  <div class="customer-pin">PIN: ${order.customerPincode}</div>
                </div>
                
                <div class="qr-section">
                  <div class="qr-code">
                    <canvas id="qr-${order.orderId}" width="70" height="70"></canvas>
                  </div>
                  <div class="qr-label">Scan to Update</div>
                </div>
              </div>
              
              <div class="items-section">
                <div class="section-title">ITEMS & TOTAL:</div>
                <div class="items-list">
                  ${order.items.map(item => `
                    <div class="item-row">
                      <span class="item-name">${item.productName}</span>
                      <span class="item-qty">${item.quantity} ${item.unit}</span>
                      <span class="item-price">₹${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  `).join('')}
                </div>
                <div class="total-amount">
                  <strong>COD TOTAL: ₹${order.totalAmount}</strong>
                </div>
              </div>
              
              <div class="seller-section">
                <div class="section-title">FROM SELLER:</div>
                <div class="seller-name">${order.sellerName}</div>
                <div class="seller-shop">${order.sellerShopName || order.sellerName}</div>
              </div>
            </div>
            
            <div class="receipt-footer">
              <div class="instructions">Present this receipt to customer • Collect exact amount • Scan QR after delivery</div>
            </div>
          </div>
          
          <script>
            // Generate QR code using a simple QR library or canvas
            function generateQR(text, canvasId) {
              const canvas = document.getElementById(canvasId);
              if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#000';
                ctx.fillRect(0, 0, 70, 70);
                ctx.fillStyle = '#fff';
                ctx.font = '8px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('QR CODE', 35, 30);
                ctx.fillText(text.substring(0, 10), 35, 45);
              }
            }
            generateQR('${order.orderId}', 'qr-${order.orderId}');
          </script>
        </body>
      </html>
    `;
  };

  const getReceiptStyles = (): string => {
    return `
      body { 
        font-family: 'Courier New', monospace; 
        margin: 0; 
        padding: 10px; 
        background: white;
      }
      .receipt {
        width: 4in;
        border: 2px solid #000;
        margin: 0 auto;
        background: white;
      }
      .receipt-header {
        background: #000;
        color: white;
        padding: 8px;
        text-align: center;
        border-bottom: 2px solid #000;
      }
      .brand {
        font-weight: bold;
        font-size: 14px;
        letter-spacing: 1px;
      }
      .order-id {
        font-size: 12px;
        margin-top: 4px;
      }
      .receipt-content {
        padding: 8px;
      }
      .section-row {
        display: flex;
        margin-bottom: 8px;
      }
      .customer-section {
        flex: 1;
        padding-right: 8px;
      }
      .qr-section {
        width: 80px;
        text-align: center;
        border: 1px solid #000;
        padding: 4px;
      }
      .qr-code {
        width: 70px;
        height: 70px;
        border: 1px solid #ccc;
        margin: 0 auto 4px auto;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f9f9f9;
      }
      .qr-label {
        font-size: 8px;
        color: #666;
      }
      .section-title {
        font-weight: bold;
        font-size: 10px;
        margin-bottom: 4px;
        text-decoration: underline;
      }
      .customer-name {
        font-weight: bold;
        font-size: 11px;
        margin-bottom: 2px;
      }
      .customer-phone, .customer-address, .customer-pin {
        font-size: 9px;
        margin-bottom: 1px;
      }
      .items-section {
        border: 1px solid #000;
        padding: 6px;
        margin: 8px 0;
      }
      .items-list {
        margin: 4px 0;
      }
      .item-row {
        display: flex;
        justify-content: space-between;
        font-size: 9px;
        margin-bottom: 2px;
        border-bottom: 1px dotted #ccc;
        padding-bottom: 1px;
      }
      .item-name {
        flex: 1;
        margin-right: 4px;
      }
      .item-qty {
        width: 50px;
        text-align: center;
      }
      .item-price {
        width: 50px;
        text-align: right;
      }
      .total-amount {
        text-align: center;
        font-size: 12px;
        margin-top: 6px;
        padding: 4px;
        background: #f0f0f0;
        border: 1px solid #000;
      }
      .seller-section {
        border-top: 1px solid #000;
        padding-top: 6px;
        margin-top: 8px;
      }
      .seller-name, .seller-shop {
        font-size: 10px;
        margin-bottom: 2px;
      }
      .seller-name {
        font-weight: bold;
      }
      .receipt-footer {
        background: #f9f9f9;
        padding: 6px;
        border-top: 1px solid #000;
        text-align: center;
      }
      .instructions {
        font-size: 8px;
        color: #666;
        line-height: 1.2;
      }
      @media print {
        body { margin: 0; padding: 5px; }
        .receipt { margin: 0; }
      }
    `;
  };

  const printBulkReceipts = (orders: Order[]) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const receiptsHtml = orders.map((order, index) => `
        <div class="receipt" style="${index > 0 ? 'page-break-before: always;' : ''}">
          ${generateReceiptHTML(order).match(/<div class="receipt">(.*?)<\/div>/s)?.[1] || ''}
        </div>
      `).join('');
      
      printWindow.document.write(`
        <html>
          <head>
            <title>Bulk Delivery Receipts</title>
            <style>
              ${getReceiptStyles()}
              @media print {
                body { margin: 0; padding: 0; }
                .receipt { page-break-after: always; margin-bottom: 20px; }
                .receipt:last-child { page-break-after: auto; }
              }
            </style>
          </head>
          <body onload="window.print();">
            ${receiptsHtml}
          </body>
        </html>
      `);
      printWindow.document.close();
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
        <h2 className="text-2xl font-bold text-white">Orders Management</h2>
        <div className="flex space-x-3">
          {permanentDeliveryPartner ? (
            <div className="flex items-center space-x-3 bg-green-900 border border-green-700 px-4 py-2 rounded-lg">
              <UserCheck className="w-5 h-5 text-green-300" />
              <div className="text-sm">
                <div className="text-green-300 font-semibold">{permanentDeliveryPartner.name}</div>
                <div className="text-green-400 text-xs">{permanentDeliveryPartner.phone}</div>
              </div>
              <button
                onClick={removePermanentPartner}
                className="ml-2 text-red-400 hover:text-red-300"
                title="Remove Partner"
              >
                <UserMinus className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowPartnerModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <UserPlus className="w-5 h-5" />
              <span>Assign Permanent Delivery Partner</span>
            </button>
          )}
          
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Status</option>
            <option value={ORDER_STATUSES.RECEIVED}>Received</option>
            <option value={ORDER_STATUSES.PACKED}>Packed</option>
            <option value={ORDER_STATUSES.OUT_FOR_DELIVERY}>Out for Delivery</option>
            <option value={ORDER_STATUSES.DELIVERED}>Delivered</option>
            <option value={ORDER_STATUSES.NOT_DELIVERED}>Not Delivered</option>
          </select>
        </div>
      </div>

      {permanentDeliveryPartner && (
        <div className="bg-green-900 border border-green-700 text-green-300 p-4 rounded-lg mb-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm">
                <strong>📦 Permanent Delivery Partner Assigned:</strong> All packed orders will be automatically assigned to {permanentDeliveryPartner.name}.
              </p>
              <p className="text-xs mt-2 text-green-400">
                Phone: {permanentDeliveryPartner.phone} | Area: {permanentDeliveryPartner.pincode}
                {permanentDeliveryPartner.upiId && ` | UPI: ${permanentDeliveryPartner.upiId}`}
              </p>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">
          <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-400 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading orders...</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="bg-gray-800 rounded-lg border border-gray-700">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Order ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-750">
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

      {/* Assign Permanent Partner Modal */}
      {showPartnerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700">
            <h3 className="text-lg font-medium mb-4 text-white">Assign Permanent Delivery Partner</h3>
            
            <div className="bg-blue-900 border border-blue-700 text-blue-300 p-3 rounded-lg mb-4 text-sm">
              <p>This delivery partner will be automatically assigned to all your future orders when marked as packed.</p>
            </div>

            <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
              {deliveryBoys.map(deliveryBoy => (
                <button
                  key={deliveryBoy.id}
                  onClick={() => assignPermanentPartner(deliveryBoy.id)}
                  className="w-full text-left p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  <div className="text-white font-medium">{deliveryBoy.name}</div>
                  <div className="text-gray-400 text-sm">{deliveryBoy.phone}</div>
                  <div className="text-gray-400 text-sm">Area: {deliveryBoy.pincode}</div>
                  {deliveryBoy.upiId && (
                    <div className="text-gray-400 text-sm">UPI: {deliveryBoy.upiId}</div>
                  )}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowPartnerModal(false)}
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