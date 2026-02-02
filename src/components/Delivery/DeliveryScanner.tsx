import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, addDoc, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Order, DeliveryRecord } from '../../types';
import { ORDER_STATUSES } from '../../config/constants';
import { generateUPIQRCode, generateTransactionId } from '../../utils/upiUtils';
import { QrCode, CheckCircle, XCircle, Camera, CreditCard, DollarSign, AlertCircle, Package2, Volume2, RefreshCw, X, Scan, Zap } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

// QRScanner Component
interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScanSuccess, onClose }) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string>('');
  const [hasFlash, setHasFlash] = useState(false);
  const [flashOn, setFlashOn] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const startScanner = async () => {
      try {
        const scanner = new Html5Qrcode('qr-reader');
        scannerRef.current = scanner;

        const config = {
          fps: 10,
          qrbox: { width: 280, height: 280 },
          aspectRatio: 16 / 9,
        };

        const constraints = {
          facingMode: 'environment',
          advanced: [{ torch: true }]
        };

        await scanner.start(
          constraints,
          config,
          (decodedText) => {
            if (isMounted) {
              onScanSuccess(decodedText);
            }
          },
          (errorMessage) => {
            // Ignore scan errors, they happen frequently
          }
        );

        if (isMounted) {
          setIsScanning(true);
          
          // Check if device has flash
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
              video: { facingMode: 'environment' } 
            });
            const track = stream.getVideoTracks()[0];
            const capabilities = track.getCapabilities() as any;
            if (capabilities.torch) {
              setHasFlash(true);
            }
            track.stop();
          } catch (err) {
            console.log('Flash not available');
          }
        }
      } catch (err: any) {
        console.error('Error starting scanner:', err);
        if (isMounted) {
          setError('Failed to start camera. Please check permissions.');
        }
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      // Cleanup function to properly stop the camera
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .then(() => {
            scannerRef.current?.clear();
            scannerRef.current = null;
            console.log('Camera stopped successfully');
          })
          .catch((err) => {
            console.error('Error stopping camera:', err);
          });
      }
    };
  }, [onScanSuccess]);

  const handleClose = async () => {
    try {
      if (scannerRef.current && isScanning) {
        await scannerRef.current.stop();
        scannerRef.current.clear();
        scannerRef.current = null;
        setIsScanning(false);
      }
    } catch (err) {
      console.error('Error closing scanner:', err);
    } finally {
      onClose();
    }
  };

  const toggleFlash = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      const track = stream.getVideoTracks()[0];
      await track.applyConstraints({
        advanced: [{ torch: !flashOn } as any]
      });
      setFlashOn(!flashOn);
    } catch (err) {
      console.error('Error toggling flash:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black overflow-hidden">
      {/* Camera Feed Background */}
      <div id="qr-reader" className="absolute inset-0 w-full h-full"></div>

      {/* Dark Overlay with Transparent Center */}
      <div className="absolute inset-0 pointer-events-none">
        <svg className="w-full h-full">
          <defs>
            <mask id="scan-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect 
                x="50%" 
                y="50%" 
                width="320" 
                height="320" 
                transform="translate(-160, -160)" 
                rx="20" 
                fill="black" 
              />
            </mask>
          </defs>
          <rect 
            width="100%" 
            height="100%" 
            fill="rgba(0, 0, 0, 0.7)" 
            mask="url(#scan-mask)" 
          />
        </svg>

        {/* Scan Frame with Corner Brackets */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80">
          {/* Top Left Corner */}
          <div className="absolute -top-1 -left-1">
            <div className="w-16 h-1 bg-green-500 rounded-full shadow-lg shadow-green-500/50"></div>
            <div className="w-1 h-16 bg-green-500 rounded-full shadow-lg shadow-green-500/50"></div>
          </div>
          
          {/* Top Right Corner */}
          <div className="absolute -top-1 -right-1">
            <div className="w-16 h-1 bg-green-500 rounded-full ml-auto shadow-lg shadow-green-500/50"></div>
            <div className="w-1 h-16 bg-green-500 rounded-full ml-auto shadow-lg shadow-green-500/50"></div>
          </div>
          
          {/* Bottom Left Corner */}
          <div className="absolute -bottom-1 -left-1">
            <div className="w-1 h-16 bg-green-500 rounded-full shadow-lg shadow-green-500/50"></div>
            <div className="w-16 h-1 bg-green-500 rounded-full shadow-lg shadow-green-500/50"></div>
          </div>
          
          {/* Bottom Right Corner */}
          <div className="absolute -bottom-1 -right-1">
            <div className="w-1 h-16 bg-green-500 rounded-full ml-auto shadow-lg shadow-green-500/50"></div>
            <div className="w-16 h-1 bg-green-500 rounded-full ml-auto shadow-lg shadow-green-500/50"></div>
          </div>

          {/* Animated Scanning Line */}
          <div className="absolute inset-0 overflow-hidden rounded-2xl">
            <div className="scan-line"></div>
          </div>

          {/* Center Glow Effect */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 bg-green-500/20 rounded-full blur-3xl animate-pulse"></div>
          </div>
        </div>
      </div>

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-black via-black/80 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={handleClose}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all backdrop-blur-sm border border-white/20"
            >
              <X className="w-6 h-6 text-white" />
            </button>
            <h2 className="text-white text-xl font-semibold">Scan QR Code</h2>
          </div>
          
          {hasFlash && (
            <button
              onClick={toggleFlash}
              className={`p-2 rounded-full transition-all backdrop-blur-sm border ${
                flashOn 
                  ? 'bg-yellow-500/30 border-yellow-500/50' 
                  : 'bg-white/10 border-white/20 hover:bg-white/20'
              }`}
            >
              <Zap className={`w-6 h-6 ${flashOn ? 'text-yellow-300' : 'text-white'}`} />
            </button>
          )}
        </div>
      </div>

      {/* Bottom Instructions */}
      <div className="absolute bottom-0 left-0 right-0 z-10 p-8 bg-gradient-to-t from-black via-black/80 to-transparent">
        <div className="max-w-md mx-auto">
          <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="p-3 bg-green-500/20 rounded-full">
                <Scan className="w-8 h-8 text-green-400 animate-pulse" />
              </div>
              <div>
                <p className="text-white text-lg font-semibold mb-1">
                  Position QR Code
                </p>
                <p className="text-gray-300 text-sm">
                  Align the QR code within the frame to scan
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="absolute top-24 left-0 right-0 z-20 px-4">
          <div className="max-w-md mx-auto bg-red-500/90 backdrop-blur-sm text-white px-6 py-4 rounded-2xl shadow-2xl border border-red-400/50">
            <p className="text-center font-medium">{error}</p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes scanAnimation {
          0% {
            transform: translateY(-100%);
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
          100% {
            transform: translateY(100%);
            opacity: 0;
          }
        }

        .scan-line {
          position: absolute;
          width: 100%;
          height: 3px;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(16, 185, 129, 0.3),
            rgba(16, 185, 129, 1),
            rgba(16, 185, 129, 0.3),
            transparent
          );
          box-shadow: 
            0 0 20px rgba(16, 185, 129, 0.8),
            0 0 40px rgba(16, 185, 129, 0.5),
            0 0 60px rgba(16, 185, 129, 0.3);
          animation: scanAnimation 3s ease-in-out infinite;
        }

        #qr-reader {
          width: 100% !important;
          height: 100% !important;
          border: none !important;
        }

        #qr-reader > div {
          width: 100% !important;
          height: 100% !important;
        }

        #qr-reader video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
        }

        #qr-reader__dashboard,
        #qr-reader__dashboard_section,
        #qr-reader__dashboard_section_swaplink,
        #qr-reader__header_message {
          display: none !important;
        }

        #qr-reader__scan_region {
          border: none !important;
        }
      `}</style>
    </div>
  );
};

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
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [undeliveredOrders, setUndeliveredOrders] = useState<Order[]>([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio on component mount
  useEffect(() => {
    audioRef.current = new Audio('/assets/beep.mp3');
    audioRef.current.load();
  }, []);

  // Audio feedback functions using the audio file
  const playSuccessBeep = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(err => console.error('Error playing success beep:', err));
    }
  };

  const playErrorBeep = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(err => console.error('Error playing first beep:', err));
      
      // Play second beep after a delay
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(err => console.error('Error playing second beep:', err));
        }
      }, 300);
    }
  };

  const showError = (message: string) => {
    setErrorMessage(message);
    setShowErrorModal(true);
    playErrorBeep();
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
    // Reset bulk mode data if applicable
    if (isBulkMode) {
      setBulkScannedOrders([]);
      setScannedOrderIds(new Set());
      setScanCount(0);
    }
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
        if (isBulkMode) {
          console.log('Order not found:', scannedOrderId);
        } else {
          showError('Order not found. Please check the order ID and try again.');
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
        const statusMessage = `Cannot deliver this order. Current status: ${order.status.replace('_', ' ')}`;
        if (isBulkMode) {
          console.log('Invalid order status:', statusMessage);
        } else {
          showError(statusMessage);
        }
        return;
      }

      // Check if delivery boy is assigned
      if (order.deliveryBoyId && order.deliveryBoyId !== user?.id) {
        if (isBulkMode) {
          console.log('Order assigned to another delivery boy');
        } else {
          showError('This order is assigned to another delivery boy and cannot be delivered by you.');
        }
        return;
      }

      // Fetch seller UPI ID
      await fetchSellerUpiId(order.sellerId);

      if (isBulkMode) {
        // Check if already scanned
        if (scannedOrderIds.has(order.orderId)) {
          console.log('Order already scanned:', order.orderId);
          showError('This order has already been scanned in this bulk session.');
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
      if (!isBulkMode) {
        showError('Error scanning order. Please try again.');
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

      if (newStatus === ORDER_STATUSES.DELIVERED && paymentData) {
        updateData.paymentStatus = 'paid';
        updateData.paymentMethod = paymentData.method;
        updateData.paymentAmount = paymentData.amount;
        if (paymentData.transactionId) {
          updateData.transactionId = paymentData.transactionId;
        }
      }

      if (reason) {
        updateData.deliveryNotes = reason;
      }

      await updateDoc(orderRef, updateData);

      const deliveryRecord: Omit<DeliveryRecord, 'id'> = {
        orderId: order.id,
        orderNumber: order.orderId,
        deliveryBoyId: user?.id || '',
        deliveryBoyName: user?.name || '',
        status: newStatus,
        timestamp: new Date(),
        reason: reason || '',
        paymentData: paymentData || null
      };

      await addDoc(collection(db, 'deliveryRecords'), deliveryRecord);

      playSuccessBeep();

      if (newStatus === ORDER_STATUSES.UNDELIVERED) {
        setUndeliveredOrders(prev => [...prev, order]);
      }

      return true;
    } catch (error) {
      console.error('Error updating order:', error);
      showError('Failed to update order status. Please try again.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleSingleDelivery = async (isDelivered: boolean) => {
    if (!currentOrder) return;

    if (isDelivered) {
      setShowPaymentModal(true);
    } else {
      setShowReasonModal(true);
    }
  };

  const handleBulkDelivery = async (isDelivered: boolean) => {
    if (bulkScannedOrders.length === 0) {
      showError('No orders scanned for bulk delivery');
      return;
    }

    if (isDelivered) {
      setShowPaymentModal(true);
    } else {
      setShowReasonModal(true);
    }
  };

  const generateUPIPayment = () => {
    if (!sellerUpiId) return;

    const amount = currentOrder?.totalAmount || bulkScannedOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const orderRef = currentOrder?.orderId || `BULK-${Date.now()}`;
    const txnId = generateTransactionId();
    
    setTransactionId(txnId);
    
    const upiString = generateUPIQRCode(
      sellerUpiId,
      amount,
      orderRef,
      txnId
    );
    
    setUpiQRCode(upiString);
  };

  const [upiQrSvg, setUpiQrSvg] = useState<string>('');

  useEffect(() => {
    if (upiQRCode) {
      import('qrcode').then(QRCode => {
        QRCode.toString(upiQRCode, { type: 'svg', width: 256 })
          .then(svg => setUpiQrSvg(svg))
          .catch(err => console.error('QR generation error:', err));
      });
    }
  }, [upiQRCode]);

  const handlePaymentConfirm = async () => {
    if (paymentMethod === 'cash' && !cashAmount) {
      showError('Please enter the cash amount collected');
      return;
    }

    if (paymentMethod === 'upi' && !transactionId) {
      showError('Please enter the UPI transaction ID');
      return;
    }

    const paymentData = {
      method: paymentMethod,
      amount: paymentMethod === 'cash' 
        ? parseFloat(cashAmount) 
        : (currentOrder?.totalAmount || bulkScannedOrders.reduce((sum, order) => sum + order.totalAmount, 0)),
      transactionId: paymentMethod === 'upi' ? transactionId : undefined
    };

    if (isBulkMode && bulkScannedOrders.length > 0) {
      const batch = writeBatch(db);
      const successfulOrders: Order[] = [];
      const failedOrders: Order[] = [];

      for (const order of bulkScannedOrders) {
        try {
          const orderRef = doc(db, 'orders', order.id);
          batch.update(orderRef, {
            status: ORDER_STATUSES.DELIVERED,
            paymentStatus: 'paid',
            paymentMethod: paymentData.method,
            paymentAmount: paymentData.amount,
            updatedAt: new Date()
          });

          const deliveryRecord: Omit<DeliveryRecord, 'id'> = {
            orderId: order.id,
            orderNumber: order.orderId,
            deliveryBoyId: user?.id || '',
            deliveryBoyName: user?.name || '',
            status: ORDER_STATUSES.DELIVERED,
            timestamp: new Date(),
            reason: '',
            paymentData
          };

          await addDoc(collection(db, 'deliveryRecords'), deliveryRecord);
          successfulOrders.push(order);
        } catch (error) {
          console.error('Error processing order:', order.orderId, error);
          failedOrders.push(order);
        }
      }

      try {
        await batch.commit();
        playSuccessBeep();
        setShowPaymentModal(false);
        setBulkScannedOrders([]);
        setScannedOrderIds(new Set());
        setScanCount(0);
        setCashAmount('');
        setTransactionId('');
        setUpiQRCode('');
        stopScanner();

        if (failedOrders.length > 0) {
          showError(`${successfulOrders.length} orders delivered successfully. ${failedOrders.length} orders failed.`);
        }
      } catch (error) {
        console.error('Batch commit error:', error);
        showError('Failed to complete bulk delivery. Please try again.');
      }
    } else if (currentOrder) {
      const success = await updateOrderStatus(currentOrder, ORDER_STATUSES.DELIVERED, '', paymentData);
      if (success) {
        setShowPaymentModal(false);
        setCurrentOrder(null);
        setCashAmount('');
        setTransactionId('');
        setUpiQRCode('');
        stopScanner();
      }
    }
  };

  const handleNotDelivered = async () => {
    if (!deliveryReason.trim()) {
      showError('Please provide a reason for non-delivery');
      return;
    }

    if (isBulkMode && bulkScannedOrders.length > 0) {
      const batch = writeBatch(db);

      for (const order of bulkScannedOrders) {
        const orderRef = doc(db, 'orders', order.id);
        batch.update(orderRef, {
          status: ORDER_STATUSES.UNDELIVERED,
          deliveryNotes: deliveryReason,
          updatedAt: new Date()
        });

        const deliveryRecord: Omit<DeliveryRecord, 'id'> = {
          orderId: order.id,
          orderNumber: order.orderId,
          deliveryBoyId: user?.id || '',
          deliveryBoyName: user?.name || '',
          status: ORDER_STATUSES.UNDELIVERED,
          timestamp: new Date(),
          reason: deliveryReason,
          paymentData: null
        };

        await addDoc(collection(db, 'deliveryRecords'), deliveryRecord);
      }

      try {
        await batch.commit();
        playSuccessBeep();
        setUndeliveredOrders(prev => [...prev, ...bulkScannedOrders]);
        setShowReasonModal(false);
        setDeliveryReason('');
        setBulkScannedOrders([]);
        setScannedOrderIds(new Set());
        setScanCount(0);
        stopScanner();
      } catch (error) {
        console.error('Batch commit error:', error);
        showError('Failed to mark orders as undelivered. Please try again.');
      }
    } else if (currentOrder) {
      const success = await updateOrderStatus(currentOrder, ORDER_STATUSES.UNDELIVERED, deliveryReason);
      if (success) {
        setShowReasonModal(false);
        setDeliveryReason('');
        setCurrentOrder(null);
        stopScanner();
      }
    }
  };

  const handleRetryOrder = async (order: Order) => {
    // Remove from undelivered list
    setUndeliveredOrders(prev => prev.filter(o => o.id !== order.id));
    
    // Set as current order
    setCurrentOrder(order);
    
    // Fetch seller UPI ID again
    await fetchSellerUpiId(order.sellerId);
    
    // Show scanner
    setShowQRScanner(true);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-gray-800 rounded-lg shadow-xl p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center">
            <Package2 className="w-7 h-7 mr-2 text-green-500" />
            Delivery Scanner
          </h2>
          <div className="flex items-center space-x-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isBulkMode}
                onChange={(e) => setIsBulkMode(e.target.checked)}
                className="mr-2"
              />
              <span className="text-gray-300">Bulk Mode</span>
            </label>
          </div>
        </div>

        {!showQRScanner ? (
          <div className="text-center py-12">
            <QrCode className="w-24 h-24 mx-auto mb-6 text-gray-600" />
            <h3 className="text-xl font-semibold mb-4 text-white">
              {isBulkMode ? 'Start Bulk Scanning' : 'Scan Order QR Code'}
            </h3>
            <p className="text-gray-400 mb-6">
              {isBulkMode 
                ? 'Scan multiple order QR codes and process them together'
                : 'Scan the QR code on the delivery package to process the order'}
            </p>
            <button
              onClick={startScanner}
              className="inline-flex items-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Camera className="w-5 h-5 mr-2" />
              Start Scanner
            </button>
          </div>
        ) : (
          <div>
            <QRScanner onScanSuccess={handleQRScan} onClose={stopScanner} />
            
            {isBulkMode && scanCount > 0 && (
              <div className="mt-4 p-4 bg-gray-700 rounded-lg border border-gray-600">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-semibold">Scanned Orders: {scanCount}</span>
                  <Volume2 className="w-5 h-5 text-green-500" />
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {bulkScannedOrders.map((order, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-800 p-2 rounded text-sm">
                      <span className="text-gray-300">{order.orderId}</span>
                      <span className="text-green-400">₹{order.totalAmount}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 flex space-x-3">
              {isBulkMode ? (
                <>
                  <button
                    onClick={() => handleBulkDelivery(true)}
                    disabled={loading || bulkScannedOrders.length === 0}
                    className="flex-1 flex items-center justify-center space-x-2 bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    <CheckCircle className="w-5 h-5" />
                    <span>Mark All Delivered</span>
                  </button>
                  <button
                    onClick={() => handleBulkDelivery(false)}
                    disabled={loading || bulkScannedOrders.length === 0}
                    className="flex-1 flex items-center justify-center space-x-2 bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    <XCircle className="w-5 h-5" />
                    <span>Mark All Not Delivered</span>
                  </button>
                </>
              ) : null}
              <button
                onClick={stopScanner}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Stop Scanner
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Undelivered Orders List */}
      {undeliveredOrders.length > 0 && (
        <div className="mt-6 bg-gray-800 rounded-lg shadow-xl p-6 border border-red-700">
          <h3 className="text-xl font-semibold mb-4 text-white flex items-center">
            <AlertCircle className="w-6 h-6 mr-2 text-red-500" />
            Undelivered Orders ({undeliveredOrders.length})
          </h3>
          <div className="space-y-3">
            {undeliveredOrders.map((order) => (
              <div key={order.id} className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-semibold">{order.orderId}</p>
                    <p className="text-gray-400 text-sm">₹{order.totalAmount}</p>
                    <p className="text-gray-500 text-xs mt-1">{order.deliveryNotes}</p>
                  </div>
                  <button
                    onClick={() => handleRetryOrder(order)}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Retry</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Current Order Details (Single Mode) */}
      {currentOrder && !isBulkMode && (
        <div className="mt-6 bg-gray-800 rounded-lg shadow-xl p-6 border border-gray-700 space-y-4">
          <h3 className="text-xl font-semibold text-white border-b border-gray-700 pb-3">Order Details</h3>
          
          {/* Order Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-gray-400 text-sm">Order ID</p>
              <p className="text-white font-semibold">{currentOrder.orderId}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Amount</p>
              <p className="text-white font-semibold">₹{currentOrder.totalAmount}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Customer</p>
              <p className="text-white">{currentOrder.customerName}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Phone</p>
              <p className="text-white">{currentOrder.customerPhone}</p>
            </div>
          </div>

          {/* Delivery Address */}
          <div>
            <p className="text-gray-400 text-sm mb-1">Delivery Address</p>
            <p className="text-white">{currentOrder.deliveryAddress}</p>
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

      {/* Error Modal */}
      {showErrorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-red-700">
            <div className="flex items-center mb-4">
              <AlertCircle className="w-8 h-8 text-red-500 mr-3" />
              <h3 className="text-lg font-medium text-white">Error</h3>
            </div>
            
            <p className="text-gray-300 mb-6">{errorMessage}</p>

            <button
              onClick={() => setShowErrorModal(false)}
              className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Close
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