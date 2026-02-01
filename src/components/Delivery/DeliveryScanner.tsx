import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, addDoc, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Order, DeliveryRecord } from '../../types';
import { ORDER_STATUSES } from '../../config/constants';
import { generateUPIQRCode, generateTransactionId } from '../../utils/upiUtils';
import { QrCode, CheckCircle, XCircle, Scan, CreditCard, DollarSign, AlertCircle, Camera, Package2 } from 'lucide-react';
import QRScanner from './QRScanner';

const DeliveryScanner: React.FC = () => {
  const { user } = useAuth();
  const [scanMode, setScanMode] = useState<'pickup' | 'delivery'>('pickup');
  const [scannedOrderId, setScannedOrderId] = useState('');
  const [bulkOrderIds, setBulkOrderIds] = useState<string[]>(['']);
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [bulkOrders, setBulkOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [deliveryReason, setDeliveryReason] = useState('');
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi'>('cash');
  const [cashAmount, setCashAmount] = useState('');
  const [upiQRCode, setUpiQRCode] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [showAssignmentWarning, setShowAssignmentWarning] = useState(false);
  const [sellerUpiId, setSellerUpiId] = useState('');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [retryAttempts, setRetryAttempts] = useState<{[orderId: string]: number}>({});
  const [showQRScanner, setShowQRScanner] = useState(false);

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment', // Use back camera
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      setCameraStream(stream);
      setShowCamera(true);
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Unable to access camera. Please check permissions or enter Order ID manually.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  const handleQRScan = (result: string) => {
    setScannedOrderId(result);
    setShowQRScanner(false);
    // Auto-scan after QR detection
    setTimeout(() => {
      handleScan();
    }, 100);
  };

  const handleQRError = (error: string) => {
    console.error('QR Scanner error:', error);
    alert(error);
  };

  const addBulkOrderField = () => {
    setBulkOrderIds([...bulkOrderIds, '']);
  };

  const updateBulkOrderField = (index: number, value: string) => {
    const newIds = [...bulkOrderIds];
    newIds[index] = value;
    setBulkOrderIds(newIds);
  };

  const removeBulkOrderField = (index: number) => {
    const newIds = bulkOrderIds.filter((_, i) => i !== index);
    setBulkOrderIds(newIds.length > 0 ? newIds : ['']);
  };

  const handleBulkScan = async () => {
    const validOrderIds = bulkOrderIds.filter(id => id.trim() !== '');
    if (validOrderIds.length === 0) {
      alert('Please enter at least one Order ID');
      return;
    }

    setLoading(true);
    try {
      const orders: Order[] = [];
      
      for (const orderId of validOrderIds) {
        const q = query(
          collection(db, 'orders'),
          where('orderId', '==', orderId.trim())
        );
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          const orderDoc = snapshot.docs[0];
          const order = {
            id: orderDoc.id,
            ...orderDoc.data(),
            createdAt: orderDoc.data().createdAt?.toDate() || new Date(),
            updatedAt: orderDoc.data().updatedAt?.toDate() || new Date()
          } as Order;
          
          if (order.status === ORDER_STATUSES.PACKED) {
            orders.push(order);
          }
        }
      }
      
      if (orders.length === 0) {
        alert('No valid packed orders found');
        return;
      }
      
      setBulkOrders(orders);
    } catch (error) {
      console.error('Error scanning bulk orders:', error);
      alert('Error scanning orders');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkPickup = async () => {
    if (bulkOrders.length === 0) return;
    
    setLoading(true);
    try {
      const batch = writeBatch(db);
      
      bulkOrders.forEach(order => {
        const orderRef = doc(db, 'orders', order.id);
        batch.update(orderRef, {
          status: ORDER_STATUSES.OUT_FOR_DELIVERY,
          deliveryBoyId: user?.id,
          deliveryBoyName: user?.name,
          outForDeliveryAt: new Date(),
          updatedAt: new Date(),
          assignedDeliveryBoys: [user?.id]
        });
      });
      
      await batch.commit();
      
      alert(`${bulkOrders.length} orders marked as Out for Delivery!`);
      setBulkOrders([]);
      setBulkOrderIds(['']);
      setIsBulkMode(false);
    } catch (error) {
      console.error('Error updating bulk orders:', error);
      alert('Error updating orders');
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async () => {
    if (!scannedOrderId.trim()) {
      alert('Please enter an Order ID');
      return;
    }

    setLoading(true);
    setShowAssignmentWarning(false);

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

      // Fetch seller's UPI ID
      await fetchSellerUpiId(order.sellerId);

      // Allow delivery boy to pick up ANY packed order or deliver their assigned orders
      if (scanMode === 'pickup') {
        if (order.status !== ORDER_STATUSES.PACKED) {
          alert('This order is not ready for pickup. Status: ' + order.status.replace('_', ' '));
          setLoading(false);
          return;
        }
        
        // Check if this delivery boy is permanently assigned to this seller
        const isAssignedPartner = await checkPermanentAssignment(order.sellerId);
        
        if (!isAssignedPartner) {
          // Show warning if order was assigned to someone else, but allow pickup anyway
          if (order.assignedDeliveryBoys && 
              order.assignedDeliveryBoys.length > 0 && 
              !order.assignedDeliveryBoys.includes(user?.id || '')) {
            setShowAssignmentWarning(true);
          }
        }
        
        // Set the order regardless of assignment
        setCurrentOrder(order);
        
      } else if (scanMode === 'delivery') {
        if (order.status !== ORDER_STATUSES.OUT_FOR_DELIVERY) {
          alert('This order is not out for delivery. Status: ' + order.status.replace('_', ' '));
          setLoading(false);
          return;
        }
        
        // Only allow delivery if this delivery boy picked it up
        if (order.deliveryBoyId && order.deliveryBoyId !== user?.id) {
          alert('This order is assigned to another delivery boy. Only the delivery boy who picked it up can mark it as delivered.');
          setLoading(false);
          return;
        }
        
        setCurrentOrder(order);
      }

    } catch (error) {
      console.error('Error scanning order:', error);
      alert('Error scanning order');
    } finally {
      setLoading(false);
    }
  };

  const checkPermanentAssignment = async (sellerId: string): Promise<boolean> => {
    if (!user) return false;
    
    try {
      const q = query(
        collection(db, 'sellerDeliveryPartners'),
        where('sellerId', '==', sellerId),
        where('deliveryBoyId', '==', user.id),
        where('isActive', '==', true)
      );
      const snapshot = await getDocs(q);
      return !snapshot.empty;
    } catch (error) {
      console.error('Error checking permanent assignment:', error);
      return false;
    }
  };

  const fetchSellerUpiId = async (sellerId: string) => {
    try {
      const sellerDoc = await getDoc(doc(db, 'users', sellerId));
      if (sellerDoc.exists()) {
        const sellerData = sellerDoc.data();
        const upiId = sellerData.upiId || '';
        console.log('Fetched seller UPI ID:', upiId);
        setSellerUpiId(upiId);
        
        if (!upiId) {
          console.warn('Seller does not have UPI ID configured');
        }
      } else {
        console.error('Seller document not found');
        setSellerUpiId('');
      }
    } catch (error) {
      console.error('Error fetching seller UPI ID:', error);
      setSellerUpiId('');
    }
  };

  const updateOrderStatus = async (newStatus: string, reason?: string, paymentData?: any) => {
    if (!currentOrder) return;

    setLoading(true);

    try {
      const updateData: any = {
        status: newStatus,
        updatedAt: new Date()
      };

      if (newStatus === ORDER_STATUSES.OUT_FOR_DELIVERY) {
        updateData.deliveryBoyId = user?.id;
        updateData.deliveryBoyName = user?.name;
        updateData.outForDeliveryAt = new Date();
        
        // Update the assignedDeliveryBoys to include this delivery boy
        updateData.assignedDeliveryBoys = [user?.id];
        
      } else if (newStatus === ORDER_STATUSES.DELIVERED) {
        updateData.deliveredAt = new Date();
        if (paymentData) {
          updateData.deliveryPaymentMethod = paymentData.method;
          if (paymentData.method === 'cash') {
            updateData.cashCollected = paymentData.amount;
          } else if (paymentData.method === 'upi') {
            updateData.upiTransactionId = paymentData.transactionId;
          }
        }
      } else if (newStatus === ORDER_STATUSES.NOT_DELIVERED && reason) {
        updateData.deliveryReason = reason;
        // Increment retry attempts
        const currentAttempts = retryAttempts[currentOrder.id] || 0;
        updateData.retryAttempts = currentAttempts + 1;
        setRetryAttempts(prev => ({
          ...prev,
          [currentOrder.id]: currentAttempts + 1
        }));
      }

      await updateDoc(doc(db, 'orders', currentOrder.id), updateData);
      
      // Create delivery record for delivered orders
      if (newStatus === ORDER_STATUSES.DELIVERED && paymentData) {
        const deliveryRecord: Omit<DeliveryRecord, 'id'> = {
          orderId: currentOrder.id,
          orderNumber: currentOrder.orderId,
          sellerId: currentOrder.sellerId,
          sellerName: currentOrder.sellerName,
          deliveryBoyId: user?.id || '',
          deliveryBoyName: user?.name || '',
          paymentMethod: paymentData.method,
          amount: currentOrder.totalAmount,
          cashCollected: paymentData.method === 'cash' ? paymentData.amount : undefined,
          upiTransactionId: paymentData.method === 'upi' ? paymentData.transactionId : undefined,
          timestamp: new Date(),
          customerName: currentOrder.customerName,
          customerAddress: currentOrder.customerAddress
        };
        
        await addDoc(collection(db, 'deliveryRecords'), deliveryRecord);
      }
      
      alert(`Order ${newStatus.replace('_', ' ')} successfully!`);
      setCurrentOrder(null);
      setScannedOrderId('');
      setDeliveryReason('');
      setShowReasonModal(false);
      setShowPaymentModal(false);
      setShowAssignmentWarning(false);
      resetPaymentForm();
    } catch (error) {
      console.error('Error updating order status:', error);
      alert('Error updating order status');
    } finally {
      setLoading(false);
    }
  };

  const retryDelivery = async (order: Order) => {
    if (!confirm('Are you sure you want to retry delivery for this order?')) return;
    
    setLoading(true);
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        status: ORDER_STATUSES.OUT_FOR_DELIVERY,
        deliveryReason: '',
        updatedAt: new Date(),
        retryAt: new Date()
      });
      
      alert('Order marked for retry delivery!');
      setCurrentOrder(null);
      setScannedOrderId('');
    } catch (error) {
      console.error('Error retrying delivery:', error);
      alert('Error retrying delivery');
    } finally {
      setLoading(false);
    }
  };

  const resetPaymentForm = () => {
    setPaymentMethod('cash');
    setCashAmount('');
    setUpiQRCode('');
    setTransactionId('');
    setSellerUpiId('');
  };

  const handleDeliveryAction = (delivered: boolean) => {
    if (delivered) {
      setShowPaymentModal(true);
    } else {
      setShowReasonModal(true);
    }
  };

  const handlePaymentConfirm = () => {
    if (paymentMethod === 'cash') {
      const amount = parseFloat(cashAmount);
      if (!amount || amount <= 0) {
        alert('Please enter a valid cash amount');
        return;
      }
      updateOrderStatus(ORDER_STATUSES.DELIVERED, undefined, {
        method: 'cash',
        amount: amount
      });
    } else if (paymentMethod === 'upi') {
      if (!transactionId.trim()) {
        alert('Please enter the UPI transaction ID');
        return;
      }
      updateOrderStatus(ORDER_STATUSES.DELIVERED, undefined, {
        method: 'upi',
        transactionId: transactionId
      });
    }
  };

  const handleNotDelivered = () => {
    if (!deliveryReason.trim()) {
      alert('Please provide a reason for non-delivery');
      return;
    }
    updateOrderStatus(ORDER_STATUSES.NOT_DELIVERED, deliveryReason);
  };

  const generateUPIPayment = () => {
    if (!currentOrder) return;
    
    // Check if seller has UPI ID
    if (!sellerUpiId) {
      alert('Seller UPI ID not available. Please contact the seller.');
      return;
    }
    
    // Generate UPI payment link in correct format
    const upiString = `upi://pay?pa=${sellerUpiId}&pn=${currentOrder.sellerName}&am=${currentOrder.totalAmount}&cu=INR`;

    // Store the UPI string; we'll generate the QR locally using the installed qrcode-generator
    console.log('UPI String:', upiString);
    setUpiQRCode(upiString);
  };

  // SVG markup for the generated UPI QR
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
        // module may export the factory as default or directly
        // @ts-ignore
        const qrcodeFactory = mod && mod.default ? mod.default : mod;
        // create QR with automatic type (0) and error correction L
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
            setScanMode('pickup');
            setCurrentOrder(null);
            setScannedOrderId('');
            setShowAssignmentWarning(false);
            setBulkOrders([]);
            setIsBulkMode(false);
            stopCamera();
          }}
          className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
            scanMode === 'pickup'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          📦 Pickup Mode
        </button>
        <button
          onClick={() => {
            setScanMode('delivery');
            setCurrentOrder(null);
            setScannedOrderId('');
            setShowAssignmentWarning(false);
            setBulkOrders([]);
            setIsBulkMode(false);
            stopCamera();
          }}
          className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
            scanMode === 'delivery'
              ? 'bg-green-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          🚚 Delivery Mode
        </button>
      </div>

      {/* Bulk Mode Toggle for Pickup */}
      {scanMode === 'pickup' && (
        <div className="flex justify-center mb-4">
          <button
            onClick={() => {
              setIsBulkMode(!isBulkMode);
              setCurrentOrder(null);
              setScannedOrderId('');
              setBulkOrders([]);
              setBulkOrderIds(['']);
              stopCamera();
            }}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              isBulkMode
                ? 'bg-orange-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <Package2 className="w-4 h-4 inline mr-2" />
            {isBulkMode ? 'Exit Bulk Mode' : 'Bulk Pickup Mode'}
          </button>
        </div>
      )}

      {/* Info Banner */}
      <div className={`p-4 rounded-lg mb-6 ${
        scanMode === 'pickup' 
          ? 'bg-purple-900 border border-purple-700 text-purple-300'
          : 'bg-green-900 border border-green-700 text-green-300'
      }`}>
        <p className="text-sm">
          {scanMode === 'pickup' 
            ? isBulkMode
              ? '📦 Bulk Pickup Mode: Enter multiple Order IDs to pick up multiple orders at once.'
              : '📦 Pickup Mode: Scan any packed order to pick it up for delivery. You can pick up orders from any seller.'
            : '🚚 Delivery Mode: Scan orders that you have picked up to mark them as delivered or not delivered.'
          }
        </p>
      </div>

      {/* Scanner Input - Single or Bulk */}
      {!isBulkMode ? (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 mb-6">
          <h3 className="text-lg font-medium mb-4 text-white flex items-center">
            <Scan className="w-5 h-5 mr-2" />
            Scan Order QR Code
          </h3>
          
          <div className="flex space-x-2 mb-4">
            <input
              type="text"
              value={scannedOrderId}
              onChange={(e) => setScannedOrderId(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleScan()}
              placeholder="Enter or scan Order ID"
              className="flex-1 px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button
              onClick={startCamera}
              className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
              onClick={() => setShowQRScanner(true)}
              className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
            >
              <Camera className="w-5 h-5" />
              <span>QR Scanner</span>
            </button>
            <button
              onClick={handleScan}
              disabled={loading}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center space-x-2"
            >
              <QrCode className="w-5 h-5" />
              <span>{loading ? 'Scanning...' : 'Scan'}</span>
            </button>
          </div>
          
          {/* QR Scanner */}
          {showQRScanner && (
            <div className="mb-4">
              <div className="relative">
                <QRScanner
                  onScan={handleQRScan}
                  onError={handleQRError}
                  isActive={showQRScanner}
                />
                <button
                  onClick={() => setShowQRScanner(false)}
                  className="absolute top-2 right-2 bg-red-600 text-white px-3 py-1 rounded-lg text-sm"
                >
                  Close Scanner
                </button>
              </div>
              <p className="text-gray-400 text-sm mt-2 text-center">
                Position the QR code within the green square for automatic scanning.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 mb-6">
          <h3 className="text-lg font-medium mb-4 text-white flex items-center">
            <Package2 className="w-5 h-5 mr-2" />
            Bulk Order Pickup
          </h3>
          
          <div className="space-y-3 mb-4">
            {bulkOrderIds.map((orderId, index) => (
              <div key={index} className="flex space-x-2">
                <input
                  type="text"
                  value={orderId}
                  onChange={(e) => updateBulkOrderField(index, e.target.value)}
                  placeholder={`Order ID ${index + 1}`}
                  className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                {bulkOrderIds.length > 1 && (
                  <button
                    onClick={() => removeBulkOrderField(index)}
                    className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
          
          <div className="flex space-x-2 mb-4">
            <button
              onClick={addBulkOrderField}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add Order ID
            </button>
            <button
              onClick={handleBulkScan}
              disabled={loading}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Scanning...' : 'Scan All Orders'}
            </button>
          </div>
          
          {/* Bulk Orders Display */}
          {bulkOrders.length > 0 && (
            <div className="bg-gray-700 rounded-lg p-4">
              <h4 className="text-white font-medium mb-3">Found {bulkOrders.length} Orders Ready for Pickup:</h4>
              <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
                {bulkOrders.map((order, index) => (
                  <div key={order.id} className="flex justify-between items-center text-sm text-gray-300 bg-gray-600 p-2 rounded">
                    <span>{order.orderId}</span>
                    <span>{order.customerName}</span>
                    <span>₹{order.totalAmount}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={handleBulkPickup}
                disabled={loading}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {loading ? 'Processing...' : `Mark All ${bulkOrders.length} Orders as Out for Delivery`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Assignment Warning */}
      {showAssignmentWarning && currentOrder && (
        <div className="bg-yellow-900 border border-yellow-700 text-yellow-300 p-4 rounded-lg mb-6">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold mb-1">⚠️ Assignment Notice</p>
              <p className="text-sm">
                This order was originally assigned to another delivery partner. However, you can still pick it up and deliver it.
                Once you mark it as "Out for Delivery", you will become the assigned delivery partner for this order.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Order Details */}
      {currentOrder && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 space-y-6">
          <div className="border-b border-gray-700 pb-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-xl font-semibold text-white">{currentOrder.orderId}</h3>
                <p className="text-sm text-gray-400 mt-1">
                  Status: <span className={`font-medium ${
                    currentOrder.status === ORDER_STATUSES.PACKED ? 'text-yellow-400' :
                    currentOrder.status === ORDER_STATUSES.OUT_FOR_DELIVERY ? 'text-purple-400' :
                    currentOrder.status === ORDER_STATUSES.DELIVERED ? 'text-green-400' :
                    'text-red-400'
                  }`}>{currentOrder.status.replace('_', ' ')}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-white">₹{currentOrder.totalAmount}</p>
                <p className="text-sm text-gray-400">COD Amount</p>
              </div>
            </div>
          </div>

          {/* Customer & Seller Info */}
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
              <h4 className="font-semibold text-white mb-3">Seller Details</h4>
              <div className="space-y-2 text-sm text-gray-300">
                <p><strong className="text-gray-400">Seller:</strong> {currentOrder.sellerName}</p>
                <p><strong className="text-gray-400">Items:</strong> {currentOrder.items.length} products</p>
                <p><strong className="text-gray-400">Payment:</strong> Cash on Delivery</p>
                {currentOrder.deliveryBoyName && (
                  <p><strong className="text-gray-400">Assigned to:</strong> {currentOrder.deliveryBoyName}</p>
                )}
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
                  onClick={() => {
                    generateUPIPayment();
                    handleDeliveryAction(true);
                  }}
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
              <div className="mt-3 text-center">
                <button
                  onClick={() => retryDelivery(currentOrder)}
                  disabled={loading}
                  className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50"
                >
                  Retry Delivery
                </button>
              </div>
            </div>
          )}
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
                          <p className="text-xs text-gray-500 mt-1">to {currentOrder.sellerName}</p>
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
                      <p className="text-sm">Seller has not configured UPI ID. Please use cash payment or contact the seller.</p>
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
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
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