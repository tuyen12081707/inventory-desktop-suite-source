import { CheckOutlined, PlusOutlined, SendOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  App,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { useState } from 'react';
import type {
  DocumentStatus,
  DocumentType,
  PageResult,
  ProductSummary,
  StockDocumentSummary,
  WarehouseSummary,
} from '@inventory/contracts';
import { api, ApiError } from '../lib/api';
import { dateTimeFormat } from '../lib/format';

const typeLabels: Record<DocumentType, string> = {
  RECEIPT: 'Nhập kho',
  ISSUE: 'Xuất kho',
  TRANSFER: 'Chuyển kho',
  ADJUSTMENT: 'Điều chỉnh',
};

const statusLabels: Record<DocumentStatus, string> = {
  DRAFT: 'Nháp',
  APPROVED: 'Đã duyệt',
  POSTED: 'Đã ghi sổ',
  REVERSED: 'Đã đảo',
  CANCELLED: 'Đã hủy',
};

const statusColors: Record<DocumentStatus, string> = {
  DRAFT: 'default',
  APPROVED: 'blue',
  POSTED: 'green',
  REVERSED: 'orange',
  CANCELLED: 'red',
};

interface DocumentFormValues {
  type: DocumentType;
  warehouseId: string;
  destinationWarehouseId?: string;
  reference?: string;
  note?: string;
  lines: Array<{
    productId: string;
    quantity: number;
    unitCost: number;
  }>;
}

export function DocumentsPage(): React.JSX.Element {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm<DocumentFormValues>();
  const documentType = Form.useWatch('type', form);

  const documents = useQuery({
    queryKey: ['documents'],
    queryFn: () => api<StockDocumentSummary[]>('/inventory/documents'),
  });
  const warehouses = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api<WarehouseSummary[]>('/warehouses'),
  });
  const products = useQuery({
    queryKey: ['products', 'document-select'],
    queryFn: () => api<PageResult<ProductSummary>>('/products?page=1&pageSize=100'),
  });

  const refreshInventory = async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['documents'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['stock'] }),
      queryClient.invalidateQueries({ queryKey: ['products'] }),
    ]);
  };

  const createDocument = useMutation({
    mutationFn: (values: DocumentFormValues) =>
      api<StockDocumentSummary>('/inventory/documents', {
        method: 'POST',
        body: JSON.stringify({ ...values, idempotencyKey: crypto.randomUUID() }),
      }),
    onSuccess: async () => {
      message.success('Đã tạo phiếu nháp');
      setModalOpen(false);
      form.resetFields();
      await refreshInventory();
    },
    onError: (error) =>
      message.error(error instanceof ApiError ? error.message : 'Không thể tạo phiếu'),
  });

  const approveDocument = useMutation({
    mutationFn: (id: string) => api(`/inventory/documents/${id}/approve`, { method: 'POST' }),
    onSuccess: async () => {
      message.success('Đã duyệt phiếu');
      await refreshInventory();
    },
    onError: (error) =>
      message.error(error instanceof ApiError ? error.message : 'Không thể duyệt phiếu'),
  });

  const postDocument = useMutation({
    mutationFn: (id: string) => api(`/inventory/documents/${id}/post`, { method: 'POST' }),
    onSuccess: async () => {
      message.success('Đã ghi sổ tồn kho');
      await refreshInventory();
    },
    onError: (error) =>
      message.error(error instanceof ApiError ? error.message : 'Không thể ghi sổ phiếu'),
  });

  const warehouseOptions = warehouses.data?.map((warehouse) => ({
    value: warehouse.id,
    label: `${warehouse.code} — ${warehouse.name}`,
  }));
  const productOptions = products.data?.data.map((product) => ({
    value: product.id,
    label: `${product.sku} — ${product.name}`,
  }));

  return (
    <Space direction="vertical" size="large" className="page-stack">
      <div className="page-heading">
        <div>
          <Typography.Title level={2}>Phiếu kho</Typography.Title>
          <Typography.Text type="secondary">
            Quy trình nháp → duyệt → ghi sổ; phiếu đã ghi sổ không thể sửa
          </Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          Tạo phiếu
        </Button>
      </div>
      <Card>
        <Table
          rowKey="id"
          loading={documents.isLoading}
          dataSource={documents.data}
          scroll={{ x: 1100 }}
          pagination={{ pageSize: 25 }}
          columns={[
            { title: 'Số phiếu', dataIndex: 'number', width: 210, fixed: 'left' },
            {
              title: 'Loại',
              dataIndex: 'type',
              width: 120,
              render: (type: DocumentType) => typeLabels[type],
            },
            { title: 'Kho nguồn', dataIndex: 'warehouseName', width: 180 },
            {
              title: 'Kho đích',
              dataIndex: 'destinationWarehouseName',
              width: 180,
              render: (value?: string) => value ?? '—',
            },
            {
              title: 'Trạng thái',
              dataIndex: 'status',
              width: 120,
              render: (status: DocumentStatus) => (
                <Tag color={statusColors[status]}>{statusLabels[status]}</Tag>
              ),
            },
            { title: 'Số dòng', dataIndex: 'lineCount', align: 'right', width: 90 },
            { title: 'Người tạo', dataIndex: 'createdByName', width: 170 },
            {
              title: 'Ngày tạo',
              dataIndex: 'createdAt',
              width: 160,
              render: (value: string) => dateTimeFormat.format(new Date(value)),
            },
            {
              title: 'Thao tác',
              key: 'actions',
              fixed: 'right',
              width: 210,
              render: (_value: unknown, row: StockDocumentSummary) => (
                <Space>
                  {row.status === 'DRAFT' && (
                    <Popconfirm
                      title="Duyệt phiếu này?"
                      description="Sau khi duyệt, phiếu sẵn sàng để ghi sổ."
                      onConfirm={() => approveDocument.mutate(row.id)}
                    >
                      <Button size="small" icon={<CheckOutlined />}>
                        Duyệt
                      </Button>
                    </Popconfirm>
                  )}
                  {row.status === 'APPROVED' && (
                    <Popconfirm
                      title="Ghi sổ tồn kho?"
                      description="Thao tác này cập nhật tồn và không thể sửa trực tiếp."
                      onConfirm={() => postDocument.mutate(row.id)}
                    >
                      <Button size="small" type="primary" icon={<SendOutlined />}>
                        Ghi sổ
                      </Button>
                    </Popconfirm>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title="Tạo phiếu kho"
        open={modalOpen}
        width={900}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createDocument.isPending}
        destroyOnHidden
      >
        <Form<DocumentFormValues>
          form={form}
          layout="vertical"
          initialValues={{
            type: 'RECEIPT',
            lines: [{ quantity: 1, unitCost: 0 }],
          }}
          onFinish={(values) => createDocument.mutate(values)}
        >
          <div className="form-grid form-grid-3">
            <Form.Item label="Loại phiếu" name="type" rules={[{ required: true }]}>
              <Select
                options={Object.entries(typeLabels).map(([value, label]) => ({
                  value,
                  label,
                }))}
              />
            </Form.Item>
            <Form.Item label="Kho nguồn" name="warehouseId" rules={[{ required: true }]}>
              <Select showSearch optionFilterProp="label" options={warehouseOptions} />
            </Form.Item>
            {documentType === 'TRANSFER' && (
              <Form.Item
                label="Kho đích"
                name="destinationWarehouseId"
                rules={[{ required: true }]}
              >
                <Select showSearch optionFilterProp="label" options={warehouseOptions} />
              </Form.Item>
            )}
          </div>
          <div className="form-grid">
            <Form.Item label="Tham chiếu" name="reference">
              <Input placeholder="PO, hóa đơn, yêu cầu xuất..." />
            </Form.Item>
            <Form.Item label="Ghi chú" name="note">
              <Input />
            </Form.Item>
          </div>
          <Typography.Title level={5}>Chi tiết hàng hóa</Typography.Title>
          <Form.List name="lines">
            {(fields, { add, remove }) => (
              <Space direction="vertical" className="full-width">
                {fields.map((field, index) => (
                  <div className="document-line" key={field.key}>
                    <Form.Item
                      label={index === 0 ? 'Sản phẩm' : undefined}
                      name={[field.name, 'productId']}
                      rules={[{ required: true, message: 'Chọn sản phẩm' }]}
                      className="line-product"
                    >
                      <Select showSearch optionFilterProp="label" options={productOptions} />
                    </Form.Item>
                    <Form.Item
                      label={index === 0 ? 'Số lượng' : undefined}
                      name={[field.name, 'quantity']}
                      rules={[{ required: true }]}
                    >
                      <InputNumber
                        precision={3}
                        min={documentType === 'ADJUSTMENT' ? undefined : 0.001}
                      />
                    </Form.Item>
                    <Form.Item
                      label={index === 0 ? 'Đơn giá' : undefined}
                      name={[field.name, 'unitCost']}
                      rules={[{ required: true }]}
                    >
                      <InputNumber min={0} precision={0} addonAfter="₫" />
                    </Form.Item>
                    <Button
                      danger
                      disabled={fields.length === 1}
                      onClick={() => remove(field.name)}
                      className={index === 0 ? 'line-remove-first' : undefined}
                    >
                      Xóa
                    </Button>
                  </div>
                ))}
                <Button onClick={() => add({ quantity: 1, unitCost: 0 })}>+ Thêm dòng</Button>
              </Space>
            )}
          </Form.List>
        </Form>
      </Modal>
    </Space>
  );
}
