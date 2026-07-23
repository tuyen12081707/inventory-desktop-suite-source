import { Spin } from 'antd';
import { HashRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { AppShell } from './components/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { InventoryPage } from './pages/InventoryPage';
import { LoginPage } from './pages/LoginPage';
import { ProductsPage } from './pages/ProductsPage';
import { WarehousesPage } from './pages/WarehousesPage';

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
      <Routes>
        <Route path="/login" element={<GuestRoute />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="documents" element={<DocumentsPage />} />
            <Route path="warehouses" element={<WarehousesPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
