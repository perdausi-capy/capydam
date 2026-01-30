import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
// ✅ 1. Import Terminal Context & Component
import { TerminalProvider } from './context/TerminalContext'; 
import GlobalTerminal from './components/GlobalTerminal';

import Layout from './components/Layout';

// Pages
import Login from './pages/Login';
import RequestAccount from './pages/RequestAccount';
import Dashboard from './pages/Dashboard'; // Library
import Categories from './pages/Categories'; // Home / Explore
import CategoryDetail from './pages/CategoryDetail';
import Upload from './pages/Upload';
import AssetDetail from './pages/AssetDetail';
import Collections from './pages/Collections';
import CollectionDetail from './pages/CollectionDetail';
import Users from './pages/Users';
import Profile from './pages/Profile';
import Support from './pages/Support';
import AdminFeedback from './pages/AdminFeedback'; 
import AdminAnalytics from './pages/AdminAnalytics';
import RecycleBin from './pages/RecycleBin';

// ✅ NEW CHAT PAGE IMPORT
import { SocketProvider } from './context/SocketContext'; 
import Chat from './pages/Chat'; // 1. Full Page Chat (Replaces floating widget)
import JrdAssets from './pages/jrdAssets';
import ScormExtractor from './pages/ScormExtractor';


// ✅ NEW APPS PAGES IMPORT
import Apps from './pages/Apps';
import DdlGenerator from './pages/DdlGenerator';

import FloatingDailyQuestion from './components/FloatingDailyQuestion';
import AdminDailyQuest from './pages/AdminDailyQuest';

// --- WRAPPERS ---

// 1. Standard Protected Route (Any logged-in user)
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" />;
  return <Layout>{children}</Layout>;
};

// 2. Admin Only Route (Security Layer)
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, user } = useAuth();
  
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (user?.role !== 'admin') return <Navigate to="/" />; // Redirect unauthorized users
  
  return <Layout>{children}</Layout>;
};

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        {/* ✅ SOCKET PROVIDER (Needs Auth first) */}
        <SocketProvider>
          <Router>
            {/* ✅ TERMINAL PROVIDER (Can be anywhere inside Router) */}
            <TerminalProvider>
              
              <Routes>
                {/* --- Public Routes --- */}
                <Route path="/login" element={<Login />} />
                <Route path="/request-account" element={<RequestAccount />} />
                
                {/* --- Protected Routes (All Users) --- */}
                
                {/* 1. Exploration (Home) */}
                <Route path="/" element={<ProtectedRoute><Categories /></ProtectedRoute>} />
                <Route path="/categories/:id" element={<ProtectedRoute><CategoryDetail /></ProtectedRoute>} />

                {/* 2. Asset Library */}
                <Route path="/library" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/upload" element={<ProtectedRoute><Upload /></ProtectedRoute>} />
                <Route path="/assets/:id" element={<ProtectedRoute><AssetDetail /></ProtectedRoute>} />
                
                {/* 3. Support & Collections */}
                <Route path="/support" element={<ProtectedRoute><Support /></ProtectedRoute>} />
                <Route path="/collections" element={<ProtectedRoute><Collections /></ProtectedRoute>} />
                <Route path="/collections/:id" element={<ProtectedRoute><CollectionDetail /></ProtectedRoute>} />
                
                {/* 4. Profile */}
                <Route path="/profile/:id?" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

                {/* 5. ✅ NEW CHAT ROUTE (Discord-style Page) */}
                <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />

                {/* 6. ✅ NEW APPS ROUTES */}
                <Route path="/apps" element={<ProtectedRoute><Apps /></ProtectedRoute>} />
                <Route path="/ddl-generator" element={<ProtectedRoute><DdlGenerator /></ProtectedRoute>} />

                {/* 6. ✅ NEW CHAT ScormExtractor */}
                <Route path="/scorm-extractor" element={<ProtectedRoute><ScormExtractor /></ProtectedRoute>} />
                 <Route path="/jrd-assets" element={<ProtectedRoute><JrdAssets /></ProtectedRoute>} />
                {/* --- Admin Routes (Restricted) --- */}
                <Route path="/users" element={<AdminRoute><Users /></AdminRoute>} />
                <Route path="/admin/feedback" element={<AdminRoute><AdminFeedback /></AdminRoute>} />
                <Route path="/admin/analytics" element={<AdminRoute><AdminAnalytics /></AdminRoute>} />
                <Route path="/admin/recycle-bin" element={<AdminRoute><RecycleBin /></AdminRoute>} />
                <Route path="/admin/daily-quest" element={<AdminRoute><AdminDailyQuest /></AdminRoute>} />
                
                
                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>

              {/* ✅ GLOBAL COMPONENTS (Persist across pages) */}
              <GlobalTerminal />
              <FloatingDailyQuestion />
              
              {/* 🗑️ REMOVED: <GlobalChat /> (Floating widget no longer needed) */}

            </TerminalProvider>
          </Router>
        </SocketProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;