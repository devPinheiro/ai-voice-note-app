import { Navigate, useLocation } from "react-router-dom";
import { type ReactNode } from "react";
import { useAuth } from "../../hooks/use-auth";

interface RouteWrapperProps {
  children: ReactNode;
  isProtected?: boolean;
  requiredRole?: string;
  redirectTo?: string;
}

export const RouteWrapper = ({
  children,
  isProtected = false,
  requiredRole,
  redirectTo,
}: RouteWrapperProps) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // For public routes that should redirect authenticated users (like login page)
  if (!isProtected && isAuthenticated) {
    return <Navigate to={redirectTo || "/"} replace />;
  }

  // For protected routes that require authentication
  if (isProtected && !isAuthenticated) {
    return (
      <Navigate
        to={redirectTo || "/login"}
        state={{ from: location }}
        replace
      />
    );
  }

  // Role-based access control (future feature)
  if (requiredRole && user && !user.isAnonymous) {
    // Add role checking logic here when roles are implemented
    // For now, just allow all authenticated users
  }

  return <>{children}</>;
};
