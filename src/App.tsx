import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Header from './components/Layout/Header';
import Footer from './components/Layout/Footer';
import LoadingSpinner from './components/UI/LoadingSpinner';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import Login from './components/Auth/Login';
import HomePage from './components/Customer/HomePage';
import Cart from './components/Customer/Cart';
import AdminDashboard from './components/Admin/AdminDashboard';

function App() {
  const { loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <Router>
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
                  <div className="py-12 text-center">
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">Seller Dashboard</h1>
                    <p className="text-gray-600">Seller panel is under construction</p>
                  </div>
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="http://localhost:5173/delivery" 
              element={
                <ProtectedRoute requiredRole="delivery">
                  <div className="py-12 text-center">
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">Delivery Dashboard</h1>
                    <p className="text-gray-600">Delivery panel is under construction</p>
                  </div>
                </ProtectedRoute>
              } 
            />
          </Routes>
        </main>
        
        <Footer />
      </div>
    </Router>
  );
}

export default App;