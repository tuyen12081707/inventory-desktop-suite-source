import {
  CameraOutlined,
  DeleteOutlined,
  LockOutlined,
  SaveOutlined,
  SettingOutlined,
  UploadOutlined,
} from '@ant-design/icons';
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
  Upload,
} from 'antd';
import { useEffect, useState } from 'react';
import type { CompanySettings } from '@inventory/contracts';
import { api, ApiError } from '../lib/api';

interface PasswordValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const SUPPORTED_LOGO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_LOGO_FILE_SIZE = 5 * 1024 * 1024;
const MAX_STORED_LOGO_SIZE = 60 * 1024;

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Không thể đọc ảnh'));
    reader.readAsDataURL(blob);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Không thể nén ảnh'))),
      'image/webp',
      quality,
    );
  });
}

async function compressLogo(file: File): Promise<string> {
  if (!SUPPORTED_LOGO_TYPES.has(file.type)) {
    throw new Error('Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP');
  }
  if (file.size > MAX_LOGO_FILE_SIZE) {
    throw new Error('Ảnh gốc không được lớn hơn 5 MB');
  }

  const sourceDataUrl = await readAsDataUrl(file);
  const image = new window.Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Không thể giải mã ảnh đã chọn'));
    image.src = sourceDataUrl;
  });

  const initialScale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
  let width = Math.max(1, Math.round(image.naturalWidth * initialScale));
  let height = Math.max(1, Math.round(image.naturalHeight * initialScale));

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Trình duyệt không hỗ trợ xử lý ảnh');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const blob = await canvasToBlob(canvas, Math.max(0.5, 0.84 - attempt * 0.07));
    if (blob.size <= MAX_STORED_LOGO_SIZE) return readAsDataUrl(blob);

    width = Math.max(160, Math.round(width * 0.82));
    height = Math.max(160, Math.round(height * 0.82));
  }
  throw new Error('Không thể nén ảnh đủ nhỏ, hãy chọn ảnh khác');
}

export function SettingsPage(): React.JSX.Element {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [companyForm] = Form.useForm<CompanySettings>();
  const [passwordForm] = Form.useForm<PasswordValues>();
  const [logoProcessing, setLogoProcessing] = useState(false);
  const logoUrl = Form.useWatch('logoKey', companyForm);
  const uploadedLogo = logoUrl?.startsWith('data:image/');
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

  const handleLogoFile = async (file: File): Promise<void> => {
    setLogoProcessing(true);
    try {
      const compressedLogo = await compressLogo(file);
      companyForm.setFieldValue('logoKey', compressedLogo);
      await companyForm.validateFields(['logoKey']);
      message.success('Đã chuẩn bị ảnh logo. Bấm Lưu cài đặt để áp dụng.');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không thể xử lý ảnh');
    } finally {
      setLogoProcessing(false);
    }
  };

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
            <Form.Item label="Logo doanh nghiệp">
              <div className="settings-logo-controls">
                <Form.Item
                  name="logoKey"
                  noStyle
                  getValueProps={(value?: string) => ({
                    value: value?.startsWith('data:image/') ? '' : value,
                  })}
                  rules={[
                    {
                      validator: (_rule, value?: string) => {
                        if (!value) return Promise.resolve();
                        if (/^data:image\/(?:jpeg|png|webp);base64,/i.test(value)) {
                          return value.length <= 85_000
                            ? Promise.resolve()
                            : Promise.reject(new Error('Ảnh logo quá lớn'));
                        }
                        try {
                          const url = new URL(value);
                          return url.protocol === 'http:' || url.protocol === 'https:'
                            ? Promise.resolve()
                            : Promise.reject(new Error('URL logo phải dùng HTTP hoặc HTTPS'));
                        } catch {
                          return Promise.reject(new Error('Nhập URL ảnh hợp lệ hoặc chọn ảnh'));
                        }
                      },
                    },
                  ]}
                >
                  <Input
                    placeholder={uploadedLogo ? 'Đang dùng ảnh đã tải lên' : 'https://…/logo.png'}
                    disabled={logoProcessing}
                  />
                </Form.Item>
                <div className="settings-logo-buttons">
                  <Upload
                    accept="image/jpeg,image/png,image/webp"
                    maxCount={1}
                    showUploadList={false}
                    beforeUpload={async (file) => {
                      await handleLogoFile(file);
                      return Upload.LIST_IGNORE;
                    }}
                  >
                    <Button icon={<UploadOutlined />} loading={logoProcessing}>
                      Chọn ảnh
                    </Button>
                  </Upload>
                  <Upload
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    maxCount={1}
                    showUploadList={false}
                    beforeUpload={async (file) => {
                      await handleLogoFile(file);
                      return Upload.LIST_IGNORE;
                    }}
                  >
                    <Button icon={<CameraOutlined />} loading={logoProcessing}>
                      Chụp ảnh
                    </Button>
                  </Upload>
                  {logoUrl && (
                    <Button
                      danger
                      icon={<DeleteOutlined />}
                      disabled={logoProcessing}
                      onClick={() => companyForm.setFieldValue('logoKey', '')}
                    >
                      Xóa
                    </Button>
                  )}
                </div>
              </div>
              <Typography.Text type="secondary" className="settings-field-help">
                Dán URL hoặc chọn ảnh JPG, PNG, WebP tối đa 5 MB. Trên điện thoại, “Chụp ảnh” sẽ mở
                camera sau.
              </Typography.Text>
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
