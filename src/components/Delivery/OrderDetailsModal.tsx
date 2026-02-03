import React, { useState, useEffect } from 'react';
import { updateDoc, doc, addDoc, collection, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Order, User, DeliveryRecord } from '../../types';
import { ORDER_STATUSES } from '../../config/constants';
import { CheckCircle, XCircle, Phone, MapPin, Package, DollarSign, CreditCard, ArrowRight, RotateCcw, Truck } from 'lucide-react';
import QRCode from 'qrcode';

interface OrderDetailsModalProps {
  order: Order;
  onClose: () => void;
  user: User | null;
  onOrderUpdate?: () => void;
}

const NOT_DELIVERED_REASONS = [
  'Customer not available',
  'Wrong address',
  'Customer refused delivery',
  'Payment issue',
  'Address not accessible',
  'Customer requested reschedule',
  'Other'
];

const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({ order, onClose, user, onOrderUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [deliveryReason, setDeliveryReason] = useState('');
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi'>('cash');
  const [cashAmount, setCashAmount] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [upiQRCode, setUpiQRCode] = useState<string>('');
  const [sellerUpiId, setSellerUpiId] = useState<string>('');

  // Fetch seller UPI ID when UPI payment is selected
  useEffect(() => {
    const fetchSellerUpiId = async () => {
      if (paymentMethod === 'upi' && order.sellerId) {
        try {
          const sellerDoc = await getDoc(doc(db, 'users', order.sellerId));
          if (sellerDoc.exists()) {
            const sellerData = sellerDoc.data();
            const upiId = sellerData.upiId || '';
            setSellerUpiId(upiId);
            
            if (upiId) {
              // Generate UPI QR code
              const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(order.sellerName)}&am=${order.totalAmount}&tn=${encodeURIComponent(`Payment for order ${order.orderId}`)}&cu=INR`;
              const qrCodeDataUrl = await QRCode.toDataURL(upiUrl, { width: 200 });
              setUpiQRCode(qrCodeDataUrl);
            }
          }
        } catch (error) {
          console.error('Error fetching seller UPI ID:', error);
        }
      }
    };

    fetchSellerUpiId();
  }, [paymentMethod, order.sellerId, order.sellerName, order.totalAmount, order.orderId]);

  const updateOrderStatus = async (newStatus: string, reason?: string, paymentData?: any) => {
    setLoading(true);

    try {
      const orderRef = doc(db, 'orders', order.id);
      const updateData: any = {
        status: newStatus,
        updatedAt: new Date()
      };

      if (newStatus === ORDER_STATUSES.OUT_FOR_DELIVERY) {
        updateData.outForDeliveryAt = new Date();
        updateData.deliveryBoyId = user?.id;
      }

      if (newStatus === ORDER_STATUSES.DELIVERED) {
        updateData.deliveredAt = new Date();
        updateData.deliveredBy = user?.id;
        
        if (paymentData) {
          updateData.paymentCollected = {
            method: paymentData.method,
            amount: paymentData.amount,
            timestamp: new Date(),
            collectedBy: user?.id,
            ...(paymentData.method === 'upi' && paymentData.transactionId && {
              transactionId: paymentData.transactionId
            })
          };
        }
      }

      if (newStatus === ORDER_STATUSES.NOT_DELIVERED && reason) {
        updateData.notDeliveredReason = reason;
        updateData.notDeliveredAt = new Date();
        updateData.notDeliveredBy = user?.id;
      }

      await updateDoc(orderRef, updateData);

      // Create delivery record
      await addDoc(collection(db, 'deliveryRecords'), {
        orderId: order.orderId,
        deliveryBoyId: user?.id,
        status: newStatus,
        timestamp: new Date(),
        ...(reason && { reason }),
        ...(paymentData && { paymentData })
      } as DeliveryRecord);

      // Update local order state
      order.status = newStatus;
      if (newStatus === ORDER_STATUSES.DELIVERED) {
        order.deliveredAt = new Date();
      } else if (newStatus === ORDER_STATUSES.NOT_DELIVERED) {
        order.notDeliveredReason = reason;
        order.notDeliveredAt = new Date();
      }

      if (onOrderUpdate) {
        onOrderUpdate();
      }

      onClose();

    } catch (error) {
      console.error('Error updating order:', error);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentConfirm = async () => {
    const paymentData = {
      method: paymentMethod,
      amount: paymentMethod === 'cash' 
        ? (parseFloat(cashAmount) || order.totalAmount)
        : order.totalAmount,
      ...(paymentMethod === 'upi' && transactionId && { transactionId })
    };

    await updateOrderStatus(ORDER_STATUSES.DELIVERED, undefined, paymentData);
  };

  const handleNotDelivered = async () => {
    const finalReason = selectedReason === 'Other' ? customReason : selectedReason;
    if (!finalReason.trim()) {
      return;
    }

    await updateOrderStatus(ORDER_STATUSES.NOT_DELIVERED, finalReason);
  };

  const handleTryAgain = async () => {
    await updateOrderStatus(ORDER_STATUSES.OUT_FOR_DELIVERY);
  };

  const isDelivered = order.status === ORDER_STATUSES.DELIVERED;
  const isNotDelivered = order.status === ORDER_STATUSES.NOT_DELIVERED;
  const isOutForDelivery = order.status === ORDER_STATUSES.OUT_FOR_DELIVERY;
  const isPackedOrReceived = order.status === ORDER_STATUSES.PACKED || order.status === ORDER_STATUSES.RECEIVED;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-700 m-4">
        {/* Header */}
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">{order.orderId}</h2>
            <div className="flex items-center space-x-3">
              {isDelivered && (
                <span className="px-3 py-1 bg-green-600 text-white rounded-full text-sm font-medium">
                  Order Delivered
                </span>
              )}
              {isNotDelivered && (
                <span className="px-3 py-1 bg-red-600 text-white rounded-full text-sm font-medium">
                  Not Delivered
                </span>
              )}
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Customer Details */}
          <div className="bg-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
              <MapPin className="w-5 h-5 mr-2" />
              Customer Details
            </h3>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-gray-400">Name</p>
                <p className="text-white font-medium">{order.customerName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Phone</p>
                <div className="flex items-center space-x-2">
                  <p className="text-white font-medium">{order.customerPhone}</p>
                  <a
                    href={`tel:${order.customerPhone}`}
                    className="text-green-400 hover:text-green-300"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-400">Address</p>
                <p className="text-white">{order.customerAddress}</p>
                <p className="text-gray-300 text-sm">PIN: {order.customerPincode}</p>
              </div>
            </div>
          </div>

          {/* Order Items */}
          <div className="bg-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
              <Package className="w-5 h-5 mr-2" />
              Items in Box ({order.items.length} items)
            </h3>
            <div className="space-y-2">
              {order.items.map((item, index) => (
                <div key={index} className="flex justify-between items-center py-2 border-b border-gray-600 last:border-b-0">
                  <div>
                    <p className="text-white font-medium">{item.productName}</p>
                    <p className="text-gray-400 text-sm">{item.quantity} {item.unit}</p>
                  </div>
                  <p className="text-green-400 font-semibold">₹{(item.price * item.quantity).toFixed(2)}</p>
                </div>
              ))}
              <div className="pt-2 border-t border-gray-600">
                <div className="flex justify-between items-center">
                  <p className="text-white font-bold text-lg">Total Amount</p>
                  <p className="text-green-400 font-bold text-xl">₹{order.totalAmount}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Not Delivered Reason Display */}
          {isNotDelivered && order.notDeliveredReason && (
            <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-red-300 mb-2">Reason for Non-Delivery</h3>
              <p className="text-red-200">{order.notDeliveredReason}</p>
            </div>
          )}

          {/* Action Section */}
          <div className="bg-gray-700 rounded-lg p-4">
            {/* Packed/Received Orders - Manual Action Selection */}
            {isPackedOrReceived && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">Choose Action</h3>
                <div className="grid grid-cols-1 gap-3">
                  <button
                    onClick={() => updateOrderStatus(ORDER_STATUSES.OUT_FOR_DELIVERY)}
                    disabled={loading}
                    className="flex items-center justify-center space-x-2 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Truck className="w-5 h-5" />
                    <span>Mark as Out for Delivery</span>
                  </button>
                  <button
                    onClick={() => setShowPaymentModal(true)}
                    disabled={loading}
                    className="flex items-center justify-center space-x-2 bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    <CheckCircle className="w-5 h-5" />
                    <span>Mark as Delivered</span>
                  </button>
                  <button
                    onClick={() => setShowReasonModal(true)}
                    disabled={loading}
                    className="flex items-center justify-center space-x-2 bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    <XCircle className="w-5 h-5" />
                    <span>Mark as Not Delivered</span>
                  </button>
                </div>
              </div>
            )}

            {/* Out for Delivery Orders */}
            {isOutForDelivery && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">Delivery Actions</h3>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowPaymentModal(true)}
                    disabled={loading}
                    className="flex-1 flex items-center justify-center space-x-2 bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    <CheckCircle className="w-5 h-5" />
                    <span>Mark as Delivered</span>
                  </button>
                  <button
                    onClick={() => setShowReasonModal(true)}
                    disabled={loading}
                    className="flex-1 flex items-center justify-center space-x-2 bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    <XCircle className="w-5 h-5" />
                    <span>Not Delivered</span>
                  </button>
                </div>
              </div>
            )}

            {/* Not Delivered Orders - Try Again */}
            {isNotDelivered && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">Retry Delivery</h3>
                <button
                  onClick={handleTryAgain}
                  disabled={loading}
                  className="w-full flex items-center justify-center space-x-2 bg-yellow-600 text-white py-3 px-4 rounded-lg hover:bg-yellow-700 disabled:opacity-50"
                >
                  <RotateCcw className="w-5 h-5" />
                  <span>Try Again</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-60">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700 m-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium mb-4 text-white">Payment Collection</h3>
            <p className="text-gray-300 mb-4">Order Amount: ₹{order.totalAmount}</p>
            
            <div className="space-y-4 mb-6">
              <div className="flex space-x-4">
                <button
                  onClick={() => setPaymentMethod('cash')}
                  className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-lg font-medium transition-colors ${
                    paymentMethod === 'cash'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <DollarSign className="w-5 h-5" />
                  <span>Cash</span>
                </button>
                <button
                  onClick={() => setPaymentMethod('upi')}
                  className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-lg font-medium transition-colors ${
                    paymentMethod === 'upi'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <CreditCard className="w-5 h-5" />
                  <span>UPI</span>
                </button>
              </div>

              {paymentMethod === 'cash' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Cash Collected (₹)
                  </label>
                  <input
                    type="number"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                    placeholder={order.totalAmount.toString()}
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              )}

              {paymentMethod === 'upi' && (
                <div className="space-y-4">
                  {sellerUpiId ? (
                    <>
                      {upiQRCode && (
                        <div className="text-center">
                          <p className="text-sm text-gray-300 mb-2">Show this QR code to customer:</p>
                          <div className="bg-white p-4 rounded-lg inline-block">
                            <img 
                              src={upiQRCode}
                              alt="UPI QR Code"
                              className="w-48 h-48"
                            />
                          </div>
                          <p className="text-xs text-gray-400 mt-2">Amount: ₹{order.totalAmount}</p>
                          <p className="text-xs text-gray-400">Pay to: {sellerUpiId}</p>
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          UPI Transaction ID
                        </label>
                        <input
                          type="text"
                          value={transactionId}
                          onChange={(e) => setTransactionId(e.target.value)}
                          placeholder="Enter transaction ID after payment"
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                    </>
                  ) : (
                    <div className="bg-yellow-900 border border-yellow-700 text-yellow-300 p-3 rounded-lg text-sm">
                      <p>Seller has not set up UPI ID. Please collect cash payment instead.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex space-x-2">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 px-4 py-2 border border-gray-600 text-gray-300 rounded-md hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handlePaymentConfirm}
                disabled={loading || (paymentMethod === 'upi' && !sellerUpiId)}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Confirm Delivery'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Not Delivered Reason Modal */}
      {showReasonModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-60">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700 m-4">
            <h3 className="text-lg font-medium mb-4 text-white">Reason for Non-Delivery</h3>
            
            <div className="space-y-3 mb-4">
              {NOT_DELIVERED_REASONS.map((reason) => (
                <label key={reason} className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="deliveryReason"
                    value={reason}
                    checked={selectedReason === reason}
                    onChange={(e) => setSelectedReason(e.target.value)}
                    className="w-4 h-4 text-red-600 bg-gray-700 border-gray-600 focus:ring-red-500"
                  />
                  <span className="text-gray-300">{reason}</span>
                </label>
              ))}
            </div>

            {selectedReason === 'Other' && (
              <textarea
                placeholder="Please specify the reason..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 mb-4"
              />
            )}

            <div className="flex space-x-2">
              <button
                onClick={() => {
                  setShowReasonModal(false);
                  setSelectedReason('');
                  setCustomReason('');
                }}
                className="flex-1 px-4 py-2 border border-gray-600 text-gray-300 rounded-md hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleNotDelivered}
                disabled={loading || !selectedReason || (selectedReason === 'Other' && !customReason.trim())}
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

export default OrderDetailsModal;