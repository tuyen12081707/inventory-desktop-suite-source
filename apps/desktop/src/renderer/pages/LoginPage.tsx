import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Form, Input, Typography } from 'antd';
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../lib/api';

interface LoginValues {
  email: string;
  password: string;
}

export function LoginPage(): React.JSX.Element {
  const { login } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (values: LoginValues): Promise<void> => {
    setSubmitting(true);
    setError(null);
    try {
      await login(values.email, values.password);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Không thể kết nối máy chủ');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <Card className="login-card">
        <div className="login-brand">
          <div className="brand-mark brand-mark-large">IP</div>
          <Typography.Title level={2}>InventoryPro</Typography.Title>
          <Typography.Text type="secondary">
            Đăng nhập để quản lý kho hàng của công ty
          </Typography.Text>
        </div>
        {error && <Alert type="error" message={error} showIcon className="login-alert" />}
        <Form<LoginValues>
          layout="vertical"
          initialValues={{
            email: 'admin@company.local',
            password: 'Admin@123456',
          }}
          onFinish={(values) => void submit(values)}
        >
          <Form.Item
            label="Email"
            name="email"
            rules={[{ required: true, type: 'email', message: 'Nhập email hợp lệ' }]}
          >
            <Input prefix={<MailOutlined />} size="large" autoFocus />
          </Form.Item>
          <Form.Item
            label="Mật khẩu"
            name="password"
            rules={[{ required: true, min: 8, message: 'Mật khẩu tối thiểu 8 ký tự' }]}
          >
            <Input.Password prefix={<LockOutlined />} size="large" />
          </Form.Item>
          <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
            Đăng nhập
          </Button>
        </Form>
      </Card>
    </div>
  );
}
