import { LockOutlined, SaveOutlined, SettingOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  App,
  Button,
  Card,
  Form,
  Image,
  Input,
  InputNumber,
  Select,
  Space,
  Typography,
} from 'antd';
import { useEffect } from 'react';
import type { CompanySettings } from '@inventory/contracts';
import { api, ApiError } from '../lib/api';

interface PasswordValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export function SettingsPage(): React.JSX.Element {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [companyForm] = Form.useForm<CompanySettings>();
  const [passwordForm] = Form.useForm<PasswordValues>();
  const logoUrl = Form.useWatch('logoKey', companyForm);
  const company = useQuery({
    queryKey: ['company-settings'],
    queryFn: () => api<CompanySettings>('/settings/company'),
  });

  useEffect(() => {
    if (company.data) companyForm.setFieldsValue(company.data);
  }, [company.data, companyForm]);

  const saveCompany = useMutation({
    mutationFn: (values: CompanySettings) =>
      api<CompanySettings>('/settings/company', { method: 'PATCH', body: JSON.stringify(values) }),
    onSuccess: async (settings) => {
      companyForm.setFieldsValue(settings);
      await queryClient.invalidateQueries({ queryKey: ['company-settings'] });
      message.success('Đã lưu cài đặt doanh nghiệp');
    },
    onError: (error) =>
      message.error(error instanceof ApiError ? error.message : 'Không thể lưu cài đặt'),
  });

  const changePassword = useMutation({
    mutationFn: (values: PasswordValues) =>
      api('/auth/me/password', { method: 'POST', body: JSON.stringify(values) }),
    onSuccess: () => {
      passwordForm.resetFields();
      message.success('Đã đổi mật khẩu. Hãy đăng nhập lại trên các thiết bị khác.');
    },
    onError: (error) =>
      message.error(error instanceof ApiError ? error.message : 'Không thể đổi mật khẩu'),
  });

  return (
    <Space direction="vertical" size="large" className="page-stack">
      <div className="page-heading">
        <div>
          <Typography.Title level={2}>Cài đặt</Typography.Title>
          <Typography.Text type="secondary">
            Thông tin doanh nghiệp, logo, hóa đơn và bảo mật tài khoản
          </Typography.Text>
        </div>
      </div>
      <Card
        title={
          <Space>
            <SettingOutlined />
            Thông tin doanh nghiệp
          </Space>
        }
        loading={company.isLoading}
      >
        <Form<CompanySettings>
          form={companyForm}
          layout="vertical"
          initialValues={company.data}
          onFinish={(values) => saveCompany.mutate(values)}
        >
          <div className="form-grid">
            <Form.Item label="Tên doanh nghiệp" name="name" rules={[{ required: true, min: 2 }]}>
              <Input />
            </Form.Item>
            <Form.Item
              label="URL logo"
              name="logoKey"
              rules={[{ type: 'url', message: 'Nhập URL ảnh hợp lệ' }]}
            >
              <Input placeholder="https://…/logo.png" />
            </Form.Item>
          </div>
          {logoUrl ? (
            <Form.Item label="Xem trước logo">
              <Image
                width={88}
                height={88}
                className="settings-logo-preview"
                src={logoUrl}
                alt="Xem trước logo"
              />
            </Form.Item>
          ) : null}
          <Form.Item label="Địa chỉ" name="address">
            <Input />
          </Form.Item>
          <div className="form-grid form-grid-3">
            <Form.Item label="Điện thoại" name="phone">
              <Input />
            </Form.Item>
            <Form.Item label="Email" name="email" rules={[{ type: 'email' }]}>
              <Input />
            </Form.Item>
            <Form.Item label="Mã số thuế" name="taxCode">
              <Input />
            </Form.Item>
          </div>
          <div className="form-grid form-grid-3">
            <Form.Item label="VAT mặc định" name="defaultTaxRate">
              <InputNumber min={0} max={100} precision={1} addonAfter="%" className="full-width" />
            </Form.Item>
            <Form.Item label="Khổ hóa đơn" name="receiptPaperSize">
              <Select
                options={[
                  { value: 'THERMAL_80', label: 'Máy in nhiệt 80 mm' },
                  { value: 'A4', label: 'A4' },
                ]}
              />
            </Form.Item>
            <Form.Item label="Tiền tệ">
              <Input value="VND (₫)" disabled />
            </Form.Item>
          </div>
          <Form.Item label="Chân trang hóa đơn" name="receiptFooter">
            <Input.TextArea rows={2} placeholder="Cảm ơn quý khách và hẹn gặp lại." />
          </Form.Item>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            htmlType="submit"
            loading={saveCompany.isPending}
          >
            Lưu cài đặt
          </Button>
        </Form>
      </Card>
      <Card
        title={
          <Space>
            <LockOutlined />
            Đổi mật khẩu
          </Space>
        }
      >
        <Form<PasswordValues>
          form={passwordForm}
          layout="vertical"
          className="password-form"
          onFinish={(values) => changePassword.mutate(values)}
        >
          <Form.Item label="Mật khẩu hiện tại" name="currentPassword" rules={[{ required: true }]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Form.Item
            label="Mật khẩu mới"
            name="newPassword"
            rules={[{ required: true, min: 12, message: 'Tối thiểu 12 ký tự' }]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            label="Xác nhận mật khẩu mới"
            name="confirmPassword"
            dependencies={['newPassword']}
            rules={[
              { required: true },
              ({ getFieldValue }) => ({
                validator: (_rule, value) =>
                  !value || getFieldValue('newPassword') === value
                    ? Promise.resolve()
                    : Promise.reject(new Error('Mật khẩu xác nhận không khớp')),
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={changePassword.isPending}>
            Đổi mật khẩu
          </Button>
        </Form>
      </Card>
    </Space>
  );
}
