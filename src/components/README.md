# Reusable Route Components

This directory contains reusable React Router components for handling protected and public routes with authentication and role-based access control.

## Components

### 1. ProtectedRoute
A simple component for protecting routes that require authentication.

```tsx
import { ProtectedRoute } from './components/ProtectedRoute';

<ProtectedRoute 
  isAuthenticated={isAuthenticated}
  redirectTo="/login"
>
  <YourProtectedComponent />
</ProtectedRoute>
```

**Props:**
- `children`: ReactNode - The component to render if authenticated
- `isAuthenticated`: boolean - Whether the user is authenticated
- `redirectTo`: string (optional) - Where to redirect unauthenticated users (default: '/login')

### 2. PublicRoute
A component for public routes that should redirect authenticated users away.

```tsx
import { PublicRoute } from './components/PublicRoute';

<PublicRoute 
  isAuthenticated={isAuthenticated}
  redirectTo="/dashboard"
>
  <YourPublicComponent />
</PublicRoute>
```

**Props:**
- `children`: ReactNode - The component to render if not authenticated
- `isAuthenticated`: boolean - Whether the user is authenticated
- `redirectTo`: string (optional) - Where to redirect authenticated users (default: '/dashboard')

### 3. RouteWrapper
A comprehensive component that combines both protected and public route logic with additional features.

```tsx
import { RouteWrapper } from './components/RouteWrapper';

// For public routes (login, register, landing page)
<RouteWrapper 
  isAuthenticated={isAuthenticated}
  isLoading={isLoading}
  isPublic={true}
  redirectTo="/dashboard"
>
  <LoginPage />
</RouteWrapper>

// For protected routes
<RouteWrapper 
  isAuthenticated={isAuthenticated}
  isLoading={isLoading}
  redirectTo="/login"
>
  <DashboardPage />
</RouteWrapper>

// For role-based protected routes
<RouteWrapper 
  isAuthenticated={isAuthenticated}
  isLoading={isLoading}
  requiredRole="admin"
  userRole={user?.role}
  redirectTo="/login"
>
  <AdminPage />
</RouteWrapper>
```

**Props:**
- `children`: ReactNode - The component to render
- `isAuthenticated`: boolean - Whether the user is authenticated
- `isLoading`: boolean (optional) - Show loading state while checking auth
- `requiredRole`: string (optional) - Required role for access
- `userRole`: string (optional) - Current user's role
- `redirectTo`: string (optional) - Where to redirect unauthorized users
- `isPublic`: boolean (optional) - Whether this is a public route

## Usage Examples

### Basic Setup

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { RouteWrapper } from './components/RouteWrapper';

const AppRoutes = () => {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Routes>
      {/* Public Routes */}
      <Route 
        path="/" 
        element={
          <RouteWrapper 
            isAuthenticated={isAuthenticated}
            isLoading={isLoading}
            isPublic={true}
          >
            <LandingPage />
          </RouteWrapper>
        } 
      />
      
      <Route 
        path="/login" 
        element={
          <RouteWrapper 
            isAuthenticated={isAuthenticated}
            isLoading={isLoading}
            isPublic={true}
            redirectTo="/dashboard"
          >
            <LoginPage />
          </RouteWrapper>
        } 
      />

      {/* Protected Routes */}
      <Route 
        path="/dashboard" 
        element={
          <RouteWrapper 
            isAuthenticated={isAuthenticated}
            isLoading={isLoading}
            redirectTo="/login"
          >
            <DashboardPage />
          </RouteWrapper>
        } 
      />

      {/* Role-based Routes */}
      <Route 
        path="/admin" 
        element={
          <RouteWrapper 
            isAuthenticated={isAuthenticated}
            isLoading={isLoading}
            requiredRole="admin"
            userRole={user?.role}
            redirectTo="/login"
          >
            <AdminPage />
          </RouteWrapper>
        } 
      />
    </Routes>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
```

### Authentication Hook

The `useAuth` hook provides authentication state and methods:

```tsx
import { useAuth } from './hooks/useAuth';

const MyComponent = () => {
  const { 
    user, 
    isAuthenticated, 
    isLoading, 
    login, 
    logout, 
    register 
  } = useAuth();

  // Use authentication state and methods
};
```

## Features

### 1. Loading States
The `RouteWrapper` component shows a loading spinner while checking authentication status.

### 2. Redirect Preservation
When redirecting to login, the original location is preserved so users can be redirected back after successful authentication.

### 3. Role-based Access Control
Support for role-based access control with automatic redirection to unauthorized page.

### 4. Flexible Configuration
- Custom redirect paths for different scenarios
- Optional role requirements
- Public/private route handling

### 5. Type Safety
Full TypeScript support with proper type definitions for all props and return values.

## Best Practices

1. **Use RouteWrapper for most cases** - It's the most comprehensive and flexible option
2. **Handle loading states** - Always pass the `isLoading` prop to show appropriate loading UI
3. **Preserve redirects** - Use the location state to redirect users back to their intended destination
4. **Role-based access** - Use `requiredRole` and `userRole` for fine-grained access control
5. **Error boundaries** - Wrap your routes in error boundaries for better error handling

## Customization

You can easily customize the loading component, unauthorized page, or add additional authentication logic by modifying the `RouteWrapper` component or creating your own wrapper components based on the existing patterns. 