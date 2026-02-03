import React, { useState } from 'react';
import { ShoppingCart, MapPin, Check, AlertTriangle } from 'lucide-react';
import { Product } from '../../types';
import { useStockManager } from '../../hooks/useStockManager';

interface ProductCardProps {
  product: Product;
  onAddToCart: () => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart }) => {
  const [isAdding, setIsAdding] = useState(false);
  const { isProductInStock, getProductStock } = useStockManager();

  // Defensive check - if product is undefined or null, don't render
  if (!product) {
    console.error('ProductCard received undefined product');
    return null;
  }

  const handleAddToCart = () => {
    setIsAdding(true);
    onAddToCart();
    
    // Reset the button state after animation
    setTimeout(() => {
      setIsAdding(false);
    }, 1000);
  };

  // Safe access to product properties with defaults
  const productName = product.name || 'Unnamed Product';
  const productDescription = product.description || 'No description available';
  const productCategory = product.category || 'Uncategorized';
  const productPrice = product.price || 0;
  const productUnit = product.unit || 'unit';
  const productStock = getProductStock(product.id) ?? product.stock || 0;
  const productSellerName = product.sellerName || 'Unknown Seller';
  const productImages = product.images || [];
  const isInStock = isProductInStock(product.id, 1);
  const isLowStock = productStock > 0 && productStock <= 5;

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden">
      <div className="aspect-w-16 aspect-h-9 bg-gray-200">
        {productImages.length > 0 && productImages[0] ? (
          <img
            src={productImages[0]}
            alt={productName}
            className="w-full h-48 object-cover"
            onError={(e) => {
              // Handle broken image
              e.currentTarget.style.display = 'none';
              e.currentTarget.parentElement!.innerHTML = `
                <div class="w-full h-48 bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center">
                  <span class="text-green-600 text-sm font-medium">Image Not Available</span>
                </div>
              `;
            }}
          />
        ) : (
          <div className="w-full h-48 bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center">
            <span className="text-green-600 text-sm font-medium">No Image</span>
          </div>
        )}
      </div>
      
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
            {productName}
          </h3>
          <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded whitespace-nowrap ml-2">
            {productCategory}
          </span>
        </div>
        
        <p className="text-gray-600 text-sm mb-3 line-clamp-2">
          {productDescription}
        </p>
        
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-1 text-gray-500 text-sm">
            <MapPin className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">By {productSellerName}</span>
          </div>
          <div className={`text-sm whitespace-nowrap ml-2 flex items-center space-x-1 ${
            productStock === 0 ? 'text-red-600' : 
            isLowStock ? 'text-orange-600' : 'text-gray-500'
          }`}>
            {productStock === 0 && <AlertTriangle className="w-3 h-3" />}
            <span>Stock: {productStock} {productUnit}</span>
          </div>
        </div>
        
        {/* Show delivery coverage info */}
        <div className="mb-3">
          <div className="text-xs text-gray-500">
            Delivers to: {product.coveredPincodes?.length || 0} areas in Gujarat
          </div>
        </div>

        {/* Stock status badges */}
        {productStock === 0 && (
          <div className="mb-3">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Out of Stock
            </span>
          </div>
        )}
        
        {isLowStock && productStock > 0 && (
          <div className="mb-3">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Low Stock
            </span>
          </div>
        )}
        
        <div className="flex items-center justify-between">
          <div className="text-2xl font-bold text-green-600">
            ₹{productPrice}
            <span className="text-sm text-gray-500 font-normal">/{productUnit}</span>
          </div>
          
          <button
            onClick={handleAddToCart}
            disabled={!isInStock || isAdding || !product.coveredPincodes?.length}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all disabled:cursor-not-allowed ${
              isAdding
                ? 'bg-green-700 text-white'
                : isInStock && product.coveredPincodes?.length
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-400 text-white'
            }`}
          >
            {isAdding ? (
              <>
                <Check className="w-4 h-4" />
                <span>Added!</span>
              </>
            ) : (
              <>
                <ShoppingCart className="w-4 h-4" />
                <span>
                  {!product.coveredPincodes?.length 
                    ? 'No Delivery' 
                    : isInStock 
                    ? 'Add to Cart' 
                    : 'Out of Stock'
                  }
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;