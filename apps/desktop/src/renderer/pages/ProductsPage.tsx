import {
  DeleteOutlined,
  EditOutlined,
  MoreOutlined,
  PlusOutlined,
  PoweroffOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  App,
  Button,
  Card,
  Dropdown,
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
  salePrice: number;
  category: string;
}

export function ProductsPage(): React.JSX.Element {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductSummary | null>(null);
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

  const updateProduct = useMutation({
    mutationFn: (values: ProductFormValues) =>
      api(`/products/${editingProduct?.id}`, { method: 'PATCH', body: JSON.stringify(values) }),
    onSuccess: async () => {
      message.success('Đã cập nhật sản phẩm');
      setModalOpen(false);
      setEditingProduct(null);
      form.resetFields();
      await queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error) =>
      message.error(error instanceof ApiError ? error.message : 'Không thể cập nhật sản phẩm'),
  });

  const changeStatus = useMutation({
    mutationFn: ({ id, active }: Pick<ProductSummary, 'id' | 'active'>) =>
      api(`/products/${id}/status`, { method: 'PATCH', body: JSON.stringify({ active }) }),
    onSuccess: async () => {
      message.success('Đã cập nhật trạng thái sản phẩm');
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await queryClient.invalidateQueries({ queryKey: ['pos-catalog'] });
    },
    onError: (error) =>
      message.error(error instanceof ApiError ? error.message : 'Không thể đổi trạng thái'),
  });

  const deleteProduct = useMutation({
    mutationFn: (id: string) => api(`/products/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      message.success('Đã xóa sản phẩm');
      await queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error) =>
      message.error(error instanceof ApiError ? error.message : 'Không thể xóa sản phẩm'),
  });

  const openCreate = (): void => {
    setEditingProduct(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (product: ProductSummary): void => {
    setEditingProduct(product);
    form.setFieldsValue({
      sku: product.sku,
      name: product.name,
      unit: product.unit,
      barcode: product.barcode,
      reorderPoint: product.reorderPoint,
      standardCost: product.standardCost,
      salePrice: product.salePrice,
      category: product.category,
    });
    setModalOpen(true);
  };

  const confirmStatusChange = (product: ProductSummary): void => {
    modal.confirm({
      title: product.active ? 'Ngừng sử dụng sản phẩm?' : 'Kích hoạt lại sản phẩm?',
      content: product.active
        ? 'Sản phẩm còn tồn kho sẽ không thể ngừng sử dụng.'
        : 'Sản phẩm sẽ xuất hiện lại trong POS và phiếu kho.',
      okText: product.active ? 'Ngừng sử dụng' : 'Kích hoạt',
      cancelText: 'Hủy',
      onOk: () => changeStatus.mutateAsync({ id: product.id, active: !product.active }),
    });
  };

  const confirmDelete = (product: ProductSummary): void => {
    modal.confirm({
      title: 'Xóa vĩnh viễn sản phẩm?',
      content: 'Chỉ xóa được sản phẩm chưa có phát sinh kho hoặc bán hàng.',
      okText: 'Xóa sản phẩm',
      cancelText: 'Hủy',
      okButtonProps: { danger: true },
      onOk: () => deleteProduct.mutateAsync(product.id),
    });
  };

  return (
    <Space direction="vertical" size="large" className="page-stack">
      <div className="page-heading">
        <div>
          <Typography.Title level={2}>Sản phẩm</Typography.Title>
          <Typography.Text type="secondary">Quản lý SKU, barcode và ngưỡng tồn</Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
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
          className="products-table"
          scroll={{ x: 1050 }}
          pagination={{
            current: page,
            pageSize: 25,
            total: products.data?.meta.total,
            showSizeChanger: false,
            onChange: setPage,
          }}
          columns={[
            { title: 'SKU', dataIndex: 'sku', width: 105, fixed: 'left' },
            {
              title: 'Tên sản phẩm',
              dataIndex: 'name',
              width: 210,
              ellipsis: true,
            },
            {
              title: 'Barcode',
              dataIndex: 'barcode',
              width: 150,
              responsive: ['lg'],
              render: (value?: string) => value ?? '—',
            },
            { title: 'ĐVT', dataIndex: 'unit', width: 72, responsive: ['lg'] },
            {
              title: 'Tổng tồn',
              dataIndex: 'stockTotal',
              align: 'right',
              width: 130,
              render: (value: number, row: ProductSummary) => (
                <Space>
                  {numberFormat.format(value)}
                  {value <= row.reorderPoint && <Tag color="red">Sắp hết</Tag>}
                </Space>
              ),
            },
            {
              title: 'Giá vốn',
              dataIndex: 'standardCost',
              align: 'right',
              width: 130,
              responsive: ['xl'],
              render: (value: number) => currencyFormat.format(value),
            },
            {
              title: 'Giá bán',
              dataIndex: 'salePrice',
              align: 'right',
              width: 130,
              responsive: ['md'],
              render: (value: number) => currencyFormat.format(value),
            },
            { title: 'Nhóm hàng', dataIndex: 'category', width: 120, responsive: ['lg'] },
            {
              title: 'Trạng thái',
              dataIndex: 'active',
              width: 105,
              responsive: ['sm'],
              render: (active: boolean) => (
                <Tag color={active ? 'green' : 'default'}>
                  {active ? 'Đang dùng' : 'Ngừng dùng'}
                </Tag>
              ),
            },
            {
              title: '',
              key: 'actions',
              fixed: 'right',
              width: 56,
              align: 'center',
              render: (_value: unknown, row: ProductSummary) => (
                <Dropdown
                  trigger={['click']}
                  placement="bottomRight"
                  menu={{
                    items: [
                      { key: 'edit', icon: <EditOutlined />, label: 'Sửa sản phẩm' },
                      {
                        key: 'status',
                        icon: <PoweroffOutlined />,
                        label: row.active ? 'Ngừng sử dụng' : 'Kích hoạt lại',
                      },
                      { type: 'divider' },
                      {
                        key: 'delete',
                        icon: <DeleteOutlined />,
                        label: 'Xóa sản phẩm',
                        danger: true,
                      },
                    ],
                    onClick: ({ key }) => {
                      if (key === 'edit') openEdit(row);
                      if (key === 'status') confirmStatusChange(row);
                      if (key === 'delete') confirmDelete(row);
                    },
                  }}
                >
                  <Button
                    type="text"
                    icon={<MoreOutlined />}
                    aria-label={`Thao tác với ${row.name}`}
                  />
                </Dropdown>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={editingProduct ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditingProduct(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        confirmLoading={createProduct.isPending || updateProduct.isPending}
        destroyOnHidden
      >
        <Form<ProductFormValues>
          form={form}
          layout="vertical"
          initialValues={{
            unit: 'cái',
            reorderPoint: 0,
            standardCost: 0,
            salePrice: 0,
            category: 'Khác',
          }}
          onFinish={(values) =>
            editingProduct ? updateProduct.mutate(values) : createProduct.mutate(values)
          }
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
          <Form.Item
            label="Nhóm hàng"
            name="category"
            rules={[{ required: true, message: 'Nhập nhóm hàng' }]}
          >
            <Input placeholder="Ví dụ: Phụ kiện, Màn hình..." />
          </Form.Item>
          <div className="form-grid">
            <Form.Item label="Ngưỡng tồn" name="reorderPoint" rules={[{ required: true }]}>
              <InputNumber min={0} precision={0} step={1} className="full-width" />
            </Form.Item>
            <Form.Item label="Giá vốn chuẩn" name="standardCost" rules={[{ required: true }]}>
              <InputNumber min={0} precision={0} className="full-width" addonAfter="₫" />
            </Form.Item>
            <Form.Item label="Giá bán" name="salePrice" rules={[{ required: true }]}>
              <InputNumber min={0} precision={0} className="full-width" addonAfter="₫" />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </Space>
  );
}
