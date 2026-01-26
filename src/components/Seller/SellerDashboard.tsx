import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Package, ShoppingBag, TrendingUp, MapPin } from 'lucide-react';
import { Product, Order } from '../../types';
import SellerProducts from './SellerProducts';
import SellerOrders from './SellerOrders';
import SellerProfile from './SellerProfile';

const SellerDashboard: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    pendingOrders: 0,
    totalRevenue: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user]);

  const fetchStats = async () => {
    if (!user) return;

    try {
      const [productsSnapshot, ordersSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'products'), where('sellerId', '==', user.id))),
        getDocs(query(collection(db, 'orders'), where('sellerId', '==', user.id)))
      ]);

      const orders = ordersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Order[];

      const pendingOrders = orders.filter(order => 
        order.status === 'received' || order.status === 'packed'
      ).length;

      const totalRevenue = orders
        .filter(order => order.status === 'delivered')
        .reduce((sum, order) => sum + order.totalAmount, 0);

      setStats({
        totalProducts: productsSnapshot.size,
        totalOrders: ordersSnapshot.size,
        pendingOrders,
        totalRevenue
      });
    } catch (error) {
      console.error('Error fetching seller stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'orders', label: 'Orders', icon: ShoppingBag },
    { id: 'profile', label: 'Profile', icon: MapPin }
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'products':
        return <SellerProducts />;
      case 'orders':
        return <SellerOrders />;
      case 'profile':
        return <SellerProfile />;
      default:
        return (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-400">Total Products</p>
                    <p className="text-3xl font-bold text-white">{stats.totalProducts}</p>
                  </div>
                  <Package className="w-12 h-12 text-green-400" />
                </div>
              </div>

              <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-400">Total Orders</p>
                    <p className="text-3xl font-bold text-white">{stats.totalOrders}</p>
                  </div>
                  <ShoppingBag className="w-12 h-12 text-blue-400" />
                </div>
              </div>

              <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-400">Pending Orders</p>
                    <p className="text-3xl font-bold text-white">{stats.pendingOrders}</p>
                  </div>
                  <ShoppingBag className="w-12 h-12 text-yellow-400" />
                </div>
              </div>

              <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-400">Total Revenue</p>
                    <p className="text-3xl font-bold text-white">₹{stats.totalRevenue.toLocaleString()}</p>
                  </div>
                  <TrendingUp className="w-12 h-12 text-green-400" />
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h2 className="text-xl font-bold mb-4 text-white">Welcome to Your Seller Dashboard</h2>
              <p className="text-gray-300">
                Manage your products, track orders, and grow your agricultural business with AGRIATOO.
              </p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Seller Dashboard</h1>
          <p className="text-gray-400 mt-2">Welcome back, {user?.name}</p>
        </div>

        <div className="border-b border-gray-700 mb-8">
          <nav className="flex space-x-8">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-green-400 text-green-400'
                      : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-green-200 border-t-green-400 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400">Loading dashboard...</p>
          </div>
        ) : (
          renderContent()
        )}
      </div>
    </div>
  );
};

export default SellerDashboard;