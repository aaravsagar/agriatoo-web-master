import React, { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../hooks/useAuth';
import { generateCoveredPincodes, isPincodeValid } from '../../utils/pincodeUtils';
import { MapPin, Save } from 'lucide-react';

const SellerProfile: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    pincode: '',
    shopName: '',
    deliveryRadius: 20
  });
  const [coveredPincodes, setCoveredPincodes] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        phone: user.phone || '',
        address: user.address || '',
        pincode: user.pincode || '',
        shopName: user.shopName || '',
        deliveryRadius: user.deliveryRadius || 20
      });
      
      if (user.pincode) {
        const covered = generateCoveredPincodes(user.pincode, user.deliveryRadius || 20);
        setCoveredPincodes(covered);
      }
    }
  }, [user]);

  const handlePincodeChange = (pincode: string) => {
    setFormData({ ...formData, pincode });
    if (isPincodeValid(pincode)) {
      const covered = generateCoveredPincodes(pincode, formData.deliveryRadius);
      setCoveredPincodes(covered);
    } else {
      setCoveredPincodes([]);
    }
  };

  const handleRadiusChange = (radius: number) => {
    setFormData({ ...formData, deliveryRadius: radius });
    if (formData.pincode && isPincodeValid(formData.pincode)) {
      const covered = generateCoveredPincodes(formData.pincode, radius);
      setCoveredPincodes(covered);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!isPincodeValid(formData.pincode)) {
      alert('Please enter a valid PIN code');
      return;
    }

    setLoading(true);

    try {
      // Generate covered pincodes for the seller
      const newCoveredPincodes = generateCoveredPincodes(formData.pincode, formData.deliveryRadius);
      
      if (newCoveredPincodes.length === 0) {
        alert('No serviceable areas found for your pincode. Please check your location.');
        setLoading(false);
        return;
      }

      await updateDoc(doc(db, 'users', user.id), {
        name: formData.name,
        phone: formData.phone,
        address: formData.address,
        pincode: formData.pincode,
        shopName: formData.shopName,
        deliveryRadius: formData.deliveryRadius,
        coveredPincodes: newCoveredPincodes,
        updatedAt: new Date()
      });

      // Update covered pincodes state
      setCoveredPincodes(newCoveredPincodes);
      
      alert('Profile updated successfully!');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold text-white mb-6">Seller Profile</h2>

      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Shop Name
            </label>
            <input
              type="text"
              value={formData.shopName}
              onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
              required
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Shop Address
            </label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              required
              rows={3}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                PIN Code
              </label>
              <input
                type="text"
                value={formData.pincode}
                onChange={(e) => handlePincodeChange(e.target.value)}
                required
                maxLength={6}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Delivery Radius (km)
              </label>
              <select
                value={formData.deliveryRadius}
                onChange={(e) => handleRadiusChange(parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value={10}>10 km</option>
                <option value={20}>20 km</option>
                <option value={30}>30 km</option>
                <option value={50}>50 km</option>
              </select>
            </div>
          </div>

          {coveredPincodes.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <MapPin className="w-4 h-4 inline mr-1" />
                Covered PIN Codes ({coveredPincodes.length} areas)
              </label>
              <div className="bg-gray-700 rounded-md p-3 max-h-32 overflow-y-auto">
                <div className="flex flex-wrap gap-2">
                  {coveredPincodes.slice(0, 20).map(pincode => (
                    <span
                      key={pincode}
                      className="bg-green-900 text-green-300 px-2 py-1 rounded text-xs"
                    >
                      {pincode}
                    </span>
                  ))}
                  {coveredPincodes.length > 20 && (
                    <span className="text-gray-400 text-xs">
                      +{coveredPincodes.length - 20} more
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2 bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-5 h-5" />
            <span>{loading ? 'Saving...' : 'Save Profile'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default SellerProfile;