import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    // Avoids a flash-redirect to /login before Firebase has reported
    // whether a session already exists.
    return <p style={{ padding: "3rem", textAlign: "center" }}>Checking session…</p>;
  }

  if (!user || !isAdmin) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
