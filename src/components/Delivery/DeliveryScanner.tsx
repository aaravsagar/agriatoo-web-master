import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, addDoc, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Order, DeliveryRecord } from '../../types';
import { ORDER_STATUSES } from '../../config/constants';
import { generateUPIQRCode, generateTransactionId } from '../../utils/upiUtils';
import { QrCode, CheckCircle, XCircle, Camera, CreditCard, DollarSign, AlertCircle, Package2, Volume2 } from 'lucide-react';
import QRScanner from './QRScanner';

interface ToastMessage {
  id: number;
  message: string;
  type: 'error' | 'warning' | 'success';
}

const DeliveryScanner: React.FC = () => {
  const { user } = useAuth();
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [bulkScannedOrders, setBulkScannedOrders] = useState<Order[]>([]);
  const [scannedOrderIds, setScannedOrderIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [deliveryReason, setDeliveryReason] = useState('');
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi'>('cash');
  const [cashAmount, setCashAmount] = useState('');
  const [upiQRCode, setUpiQRCode] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [sellerUpiId, setSellerUpiId] = useState('');
  const [scanCount, setScanCount] = useState(0);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [upiQrSvg, setUpiQrSvg] = useState('');
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const toastIdCounter = useRef(0);

  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio('/assets/beep.mp3');
    audioRef.current.preload = 'auto';
  }, []);

  // Toast notification functions
  const showToast = (message: string, type: 'error' | 'warning' | 'success' = 'error') => {
    const id = toastIdCounter.current++;
    setToasts(prev => [...prev, { id, message, type }]);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 3000);
  };

  // Audio feedback functions using the beep.mp3 file
  const playBeep = async (times: number = 1) => {
    if (!audioRef.current) return;
    
    for (let i = 0; i < times; i++) {
      try {
        // Clone the audio to allow overlapping plays
        const audio = audioRef.current.cloneNode() as HTMLAudioElement;
        await audio.play();
        
        // Wait for beep duration plus a small gap before next beep
        if (i < times - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      } catch (error) {
        console.error('Error playing beep:', error);
      }
    }
  };

  const playSuccessBeep = () => playBeep(1);
  const playAlreadyDeliveredBeep = () => playBeep(2);
  const playErrorBeep = () => playBeep(3);

  const startScanner = () => {
    setShowQRScanner(true);
    if (isBulkMode) {
      setBulkScannedOrders([]);
      setScannedOrderIds(new Set());
      setScanCount(0);
    }
  };

  const stopScanner = () => {
    setShowQRScanner(false);
    setCurrentOrder(null);
  };

  const handleQRScan = async (scannedOrderId: string) => {
    if (!scannedOrderId.trim()) return;

    try {
      const q = query(
        collection(db, 'orders'),
        where('orderId', '==', scannedOrderId.trim())
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        playErrorBeep();
        if (isBulkMode) {
          showToast('Order not found: ' + scannedOrderId, 'error');
        } else {
          showToast('Order not found', 'error');
        }
        return;
      }

      const orderDoc = snapshot.docs[0];
      const order = {
        id: orderDoc.id,
        ...orderDoc.data(),
        createdAt: orderDoc.data().createdAt?.toDate() || new Date(),
        updatedAt: orderDoc.data().updatedAt?.toDate() || new Date()
      } as Order;

      // Check if order was already delivered
      if (order.status === ORDER_STATUSES.DELIVERED) {
        playAlreadyDeliveredBeep();
        if (isBulkMode) {
          showToast(`Order ${order.orderId} already delivered`, 'warning');
        } else {
          showToast('This order has already been delivered', 'warning');
        }
        return;
      }

      // Allow retry for NOT_DELIVERED orders - set them back to OUT_FOR_DELIVERY
      if (order.status === ORDER_STATUSES.NOT_DELIVERED) {
        // Update order status to OUT_FOR_DELIVERY for retry
        await updateDoc(doc(db, 'orders', order.id), {
          status: ORDER_STATUSES.OUT_FOR_DELIVERY,
          updatedAt: new Date()
        });
        
        // Update local order object
        order.status = ORDER_STATUSES.OUT_FOR_DELIVERY;
        playSuccessBeep();
        
        if (isBulkMode) {
          showToast(`Order ${order.orderId} status updated to Out for Delivery`, 'success');
        } else {
          showToast('Order status updated. Ready for delivery retry.', 'success');
        }
      }

      // Allow delivery even if order is not ready or not out for delivery
      // Valid statuses: OUT_FOR_DELIVERY, NOT_READY_FOR_PICKUP
      const validStatuses = [
        ORDER_STATUSES.OUT_FOR_DELIVERY,
        ORDER_STATUSES.NOT_READY_FOR_PICKUP
      ];

      if (!validStatuses.includes(order.status)) {
        playErrorBeep();
        const statusMessage = `Order status: ${order.status.replace(/_/g, ' ')}`;
        if (isBulkMode) {
          showToast(`Invalid status - ${statusMessage}`, 'error');
        } else {
          showToast(`Cannot deliver this order. ${statusMessage}`, 'error');
        }
        return;
      }

      // If order is NOT_READY_FOR_PICKUP, update it to OUT_FOR_DELIVERY automatically
      if (order.status === ORDER_STATUSES.NOT_READY_FOR_PICKUP) {
        await updateDoc(doc(db, 'orders', order.id), {
          status: ORDER_STATUSES.OUT_FOR_DELIVERY,
          deliveryBoyId: user?.id,
          updatedAt: new Date()
        });
        
        // Update local order object
        order.status = ORDER_STATUSES.OUT_FOR_DELIVERY;
        order.deliveryBoyId = user?.id;
      }

      // Check if delivery boy is assigned
      if (order.deliveryBoyId && order.deliveryBoyId !== user?.id) {
        playErrorBeep();
        if (isBulkMode) {
          showToast('Order assigned to another delivery person', 'error');
        } else {
          showToast('This order is assigned to another delivery person', 'error');
        }
        return;
      }

      // Fetch seller UPI ID
      await fetchSellerUpiId(order.sellerId);

      if (isBulkMode) {
        // Check if already scanned
        if (scannedOrderIds.has(order.orderId)) {
          playAlreadyDeliveredBeep();
          showToast(`Order ${order.orderId} already scanned`, 'warning');
          return;
        }

        // Add to bulk list
        setBulkScannedOrders(prev => [...prev, order]);
        setScannedOrderIds(prev => new Set([...prev, order.orderId]));
        setScanCount(prev => prev + 1);
        playSuccessBeep();
        // Don't show success toast in bulk mode to avoid interrupting flow
      } else {
        // Single mode - show order details
        setCurrentOrder(order);
        playSuccessBeep();
      }

    } catch (error) {
      console.error('Error scanning order:', error);
      playErrorBeep();
      if (isBulkMode) {
        showToast('Error scanning order', 'error');
      } else {
        showToast('Error scanning order. Please try again.', 'error');
      }
    }
  };

  const fetchSellerUpiId = async (sellerId: string) => {
    try {
      const sellerDoc = await getDoc(doc(db, 'users', sellerId));
      if (sellerDoc.exists()) {
        const sellerData = sellerDoc.data();
        const upiId = sellerData.upiId || '';
        setSellerUpiId(upiId);
      } else {
        setSellerUpiId('');
      }
    } catch (error) {
      console.error('Error fetching seller UPI ID:', error);
      setSellerUpiId('');
    }
  };

  const updateOrderStatus = async (order: Order, newStatus: string, reason?: string, paymentData?: any) => {
    setLoading(true);

    try {
      const orderRef = doc(db, 'orders', order.id);
      const updateData: any = {
        status: newStatus,
        updatedAt: new Date()
      };

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

      if (newStatus === ORDER_STATUSES.DELIVERED) {
        playSuccessBeep();
        showToast('Order marked as delivered successfully!', 'success');
      } else {
        showToast('Order status updated', 'success');
      }

      // Reset state
      setCurrentOrder(null);
      setShowPaymentModal(false);
      setShowReasonModal(false);
      setDeliveryReason('');
      setCashAmount('');
      setTransactionId('');
      setPaymentMethod('cash');

    } catch (error) {
      console.error('Error updating order:', error);
      playErrorBeep();
      showToast('Error updating order status', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSingleDelivery = (isDelivered: boolean) => {
    if (!currentOrder) return;

    if (isDelivered) {
      setShowPaymentModal(true);
    } else {
      setShowReasonModal(true);
    }
  };

  const handlePaymentConfirm = async () => {
    if (!currentOrder) return;

    const paymentData = {
      method: paymentMethod,
      amount: paymentMethod === 'cash' 
        ? (parseFloat(cashAmount) || currentOrder.totalAmount)
        : currentOrder.totalAmount,
      ...(paymentMethod === 'upi' && transactionId && { transactionId })
    };

    await updateOrderStatus(currentOrder, ORDER_STATUSES.DELIVERED, undefined, paymentData);
  };

  const handleNotDelivered = async () => {
    if (!currentOrder || !deliveryReason.trim()) {
      showToast('Please provide a reason for non-delivery', 'error');
      return;
    }

    await updateOrderStatus(currentOrder, ORDER_STATUSES.NOT_DELIVERED, deliveryReason);
  };

  const handleBulkDelivery = async () => {
    if (bulkScannedOrders.length === 0) {
      showToast('No orders scanned yet', 'error');
      return;
    }

    setLoading(true);
    try {
      const batch = writeBatch(db);
      const now = new Date();

      for (const order of bulkScannedOrders) {
        const orderRef = doc(db, 'orders', order.id);
        batch.update(orderRef, {
          status: ORDER_STATUSES.DELIVERED,
          deliveredAt: now,
          deliveredBy: user?.id,
          updatedAt: now
        });

        // Add delivery record
        const deliveryRecordRef = doc(collection(db, 'deliveryRecords'));
        batch.set(deliveryRecordRef, {
          orderId: order.orderId,
          deliveryBoyId: user?.id,
          status: ORDER_STATUSES.DELIVERED,
          timestamp: now
        });
      }

      await batch.commit();
      
      playSuccessBeep();
      showToast(`Successfully delivered ${bulkScannedOrders.length} orders!`, 'success');
      
      // Reset bulk state
      setBulkScannedOrders([]);
      setScannedOrderIds(new Set());
      setScanCount(0);
      setShowQRScanner(false);

    } catch (error) {
      console.error('Error in bulk delivery:', error);
      playErrorBeep();
      showToast('Error updating bulk orders', 'error');
    } finally {
      setLoading(false);
    }
  };

  const generateUPIPayment = async () => {
    if (!currentOrder || !sellerUpiId) return;

    try {
      const qrCode = await generateUPIQRCode(
        sellerUpiId,
        currentOrder.totalAmount,
        `Order ${currentOrder.orderId}`
      );
      setUpiQRCode(qrCode);
      setUpiQrSvg(qrCode);
    } catch (error) {
      console.error('Error generating UPI QR code:', error);
      showToast('Error generating payment QR code', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`min-w-[300px] p-4 rounded-lg shadow-lg transform transition-all duration-300 ease-in-out ${
              toast.type === 'error' 
                ? 'bg-red-600 border-l-4 border-red-800' 
                : toast.type === 'warning'
                ? 'bg-yellow-600 border-l-4 border-yellow-800'
                : 'bg-green-600 border-l-4 border-green-800'
            }`}
            style={{
              animation: 'slideInRight 0.3s ease-out'
            }}
          >
            <div className="flex items-start">
              <div className="flex-shrink-0 mr-3">
                {toast.type === 'error' && <XCircle className="w-6 h-6" />}
                {toast.type === 'warning' && <AlertCircle className="w-6 h-6" />}
                {toast.type === 'success' && <CheckCircle className="w-6 h-6" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{toast.message}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="max-w-4xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Package2 className="w-8 h-8 text-green-400" />
            <h1 className="text-3xl font-bold">Delivery Scanner</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isBulkMode}
                onChange={(e) => {
                  setIsBulkMode(e.target.checked);
                  if (!e.target.checked) {
                    setBulkScannedOrders([]);
                    setScannedOrderIds(new Set());
                    setScanCount(0);
                  }
                }}
                className="w-5 h-5 text-green-600 bg-gray-700 border-gray-600 rounded focus:ring-green-500"
              />
              <span className="text-sm font-medium">Bulk Mode</span>
            </label>
          </div>
        </div>

        {/* Scanner Control */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          {!showQRScanner ? (
            <button
              onClick={startScanner}
              className="w-full flex items-center justify-center space-x-2 bg-green-600 text-white py-4 px-6 rounded-lg hover:bg-green-700 transition-colors"
            >
              <Camera className="w-6 h-6" />
              <span className="text-lg font-medium">
                {isBulkMode ? 'Start Bulk Scanning' : 'Start Scanner'}
              </span>
            </button>
          ) : (
            <div className="space-y-4">
              <QRScanner
                onScan={handleQRScan}
                onError={(error) => {
                  console.error('QR Scanner error:', error);
                  playErrorBeep();
                }}
                isActive={showQRScanner}
              />
              <button
                onClick={stopScanner}
                className="w-full flex items-center justify-center space-x-2 bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700"
              >
                <XCircle className="w-5 h-5" />
                <span>Stop Scanner</span>
              </button>
            </div>
          )}
        </div>

        {/* Bulk Mode Summary */}
        {isBulkMode && bulkScannedOrders.length > 0 && (
          <div className="mt-6 bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-bold text-white mb-4">Scanned Orders ({scanCount})</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {bulkScannedOrders.map((order, index) => (
                <div key={order.id} className="bg-gray-700 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{order.orderId}</p>
                    <p className="text-sm text-gray-400">{order.customerName}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">₹{order.totalAmount}</p>
                    <p className="text-xs text-gray-400">{order.items.length} items</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Single Order Details */}
      {!isBulkMode && currentOrder && !showQRScanner && (
        <div className="max-w-4xl mx-auto bg-gray-800 rounded-lg p-6 border border-gray-700 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">{currentOrder.orderId}</h2>
            <span className="px-3 py-1 bg-blue-600 text-white rounded-full text-sm">
              {currentOrder.status.replace(/_/g, ' ')}
            </span>
          </div>

          {/* Customer Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-400">Customer</p>
              <p className="font-medium">{currentOrder.customerName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Phone</p>
              <p className="font-medium">{currentOrder.customerPhone}</p>
            </div>
            <div className="col-span-2">
              <p className="text-sm text-gray-400">Address</p>
              <p className="font-medium">{currentOrder.customerAddress}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Total Amount</p>
              <p className="text-xl font-bold text-green-400">₹{currentOrder.totalAmount}</p>
            </div>
          </div>

          {/* Order Items */}
          <div>
            <h4 className="font-semibold text-white mb-3">Order Items</h4>
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="space-y-2">
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
            <button
              onClick={() => {
                generateUPIPayment();
                handleSingleDelivery(true);
              }}
              disabled={loading}
              className="flex-1 flex items-center justify-center space-x-2 bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <CheckCircle className="w-5 h-5" />
              <span>Delivered</span>
            </button>
            <button
              onClick={() => handleSingleDelivery(false)}
              disabled={loading}
              className="flex-1 flex items-center justify-center space-x-2 bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              <XCircle className="w-5 h-5" />
              <span>Not Delivered</span>
            </button>
          </div>
        </div>
      )}

      {/* Payment Method Modal */}
      {showPaymentModal && currentOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700">
            <h3 className="text-lg font-medium mb-4 text-white">Payment Collection</h3>
            <p className="text-gray-300 mb-4">Order Amount: ₹{currentOrder.totalAmount}</p>
            
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
                  onClick={() => {
                    setPaymentMethod('upi');
                    generateUPIPayment();
                  }}
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
                    placeholder={currentOrder.totalAmount.toString()}
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
                      <div className="bg-gray-700 border border-gray-600 rounded-lg p-3">
                        <p className="text-xs text-gray-400 mb-1">Seller UPI ID:</p>
                        <p className="text-sm text-green-300 font-mono font-semibold break-all">{sellerUpiId}</p>
                      </div>
                      {upiQRCode && (
                        <div className="text-center bg-white rounded-lg p-4">
                          {upiQrSvg ? (
                            <div className="mx-auto mb-2 w-64 h-64" dangerouslySetInnerHTML={{ __html: upiQrSvg }} />
                          ) : (
                            <p className="text-sm text-red-500">Unable to render QR</p>
                          )}
                          <p className="text-sm text-gray-600 font-semibold">Scan to pay ₹{currentOrder.totalAmount}</p>
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
                    <div className="bg-red-900 border border-red-700 text-red-300 p-4 rounded-lg text-center">
                      <p className="font-semibold mb-1">⚠️ UPI Not Available</p>
                      <p className="text-sm">Seller has not configured UPI ID. Please use cash payment.</p>
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

      {/* CSS Animation for Toast */}
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default DeliveryScanner;