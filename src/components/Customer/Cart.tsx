import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useCart } from '../../hooks/useCart';
import { generateUniqueOrderId } from '../../utils/qrUtils';
import { isPincodeValid } from '../../utils/pincodeUtils';
import { Plus, Minus, Trash2, ArrowLeft } from 'lucide-react';
import { ORDER_STATUSES } from '../../config/constants';

const Cart: React.FC = () => {
  const { cartItems, updateQuantity, removeFromCart, clearCart, totalAmount } = useCart();
  const navigate = useNavigate();
  
  const [customerDetails, setCustomerDetails] = useState({
    name: '',
    phone: '',
    address: '',
    pincode: ''
  });
  const [isCheckout, setIsCheckout] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleQuantityChange = (productId: string, change: number) => {
    const item = cartItems.find(item => item.productId === productId);
    if (item) {
      updateQuantity(productId, item.quantity + change);
    }
  };

  const validateCheckout = () => {
    if (!customerDetails.name.trim()) return 'Name is required';
    if (!customerDetails.phone.trim()) return 'Phone number is required';
    if (!/^[6-9]\d{9}$/.test(customerDetails.phone)) return 'Invalid phone number';
    if (!customerDetails.address.trim()) return 'Address is required';
    if (!customerDetails.pincode.trim()) return 'PIN code is required';
    if (!isPincodeValid(customerDetails.pincode)) return 'Invalid PIN code';
    
    // Check if all products are available for the pincode
    const unavailableProducts = cartItems.filter(item => 
      !item.product.coveredPincodes.includes(customerDetails.pincode)
    );
    if (unavailableProducts.length > 0) {
      return `Some products are not available for PIN code ${customerDetails.pincode}`;
    }
    
    return null;
  };

  const handlePlaceOrder = async () => {
    const validationError = validateCheckout();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Group items by seller
      const sellerGroups = cartItems.reduce((groups, item) => {
        const sellerId = item.product.sellerId;
        if (!groups[sellerId]) {
          groups[sellerId] = [];
        }
        groups[sellerId].push(item);
        return groups;
      }, {} as Record<string, typeof cartItems>);

      // Create separate orders for each seller
      const orderPromises = Object.entries(sellerGroups).map(async ([sellerId, items]) => {
        const sellerProduct = items[0].product;
        const orderId = generateUniqueOrderId();
        
        const orderData = {
          orderId,
          customerName: customerDetails.name,
          customerPhone: customerDetails.phone,
          customerAddress: customerDetails.address,
          customerPincode: customerDetails.pincode,
          sellerId,
          sellerName: sellerProduct.sellerName,
          sellerShopName: sellerProduct.sellerName, // Assuming shop name is same as seller name
          sellerAddress: '', // Will be updated by seller
          items: items.map(item => ({
            productId: item.productId,
            productName: item.product.name,
            price: item.product.price,
            quantity: item.quantity,
            unit: item.product.unit
          })),
          totalAmount: items.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
          status: ORDER_STATUSES.RECEIVED,
          paymentMethod: 'cod',
          createdAt: new Date(),
          updatedAt: new Date()
        };

        return addDoc(collection(db, 'orders'), orderData);
      });

      await Promise.all(orderPromises);
      
      clearCart();
      alert('Orders placed successfully! You will receive confirmation shortly.');
      navigate('/');
    } catch (error) {
      console.error('Error placing orders:', error);
      setError('Failed to place orders. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-16">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Your cart is empty</h2>
            <p className="text-gray-600 mb-8">Add some products to get started!</p>
            <Link
              to="/"
              className="inline-flex items-center bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Shopping Cart</h1>
          <Link
            to="/"
            className="flex items-center text-green-600 hover:text-green-700"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Continue Shopping
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-md">
          {/* Cart Items */}
          <div className="p-6">
            {cartItems.map(item => (
              <div key={item.productId} className="flex items-center py-4 border-b border-gray-200 last:border-b-0">
                <div className="w-16 h-16 bg-gray-200 rounded-lg flex-shrink-0">
                  {item.product.images?.[0] ? (
                    <img
                      src={item.product.images[0]}
                      alt={item.product.name}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-full h-full bg-green-100 rounded-lg flex items-center justify-center">
                      <span className="text-green-600 text-xs">No Image</span>
                    </div>
                  )}
                </div>

                <div className="ml-4 flex-grow">
                  <h3 className="text-lg font-medium text-gray-900">{item.product.name}</h3>
                  <p className="text-sm text-gray-600">By {item.product.sellerName}</p>
                  <p className="text-lg font-semibold text-green-600">
                    ₹{item.product.price}/{item.product.unit}
                  </p>
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => handleQuantityChange(item.productId, -1)}
                    className="p-1 rounded-full bg-gray-100 hover:bg-gray-200"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-12 text-center font-medium">{item.quantity}</span>
                  <button
                    onClick={() => handleQuantityChange(item.productId, 1)}
                    className="p-1 rounded-full bg-gray-100 hover:bg-gray-200"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <div className="ml-4 text-right">
                  <p className="text-lg font-semibold">₹{(item.product.price * item.quantity).toFixed(2)}</p>
                  <button
                    onClick={() => removeFromCart(item.productId)}
                    className="text-red-600 hover:text-red-700 mt-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Checkout Section */}
          <div className="border-t border-gray-200 p-6">
            <div className="flex justify-between items-center mb-6">
              <span className="text-xl font-semibold">Total: ₹{totalAmount.toFixed(2)}</span>
              <button
                onClick={() => setIsCheckout(!isCheckout)}
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                {isCheckout ? 'Hide Checkout' : 'Proceed to Checkout'}
              </button>
            </div>

            {isCheckout && (
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">Customer Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={customerDetails.name}
                    onChange={(e) => setCustomerDetails({ ...customerDetails, name: e.target.value })}
                    className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <input
                    type="tel"
                    placeholder="Phone Number"
                    value={customerDetails.phone}
                    onChange={(e) => setCustomerDetails({ ...customerDetails, phone: e.target.value })}
                    className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <input
                    type="text"
                    placeholder="PIN Code"
                    value={customerDetails.pincode}
                    onChange={(e) => setCustomerDetails({ ...customerDetails, pincode: e.target.value })}
                    className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <textarea
                  placeholder="Complete Address"
                  value={customerDetails.address}
                  onChange={(e) => setCustomerDetails({ ...customerDetails, address: e.target.value })}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 mb-4"
                />

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4">
                    {error}
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-600">Payment Method: Cash on Delivery</p>
                  <button
                    onClick={handlePlaceOrder}
                    disabled={loading}
                    className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? 'Placing Order...' : 'Place Order'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;