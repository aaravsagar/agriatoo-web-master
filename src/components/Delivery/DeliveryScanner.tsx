import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, addDoc, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Order, DeliveryRecord } from '../../types';
import { ORDER_STATUSES } from '../../config/constants';
import { generateUPIQRCode, generateTransactionId } from '../../utils/upiUtils';
import { QrCode, CheckCircle, XCircle, Camera, CreditCard, DollarSign, AlertCircle, Package2, Volume2 } from 'lucide-react';
import QRScanner from './QRScanner';

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

  // Audio feedback functions
  const playSuccessBeep = () => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  };

  const playErrorBeep = () => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // First beep
    const oscillator1 = audioContext.createOscillator();
    const gainNode1 = audioContext.createGain();
    oscillator1.connect(gainNode1);
    gainNode1.connect(audioContext.destination);
    oscillator1.frequency.value = 400;
    oscillator1.type = 'sine';
    gainNode1.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode1.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
    oscillator1.start(audioContext.currentTime);
    oscillator1.stop(audioContext.currentTime + 0.15);
    
    // Second beep
    setTimeout(() => {
      const oscillator2 = audioContext.createOscillator();
      const gainNode2 = audioContext.createGain();
      oscillator2.connect(gainNode2);
      gainNode2.connect(audioContext.destination);
      oscillator2.frequency.value = 400;
      oscillator2.type = 'sine';
      gainNode2.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
      oscillator2.start(audioContext.currentTime);
      oscillator2.stop(audioContext.currentTime + 0.15);
    }, 200);
  };

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
          // Show error briefly in bulk mode
          console.log('Order not found:', scannedOrderId);
        } else {
          alert('Order not found');
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

      // Check if order is valid for delivery
      if (order.status !== ORDER_STATUSES.OUT_FOR_DELIVERY) {
        playErrorBeep();
        const statusMessage = `Order status: ${order.status.replace('_', ' ')}`;
        if (isBulkMode) {
          console.log('Invalid order status:', statusMessage);
        } else {
          alert(`Cannot deliver this order. ${statusMessage}`);
        }
        return;
      }

      // Check if delivery boy is assigned
      if (order.deliveryBoyId && order.deliveryBoyId !== user?.id) {
        playErrorBeep();
        if (isBulkMode) {
          console.log('Order assigned to another delivery boy');
        } else {
          alert('This order is assigned to another delivery boy');
        }
        return;
      }

      // Fetch seller UPI ID
      await fetchSellerUpiId(order.sellerId);

      if (isBulkMode) {
        // Check if already scanned
        if (scannedOrderIds.has(order.orderId)) {
          playErrorBeep();
          console.log('Order already scanned:', order.orderId);
          return;
        }

        // Add to bulk list
        setBulkScannedOrders(prev => [...prev, order]);
        setScannedOrderIds(prev => new Set([...prev, order.orderId]));
        setScanCount(prev => prev + 1);
        playSuccessBeep();
        console.log('Order added to bulk list:', order.orderId);
      } else {
        // Single mode - show order details
        setCurrentOrder(order);
        playSuccessBeep();
      }

    } catch (error) {
      console.error('Error scanning order:', error);
      playErrorBeep();
      if (!isBulkMode) {
        alert('Error scanning order');
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
      const updateData: any = {
        status: newStatus,
        updatedAt: new Date()
      };

      if (newStatus === ORDER_STATUSES.DELIVERED) {
        updateData.deliveredAt = new Date();
        if (paymentData) {
          updateData.deliveryPaymentMethod = paymentData.method;
          if (paymentData.method === 'cash' && paymentData.amount) {
            updateData.cashCollected = paymentData.amount;
          } else if (paymentData.method === 'upi' && paymentData.transactionId) {
            updateData.upiTransactionId = paymentData.transactionId;
          }
        }
      } else if (newStatus === ORDER_STATUSES.NOT_DELIVERED && reason) {
        updateData.deliveryReason = reason;
        updateData.retryAttempts = (order.retryAttempts || 0) + 1;
      }

      await updateDoc(doc(db, 'orders', order.id), updateData);
      
      // Create delivery record for delivered orders
      if (newStatus === ORDER_STATUSES.DELIVERED && paymentData) {
        const deliveryRecord: any = {
          orderId: order.id,
          orderNumber: order.orderId,
          sellerId: order.sellerId,
          sellerName: order.sellerName,
          deliveryBoyId: user?.id || '',
          deliveryBoyName: user?.name || '',
          paymentMethod: paymentData.method,
          amount: order.totalAmount,
          timestamp: new Date(),
          customerName: order.customerName,
          customerAddress: order.customerAddress
        };
        
        // Only add fields that have values
        if (paymentData.method === 'cash' && paymentData.amount) {
          deliveryRecord.cashCollected = paymentData.amount;
        }
        if (paymentData.method === 'upi' && paymentData.transactionId) {
          deliveryRecord.upiTransactionId = paymentData.transactionId;
        }
        
        await addDoc(collection(db, 'deliveryRecords'), deliveryRecord);
      }
      
    } catch (error) {
      console.error('Error updating order status:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleSingleDelivery = (delivered: boolean) => {
    if (delivered) {
      setShowPaymentModal(true);
    } else {
      setShowReasonModal(true);
    }
  };

  const handlePaymentConfirm = async () => {
    if (!currentOrder) return;

    if (paymentMethod === 'cash') {
      const amount = parseFloat(cashAmount);
      if (!amount || amount <= 0) {
        alert('Please enter a valid cash amount');
        return;
      }
      try {
        await updateOrderStatus(currentOrder, ORDER_STATUSES.DELIVERED, undefined, {
          method: 'cash',
          amount: amount
        });
        alert('Order marked as delivered!');
        resetSingleMode();
      } catch (error) {
        alert('Error updating order status');
      }
    } else if (paymentMethod === 'upi') {
      if (!transactionId.trim()) {
        alert('Please enter the UPI transaction ID');
        return;
      }
      try {
        await updateOrderStatus(currentOrder, ORDER_STATUSES.DELIVERED, undefined, {
          method: 'upi',
          transactionId: transactionId
        });
        alert('Order marked as delivered!');
        resetSingleMode();
      } catch (error) {
        alert('Error updating order status');
      }
    }
  };

  const handleNotDelivered = async () => {
    if (!currentOrder || !deliveryReason.trim()) {
      alert('Please provide a reason for non-delivery');
      return;
    }
    
    try {
      await updateOrderStatus(currentOrder, ORDER_STATUSES.NOT_DELIVERED, deliveryReason);
      alert('Order marked as not delivered');
      resetSingleMode();
    } catch (error) {
      alert('Error updating order status');
    }
  };

  const handleBulkDelivery = async () => {
    if (bulkScannedOrders.length === 0) {
      alert('No orders scanned');
      return;
    }

    if (!confirm(`Mark all ${bulkScannedOrders.length} orders as delivered?`)) {
      return;
    }

    setLoading(true);
    try {
      const batch = writeBatch(db);
      const now = new Date();
      
      bulkScannedOrders.forEach(order => {
        const orderRef = doc(db, 'orders', order.id);
        batch.update(orderRef, {
          status: ORDER_STATUSES.DELIVERED,
          deliveredAt: now,
          deliveryPaymentMethod: 'cash',
          cashCollected: order.totalAmount,
          updatedAt: now
        });

        // Add delivery record
        const deliveryRecordRef = doc(collection(db, 'deliveryRecords'));
        batch.set(deliveryRecordRef, {
          orderId: order.id,
          orderNumber: order.orderId,
          sellerId: order.sellerId,
          sellerName: order.sellerName,
          deliveryBoyId: user?.id || '',
          deliveryBoyName: user?.name || '',
          paymentMethod: 'cash',
          amount: order.totalAmount,
          cashCollected: order.totalAmount,
          timestamp: now,
          customerName: order.customerName,
          customerAddress: order.customerAddress
        });
      });
      
      await batch.commit();
      
      alert(`${bulkScannedOrders.length} orders marked as delivered!`);
      setBulkScannedOrders([]);
      setScannedOrderIds(new Set());
      setScanCount(0);
      setShowQRScanner(false);
    } catch (error) {
      console.error('Error updating bulk orders:', error);
      alert('Error updating orders');
    } finally {
      setLoading(false);
    }
  };

  const resetSingleMode = () => {
    setCurrentOrder(null);
    setShowPaymentModal(false);
    setShowReasonModal(false);
    setDeliveryReason('');
    resetPaymentForm();
  };

  const resetPaymentForm = () => {
    setPaymentMethod('cash');
    setCashAmount('');
    setUpiQRCode('');
    setTransactionId('');
    setSellerUpiId('');
  };

  const generateUPIPayment = () => {
    if (!currentOrder || !sellerUpiId) return;
    
    const upiString = `upi://pay?pa=${sellerUpiId}&pn=${currentOrder.sellerName}&am=${currentOrder.totalAmount}&cu=INR`;
    setUpiQRCode(upiString);
  };

  // Generate UPI QR SVG
  const [upiQrSvg, setUpiQrSvg] = useState('');

  useEffect(() => {
    let mounted = true;
    if (!upiQRCode) {
      setUpiQrSvg('');
      return;
    }

    const generate = async () => {
      try {
        const mod = await import('qrcode-generator');
        const qrcodeFactory = mod && mod.default ? mod.default : mod;
        const qr = qrcodeFactory(0, 'L');
        qr.addData(upiQRCode);
        qr.make();
        const svg = qr.createSvgTag(6);
        if (mounted) setUpiQrSvg(svg);
      } catch (e) {
        console.error('Error generating QR SVG:', e);
        if (mounted) setUpiQrSvg('');
      }
    };

    generate();

    return () => {
      mounted = false;
    };
  }, [upiQRCode]);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Mode Selector */}
      <div className="flex space-x-4 mb-6">
        <button
          onClick={() => {
            setIsBulkMode(false);
            setShowQRScanner(false);
            setCurrentOrder(null);
            setBulkScannedOrders([]);
            setScannedOrderIds(new Set());
          }}
          className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
            !isBulkMode
              ? 'bg-green-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          🚚 Single Delivery Mode
        </button>
        <button
          onClick={() => {
            setIsBulkMode(true);
            setShowQRScanner(false);
            setCurrentOrder(null);
            setBulkScannedOrders([]);
            setScannedOrderIds(new Set());
          }}
          className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
            isBulkMode
              ? 'bg-purple-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          📦 Bulk Delivery Mode
        </button>
      </div>

      {/* Info Banner */}
      <div className={`p-4 rounded-lg mb-6 ${
        isBulkMode 
          ? 'bg-purple-900 border border-purple-700 text-purple-300'
          : 'bg-green-900 border border-green-700 text-green-300'
      }`}>
        <p className="text-sm">
          {isBulkMode 
            ? '📦 Bulk Mode: Scan multiple orders continuously. Scanner stays open until you close it and mark all as delivered.'
            : '🚚 Single Mode: Scan one order at a time to mark as delivered or not delivered.'
          }
        </p>
      </div>

      {/* Scanner Controls */}
      {!showQRScanner && (
        <div className="text-center mb-6">
          <button
            onClick={startScanner}
            className="bg-blue-600 text-white px-8 py-4 rounded-lg hover:bg-blue-700 text-lg font-medium flex items-center space-x-3 mx-auto"
          >
            <Camera className="w-6 h-6" />
            <span>Start QR Scanner</span>
          </button>
        </div>
      )}

      {/* QR Scanner */}
      {showQRScanner && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-white flex items-center">
              <QrCode className="w-5 h-5 mr-2" />
              {isBulkMode ? 'Bulk QR Scanner' : 'Single QR Scanner'}
            </h3>
            <button
              onClick={stopScanner}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
            >
              Close Scanner
            </button>
          </div>

          {isBulkMode && (
            <div className="mb-4 flex items-center justify-between bg-purple-900 bg-opacity-50 p-3 rounded-lg">
              <div className="flex items-center space-x-3">
                <Volume2 className="w-5 h-5 text-purple-300" />
                <span className="text-purple-300">Scanned Orders: {scanCount}</span>
              </div>
              <div className="text-purple-300 text-sm">
                🔊 Listen for beeps: 1 beep = success, 2 beeps = error
              </div>
            </div>
          )}

          <QRScanner
            onScan={handleQRScan}
            onError={(error) => {
              console.error('QR Scanner error:', error);
              playErrorBeep();
            }}
            isActive={showQRScanner}
          />
        </div>
      )}

      {/* Bulk Scanned Orders */}
      {isBulkMode && bulkScannedOrders.length > 0 && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 mb-6">
          <h3 className="text-lg font-medium text-white mb-4">
            Scanned Orders ({bulkScannedOrders.length})
          </h3>
          <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
            {bulkScannedOrders.map((order, index) => (
              <div key={order.id} className="flex justify-between items-center bg-gray-700 p-3 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-white font-medium">{order.orderId}</p>
                    <p className="text-gray-400 text-sm">{order.customerName}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white font-medium">₹{order.totalAmount}</p>
                  <p className="text-gray-400 text-sm">{order.customerPincode}</p>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={handleBulkDelivery}
            disabled={loading}
            className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
          >
            {loading ? 'Processing...' : `Mark All ${bulkScannedOrders.length} Orders as Delivered`}
          </button>
        </div>
      )}

      {/* Single Order Details */}
      {!isBulkMode && currentOrder && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 space-y-6">
          <div className="border-b border-gray-700 pb-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-xl font-semibold text-white">{currentOrder.orderId}</h3>
                <p className="text-sm text-gray-400 mt-1">
                  Status: <span className="font-medium text-purple-400">Out for Delivery</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-white">₹{currentOrder.totalAmount}</p>
                <p className="text-sm text-gray-400">COD Amount</p>
              </div>
            </div>
          </div>

          {/* Customer & Order Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-white mb-3">Customer Details</h4>
              <div className="space-y-2 text-sm text-gray-300">
                <p><strong className="text-gray-400">Name:</strong> {currentOrder.customerName}</p>
                <p><strong className="text-gray-400">Phone:</strong> {currentOrder.customerPhone}</p>
                <p><strong className="text-gray-400">Address:</strong> {currentOrder.customerAddress}</p>
                <p><strong className="text-gray-400">PIN Code:</strong> {currentOrder.customerPincode}</p>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-3">Order Details</h4>
              <div className="space-y-2 text-sm text-gray-300">
                <p><strong className="text-gray-400">Seller:</strong> {currentOrder.sellerName}</p>
                <p><strong className="text-gray-400">Items:</strong> {currentOrder.items.length} products</p>
                <p><strong className="text-gray-400">Payment:</strong> Cash on Delivery</p>
              </div>
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
    </div>
  );
};

export default DeliveryScanner;