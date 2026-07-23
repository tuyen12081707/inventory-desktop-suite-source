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
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Pagination,
  Select,
  Skeleton,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { useState } from 'react';
import type { PageResult, ProductSummary, WarehouseSummary } from '@inventory/contracts';
import { api, ApiError } from '../lib/api';
import { currencyFormat, numberFormat } from '../lib/format';
import { getStockLevel } from '../lib/stock-level';

interface ProductFormValues {
  sku: string;
  name: string;
  unit: string;
  barcode?: string;
  reorderPoint: number;
  standardCost: number;
  salePrice: number;
  category: string;
  openingQuantity: number;
  openingWarehouseId?: string;
}

function StockStatusTag({
  quantity,
  reorderPoint,
}: {
  quantity: number;
  reorderPoint: number;
}): React.JSX.Element | null {
  const level = getStockLevel(quantity, reorderPoint);
  if (level === 'OUT_OF_STOCK') return <Tag color="red">Hết hàng</Tag>;
  if (level === 'LOW_STOCK') return <Tag color="orange">Sắp hết</Tag>;
  return null;
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
  const warehouses = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api<WarehouseSummary[]>('/warehouses'),
  });
  const activeWarehouses = warehouses.data?.filter((warehouse) => warehouse.active) ?? [];

  const createProduct = useMutation({
    mutationFn: (values: ProductFormValues) =>
      api<ProductSummary>('/products', {
        method: 'POST',
        body: JSON.stringify(values),
      }),
    onSuccess: async (_product, values) => {
      message.success(
        values.openingQuantity > 0 ? 'Đã tạo sản phẩm và ghi nhận tồn ban đầu' : 'Đã tạo sản phẩm',
      );
      setModalOpen(false);
      form.resetFields();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['products'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory'] }),
        queryClient.invalidateQueries({ queryKey: ['documents'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['pos-catalog'] }),
      ]);
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
      openingQuantity: 0,
      openingWarehouseId: undefined,
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

  const renderProductActions = (product: ProductSummary): React.JSX.Element => (
    <Dropdown
      trigger={['click']}
      placement="bottomRight"
      menu={{
        items: [
          { key: 'edit', icon: <EditOutlined />, label: 'Sửa sản phẩm' },
          {
            key: 'status',
            icon: <PoweroffOutlined />,
            label: product.active ? 'Ngừng sử dụng' : 'Kích hoạt lại',
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
          if (key === 'edit') openEdit(product);
          if (key === 'status') confirmStatusChange(product);
          if (key === 'delete') confirmDelete(product);
        },
      }}
    >
      <Button type="text" icon={<MoreOutlined />} aria-label={`Thao tác với ${product.name}`} />
    </Dropdown>
  );

  const productData = products.data?.data ?? [];

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
      <Card className="products-panel">
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
        <div className="products-desktop-table">
          <Table
            rowKey="id"
            loading={products.isLoading}
            dataSource={productData}
            className="products-table"
            scroll={{ x: 1150 }}
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
                    <StockStatusTag quantity={value} reorderPoint={row.reorderPoint} />
                  </Space>
                ),
              },
              {
                title: 'Ngưỡng',
                dataIndex: 'reorderPoint',
                align: 'right',
                width: 90,
                responsive: ['lg'],
                render: (value: number) => (value > 0 ? numberFormat.format(value) : 'Tắt'),
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
                render: (_value: unknown, row: ProductSummary) => renderProductActions(row),
              },
            ]}
          />
        </div>

        <div className="products-mobile-list">
          {products.isLoading ? (
            <div className="mobile-product-loading">
              <Skeleton active paragraph={{ rows: 3 }} />
              <Skeleton active paragraph={{ rows: 3 }} />
            </div>
          ) : products.isError ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không thể tải sản phẩm" />
          ) : productData.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có sản phẩm phù hợp" />
          ) : (
            productData.map((product) => (
              <article className="mobile-product-card" key={product.id}>
                <div className="mobile-product-header">
                  <div>
                    <Typography.Text strong className="mobile-product-name">
                      {product.name}
                    </Typography.Text>
                    <Typography.Text type="secondary" className="mobile-product-sku">
                      {product.sku}
                    </Typography.Text>
                  </div>
                  <div className="mobile-product-actions">{renderProductActions(product)}</div>
                </div>

                <div className="mobile-product-tags">
                  <Tag color={product.active ? 'green' : 'default'}>
                    {product.active ? 'Đang dùng' : 'Ngừng dùng'}
                  </Tag>
                  <StockStatusTag
                    quantity={product.stockTotal}
                    reorderPoint={product.reorderPoint}
                  />
                  <Tag>{product.category}</Tag>
                </div>

                <div className="mobile-product-metrics">
                  <div>
                    <span>Tồn kho</span>
                    <strong>
                      {numberFormat.format(product.stockTotal)} {product.unit}
                    </strong>
                  </div>
                  <div>
                    <span>Giá bán</span>
                    <strong>{currencyFormat.format(product.salePrice)}</strong>
                  </div>
                </div>

                <div className="mobile-product-meta">
                  <span>
                    Barcode: <strong>{product.barcode ?? 'Chưa có'}</strong>
                  </span>
                  <span>
                    Giá vốn: <strong>{currencyFormat.format(product.standardCost)}</strong>
                  </span>
                  <span>
                    Ngưỡng cảnh báo:{' '}
                    <strong>
                      {product.reorderPoint > 0
                        ? `${numberFormat.format(product.reorderPoint)} ${product.unit}`
                        : 'Đang tắt'}
                    </strong>
                  </span>
                </div>
              </article>
            ))
          )}

          {(products.data?.meta.total ?? 0) > 0 && (
            <Pagination
              simple
              current={page}
              pageSize={25}
              total={products.data?.meta.total}
              showSizeChanger={false}
              onChange={setPage}
              className="mobile-product-pagination"
            />
          )}
        </div>
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
            openingQuantity: 0,
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
            <Form.Item
              label="Ngưỡng cảnh báo"
              name="reorderPoint"
              rules={[{ required: true }]}
              extra="Áp dụng riêng cho sản phẩm này trên tổng tất cả kho. Nhập 0 để chỉ cảnh báo khi hết hàng."
            >
              <InputNumber min={0} precision={0} step={1} className="full-width" />
            </Form.Item>
            <Form.Item label="Giá vốn chuẩn" name="standardCost" rules={[{ required: true }]}>
              <InputNumber min={0} precision={0} className="full-width" addonAfter="₫" />
            </Form.Item>
            <Form.Item label="Giá bán" name="salePrice" rules={[{ required: true }]}>
              <InputNumber min={0} precision={0} className="full-width" addonAfter="₫" />
            </Form.Item>
          </div>
          {editingProduct ? (
            <div className="product-stock-readonly">
              <Typography.Text type="secondary">Tổng tồn hiện tại</Typography.Text>
              <Typography.Text strong>
                {numberFormat.format(editingProduct.stockTotal)} {editingProduct.unit}
              </Typography.Text>
              <Typography.Text type="secondary">
                Muốn thay đổi số lượng, hãy tạo Phiếu kho hoặc Phiếu điều chỉnh để giữ đúng lịch sử
                kho.
              </Typography.Text>
            </div>
          ) : (
            <div className="form-grid">
              <Form.Item
                label="Số lượng tồn ban đầu"
                name="openingQuantity"
                rules={[
                  { required: true, message: 'Nhập số lượng tồn ban đầu' },
                  {
                    type: 'integer',
                    min: 0,
                    message: 'Số lượng tồn phải là số nguyên không âm',
                  },
                ]}
                extra="Nhập 0 nếu chưa có hàng. Hệ thống sẽ tạo phiếu nhập đã ghi sổ khi số lượng lớn hơn 0."
              >
                <InputNumber min={0} precision={0} step={1} className="full-width" />
              </Form.Item>
              <Form.Item
                noStyle
                shouldUpdate={(previous, current) =>
                  previous.openingQuantity !== current.openingQuantity
                }
              >
                {({ getFieldValue }) => (
                  <Form.Item
                    label="Kho nhận tồn ban đầu"
                    name="openingWarehouseId"
                    rules={[
                      {
                        validator: async (_rule, value?: string) => {
                          if (Number(getFieldValue('openingQuantity')) > 0 && !value) {
                            throw new Error('Chọn kho nhận tồn ban đầu');
                          }
                        },
                      },
                    ]}
                    extra={
                      activeWarehouses.length === 0
                        ? 'Chưa có kho đang hoạt động. Hãy tạo hoặc kích hoạt kho trước.'
                        : 'Chỉ bắt buộc khi tồn ban đầu lớn hơn 0.'
                    }
                  >
                    <Select
                      allowClear
                      showSearch
                      loading={warehouses.isLoading}
                      disabled={activeWarehouses.length === 0}
                      placeholder="Chọn kho"
                      optionFilterProp="label"
                      options={activeWarehouses.map((warehouse) => ({
                        value: warehouse.id,
                        label: `${warehouse.code} — ${warehouse.name}`,
                      }))}
                    />
                  </Form.Item>
                )}
              </Form.Item>
            </div>
          )}
        </Form>
      </Modal>
    </Space>
  );
}
