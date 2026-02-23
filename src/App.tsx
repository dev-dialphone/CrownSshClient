import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { useEffect } from "react";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import PinEntry from "@/pages/PinEntry";
import PendingApprovalScreen from "@/components/PendingApprovalScreen";

// Loading fallback component (Used for auth loading)
const LoadingScreen = () => (
  <div className="flex h-screen items-center justify-center bg-black text-white">
    <div className="animate-pulse">Loading...</div>
  </div>
);

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, error, checkAuth, isPinVerified, logout } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading) return <LoadingScreen />;

  if (error && !user) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-black text-white gap-4">
        <div className="text-red-500">Unable to verify session: {error}</div>
        <button
          onClick={() => checkAuth()}
          className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Block pending/rejected users BEFORE showing the dashboard
  if (user.role !== 'admin' && user.status && user.status !== 'active') {
    return (
      <PendingApprovalScreen
        status={user.status as 'pending' | 'rejected'}
        email={user.email}
        onLogout={logout}
      />
    );
  }

  if (!isPinVerified) return <PinEntry />;

  return <>{children}</>;
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={
          <PrivateRoute>
            <Home />
          </PrivateRoute>
        } />
      </Routes>
    </Router>
  );
}
