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
  const [scannerKey, setScannerKey] = useState(0);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const toastIdCounter = useRef(0);
  const isProcessingRef = useRef(false);

  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio('/assets/beep.mp3');
    audioRef.current.volume = 0.5;
  }, []);

  // Toast notification functions
  const showToast = (message: string, type: 'error' | 'warning' | 'success' = 'error') => {
    const id = toastIdCounter.current++;
    setToasts(prev => [...prev, { id, message, type }]);
    
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 3000);
  };

  // Audio feedback functions
  const playBeep = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(error => {
        console.error('Error playing beep:', error);
      });
    }
  };

  const startScanner = () => {
    setCurrentOrder(null);
    setShowOrderDetails(false);
    isProcessingRef.current = false;
    setScannerKey(prev => prev + 1);
    setShowQRScanner(true);
  };

  const stopScanner = () => {
    setShowQRScanner(false);
    setScannerKey(prev => prev + 1);
  };

  const handleQRScan = async (scannedOrderId: string) => {
    if (isProcessingRef.current) {
      console.log('Already processing a scan, ignoring...');
      return;
    }
    
    if (!scannedOrderId.trim()) return;

    isProcessingRef.current = true;
    setShowQRScanner(false);

    try {
      // Play beep sound once
      playBeep();

      const q = query(
        collection(db, 'orders'),
        where('orderId', '==', scannedOrderId.trim())
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        showToast('Order not found: ' + scannedOrderId, 'error');
        setTimeout(() => startScanner(), 2000);
        return;
      }

      const orderDoc = snapshot.docs[0];
      const order = {
        id: orderDoc.id,
        ...orderDoc.data(),
        createdAt: orderDoc.data().createdAt?.toDate() || new Date(),
        updatedAt: orderDoc.data().updatedAt?.toDate() || new Date()
      } as Order;

      // ❌ CRITICAL FIX: Do NOT auto-mark as Out for Delivery
      // Just show the order details and let user choose action
      setCurrentOrder(order);
      setShowOrderDetails(true);

    } catch (error) {
      console.error('Error scanning order:', error);
      showToast('Error scanning order. Please try again.', 'error');
      setTimeout(() => startScanner(), 2000);
    } finally {
      isProcessingRef.current = false;
    }
  };

  const handleOrderModalClose = () => {
    setShowOrderDetails(false);
    setCurrentOrder(null);
    setTimeout(() => startScanner(), 500);
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
              <span className="text-lg font-medium">Start Scanner</span>
            </button>
          ) : (
            <div className="space-y-4">
              <QRScanner
                key={scannerKey}
                onScan={handleQRScan}
                onError={(error) => {
                  console.error('QR Scanner error:', error);
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
          onOrderUpdate={() => {
            // Refresh the order data after update
            handleOrderModalClose();
          }}
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