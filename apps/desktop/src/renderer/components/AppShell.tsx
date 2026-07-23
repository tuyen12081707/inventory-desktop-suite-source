import {
  AppstoreOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  LogoutOutlined,
  PrinterOutlined,
  ShoppingCartOutlined,
  ShopOutlined,
} from '@ant-design/icons';
import { Avatar, Button, Dropdown, Layout, Menu, Space, Typography, message } from 'antd';
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
];

export function AppShell(): React.JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [messageApi, contextHolder] = message.useMessage();

  const print = async (): Promise<void> => {
    const result = await desktop.printCurrentWindow();
    if (!result.success) messageApi.error(result.reason ?? 'Không thể in');
  };

  return (
    <Layout className="app-layout">
      {contextHolder}
      <Sider width={236} className="app-sider" theme="light">
        <div className="brand">
          <div className="brand-mark">IP</div>
          <div>
            <Typography.Text strong>InventoryPro</Typography.Text>
            <Typography.Text type="secondary" className="brand-subtitle">
              Quản lý kho
            </Typography.Text>
          </div>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header className="app-header">
          <Typography.Title level={4} className="header-title">
            Hệ thống quản lý kho
          </Typography.Title>
          <Space size="middle">
            <Button icon={<PrinterOutlined />} onClick={print}>
              In màn hình
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
