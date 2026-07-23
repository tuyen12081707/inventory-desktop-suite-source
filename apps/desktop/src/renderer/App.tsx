import { Spin } from 'antd';
import { lazy, Suspense } from 'react';
import { HashRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { AppShell } from './components/AppShell';

const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })),
);
const DocumentsPage = lazy(() =>
  import('./pages/DocumentsPage').then((module) => ({ default: module.DocumentsPage })),
);
const InventoryPage = lazy(() =>
  import('./pages/InventoryPage').then((module) => ({ default: module.InventoryPage })),
);
const LoginPage = lazy(() =>
  import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })),
);
const PosPage = lazy(() =>
  import('./pages/PosPage').then((module) => ({ default: module.PosPage })),
);
const ProductsPage = lazy(() =>
  import('./pages/ProductsPage').then((module) => ({ default: module.ProductsPage })),
);
const WarehousesPage = lazy(() =>
  import('./pages/WarehousesPage').then((module) => ({ default: module.WarehousesPage })),
);

function ProtectedRoute(): React.JSX.Element {
  const { user, booting } = useAuth();
  if (booting) {
    return (
      <div className="center-screen">
        <Spin size="large" />
      </div>
    );
  }
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

function GuestRoute(): React.JSX.Element {
  const { user, booting } = useAuth();
  if (booting)
    return (
      <div className="center-screen">
        <Spin size="large" />
      </div>
    );
  return user ? <Navigate to="/" replace /> : <LoginPage />;
}

export function App(): React.JSX.Element {
  return (
    <HashRouter>
      <Suspense
        fallback={
          <div className="center-screen">
            <Spin size="large" />
          </div>
        }
      >
        <Routes>
          <Route path="/login" element={<GuestRoute />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route index element={<DashboardPage />} />
              <Route path="pos" element={<PosPage />} />
              <Route path="products" element={<ProductsPage />} />
              <Route path="inventory" element={<InventoryPage />} />
              <Route path="documents" element={<DocumentsPage />} />
              <Route path="warehouses" element={<WarehousesPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </HashRouter>
  );
}
