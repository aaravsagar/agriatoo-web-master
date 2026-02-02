import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Order } from '../../types';
import { ORDER_STATUSES } from '../../config/constants';
import { Camera, CheckCircle, XCircle, AlertCircle, Package2 } from 'lucide-react';
import QRScanner from './QRScanner';
import OrderDetailsModal from './OrderDetailsModal';

interface ToastMessage {
  id: number;
  message: string;
  type: 'error' | 'warning' | 'success';
}

const DeliveryScanner: React.FC = () => {
  const { user } = useAuth();
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [scannerKey, setScannerKey] = useState(0); // Force remount scanner
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const toastIdCounter = useRef(0);
  const isProcessingRef = useRef(false); // Prevent multiple scans

  // Initialize audio element
  useEffect(() => {
    // Create a simple beep sound programmatically to avoid file dependency
    const createBeepSound = () => {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'square';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    };
    
    audioRef.current = { play: createBeepSound } as any;
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

  // Audio feedback functions
  const playBeep = (times: number = 1) => {
    if (!audioRef.current) return;
    
    // Play beeps with delay
    let delay = 0;
    for (let i = 0; i < times; i++) {
      setTimeout(() => {
        try {
          audioRef.current?.play();
        } catch (error) {
          console.error('Error playing beep:', error);
        }
      }, delay);
      delay += 200; // 200ms between beeps
      }
  };

  const playSuccessBeep = () => playBeep(1);
  const playErrorBeep = () => playBeep(2);

  const startScanner = () => {
    setCurrentOrder(null);
    setShowOrderDetails(false);
    isProcessingRef.current = false;
    setScannerKey(prev => prev + 1); // Force remount
    setShowQRScanner(true);
  };

  const stopScanner = () => {
    setShowQRScanner(false);
    setScannerKey(prev => prev + 1); // Force remount to ensure cleanup
  };

  const handleQRScan = async (scannedOrderId: string) => {
    // Prevent multiple simultaneous scans
    if (isProcessingRef.current) {
      console.log('Already processing a scan, ignoring...');
      return;
    }
    
    if (!scannedOrderId.trim()) return;

    isProcessingRef.current = true;
    setShowQRScanner(false); // Stop scanner immediately

    try {
      const q = query(
        collection(db, 'orders'),
        where('orderId', '==', scannedOrderId.trim())
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        playErrorBeep();
        showToast('Order not found: ' + scannedOrderId, 'error');
        // Restart scanner after error
        setTimeout(() => {
          startScanner();
        }, 2000);
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
        playSuccessBeep();
        setCurrentOrder(order);
        setShowOrderDetails(true);
        return;
      }

      // Check if order was not delivered
      if (order.status === ORDER_STATUSES.NOT_DELIVERED) {
        playErrorBeep();
        setCurrentOrder(order);
        setShowOrderDetails(true);
        return;
      }

      // Allow scanning for: PACKED, RECEIVED, OUT_FOR_DELIVERY
      const scannableStatuses = [
        ORDER_STATUSES.PACKED,
        ORDER_STATUSES.RECEIVED,
        ORDER_STATUSES.OUT_FOR_DELIVERY
      ];

      if (!scannableStatuses.includes(order.status)) {
        playErrorBeep();
        showToast(`Cannot process this order. Status: ${order.status.replace(/_/g, ' ')}`, 'error');
        // Restart scanner after error
        setTimeout(() => {
          startScanner();
        }, 2000);
        return;
      }

      // If order is PACKED or RECEIVED, update it to OUT_FOR_DELIVERY
      const statusesToUpdate = [
        ORDER_STATUSES.PACKED,
        ORDER_STATUSES.RECEIVED
      ];

      if (statusesToUpdate.includes(order.status)) {
        await updateDoc(doc(db, 'orders', order.id), {
          status: ORDER_STATUSES.OUT_FOR_DELIVERY,
          deliveryBoyId: user?.id,
          updatedAt: new Date()
        });
        
        // Update local order object
        order.status = ORDER_STATUSES.OUT_FOR_DELIVERY;
        order.deliveryBoyId = user?.id;
        
        playSuccessBeep();
        showToast(`Order ${order.orderId} marked as Out for Delivery`, 'success');
      }

      // Check if delivery boy is assigned
      if (order.deliveryBoyId && order.deliveryBoyId !== user?.id) {
        playErrorBeep();
        showToast('Order assigned to another delivery person', 'error');
        // Restart scanner after error
        setTimeout(() => {
          startScanner();
        }, 2000);
        return;
      }

      // Show order details
      setCurrentOrder(order);
      setShowOrderDetails(true);

    } catch (error) {
      console.error('Error scanning order:', error);
      playErrorBeep();
      showToast('Error scanning order. Please try again.', 'error');
      // Restart scanner after error
      setTimeout(() => {
        startScanner();
      }, 2000);
    } finally {
      isProcessingRef.current = false;
    }
  };

  const handleOrderModalClose = () => {
    setShowOrderDetails(false);
    setCurrentOrder(null);
    // Restart scanner after closing modal
    setTimeout(() => {
      startScanner();
    }, 500);
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
            <h1 className="text-3xl font-bold">QR Scanner</h1>
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
                Start Scanner
              </span>
            </button>
          ) : (
            <div className="space-y-4">
              <QRScanner
                key={scannerKey}
                onScan={handleQRScan}
                onError={(error) => {
                  console.error('QR Scanner error:', error);
                  playErrorBeep();
                  showToast('Scanner error: ' + error, 'error');
                }}
                isActive={showQRScanner}
                manualTrigger={false}
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

      </div>
      
      {/* Order Details Modal */}
      {showOrderDetails && currentOrder && (
        <OrderDetailsModal 
          order={currentOrder}
          onClose={handleOrderModalClose}
          user={user}
        />
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