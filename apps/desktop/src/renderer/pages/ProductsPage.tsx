import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  App,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { useState } from 'react';
import type { PageResult, ProductSummary } from '@inventory/contracts';
import { api, ApiError } from '../lib/api';
import { currencyFormat, numberFormat } from '../lib/format';

interface ProductFormValues {
  sku: string;
  name: string;
  unit: string;
  barcode?: string;
  reorderPoint: number;
  standardCost: number;
}

export function ProductsPage(): React.JSX.Element {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [form] = Form.useForm<ProductFormValues>();

  const products = useQuery({
    queryKey: ['products', search, page],
    queryFn: () =>
      api<PageResult<ProductSummary>>(
        `/products?search=${encodeURIComponent(search)}&page=${page}&pageSize=25`,
      ),
  });

  const createProduct = useMutation({
    mutationFn: (values: ProductFormValues) =>
      api<ProductSummary>('/products', {
        method: 'POST',
        body: JSON.stringify(values),
      }),
    onSuccess: async () => {
      message.success('Đã tạo sản phẩm');
      setModalOpen(false);
      form.resetFields();
      await queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error) =>
      message.error(error instanceof ApiError ? error.message : 'Không thể tạo sản phẩm'),
  });

  return (
    <Space direction="vertical" size="large" className="page-stack">
      <div className="page-heading">
        <div>
          <Typography.Title level={2}>Sản phẩm</Typography.Title>
          <Typography.Text type="secondary">Quản lý SKU, barcode và ngưỡng tồn</Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          Thêm sản phẩm
        </Button>
      </div>
      <Card>
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="Tìm theo tên, SKU hoặc barcode"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="table-search"
        />
        <Table
          rowKey="id"
          loading={products.isLoading}
          dataSource={products.data?.data}
          pagination={{
            current: page,
            pageSize: 25,
            total: products.data?.meta.total,
            showSizeChanger: false,
            onChange: setPage,
          }}
          columns={[
            { title: 'SKU', dataIndex: 'sku', width: 130 },
            { title: 'Tên sản phẩm', dataIndex: 'name' },
            { title: 'Barcode', dataIndex: 'barcode', render: (value?: string) => value ?? '—' },
            { title: 'ĐVT', dataIndex: 'unit', width: 90 },
            {
              title: 'Tổng tồn',
              dataIndex: 'stockTotal',
              align: 'right',
              render: (value: number, row: ProductSummary) => (
                <Space>
                  {numberFormat.format(value)}
                  {value <= row.reorderPoint && <Tag color="red">Sắp hết</Tag>}
                </Space>
              ),
            },
            {
              title: 'Giá chuẩn',
              dataIndex: 'standardCost',
              align: 'right',
              render: (value: number) => currencyFormat.format(value),
            },
            {
              title: 'Trạng thái',
              dataIndex: 'active',
              render: (active: boolean) => (
                <Tag color={active ? 'green' : 'default'}>
                  {active ? 'Đang dùng' : 'Ngừng dùng'}
                </Tag>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title="Thêm sản phẩm"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createProduct.isPending}
        destroyOnHidden
      >
        <Form<ProductFormValues>
          form={form}
          layout="vertical"
          initialValues={{ unit: 'cái', reorderPoint: 0, standardCost: 0 }}
          onFinish={(values) => createProduct.mutate(values)}
        >
          <div className="form-grid">
            <Form.Item
              label="SKU"
              name="sku"
              rules={[{ required: true, min: 2, message: 'Nhập mã SKU' }]}
            >
              <Input autoFocus />
            </Form.Item>
            <Form.Item label="Đơn vị tính" name="unit" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          </div>
          <Form.Item
            label="Tên sản phẩm"
            name="name"
            rules={[{ required: true, min: 2, message: 'Nhập tên sản phẩm' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="Barcode" name="barcode">
            <Input placeholder="Quét hoặc nhập barcode" />
          </Form.Item>
          <div className="form-grid">
            <Form.Item label="Ngưỡng tồn" name="reorderPoint" rules={[{ required: true }]}>
              <InputNumber min={0} precision={3} className="full-width" />
            </Form.Item>
            <Form.Item label="Giá vốn chuẩn" name="standardCost" rules={[{ required: true }]}>
              <InputNumber min={0} precision={0} className="full-width" addonAfter="₫" />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </Space>
  );
}
