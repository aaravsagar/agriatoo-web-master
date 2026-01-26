import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Header from './components/Layout/Header';
import Footer from './components/Layout/Footer';
import LoadingSpinner from './components/UI/LoadingSpinner';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import Login from './components/Auth/Login';
import HomePage from './components/Customer/HomePage';
import Cart from './components/Customer/Cart';
import AdminDashboard from './components/Admin/AdminDashboard';
import SellerDashboard from './components/Seller/SellerDashboard';
import DeliveryDashboard from './components/Delivery/DeliveryDashboard';

function AppContent() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // ✅ ALWAYS call hooks at top level
  useEffect(() => {
    if (!loading && user && window.location.pathname === '/') {
      const dashboardRoutes: Record<string, string> = {
        admin: '/admin',
        seller: '/seller',
        delivery: '/delivery',
      };

      const targetRoute = dashboardRoutes[user.role];
      if (targetRoute) {
        navigate(targetRoute, { replace: true });
      }
    }
  }, [user, loading, navigate]);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      <main className="flex-grow">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/login" element={<Login />} />

          {/* Protected Routes */}
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/seller/*"
            element={
              <ProtectedRoute requiredRole="seller">
                <SellerDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/delivery/*"
            element={
              <ProtectedRoute requiredRole="delivery">
                <DeliveryDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>

      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
