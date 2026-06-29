import React, { useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import Login from './pages/Login';
import CitizenForm from './pages/CitizenForm';
import AdminDashboard from './pages/AdminDashboard';
import ResponderPortal from './pages/ResponderPortal';

// PROTECTED ROUTE FILTER GATEWAY
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, token } = useContext(AuthContext);

  if (!token) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    // If user role doesn't match clearance criteria, kick back to login context
    return <Navigate to="/login" replace />;
  }
  return children;
};

function AppRoutes() {
  const { user } = useContext(AuthContext);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      {/* CITIZEN ENTRY PATH */}
      <Route path="/report" element={
        <ProtectedRoute allowedRoles={['Citizen']}>
          <CitizenForm />
        </ProtectedRoute>
      } />

      {/* ADMIN CONTROL PANEL PATH */}
      <Route path="/admin" element={
        <ProtectedRoute allowedRoles={['Admin']}>
          <AdminDashboard />
        </ProtectedRoute>
      } />

      {/* FIELD RESPONDER PATH */}
      <Route path="/responder" element={
        <ProtectedRoute allowedRoles={['Responder']}>
          <ResponderPortal />
        </ProtectedRoute>
      } />

      {/* FALLBACK DIRECTIVE */}
      <Route path="*" element={
        user ? (
          user.role === 'Admin' ? <Navigate to="/admin" /> : 
          user.role === 'Responder' ? <Navigate to="/responder" /> : <Navigate to="/report" />
        ) : <Navigate to="/login" />
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}