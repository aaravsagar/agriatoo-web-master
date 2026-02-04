import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Product } from '../../types';
import { PRODUCT_CATEGORIES } from '../../config/constants';
import { isPincodeValid } from '../../utils/pincodeUtils';
import { Search, ShoppingCart, Truck, Shield, Users } from 'lucide-react';
import { useCart } from '../../hooks/useCart';
import { useStockManager } from '../../hooks/useStockManager';
import ProductCard from '../../components/Customer/ProductCard';

const HomePage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [pincode, setPincode] = useState('');
  const [pincodeValidating, setPincodeValidating] = useState(false);
  const [pincodeValid, setPincodeValid] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const { addToCart, totalItems } = useCart();
  const { subscribeToProductStock, isProductInStock, getProductStock } = useStockManager();
  const navigate = useNavigate();

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory, pincode]);

  // Subscribe to real-time stock updates for displayed products
  useEffect(() => {
    if (products.length > 0) {
      const productIds = products.map(p => p.id);
      const unsubscribe = subscribeToProductStock(productIds, (stockMap) => {
        // Update products with real-time stock
        setProducts(prevProducts => 
          prevProducts.map(product => ({
            ...product,
            stock: stockMap.get(product.id) ?? product.stock
          }))
        );
      });

      return unsubscribe;
    }
  }, [products.map(p => p.id).join(','), subscribeToProductStock]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      // Query active products
      const q = query(
        collection(db, 'products'),
        where('isActive', '==', true)
      );

      const snapshot = await getDocs(q);
      let productsData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || '',
          description: data.description || '',
          price: data.price || 0,
          originalPrice: data.originalPrice,
          discountedPrice: data.discountedPrice,
          category: data.category || '',
          unit: data.unit || 'unit',
          stock: data.stock || 0,
          images: data.images || [],
          sellerName: data.sellerName || '',
          sellerId: data.sellerId || '',
          coveredPincodes: data.coveredPincodes || [],
          isActive: data.isActive || false,
          createdAt: data.createdAt?.toDate() || new Date()
        } as Product;
      });

      // Filter out any invalid products
      productsData = productsData.filter(product => 
        product.name && product.id && typeof product.price === 'number'
      );

      // Frontend filtering by category
      if (selectedCategory) {
        productsData = productsData.filter(product => product.category === selectedCategory);
      }

      // Filter by pincode if provided
      if (pincode) {
        productsData = productsData.filter(product => 
          Array.isArray(product.coveredPincodes) && 
          product.coveredPincodes.includes(pincode)
        );
      }

      // Sort by creation date (newest first) and limit to 20
      productsData.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      productsData = productsData.slice(0, 20);

      console.log('Fetched products:', productsData.length);
      setProducts(productsData);
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePincodeChange = (newPincode: string) => {
    setPincode(newPincode);
    
    if (newPincode.length === 6) {
      setPincodeValidating(true);
      isPincodeValid(newPincode).then(isValid => {
        setPincodeValidating(false);
        setPincodeValid(isValid);
      }).catch(() => {
        setPincodeValidating(false);
        setPincodeValid(false);
      });
    } else {
      setPincodeValid(null);
    }
  };

  const handleAddToCart = (product: Product) => {
    if (!product || !product.id) {
      console.error('Invalid product:', product);
      setNotificationMessage('Invalid product data');
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 3000);
      return;
    }

    // Check real-time stock availability
    if (!isProductInStock(product.id, 1)) {
      setNotificationMessage(`${product.name} is currently out of stock`);
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 3000);
      return;
    }

    // Validate product has delivery coverage
    if (!product.coveredPincodes || product.coveredPincodes.length === 0) {
      setNotificationMessage('This product has no delivery coverage set');
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 3000);
      return;
    }

    try {
      addToCart(product);
      setNotificationMessage(`${product.name} added to cart!`);
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 3000);
    } catch (error) {
      console.error('Error adding to cart:', error);
      setNotificationMessage('Failed to add item to cart');
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 3000);
    }
  };

  const filteredProducts = products.filter(product => {
    if (!product || !product.name) return false;
    
    const searchLower = searchTerm.toLowerCase();
    const nameMatch = product.name.toLowerCase().includes(searchLower);
    const descMatch = product.description?.toLowerCase().includes(searchLower) || false;
    
    return nameMatch || descMatch;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Notification Toast */}
      {showNotification && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-2 animate-slide-in">
          <ShoppingCart className="w-5 h-5" />
          <span>{notificationMessage}</span>
        </div>
      )}

      {/* Hero Section */}
      <section className="bg-gradient-to-r from-green-600 to-green-800 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Welcome to <span className="text-green-300">AGRIATOO</span>
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-green-100">
              Your trusted marketplace for quality agricultural products
            </p>
            <div className="flex flex-col md:flex-row gap-4 max-w-md mx-auto">
              <input
                type="text"
                placeholder="Enter your PIN code"
                value={pincode}
                onChange={(e) => handlePincodeChange(e.target.value)}
                maxLength={6}
                className="flex-1 px-4 py-3 rounded-lg text-gray-900 placeholder-gray-500 relative"
              />
              {pincodeValidating && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-green-600 rounded-full animate-spin"></div>
                </div>
              )}
              <button 
                onClick={fetchProducts}
                disabled={pincodeValidating || (pincode.length === 6 && !pincodeValid)}
                className="bg-green-500 hover:bg-green-400 px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Find Products
              </button>
            </div>
            {pincode.length === 6 && pincodeValid === false && (
              <p className="text-red-300 text-sm mt-2 text-center">
                Invalid PIN code. Please enter a valid Indian PIN code.
              </p>
            )}
            {pincode.length === 6 && pincodeValid === true && (
              <p className="text-green-300 text-sm mt-2 text-center">
                ✓ Valid PIN code
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Truck className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Fast Delivery</h3>
              <p className="text-gray-600">Quick delivery to your doorstep across India</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Quality Assured</h3>
              <p className="text-gray-600">Only genuine products from verified sellers</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Trusted Network</h3>
              <p className="text-gray-600">Connect with farmers and sellers nationwide</p>
            </div>
          </div>
        </div>
      </section>

      {/* Product Search and Filter */}
      <section className="py-8 bg-gray-50 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">All Categories</option>
              {PRODUCT_CATEGORIES.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            
            {/* Cart Button with Badge */}
            <Link
              to="/cart"
              className="relative bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
            >
              <ShoppingCart className="w-5 h-5" />
              <span>Cart</span>
              {totalItems > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </Link>
          </div>
        </div>
      </section>

      {/* Products Grid */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">
            {selectedCategory ? `${selectedCategory} Products` : 'Featured Products'}
          </h2>

          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-2 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Loading products...</p>
            </div>
          ) : filteredProducts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredProducts.map(product => (
                product && product.id ? (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAddToCart={() => handleAddToCart(product)}
                  />
                ) : null
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-600 text-lg">
                {pincode 
                  ? `No products available for PIN code ${pincode}` 
                  : 'No products found'
                }
              </p>
              <p className="text-gray-500 mt-2">
                Try searching with a different PIN code or category
              </p>
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-green-600 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
              ? `No products available for PIN code ${pincode}${pincodeValid === false ? ' (Invalid PIN code)' : ''}` 
          <p className="text-xl mb-8 text-green-100">
            Browse our complete catalog and find the best agricultural products
          </p>
          <button
            onClick={() => navigate('/cart')}
            className="inline-flex items-center bg-white text-green-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
          >
            <ShoppingCart className="w-5 h-5 mr-2" />
            Try searching with a different valid PIN code or category
          </button>
        </div>
      </section>

      <style>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default HomePage;