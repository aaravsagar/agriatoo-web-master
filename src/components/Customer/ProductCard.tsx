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

  // Defensive check
  if (!product) {
    console.error('ProductCard received undefined product');
    return null;
  }

  const handleAddToCart = () => {
    setIsAdding(true);
    onAddToCart();
    setTimeout(() => setIsAdding(false), 1000);
  };

  // Safe defaults
  const productName = product.name ?? 'Unnamed Product';
  const productDescription = product.description ?? 'No description available';
  const productCategory = product.category ?? 'Uncategorized';
  const productPrice = product.price ?? 0;
  const productOriginalPrice = product.originalPrice;
  const productDiscountedPrice = product.discountedPrice;
  const productUnit = product.unit ?? 'unit';

  // ✅ FIXED LINE (no operator conflict)
  const stockFromManager = getProductStock(product.id);
  const productStock = stockFromManager ?? product.stock ?? 0;

  const productSellerName = product.sellerName ?? 'Unknown Seller';
  const productImages = product.images ?? [];
  const isInStock = isProductInStock(product.id, 1);
  const isLowStock = productStock > 0 && productStock <= 5;

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden">
      <div className="bg-gray-200">
        {productImages[0] ? (
          <img
            src={productImages[0]}
            alt={productName}
            className="w-full h-48 object-cover"
            onError={(e) => {
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
        <div className="flex justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
            {productName}
          </h3>
          <span className="text-sm bg-gray-100 px-2 py-1 rounded">
            {productCategory}
          </span>
        </div>

        <p className="text-gray-600 text-sm mb-3 line-clamp-2">
          {productDescription}
        </p>

        <div className="flex justify-between mb-3 text-sm">
          <div className="flex items-center text-gray-500">
            <MapPin className="w-4 h-4 mr-1" />
            By {productSellerName}
          </div>

          <div
            className={
              productStock === 0
                ? 'text-red-600'
                : isLowStock
                ? 'text-orange-600'
                : 'text-gray-500'
            }
          >
            {productStock === 0 && <AlertTriangle className="inline w-3 h-3 mr-1" />}
            Stock: {productStock} {productUnit}
          </div>
        </div>

        {productStock === 0 && (
          <span className="inline-flex items-center px-2 py-1 text-xs bg-red-100 text-red-800 rounded mb-3">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Out of Stock
          </span>
        )}

        {isLowStock && productStock > 0 && (
          <span className="inline-flex items-center px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded mb-3">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Low Stock
          </span>
        )}

        <div className="flex justify-between items-center mt-4">
          <div className="text-2xl font-bold text-green-600">
            ₹{productPrice}
            {productOriginalPrice && productOriginalPrice > productPrice && (
              <span className="text-lg text-gray-400 line-through ml-2">
                ₹{productOriginalPrice}
              </span>
            )}
            <span className="text-sm text-gray-500">/{productUnit}</span>
          </div>

          <button
            onClick={handleAddToCart}
            disabled={!isInStock || isAdding || !product.coveredPincodes?.length}
            className={`px-4 py-2 rounded-lg text-white flex items-center gap-2 ${
              isAdding
                ? 'bg-green-700'
                : isInStock && product.coveredPincodes?.length
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-gray-400'
            }`}
          >
            {isAdding ? (
              <>
                <Check className="w-4 h-4" /> Added
              </>
            ) : (
              <>
                <ShoppingCart className="w-4 h-4" />
                {!product.coveredPincodes?.length
                  ? 'No Delivery'
                  : isInStock
                  ? 'Add to Cart'
                  : 'Out of Stock'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
