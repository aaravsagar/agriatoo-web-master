import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Order } from '../../types';
import { ORDER_STATUSES } from '../../config/constants';
import { sortOrdersByDistance } from '../../utils/pincodeUtils';
import { Truck, Package, MapPin, CheckCircle } from 'lucide-react';
import DeliveryOrders from './DeliveryOrders';
import DeliveryScanner from './DeliveryScanner';

const DeliveryDashboard: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState({
    assignedOrders: 0,
    completedToday: 0,
    pendingDeliveries: 0,
    totalDelivered: 0
  });
  const [todaysOrders, setTodaysOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user]);

  const fetchStats = async () => {
    try {
      // Show only orders that are "Out for Delivery" and assigned to this delivery boy
      const q = query(
        collection(db, 'orders'),
        where('deliveryBoyId', '==', user?.id || ''),
        where('status', '==', ORDER_STATUSES.OUT_FOR_DELIVERY)
      );
      const snapshot = await getDocs(q);
      let orders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      })) as Order[];

      // Frontend sorting by creation date (newest first)
      orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todaysOrders = orders.filter(order => {
        const orderDate = new Date(order.createdAt);
        orderDate.setHours(0, 0, 0, 0);
        return orderDate.getTime() === today.getTime();
      });

      const completedToday = orders.filter(order => {
        const orderDate = new Date(order.deliveredAt || order.createdAt);
        orderDate.setHours(0, 0, 0, 0);
        return orderDate.getTime() === today.getTime()
      }).length;

      const pendingDeliveries = orders.filter(order => 
        order.status === ORDER_STATUSES.OUT_FOR_DELIVERY
      ).length;

      // Get total delivered from all orders (not just out for delivery)
      const allOrdersQ = query(
        collection(db, 'orders'),
        where('deliveryBoyId', '==', user?.id || ''),
        where('status', '==', ORDER_STATUSES.DELIVERED)
      );
      const allOrdersSnapshot = await getDocs(allOrdersQ);
      const totalDelivered = allOrdersSnapshot.size;

      // Sort today's orders by distance if user has pincode
      const sortedTodaysOrders = user.pincode 
        ? sortOrdersByDistance([...todaysOrders], user.pincode)
        : todaysOrders;

      setStats({
        assignedOrders: orders.length,
        completedToday,
        pendingDeliveries,
        totalDelivered
      });

      setTodaysOrders(sortedTodaysOrders);
    } catch (error) {
      console.error('Error fetching delivery stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Truck },
    { id: 'orders', label: 'Orders', icon: Package },
    { id: 'scanner', label: 'Scanner', icon: MapPin }
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'orders':
        return <DeliveryOrders />;
      case 'scanner':
        return <DeliveryScanner />;
      default:
        return (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-400">Out for Delivery</p>
                    <p className="text-3xl font-bold text-white">{stats.assignedOrders}</p>
                  </div>
                  <Package className="w-12 h-12 text-blue-400" />
                </div>
              </div>

              <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-400">Completed Today</p>
                    <p className="text-3xl font-bold text-white">{stats.completedToday}</p>
                  </div>
                  <CheckCircle className="w-12 h-12 text-green-400" />
                </div>
              </div>

              <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-400">Pending Deliveries</p>
                    <p className="text-3xl font-bold text-white">{stats.pendingDeliveries}</p>
                  </div>
                  <Truck className="w-12 h-12 text-yellow-400" />
                </div>
              </div>

              <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-400">Total Delivered</p>
                    <p className="text-3xl font-bold text-white">{stats.totalDelivered}</p>
                  </div>
                  <CheckCircle className="w-12 h-12 text-green-400" />
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h2 className="text-xl font-bold mb-4 text-white">Current Deliveries</h2>
              {todaysOrders.length > 0 ? (
                <div className="space-y-3">
                  {todaysOrders.slice(0, 5).map((order, index) => (
                    <div key={order.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                          {index + 1}
                        </div>
                        <div>
                          <p className="text-white font-medium">{order.orderId}</p>
                          <p className="text-gray-400 text-sm">{order.customerName} - {order.customerPincode}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        order.status === ORDER_STATUSES.DELIVERED 
                          ? 'bg-green-900 text-green-300'
                          : order.status === ORDER_STATUSES.OUT_FOR_DELIVERY
                          ? 'bg-yellow-900 text-yellow-300'
                          : 'bg-blue-900 text-blue-300'
                      }`}>
                        {order.status.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                  {todaysOrders.length > 5 && (
                    <p className="text-gray-400 text-center">+{todaysOrders.length - 5} more orders</p>
                  )}
                </div>
              ) : (
                <p className="text-gray-400">No orders out for delivery</p>
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Delivery Dashboard</h1>
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

export default DeliveryDashboard;