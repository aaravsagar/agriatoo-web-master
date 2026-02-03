import { useState, useEffect, useCallback } from 'react';
import { doc, updateDoc, onSnapshot, writeBatch, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Product, CartItem } from '../types';

interface StockUpdate {
  productId: string;
  quantityChange: number;
  orderId?: string;
}

interface LowStockAlert {
  productId: string;
  productName: string;
  currentStock: number;
  threshold: number;
}

export const useStockManager = () => {
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlert[]>([]);
  const [stockUpdates, setStockUpdates] = useState<Map<string, number>>(new Map());

  // Real-time stock update function
  const updateProductStock = useCallback(async (updates: StockUpdate[]): Promise<boolean> => {
    try {
      const batch = writeBatch(db);
      const updatedProducts: { [key: string]: number } = {};

      // Process each stock update
      for (const update of updates) {
        const productRef = doc(db, 'products', update.productId);
        
        // Get current product data
        const productDoc = await getDoc(productRef);
        if (!productDoc.exists()) {
          console.error(`Product ${update.productId} not found`);
          continue;
        }

        const currentStock = productDoc.data().stock || 0;
        const newStock = Math.max(0, currentStock - update.quantityChange);
        
        // Update in batch
        batch.update(productRef, {
          stock: newStock,
          updatedAt: new Date(),
          lastStockUpdate: new Date(),
          ...(update.orderId && { lastOrderId: update.orderId })
        });

        updatedProducts[update.productId] = newStock;
        
        // Check for low stock
        const lowStockThreshold = 5; // Can be made configurable per product
        if (newStock <= lowStockThreshold && currentStock > lowStockThreshold) {
          setLowStockAlerts(prev => [
            ...prev.filter(alert => alert.productId !== update.productId),
            {
              productId: update.productId,
              productName: productDoc.data().name || 'Unknown Product',
              currentStock: newStock,
              threshold: lowStockThreshold
            }
          ]);
        }
      }

      // Commit all updates atomically
      await batch.commit();
      
      // Update local stock state
      setStockUpdates(prev => {
        const newMap = new Map(prev);
        Object.entries(updatedProducts).forEach(([productId, stock]) => {
          newMap.set(productId, stock);
        });
        return newMap;
      });

      console.log('✅ Stock updated successfully:', updatedProducts);
      return true;
    } catch (error) {
      console.error('❌ Error updating stock:', error);
      return false;
    }
  }, []);

  // Reduce stock when order is placed
  const reduceStockForOrder = useCallback(async (cartItems: CartItem[], orderId: string): Promise<boolean> => {
    const updates: StockUpdate[] = cartItems.map(item => ({
      productId: item.productId,
      quantityChange: item.quantity,
      orderId
    }));

    return await updateProductStock(updates);
  }, [updateProductStock]);

  // Restore stock when order is cancelled
  const restoreStockForOrder = useCallback(async (cartItems: CartItem[], orderId: string): Promise<boolean> => {
    const updates: StockUpdate[] = cartItems.map(item => ({
      productId: item.productId,
      quantityChange: -item.quantity, // Negative to add back stock
      orderId
    }));

    return await updateProductStock(updates);
  }, [updateProductStock]);

  // Subscribe to real-time stock updates for specific products
  const subscribeToProductStock = useCallback((productIds: string[], callback: (stocks: Map<string, number>) => void) => {
    const unsubscribes: (() => void)[] = [];

    productIds.forEach(productId => {
      const unsubscribe = onSnapshot(doc(db, 'products', productId), (doc) => {
        if (doc.exists()) {
          const stock = doc.data().stock || 0;
          setStockUpdates(prev => {
            const newMap = new Map(prev);
            newMap.set(productId, stock);
            callback(newMap);
            return newMap;
          });
        }
      });
      unsubscribes.push(unsubscribe);
    });

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, []);

  // Get current stock for a product
  const getProductStock = useCallback((productId: string): number | null => {
    return stockUpdates.get(productId) ?? null;
  }, [stockUpdates]);

  // Check if product is in stock
  const isProductInStock = useCallback((productId: string, requestedQuantity: number = 1): boolean => {
    const currentStock = stockUpdates.get(productId);
    return currentStock !== undefined ? currentStock >= requestedQuantity : true;
  }, [stockUpdates]);

  // Dismiss low stock alert
  const dismissLowStockAlert = useCallback((productId: string) => {
    setLowStockAlerts(prev => prev.filter(alert => alert.productId !== productId));
  }, []);

  // Manually update stock (for seller restocking)
  const updateStock = useCallback(async (productId: string, newStock: number): Promise<boolean> => {
    try {
      await updateDoc(doc(db, 'products', productId), {
        stock: newStock,
        updatedAt: new Date(),
        lastStockUpdate: new Date()
      });

      setStockUpdates(prev => {
        const newMap = new Map(prev);
        newMap.set(productId, newStock);
        return newMap;
      });

      // Remove low stock alert if stock is restored
      if (newStock > 5) {
        dismissLowStockAlert(productId);
      }

      return true;
    } catch (error) {
      console.error('Error updating stock:', error);
      return false;
    }
  }, [dismissLowStockAlert]);

  return {
    // Stock operations
    reduceStockForOrder,
    restoreStockForOrder,
    updateStock,
    
    // Stock queries
    getProductStock,
    isProductInStock,
    
    // Real-time subscriptions
    subscribeToProductStock,
    
    // Alerts
    lowStockAlerts,
    dismissLowStockAlert,
    
    // Current stock state
    stockUpdates
  };
};