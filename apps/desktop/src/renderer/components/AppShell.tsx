import {
  AppstoreOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  LogoutOutlined,
  MenuOutlined,
  PrinterOutlined,
  BarChartOutlined,
  SettingOutlined,
  ShoppingCartOutlined,
  ShopOutlined,
} from '@ant-design/icons';
import {
  Avatar,
  Button,
  Drawer,
  Dropdown,
  Grid,
  Layout,
  Menu,
  Space,
  Typography,
  message,
} from 'antd';
import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { desktop } from '../lib/platform';

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: 'Tổng quan' },
  { key: '/pos', icon: <ShoppingCartOutlined />, label: 'Bán hàng POS' },
  { key: '/products', icon: <AppstoreOutlined />, label: 'Sản phẩm' },
  { key: '/inventory', icon: <DatabaseOutlined />, label: 'Tồn kho' },
  { key: '/documents', icon: <FileTextOutlined />, label: 'Phiếu kho' },
  { key: '/warehouses', icon: <ShopOutlined />, label: 'Kho hàng' },
  { key: '/reports', icon: <BarChartOutlined />, label: 'Báo cáo' },
  { key: '/settings', icon: <SettingOutlined />, label: 'Cài đặt' },
];

export function AppShell(): React.JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [messageApi, contextHolder] = message.useMessage();
  const screens = Grid.useBreakpoint();
  const mobileLayout = screens.lg === false;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileLayout) setMobileMenuOpen(false);
  }, [mobileLayout]);

  const print = async (): Promise<void> => {
    const result = await desktop.printCurrentWindow();
    if (!result.success) messageApi.error(result.reason ?? 'Không thể in');
  };

  const navigation = (
    <Menu
      mode="inline"
      selectedKeys={[location.pathname]}
      items={menuItems}
      onClick={({ key }) => {
        navigate(key);
        setMobileMenuOpen(false);
      }}
    />
  );

  const brand = (
    <div className="brand">
      <div className="brand-mark">IP</div>
      <div>
        <Typography.Text strong>InventoryPro</Typography.Text>
        <Typography.Text type="secondary" className="brand-subtitle">
          Quản lý kho
        </Typography.Text>
      </div>
    </div>
  );

  return (
    <Layout className="app-layout">
      {contextHolder}
      <Sider width={236} className="app-sider desktop-sider" theme="light">
        {brand}
        {navigation}
      </Sider>
      <Drawer
        title={brand}
        placement="left"
        width={280}
        open={mobileLayout && mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        className="mobile-nav-drawer"
        maskClosable
        keyboard
        destroyOnHidden
      >
        {navigation}
      </Drawer>
      <Layout>
        <Header className="app-header">
          <Space className="header-leading">
            {mobileLayout && (
              <Button
                type="text"
                className="mobile-menu-button"
                icon={<MenuOutlined />}
                aria-label="Mở menu điều hướng"
                onClick={() => setMobileMenuOpen(true)}
              />
            )}
            <Typography.Title level={4} className="header-title">
              Hệ thống quản lý kho
            </Typography.Title>
          </Space>
          <Space size="middle">
            <Button className="print-current-page" icon={<PrinterOutlined />} onClick={print}>
              In trang hiện tại
            </Button>
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'logout',
                    icon: <LogoutOutlined />,
                    label: 'Đăng xuất',
                    onClick: () => void logout(),
                  },
                ],
              }}
            >
              <Space className="user-menu">
                <Avatar>{user?.fullName.slice(0, 1).toUpperCase()}</Avatar>
                <div>
                  <Typography.Text strong>{user?.fullName}</Typography.Text>
                  <Typography.Text type="secondary" className="user-email">
                    {user?.email}
                  </Typography.Text>
                </div>
              </Space>
            </Dropdown>
          </Space>
        </Header>
        <Content className="app-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
