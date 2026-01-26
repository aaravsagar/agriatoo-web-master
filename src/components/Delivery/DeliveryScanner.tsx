import React, { useState } from 'react';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Order } from '../../types';
import { ORDER_STATUSES } from '../../config/constants';
import { QrCode, CheckCircle, XCircle, Scan } from 'lucide-react';

const DeliveryScanner: React.FC = () => {
  const { user } = useAuth();
  const [scanMode, setScanMode] = useState<'pickup' | 'delivery'>('pickup');
  const [scannedOrderId, setScannedOrderId] = useState('');
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [deliveryReason, setDeliveryReason] = useState('');
  const [showReasonModal, setShowReasonModal] = useState(false);

  const handleScan = async () => {
    if (!scannedOrderId.trim()) {
      alert('Please enter an Order ID');
      return;
    }

    setLoading(true);

    try {
      const q = query(
        collection(db, 'orders'),
        where('orderId', '==', scannedOrderId.trim())
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        alert('Order not found');
        setLoading(false);
        return;
      }

      const orderDoc = snapshot.docs[0];
      const order = {
        id: orderDoc.id,
        ...orderDoc.data(),
        createdAt: orderDoc.data().createdAt?.toDate() || new Date(),
        updatedAt: orderDoc.data().updatedAt?.toDate() || new Date()
      } as Order;

      // Verify this order is assigned to current delivery boy
      if (order.deliveryBoyId !== user?.id) {
        alert('This order is not assigned to you');
        setLoading(false);
        return;
      }

      setCurrentOrder(order);
    } catch (error) {
      console.error('Error scanning order:', error);
      alert('Error scanning order');
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (newStatus: string, reason?: string) => {
    if (!currentOrder) return;

    setLoading(true);

    try {
      const updateData: any = {
        status: newStatus,
        updatedAt: new Date()
      };

      if (newStatus === ORDER_STATUSES.OUT_FOR_DELIVERY) {
        updateData.outForDeliveryAt = new Date();
      } else if (newStatus === ORDER_STATUSES.DELIVERED) {
        updateData.deliveredAt = new Date();
      } else if (newStatus === ORDER_STATUSES.NOT_DELIVERED && reason) {
        updateData.deliveryReason = reason;
      }

      await updateDoc(doc(db, 'orders', currentOrder.id), updateData);
      
      alert(`Order ${newStatus.replace('_', ' ')} successfully!`);
      setCurrentOrder(null);
      setScannedOrderId('');
      setDeliveryReason('');
      setShowReasonModal(false);
    } catch (error) {
      console.error('Error updating order status:', error);
      alert('Error updating order status');
    } finally {
      setLoading(false);
    }
  };

  const handleDeliveryAction = (delivered: boolean) => {
    if (delivered) {
      updateOrderStatus(ORDER_STATUSES.DELIVERED);
    } else {
      setShowReasonModal(true);
    }
  };

  const handleNotDelivered = () => {
    if (!deliveryReason.trim()) {
      alert('Please provide a reason for non-delivery');
      return;
    }
    updateOrderStatus(ORDER_STATUSES.NOT_DELIVERED, deliveryReason);
  };

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

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-white mb-6">QR Code Scanner</h2>

      {/* Scan Mode Toggle */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 mb-6">
        <h3 className="text-lg font-semibold text-white mb-4">Scan Mode</h3>
        <div className="flex space-x-4">
          <button
            onClick={() => setScanMode('pickup')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
              scanMode === 'pickup'
                ? 'bg-green-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Pickup Mode
            <p className="text-sm opacity-75">Mark orders as "Out for Delivery"</p>
          </button>
          <button
            onClick={() => setScanMode('delivery')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
              scanMode === 'delivery'
                ? 'bg-green-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Delivery Mode
            <p className="text-sm opacity-75">Mark orders as "Delivered" or "Not Delivered"</p>
          </button>
        </div>
      </div>

      {/* Scanner Input */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 mb-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
          <QrCode className="w-5 h-5 mr-2" />
          Scan Order QR Code
        </h3>
        
        <div className="flex space-x-3">
          <input
            type="text"
            placeholder="Enter Order ID or scan QR code"
            value={scannedOrderId}
            onChange={(e) => setScannedOrderId(e.target.value)}
            className="flex-1 px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
            onKeyPress={(e) => e.key === 'Enter' && handleScan()}
          />
          <button
            onClick={handleScan}
            disabled={loading}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            <Scan className="w-5 h-5" />
            <span>{loading ? 'Scanning...' : 'Scan'}</span>
          </button>
        </div>
      </div>

      {/* Scanned Order Details */}
      {currentOrder && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Order Details</h3>
            <span className={`px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(currentOrder.status)}`}>
              {currentOrder.status.replace('_', ' ')}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <h4 className="font-semibold text-white mb-2">Order Information</h4>
              <div className="text-sm text-gray-300 space-y-1">
                <p><strong>Order ID:</strong> {currentOrder.orderId}</p>
                <p><strong>Customer:</strong> {currentOrder.customerName}</p>
                <p><strong>Phone:</strong> {currentOrder.customerPhone}</p>
                <p><strong>Amount:</strong> ₹{currentOrder.totalAmount}</p>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-2">Delivery Address</h4>
              <div className="text-sm text-gray-300">
                <p>{currentOrder.customerAddress}</p>
                <p>PIN: {currentOrder.customerPincode}</p>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h4 className="font-semibold text-white mb-2">Items ({currentOrder.items.length})</h4>
            <div className="bg-gray-700 rounded-lg p-3">
              <div className="space-y-1">
                {currentOrder.items.map((item, index) => (
                  <div key={index} className="flex justify-between text-sm text-gray-300">
                    <span>{item.productName} x {item.quantity} {item.unit}</span>
                    <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            {scanMode === 'pickup' && currentOrder.status === ORDER_STATUSES.PACKED && (
              <button
                onClick={() => updateOrderStatus(ORDER_STATUSES.OUT_FOR_DELIVERY)}
                disabled={loading}
                className="flex-1 flex items-center justify-center space-x-2 bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                <CheckCircle className="w-5 h-5" />
                <span>Mark as Out for Delivery</span>
              </button>
            )}

            {scanMode === 'delivery' && currentOrder.status === ORDER_STATUSES.OUT_FOR_DELIVERY && (
              <>
                <button
                  onClick={() => handleDeliveryAction(true)}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center space-x-2 bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <CheckCircle className="w-5 h-5" />
                  <span>Delivered</span>
                </button>
                <button
                  onClick={() => handleDeliveryAction(false)}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center space-x-2 bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  <XCircle className="w-5 h-5" />
                  <span>Not Delivered</span>
                </button>
              </>
            )}
          </div>

          {currentOrder.status === ORDER_STATUSES.DELIVERED && (
            <div className="mt-4 p-3 bg-green-900 rounded-lg">
              <p className="text-green-300 text-center">✅ This order has been delivered successfully</p>
            </div>
          )}

          {currentOrder.status === ORDER_STATUSES.NOT_DELIVERED && (
            <div className="mt-4 p-3 bg-red-900 rounded-lg">
              <p className="text-red-300 text-center">❌ This order was not delivered</p>
              {currentOrder.deliveryReason && (
                <p className="text-red-300 text-sm mt-1">Reason: {currentOrder.deliveryReason}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Not Delivered Reason Modal */}
      {showReasonModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700">
            <h3 className="text-lg font-medium mb-4 text-white">Reason for Non-Delivery</h3>
            
            <textarea
              placeholder="Please provide a reason why the order could not be delivered..."
              value={deliveryReason}
              onChange={(e) => setDeliveryReason(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 mb-4"
            />

            <div className="flex space-x-2">
              <button
                onClick={() => {
                  setShowReasonModal(false);
                  setDeliveryReason('');
                }}
                className="flex-1 px-4 py-2 border border-gray-600 text-gray-300 rounded-md hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleNotDelivered}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'Updating...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryScanner;