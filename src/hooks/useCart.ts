import { useState, useEffect } from 'react';
import { CartItem, Product } from '../types';
import { useStockManager } from './useStockManager';

const CART_STORAGE_KEY = 'agriatoo_cart';

export const useCart = () => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const { isProductInStock } = useStockManager();

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      console.log('🔄 Loading cart from localStorage...');
      const savedCart = localStorage.getItem(CART_STORAGE_KEY);
      
      if (savedCart) {
        const parsedCart = JSON.parse(savedCart);
        console.log('✅ Cart loaded from localStorage:', parsedCart);
        
        // Validate cart items
        const validCart = parsedCart.filter((item: any) => {
          const isValid = item && 
                         item.productId && 
                         item.product && 
                         item.quantity > 0;
          
          if (!isValid) {
            console.warn('⚠️ Invalid cart item removed:', item);
          }
          return isValid;
        });
        
        setCartItems(validCart);
        console.log('✅ Valid cart items:', validCart.length);
      } else {
        console.log('ℹ️ No saved cart found');
      }
    } catch (error) {
      console.error('❌ Error loading cart from localStorage:', error);
      localStorage.removeItem(CART_STORAGE_KEY);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  // Save cart to localStorage whenever it changes (only after initialization)
  useEffect(() => {
    if (!isInitialized) {
      console.log('⏳ Waiting for initialization...');
      return;
    }

    try {
      console.log('💾 Saving cart to localStorage:', cartItems);
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
      console.log('✅ Cart saved successfully');
      
      // Dispatch custom event for other components to listen
      window.dispatchEvent(new CustomEvent('cartUpdated', { 
        detail: { itemCount: cartItems.length } 
      }));
    } catch (error) {
      console.error('❌ Error saving cart to localStorage:', error);
    }
  }, [cartItems, isInitialized]);

  const addToCart = (product: Product, quantity: number = 1) => {
    console.log('🛒 Adding to cart:', product.name, 'Qty:', quantity);
    
    if (!product || !product.id) {
      console.error('❌ Invalid product:', product);
      return;
    }

    // Check stock availability before adding
    if (!isProductInStock(product.id, quantity)) {
      console.warn('❌ Product out of stock:', product.name);
      throw new Error(`${product.name} is out of stock or insufficient quantity available`);
    }

    setCartItems(prev => {
      const existingItem = prev.find(item => item.productId === product.id);
      
      if (existingItem) {
        console.log('📦 Product already in cart, updating quantity');
        const requestedQuantity = existingItem.quantity + quantity;
        
        // Check if requested quantity is available
        if (!isProductInStock(product.id, requestedQuantity)) {
          console.warn('❌ Insufficient stock for requested quantity');
          throw new Error(`Only ${product.stock} units available for ${product.name}`);
        }
        
        const newQuantity = Math.min(requestedQuantity, product.stock);
        const updated = prev.map(item =>
          item.productId === product.id
            ? { ...item, quantity: newQuantity }
            : item
        );
        console.log('✅ Cart updated:', updated);
        return updated;
      }
      
      // Add new item to cart
      console.log('➕ Adding new item to cart');
      const newItem: CartItem = { 
        productId: product.id, 
        product: product, 
        quantity: Math.min(quantity, product.stock) 
      };
      const updated = [...prev, newItem];
      console.log('✅ Cart updated:', updated);
      return updated;
    });
  };

  const updateQuantity = (productId: string, quantity: number) => {
    console.log('🔄 Updating quantity for product:', productId, 'New qty:', quantity);
    
    if (quantity <= 0) {
      console.log('🗑️ Quantity is 0, removing item');
      removeFromCart(productId);
      return;
    }
    
    // Check stock availability for new quantity
    if (!isProductInStock(productId, quantity)) {
      console.warn('❌ Insufficient stock for requested quantity');
      return;
    }
    
    setCartItems(prev =>
      prev.map(item => {
        if (item.productId === productId) {
          const newQuantity = Math.min(quantity, item.product.stock);
          console.log('✅ Updated quantity:', newQuantity);
          return { ...item, quantity: newQuantity };
        }
        return item;
      })
    );
  };

  const removeFromCart = (productId: string) => {
    console.log('🗑️ Removing product from cart:', productId);
    setCartItems(prev => {
      const updated = prev.filter(item => item.productId !== productId);
      console.log('✅ Cart after removal:', updated);
      return updated;
    });
  };

  const clearCart = () => {
    console.log('🧹 Clearing cart');
    setCartItems([]);
    localStorage.removeItem(CART_STORAGE_KEY);
    console.log('✅ Cart cleared');
  };

  const totalAmount = cartItems.reduce(
    (sum, item) => sum + (item.product.price * item.quantity),
    0
  );

  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const isInCart = (productId: string): boolean => {
    return cartItems.some(item => item.productId === productId);
  };

  const getCartItemQuantity = (productId: string): number => {
    const item = cartItems.find(item => item.productId === productId);
    return item ? item.quantity : 0;
  };

  console.log('🛒 Cart State - Items:', cartItems.length, 'Total:', totalAmount, 'Initialized:', isInitialized);

  return {
    cartItems,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    totalAmount,
    totalItems,
    isInCart,
    getCartItemQuantity,
    isInitialized
  };
};