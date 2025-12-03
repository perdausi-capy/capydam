import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import Layout from './components/Layout';
import AssetDetail from './pages/AssetDetail';
import Collections from './pages/Collections';
import CollectionDetail from './pages/CollectionDetail';
import RequestAccount from './pages/RequestAccount';
import Users from './pages/Users';

// Wrapper for protected pages that includes the Sidebar Layout
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" />;
  
  return <Layout>{children}</Layout>;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/request-account" element={<RequestAccount />} />

          
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/upload" 
            element={
              <ProtectedRoute>
                <Upload />
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/assets/:id" 
            element={
              <ProtectedRoute>
                <AssetDetail />
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/collections" 
            element={
              <ProtectedRoute>
                <Collections />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/collections/:id" 
            element={
              <ProtectedRoute>
                <CollectionDetail />
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/users" 
            element={
              <ProtectedRoute>
                <Users />
              </ProtectedRoute>
            } 
          />

        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;