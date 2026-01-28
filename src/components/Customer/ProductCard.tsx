import React, { useState } from 'react';
import { ShoppingCart, MapPin, Check } from 'lucide-react';
import { Product } from '../../types';

interface ProductCardProps {
  product: Product;
  onAddToCart: () => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart }) => {
  const [isAdding, setIsAdding] = useState(false);

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
  const productStock = product.stock || 0;
  const productSellerName = product.sellerName || 'Unknown Seller';
  const productImages = product.images || [];

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
          <div className="text-sm text-gray-500 whitespace-nowrap ml-2">
            Stock: {productStock} {productUnit}
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="text-2xl font-bold text-green-600">
            ₹{productPrice}
            <span className="text-sm text-gray-500 font-normal">/{productUnit}</span>
          </div>
          
          <button
            onClick={handleAddToCart}
            disabled={productStock <= 0 || isAdding}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all disabled:cursor-not-allowed ${
              isAdding
                ? 'bg-green-700 text-white'
                : productStock > 0
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
                <span>{productStock > 0 ? 'Add to Cart' : 'Out of Stock'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;