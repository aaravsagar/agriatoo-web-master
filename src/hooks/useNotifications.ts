import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from './useAuth';
import { Order } from '../types';

interface Notification {
  id: string;
  type: 'new_order' | 'order_update' | 'low_stock';
  title: string;
  message: string;
  orderId?: string;
  timestamp: Date;
  read: boolean;
}

export const useNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const playNotificationSound = useCallback(() => {
    try {
      const audio = new Audio('/assets/notification.mp3');
      audio.volume = 0.5;
      audio.play().catch(error => {
        console.error('Error playing notification sound:', error);
      });
    } catch (error) {
      console.error('Error creating audio element:', error);
    }
  }, []);

  const showNotificationModal = useCallback((order: Order) => {
    // Create and show notification modal
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
        <div class="flex items-center mb-4">
          <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
            <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path>
            </svg>
          </div>
          <div>
            <h3 class="text-lg font-semibold text-gray-900">New Order Received!</h3>
            <p class="text-sm text-gray-600">Order ID: ${order.orderId}</p>
          </div>
        </div>
        <div class="mb-4">
          <p class="text-gray-700"><strong>Customer:</strong> ${order.customerName}</p>
          <p class="text-gray-700"><strong>Amount:</strong> ₹${order.totalAmount}</p>
          <p class="text-gray-700"><strong>Items:</strong> ${order.items.length} products</p>
        </div>
        <button onclick="this.parentElement.parentElement.remove()" class="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors">
          Got it!
        </button>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (modal.parentElement) {
        modal.remove();
      }
    }, 10000);
  }, []);

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      timestamp: new Date(),
      read: false
    };

    setNotifications(prev => [newNotification, ...prev.slice(0, 49)]); // Keep only 50 notifications
    setUnreadCount(prev => prev + 1);
  }, []);

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === notificationId 
          ? { ...notif, read: true }
          : notif
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(notif => ({ ...notif, read: true })));
    setUnreadCount(0);
  }, []);

  // Listen for new orders for sellers
  useEffect(() => {
    if (!user || user.role !== 'seller') return;

    const q = query(
      collection(db, 'orders'),
      where('sellerId', '==', user.id),
      where('status', '==', 'received'),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    let lastOrderTime = Date.now();

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const order = {
            id: change.doc.id,
            ...change.doc.data(),
            createdAt: change.doc.data().createdAt?.toDate() || new Date()
          } as Order;

          // Only show notification for orders created after component mount
          if (order.createdAt.getTime() > lastOrderTime) {
            playNotificationSound();
            showNotificationModal(order);
            
            addNotification({
              type: 'new_order',
              title: 'New Order Received',
              message: `Order ${order.orderId} from ${order.customerName} - ₹${order.totalAmount}`,
              orderId: order.orderId
            });
          }
        }
      });
    });

    return () => unsubscribe();
  }, [user, playNotificationSound, showNotificationModal, addNotification]);

  return {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    playNotificationSound
  };
};