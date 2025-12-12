import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout';

// Pages
import Login from './pages/Login';
import RequestAccount from './pages/RequestAccount';
import Dashboard from './pages/Dashboard'; // Now the 'Library'
import Categories from './pages/Categories'; // Now the 'Home'
import CategoryDetail from './pages/CategoryDetail';
import Upload from './pages/Upload';
import AssetDetail from './pages/AssetDetail';
import Collections from './pages/Collections';
import CollectionDetail from './pages/CollectionDetail';
import Users from './pages/Users';
import Profile from './pages/Profile';

// Wrapper for protected pages that includes the Sidebar Layout
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" />;
  
  return <Layout>{children}</Layout>;
};

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <Router>
          <Routes>
            {/* --- Public Routes --- */}
            <Route path="/login" element={<Login />} />
            <Route path="/request-account" element={<RequestAccount />} />
            
            {/* --- Protected Routes --- */}
            
            {/* 1. Exploration (Home) */}
            <Route path="/" element={<ProtectedRoute><Categories /></ProtectedRoute>} />
            <Route path="/categories/:id" element={<ProtectedRoute><CategoryDetail /></ProtectedRoute>} />

            {/* 2. Asset Library */}
            <Route path="/library" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/upload" element={<ProtectedRoute><Upload /></ProtectedRoute>} />
            <Route path="/assets/:id" element={<ProtectedRoute><AssetDetail /></ProtectedRoute>} />
            
            {/* 3. Collections */}
            <Route path="/collections" element={<ProtectedRoute><Collections /></ProtectedRoute>} />
            <Route path="/collections/:id" element={<ProtectedRoute><CollectionDetail /></ProtectedRoute>} />
            
            {/* 4. Admin / Users */}
            <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
            
            {/* 5. Profile / User Detail (Combined) */}
            {/* The ? makes the ID optional */}
            <Route path="/profile/:id?" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Router>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;