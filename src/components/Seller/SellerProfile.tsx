import React, { useState, useEffect } from 'react';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../hooks/useAuth';
import { generateCoveredPincodes, isPincodeValid, getPincodeInfo } from '../../utils/pincodeUtils';
import { MapPin, Save } from 'lucide-react';

const SellerProfile: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');
  const [pincodeValidating, setPincodeValidating] = useState(false);
  const [pincodeInfo, setPincodeInfo] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    pincode: '',
    shopName: '',
    deliveryRadius: 20,
    upiId: ''
  });
  const [coveredPincodes, setCoveredPincodes] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      console.log('Loading user data:', user);
      setFormData({
        name: user.name || '',
        phone: user.phone || '',
        address: user.address || '',
        pincode: user.pincode || '',
        shopName: user.shopName || '',
        deliveryRadius: user.deliveryRadius || 20,
        upiId: user.upiId || ''
      });
      
      if (user.pincode) {
        const covered = generateCoveredPincodes(user.pincode, user.deliveryRadius || 20);
        setCoveredPincodes(covered);
      }
    }
  }, [user]);

  const showMessage = (msg: string, type: 'success' | 'error') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 5000);
  };
  const handlePincodeChange = (pincode: string) => {
    console.log('Pincode changed to:', pincode);
    setFormData({ ...formData, pincode });
    
    if (pincode.length === 6) {
      setPincodeValidating(true);
      setPincodeInfo(null);
      
      Promise.all([
        isPincodeValid(pincode),
        getPincodeInfo(pincode)
      ]).then(([isValid, info]) => {
        setPincodeValidating(false);
        
        if (isValid && info) {
          setPincodeInfo(info);
          generateCoveredPincodes(pincode, formData.deliveryRadius).then(covered => {
            console.log('Generated covered pincodes:', covered.length);
            setCoveredPincodes(covered);
          });
        } else {
          console.log('Invalid pincode');
          setPincodeInfo(null);
          setCoveredPincodes([]);
        }
      }).catch(error => {
        console.error('Error validating pincode:', error);
        setPincodeValidating(false);
        setPincodeInfo(null);
        setCoveredPincodes([]);
      });
    } else {
      setPincodeInfo(null);
      setCoveredPincodes([]);
    }
  };

  const handleRadiusChange = (radius: number) => {
    console.log('Radius changed to:', radius);
    setFormData({ ...formData, deliveryRadius: radius });
    if (formData.pincode && formData.pincode.length === 6) {
      isPincodeValid(formData.pincode).then(isValid => {
        if (isValid) {
          generateCoveredPincodes(formData.pincode, radius).then(covered => {
            console.log('Updated covered pincodes for radius:', covered.length);
            setCoveredPincodes(covered);
          });
        }
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    console.log('Submitting profile update:', formData);

    const isValid = await isPincodeValid(formData.pincode);
    if (!isValid) {
      showMessage('Please enter a valid PIN code', 'error');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      // Generate covered pincodes for the seller
      const newCoveredPincodes = await generateCoveredPincodes(formData.pincode, formData.deliveryRadius);
      console.log('Final covered pincodes:', newCoveredPincodes);
      
      if (newCoveredPincodes.length === 0) {
        showMessage('No serviceable areas found for your pincode. Please try a different pincode.', 'error');
        setSaving(false);
        return;
      }

      const updateData = {
        name: formData.name,
        phone: formData.phone,
        address: formData.address,
        pincode: formData.pincode,
        shopName: formData.shopName,
        deliveryRadius: formData.deliveryRadius,
        upiId: formData.upiId,
        coveredPincodes: newCoveredPincodes,
        updatedAt: new Date()
      };

      console.log('Updating user document with:', updateData);
      await updateDoc(doc(db, 'users', user.id), updateData);

      // Verify the update by fetching the document
      const updatedDoc = await getDoc(doc(db, 'users', user.id));
      if (updatedDoc.exists()) {
        const updatedData = updatedDoc.data();
        console.log('Profile updated successfully:', updatedData);
        
        // Update covered pincodes state
        setCoveredPincodes(newCoveredPincodes);
        
        showMessage(`Profile updated successfully! You can now deliver to ${newCoveredPincodes.length} areas.`, 'success');
      } else {
        throw new Error('Failed to verify profile update');
      }

    } catch (error: any) {
      console.error('Error updating profile:', error);
      showMessage(`Error updating profile: ${error.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold text-white mb-6">Seller Profile</h2>

      {/* Message Display */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg ${
          messageType === 'success' 
            ? 'bg-green-900 border border-green-700 text-green-300' 
            : 'bg-red-900 border border-red-700 text-red-300'
        }`}>
          {message}
        </div>
      )}
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
                PIN Code (Any Indian PIN Code)
              </label>
              <input
                type="text"
                value={formData.pincode}
                onChange={(e) => handlePincodeChange(e.target.value)}
                required
                maxLength={6}
                placeholder="e.g., 110001, 400001, 380001"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              {pincodeValidating && (
                <p className="text-xs text-blue-400 mt-1 flex items-center">
                  <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin mr-2"></div>
                  Validating pincode...
                </p>
              )}
              {pincodeInfo && (
                <p className="text-xs text-green-400 mt-1">
                  ✓ {pincodeInfo.area}, {pincodeInfo.district}, {pincodeInfo.state}
                </p>
              )}
              {formData.pincode.length === 6 && !pincodeValidating && !pincodeInfo && (
                <p className="text-xs text-red-400 mt-1">
                  ✗ Invalid or not found
                </p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                Enter any valid Indian PIN code to calculate delivery areas
              </p>
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

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              UPI ID (for digital payments)
            </label>
            <input
              type="text"
              value={formData.upiId}
              onChange={(e) => setFormData({ ...formData, upiId: e.target.value })}
              placeholder="yourname@paytm / yourname@phonepe"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              Optional: Add your UPI ID to receive digital payments from customers
            </p>
          </div>

          {formData.pincode && !isPincodeValid(formData.pincode) && (
            <div className="bg-yellow-900 border border-yellow-700 text-yellow-300 p-3 rounded-lg">
              <p className="text-sm">
                ⚠️ Invalid PIN code. Please enter a valid Indian PIN code to enable product creation.
              </p>
            </div>
          )}
          <button
            type="submit"
            disabled={saving || !formData.pincode || pincodeValidating || !pincodeInfo}
            className="w-full flex items-center justify-center space-x-2 bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-5 h-5" />
            <span>{saving ? 'Saving...' : 'Save Profile'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default SellerProfile;