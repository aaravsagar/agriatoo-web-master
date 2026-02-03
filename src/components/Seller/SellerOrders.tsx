import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, addDoc, setDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Order, User, DeliveryRecord } from '../../types';
import { ORDER_STATUSES } from '../../config/constants';
import { generateOrderQR } from '../../utils/qrUtils';
import { format } from 'date-fns';
import { Eye, Package, Printer, QrCode, UserPlus, Users, UserCheck, UserMinus, XCircle } from 'lucide-react';

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
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);

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

  const handleOrderSelection = (orderId: string, isSelected: boolean) => {
    const newSelection = new Set(selectedOrders);
    if (isSelected) {
      newSelection.add(orderId);
    } else {
      newSelection.delete(orderId);
    }
    setSelectedOrders(newSelection);
  };

  const handleSelectAll = (isSelected: boolean) => {
    if (isSelected) {
      const allOrderIds = new Set(filteredOrders.map(order => order.id));
      setSelectedOrders(allOrderIds);
    } else {
      setSelectedOrders(new Set());
    }
  };

  const handleBulkPrint = async () => {
    const selectedOrdersList = filteredOrders.filter(order => selectedOrders.has(order.id));
    
    if (selectedOrdersList.length === 0) {
      alert('Please select orders to print');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      let combinedHtml = `
        <html>
          <head>
            <title>Bulk Delivery Receipts</title>
            <style>${getReceiptStyles()}</style>
          </head>
          <body>
      `;

      for (let i = 0; i < selectedOrdersList.length; i++) {
        const order = selectedOrdersList[i];
        const receiptContent = await generateReceiptContent(order);
        combinedHtml += `
          <div class="receipt" ${i < selectedOrdersList.length - 1 ? 'style="page-break-after: always;"' : ''}>
            ${receiptContent}
          </div>
        `;
      }

      combinedHtml += `
          </body>
        </html>
      `;

      printWindow.document.write(combinedHtml);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  const cancelOrder = async (orderId: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelledBy: user?.id,
        updatedAt: new Date()
      });
      
      await fetchOrders();
      setShowCancelModal(false);
      setOrderToCancel(null);
      alert('Order cancelled successfully');
    } catch (error) {
      console.error('Error cancelling order:', error);
      alert('Failed to cancel order. Please try again.');
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

  const printReceipt = async (order: Order) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const receiptHtml = await generateReceiptHTML(order);
      printWindow.document.write(receiptHtml);
      printWindow.document.close();
    }
  };

  const generateReceiptHTML = async (order: Order): Promise<string> => {
    const receiptContent = await generateReceiptContent(order);

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
            ${receiptContent}
          </div>
        </body>
      </html>
    `;
  };

  const generateReceiptContent = async (order: Order): Promise<string> => {
    // Generate QR code SVG
    let qrSvg = '';
    try {
      const qrcodeGenerator = await import('qrcode-generator');
      const qrFactory = qrcodeGenerator.default || qrcodeGenerator;
      const qr = qrFactory(0, 'L');
      qr.addData(order.orderId);
      qr.make();
      qrSvg = qr.createSvgTag(4); // cell size 4 for print
    } catch (error) {
      console.error('Error generating QR code:', error);
      qrSvg = '<svg width="100" height="100"><text x="50" y="50" text-anchor="middle">QR Error</text></svg>';
    }

    return `
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
              ${qrSvg}
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
        margin: 0 auto 4px auto;
        display: flex;
        align-items: center;
        justify-content: center;
        background: white;
      }
      .qr-code svg {
        width: 100%;
        height: 100%;
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
        padding-top: 6px;
        border-top: 2px solid #000;
      }
      .seller-section {
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid #ccc;
      }
      .seller-name {
        font-weight: bold;
        font-size: 10px;
      }
      .seller-shop {
        font-size: 9px;
        color: #666;
      }
      .receipt-footer {
        background: #f0f0f0;
        padding: 6px;
        border-top: 2px solid #000;
        font-size: 8px;
        text-align: center;
      }
      .instructions {
        color: #333;
      }
      @media print {
        body {
          margin: 0;
          padding: 0;
        }
      }
    `;
  };

  const filteredOrders = selectedStatus 
    ? orders.filter(order => order.status === selectedStatus)
    : orders;

  const getStatusColor = (status: string): string => {
    const colors: { [key: string]: string } = {
      [ORDER_STATUSES.RECEIVED]: 'bg-blue-100 text-blue-800',
      [ORDER_STATUSES.PACKED]: 'bg-yellow-100 text-yellow-800',
      [ORDER_STATUSES.OUT_FOR_DELIVERY]: 'bg-purple-100 text-purple-800',
      [ORDER_STATUSES.DELIVERED]: 'bg-green-100 text-green-800',
      [ORDER_STATUSES.NOT_DELIVERED]: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">My Orders</h2>
        
        <div className="flex items-center space-x-2">
          {selectedOrders.size > 0 && (
            <button
              onClick={handleBulkPrint}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
            >
              <Printer className="w-5 h-5" />
              <span>Bulk Print ({selectedOrders.size})</span>
            </button>
          )}
          
          {permanentDeliveryPartner ? (
            <div className="bg-gray-800 border border-gray-700 px-4 py-2 rounded-lg flex items-center space-x-3">
              <UserCheck className="w-5 h-5 text-green-400" />
              <div>
                <div className="text-xs text-gray-400">Permanent Partner</div>
                <div className="text-sm font-medium text-white">{permanentDeliveryPartner.name}</div>
              </div>
              <button
                onClick={removePermanentPartner}
                className="ml-2 p-1 hover:bg-gray-700 rounded"
                title="Remove partner"
              >
                <UserMinus className="w-4 h-4 text-red-400" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowPartnerModal(true)}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center space-x-2"
            >
              <UserPlus className="w-5 h-5" />
              <span>Assign Permanent Partner</span>
            </button>
          )}
        </div>
      </div>

      {/* Status Filter */}
      <div className="mb-4 flex space-x-2">
        <button
          onClick={() => setSelectedStatus('')}
          className={`px-4 py-2 rounded-md ${
            selectedStatus === '' 
              ? 'bg-purple-600 text-white' 
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          All Orders ({orders.length})
        </button>
        {Object.values(ORDER_STATUSES).map((status) => {
          const count = orders.filter(o => o.status === status).length;
          return (
            <button
              key={status}
              onClick={() => setSelectedStatus(status)}
              className={`px-4 py-2 rounded-md ${
                selectedStatus === status 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {status.replace('_', ' ')} ({count})
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading orders...</p>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg shadow overflow-hidden border border-gray-700">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={selectedOrders.size === filteredOrders.length && filteredOrders.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500"
                    />
                  </th>
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
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-750">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedOrders.has(order.id)}
                        onChange={(e) => handleOrderSelection(order.id, e.target.checked)}
                        className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                      {order.orderId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-white">{order.customerName}</div>
                      <div className="text-sm text-gray-400">{order.customerPhone}</div>
                      <div className="text-sm text-gray-400">{order.customerPincode}</div>
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
                        {(order.status === ORDER_STATUSES.RECEIVED || order.status === ORDER_STATUSES.PACKED) && (
                          <button
                            onClick={() => {
                              setOrderToCancel(order);
                              setShowCancelModal(true);
                            }}
                            className="text-red-400 hover:text-red-300"
                            title="Cancel Order"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
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

      {/* Cancel Order Modal */}
      {showCancelModal && orderToCancel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700">
            <h3 className="text-lg font-medium mb-4 text-white">Cancel Order</h3>
            
            <p className="text-gray-300 mb-6">
              Are you sure you want to cancel order <strong>{orderToCancel.orderId}</strong>?
              This action cannot be undone.
            </p>

            <div className="flex space-x-2">
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setOrderToCancel(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-600 text-gray-300 rounded-md hover:bg-gray-700"
              >
                Keep Order
              </button>
              <button
                onClick={() => cancelOrder(orderToCancel.id)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Cancel Order
              </button>
            </div>
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