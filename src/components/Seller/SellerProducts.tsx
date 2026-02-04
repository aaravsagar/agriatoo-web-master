import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../hooks/useAuth';
import { useStockManager } from '../../hooks/useStockManager';
import { Product } from '../../types';
import { PRODUCT_CATEGORIES } from '../../config/constants';
import { generateCoveredPincodes, isPincodeValid } from '../../utils/pincodeUtils';
import { Plus, CreditCard as Edit, Trash2, Package, AlertTriangle, RefreshCw } from 'lucide-react';

const SellerProducts: React.FC = () => {
  const { user } = useAuth();
  const { subscribeToProductStock, updateStock, lowStockAlerts, dismissLowStockAlert } = useStockManager();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [restockProduct, setRestockProduct] = useState<Product | null>(null);
  const [restockQuantity, setRestockQuantity] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: PRODUCT_CATEGORIES[0],
    price: '',
    originalPrice: '',
    discountedPrice: '',
    unit: 'kg',
    stock: '',
    images: ['']
  });

  useEffect(() => {
    if (user) {
      fetchProducts();
    }
  }, [user]);

  // Subscribe to real-time stock updates for seller's products
  useEffect(() => {
    if (products.length > 0) {
      const productIds = products.map(p => p.id);
      const unsubscribe = subscribeToProductStock(productIds, (stockMap) => {
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
    if (!user) return;

    try {
      // Simplified query without orderBy
      const q = query(
        collection(db, 'products'),
        where('sellerId', '==', user.id)
      );
      const snapshot = await getDocs(q);
      let productsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as Product[];
      
      // Frontend sorting by creation date (newest first)
      productsData.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      setProducts(productsData);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    console.log('Creating product with user data:', user);

    // Fetch fresh user data to ensure we have latest profile
    try {
      const userDoc = await getDoc(doc(db, 'users', user.id));
      if (!userDoc.exists()) {
        alert('User profile not found. Please refresh and try again.');
        return;
      }

      const userData = userDoc.data();
      console.log('Fresh user data:', userData);

      // Validate seller has pincode set
      if (!userData.pincode) {
        alert('Please set your pincode in the profile section before adding products');
        return;
      }

      // Validate pincode is valid
      if (!isPincodeValid(userData.pincode)) {
        alert('Your pincode is invalid. Please update your profile with a valid Gujarat pincode.');
        return;
      }

      // Check if user has covered pincodes
      if (!userData.coveredPincodes || userData.coveredPincodes.length === 0) {
        alert('No delivery areas found. Please update your profile to generate delivery coverage.');
        return;
      }

      setLoading(true);

      // Use fresh user data for product creation
      const productData = {
        name: formData.name,
        description: formData.description,
        category: formData.category,
        price: parseFloat(formData.price),
        originalPrice: formData.originalPrice ? parseFloat(formData.originalPrice) : undefined,
        discountedPrice: formData.discountedPrice ? parseFloat(formData.discountedPrice) : undefined,
        unit: formData.unit,
        stock: parseInt(formData.stock),
        images: formData.images.filter(img => img.trim() !== ''),
        sellerId: user.id,
        sellerName: userData.name || user.name,
        sellerPincode: userData.pincode,
        sellerAddress: userData.address || '',
        sellerShopName: userData.shopName || userData.name || user.name,
        sellerDeliveryRadius: userData.deliveryRadius || 20,
        coveredPincodes: userData.coveredPincodes,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      console.log('Creating product with data:', productData);

      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), {
          ...productData,
          updatedAt: new Date()
        });
        console.log('Product updated successfully');
      } else {
        const docRef = await addDoc(collection(db, 'products'), productData);
        console.log('Product created with ID:', docRef.id);
      }

      await fetchProducts();
      setShowModal(false);
      resetForm();
      
      alert(`Product ${editingProduct ? 'updated' : 'created'} successfully! It can be delivered to ${userData.coveredPincodes.length} areas in Gujarat.`);

    } catch (error: any) {
      console.error('Error saving product:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Add this helper function to get fresh user data
  const getFreshUserData = async () => {
    if (!user) return null;
    
    try {
      const userDoc = await getDoc(doc(db, 'users', user.id));
      if (userDoc.exists()) {
        return userDoc.data();
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
    return null;
  };

  const openModal = async (product?: Product) => {
    const freshUserData = await getFreshUserData();
    
    if (!freshUserData?.pincode) {
      alert('Please complete your profile by setting your pincode before adding products.');
      return;
    }
    if (!freshUserData.coveredPincodes || freshUserData.coveredPincodes.length === 0) {
      alert('No delivery areas found. Please update your profile to generate delivery coverage.');
      return;
    }

    // Now proceed to open the modal
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        description: product.description,
        category: product.category,
        price: product.price.toString(),
        unit: product.unit,
        stock: product.stock.toString(),
        images: product.images.length > 0 ? product.images : ['']
      });
    } else {
      resetForm();
    }
    
    setShowModal(true);
  };

  const handleDelete = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      await deleteDoc(doc(db, 'products', productId));
      await fetchProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: PRODUCT_CATEGORIES[0],
      price: '',
      originalPrice: '',
      discountedPrice: '',
      unit: 'kg',
      stock: '',
      images: ['']
    });
    setEditingProduct(null);
  };

  const handleRestock = async () => {
    if (!restockProduct || !restockQuantity) return;
    
    const newStock = parseInt(restockQuantity);
    if (isNaN(newStock) || newStock < 0) {
      alert('Please enter a valid stock quantity');
      return;
    }

    const success = await updateStock(restockProduct.id, newStock);
    if (success) {
      setShowRestockModal(false);
      setRestockProduct(null);
      setRestockQuantity('');
      dismissLowStockAlert(restockProduct.id);
      alert(`Stock updated successfully! ${restockProduct.name} now has ${newStock} units.`);
    } else {
      alert('Failed to update stock. Please try again.');
    }
  };

  const addImageField = () => {
    setFormData({
      ...formData,
      images: [...formData.images, '']
    });
  };

  const updateImageField = (index: number, value: string) => {
    const newImages = [...formData.images];
    newImages[index] = value;
    setFormData({
      ...formData,
      images: newImages
    });
  };

  const removeImageField = (index: number) => {
    const newImages = formData.images.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      images: newImages.length > 0 ? newImages : ['']
    });
  };

  return (
    <div>
      {/* Low Stock Alerts */}
      {lowStockAlerts.length > 0 && (
        <div className="mb-6 bg-orange-900 border border-orange-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-orange-300 mb-3 flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            Low Stock Alerts ({lowStockAlerts.length})
          </h3>
          <div className="space-y-2">
            {lowStockAlerts.map(alert => (
              <div key={alert.productId} className="flex items-center justify-between bg-orange-800 bg-opacity-50 rounded-lg p-3">
                <div>
                  <p className="text-orange-200 font-medium">{alert.productName}</p>
                  <p className="text-orange-300 text-sm">
                    Only {alert.currentStock} units left (threshold: {alert.threshold})
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      const product = products.find(p => p.id === alert.productId);
                      if (product) {
                        setRestockProduct(product);
                        setRestockQuantity(product.stock.toString());
                        setShowRestockModal(true);
                      }
                    }}
                    className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 flex items-center space-x-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Restock</span>
                  </button>
                  <button
                    onClick={() => dismissLowStockAlert(alert.productId)}
                    className="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Restock Modal */}
      {showRestockModal && restockProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700">
            <h3 className="text-lg font-medium mb-4 text-white">Update Stock</h3>
            
            <div className="mb-4">
              <p className="text-gray-300 mb-2">Product: <strong>{restockProduct.name}</strong></p>
              <p className="text-gray-400 text-sm">Current Stock: {restockProduct.stock} {restockProduct.unit}</p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                New Stock Quantity
              </label>
              <input
                type="number"
                value={restockQuantity}
                onChange={(e) => setRestockQuantity(e.target.value)}
                min="0"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Enter new stock quantity"
              />
            </div>

            <div className="flex space-x-2">
              <button
                onClick={() => {
                  setShowRestockModal(false);
                  setRestockProduct(null);
                  setRestockQuantity('');
                }}
                className="flex-1 px-4 py-2 border border-gray-600 text-gray-300 rounded-md hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleRestock}
                disabled={!restockQuantity || parseInt(restockQuantity) < 0}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                Update Stock
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">My Products</h2>
        <button
          onClick={() => openModal()}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
        >
          <Plus className="w-5 h-5" />
          <span>Add Product</span>
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="w-8 h-8 border-2 border-green-200 border-t-green-400 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading products...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map(product => (
            <div key={product.id} className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
              <div className="aspect-w-16 aspect-h-9 bg-gray-700">
                {product.images && product.images.length > 0 ? (
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    className="w-full h-48 object-cover"
                  />
                ) : (
                  <div className="w-full h-48 bg-gradient-to-br from-green-900 to-green-800 flex items-center justify-center">
                    <Package className="w-12 h-12 text-green-400" />
                  </div>
                )}
              </div>
              
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-lg font-semibold text-white line-clamp-2">
                    {product.name}
                  </h3>
                  <span className="text-sm text-gray-400 bg-gray-700 px-2 py-1 rounded">
                    {product.category}
                  </span>
                </div>
                
                <p className="text-gray-300 text-sm mb-3 line-clamp-2">
                  {product.description}
                </p>
                
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm text-gray-400">
                    <p>Stock: {product.stock} {product.unit}</p>
                    <p>Coverage: {product.coveredPincodes?.length || 0} areas</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-400">
                      ₹{product.price}
                    </p>
                    {product.originalPrice && product.originalPrice > product.price && (
                      <p className="text-sm text-gray-500 line-through">
                        ₹{product.originalPrice}
                      </p>
                    )}
                    <p className="text-sm text-gray-400">per {product.unit}</p>
                  </div>
                </div>
                
                {/* Stock status indicators */}
                <div className="mb-3">
                  {product.stock === 0 && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-900 text-red-300 mr-2">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Out of Stock
                    </span>
                  )}
                  {product.stock > 0 && product.stock <= 5 && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-900 text-orange-300 mr-2">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Low Stock
                    </span>
                  )}
                </div>
                
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    product.isActive 
                      ? 'bg-green-900 text-green-300' 
                      : 'bg-red-900 text-red-300'
                  }`}>
                    {product.isActive ? 'Active' : 'Inactive'}
                  </span>
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        setRestockProduct(product);
                        setRestockQuantity(product.stock.toString());
                        setShowRestockModal(true);
                      }}
                      className="text-green-400 hover:text-green-300"
                      title="Update Stock"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openModal(product)}
                      className="text-blue-400 hover:text-blue-300"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(product.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {products.length === 0 && !loading && (
        <div className="text-center py-12">
          <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No products yet</h3>
          <p className="text-gray-400 mb-4">Start by adding your first product</p>
          <button
            onClick={() => openModal()}
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            Add Product
          </button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-96 overflow-y-auto border border-gray-700">
            <h3 className="text-lg font-medium mb-4 text-white">
              {editingProduct ? 'Edit Product' : 'Add New Product'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Product Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {PRODUCT_CATEGORIES.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>

              <textarea
                placeholder="Product Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
                rows={3}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input
                  type="number"
                  placeholder="Price"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  required
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                
                <input
                  type="number"
                  placeholder="Original Price (optional)"
                  value={formData.originalPrice}
                  onChange={(e) => setFormData({ ...formData, originalPrice: e.target.value })}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                
                <input
                  type="number"
                  placeholder="Discounted Price (optional)"
                  value={formData.discountedPrice}
                  onChange={(e) => setFormData({ ...formData, discountedPrice: e.target.value })}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <select
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="kg">kg</option>
                  <option value="liter">liter</option>
                  <option value="piece">piece</option>
                  <option value="packet">packet</option>
                  <option value="bag">bag</option>
                </select>
                
                <input
                  type="number"
                  placeholder="Stock Quantity"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                  required
                  min="0"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Product Images (URLs)</label>
                {formData.images.map((image, index) => (
                  <div key={index} className="flex space-x-2 mb-2">
                    <input
                      type="url"
                      placeholder="Image URL"
                      value={image}
                      onChange={(e) => updateImageField(index, e.target.value)}
                      className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    {formData.images.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeImageField(index)}
                        className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addImageField}
                  className="text-green-400 hover:text-green-300 text-sm"
                >
                  + Add another image
                </button>
              </div>

              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-600 text-gray-300 rounded-md hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : (editingProduct ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SellerProducts;