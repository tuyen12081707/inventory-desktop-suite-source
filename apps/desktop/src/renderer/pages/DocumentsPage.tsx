import {
  CheckOutlined,
  EyeOutlined,
  MoreOutlined,
  PlusOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  App,
  Button,
  Card,
  Descriptions,
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
import type {
  DocumentStatus,
  DocumentType,
  PageResult,
  ProductSummary,
  StockDocumentDetail,
  StockDocumentSummary,
  WarehouseSummary,
} from '@inventory/contracts';
import { api, ApiError } from '../lib/api';
import { dateTimeFormat, numberFormat } from '../lib/format';

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

const PAGE_SIZE = 25;

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
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [form] = Form.useForm<DocumentFormValues>();
  const documentType = Form.useWatch('type', form);

  const documents = useQuery({
    queryKey: ['documents'],
    queryFn: () => api<StockDocumentSummary[]>('/inventory/documents'),
  });
  const documentDetail = useQuery({
    queryKey: ['document-detail', selectedDocumentId],
    queryFn: () => api<StockDocumentDetail>(`/inventory/documents/${selectedDocumentId}`),
    enabled: Boolean(selectedDocumentId),
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
    mutationFn: (values: DocumentFormValues) => {
      const payload = {
        ...values,
        destinationWarehouseId:
          values.type === 'TRANSFER' ? values.destinationWarehouseId : undefined,
        idempotencyKey: crypto.randomUUID(),
      };
      return api<StockDocumentSummary>('/inventory/documents', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
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
  const documentData = documents.data ?? [];
  const mobilePageData = documentData.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const confirmApprove = (document: StockDocumentSummary): void => {
    modal.confirm({
      title: 'Duyệt phiếu này?',
      content: 'Sau khi duyệt, phiếu sẵn sàng để ghi sổ.',
      okText: 'Duyệt phiếu',
      cancelText: 'Hủy',
      onOk: () => approveDocument.mutateAsync(document.id),
    });
  };

  const confirmPost = (document: StockDocumentSummary): void => {
    modal.confirm({
      title: 'Ghi sổ tồn kho?',
      content: 'Thao tác này cập nhật tồn và không thể sửa trực tiếp.',
      okText: 'Ghi sổ',
      cancelText: 'Hủy',
      onOk: () => postDocument.mutateAsync(document.id),
    });
  };

  const renderDocumentActions = (document: StockDocumentSummary): React.JSX.Element => {
    const items = [
      { key: 'view', icon: <EyeOutlined />, label: 'Xem chi tiết' },
      ...(document.status === 'DRAFT'
        ? [{ key: 'approve', icon: <CheckOutlined />, label: 'Duyệt phiếu' }]
        : []),
      ...(document.status === 'APPROVED'
        ? [{ key: 'post', icon: <SendOutlined />, label: 'Ghi sổ' }]
        : []),
    ];
    return (
      <Dropdown
        trigger={['click']}
        placement="bottomRight"
        menu={{
          items,
          onClick: ({ key }) => {
            if (key === 'view') setSelectedDocumentId(document.id);
            if (key === 'approve') confirmApprove(document);
            if (key === 'post') confirmPost(document);
          },
        }}
      >
        <Button icon={<MoreOutlined />}>Thao tác</Button>
      </Dropdown>
    );
  };

  const warehouseDisplay = (document: StockDocumentSummary): string =>
    document.type === 'TRANSFER' && document.destinationWarehouseName
      ? `${document.warehouseName} → ${document.destinationWarehouseName}`
      : document.warehouseName;

  return (
    <Space direction="vertical" size="large" className="page-stack">
      <div className="page-heading">
        <div>
          <Typography.Title level={2}>Phiếu kho</Typography.Title>
          <Typography.Text type="secondary">
            Nhập, xuất, chuyển và điều chỉnh: nháp → duyệt → ghi sổ. Tồn ban đầu được tự tạo từ màn
            Sản phẩm.
          </Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          Tạo phiếu
        </Button>
      </div>
      <Card className="documents-panel">
        <div className="documents-desktop-table">
          <Table
            rowKey="id"
            loading={documents.isLoading}
            dataSource={documentData}
            className="documents-table"
            scroll={{ x: 905 }}
            pagination={{ pageSize: PAGE_SIZE }}
            columns={[
              { title: 'Số phiếu', dataIndex: 'number', width: 180 },
              {
                title: 'Loại',
                dataIndex: 'type',
                width: 95,
                render: (type: DocumentType) => typeLabels[type],
              },
              {
                title: 'Kho',
                key: 'warehouse',
                width: 190,
                render: (_value: unknown, row: StockDocumentSummary) => warehouseDisplay(row),
              },
              {
                title: 'Trạng thái',
                dataIndex: 'status',
                width: 105,
                render: (status: DocumentStatus) => (
                  <Tag color={statusColors[status]}>{statusLabels[status]}</Tag>
                ),
              },
              { title: 'Số dòng', dataIndex: 'lineCount', align: 'right', width: 70 },
              {
                title: 'Người tạo',
                dataIndex: 'createdByName',
                width: 140,
                responsive: ['xxl'],
              },
              {
                title: 'Ngày tạo',
                dataIndex: 'createdAt',
                width: 145,
                render: (value: string) => dateTimeFormat.format(new Date(value)),
              },
              {
                title: 'Thao tác',
                key: 'actions',
                fixed: 'right',
                width: 120,
                align: 'center',
                render: (_value: unknown, row: StockDocumentSummary) => renderDocumentActions(row),
              },
            ]}
          />
        </div>

        <div className="documents-mobile-list">
          {documents.isLoading ? (
            <div className="mobile-list-loading">
              <Skeleton active paragraph={{ rows: 3 }} />
              <Skeleton active paragraph={{ rows: 3 }} />
            </div>
          ) : documents.isError ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không thể tải phiếu kho" />
          ) : mobilePageData.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có phiếu kho" />
          ) : (
            mobilePageData.map((document) => (
              <article className="mobile-document-card" key={document.id}>
                <div className="mobile-list-card-header">
                  <div>
                    <Typography.Text strong className="mobile-list-card-title">
                      {document.number}
                    </Typography.Text>
                    <Typography.Text type="secondary" className="mobile-list-card-code">
                      {typeLabels[document.type]}
                    </Typography.Text>
                  </div>
                  <Tag color={statusColors[document.status]}>{statusLabels[document.status]}</Tag>
                </div>

                <div className="mobile-document-route">
                  <div>
                    <span>{document.type === 'TRANSFER' ? 'Luân chuyển kho' : 'Kho'}</span>
                    <strong>{warehouseDisplay(document)}</strong>
                  </div>
                </div>

                <div className="mobile-list-metrics">
                  <div>
                    <span>Số dòng hàng</span>
                    <strong>{numberFormat.format(document.lineCount)}</strong>
                  </div>
                  <div>
                    <span>Ngày tạo</span>
                    <strong>{dateTimeFormat.format(new Date(document.createdAt))}</strong>
                  </div>
                </div>

                <div className="mobile-list-meta">
                  <span>
                    Người tạo: <strong>{document.createdByName}</strong>
                  </span>
                </div>

                <div className="mobile-document-actions">{renderDocumentActions(document)}</div>
              </article>
            ))
          )}

          {documentData.length > PAGE_SIZE && (
            <Pagination
              simple
              current={page}
              pageSize={PAGE_SIZE}
              total={documentData.length}
              showSizeChanger={false}
              onChange={setPage}
              className="mobile-list-pagination"
            />
          )}
        </div>
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
            <Form.Item
              label={documentType === 'TRANSFER' ? 'Kho xuất' : 'Kho'}
              name="warehouseId"
              rules={[{ required: true, message: 'Chọn kho' }]}
            >
              <Select showSearch optionFilterProp="label" options={warehouseOptions} />
            </Form.Item>
            {documentType === 'TRANSFER' && (
              <Form.Item
                label="Kho nhận"
                name="destinationWarehouseId"
                rules={[
                  { required: true, message: 'Chọn kho nhận' },
                  ({ getFieldValue }) => ({
                    validator: async (_rule, value?: string) => {
                      if (value && value === getFieldValue('warehouseId')) {
                        throw new Error('Kho nhận phải khác kho xuất');
                      }
                    },
                  }),
                ]}
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
                        precision={0}
                        step={1}
                        min={documentType === 'ADJUSTMENT' ? undefined : 1}
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

      <Modal
        title={
          documentDetail.data ? `Chi tiết phiếu ${documentDetail.data.number}` : 'Chi tiết phiếu'
        }
        open={Boolean(selectedDocumentId)}
        onCancel={() => setSelectedDocumentId(null)}
        footer={[
          <Button key="close" onClick={() => setSelectedDocumentId(null)}>
            Đóng
          </Button>,
        ]}
        width={820}
        destroyOnHidden
      >
        {documentDetail.isLoading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : documentDetail.isError || !documentDetail.data ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không thể tải chi tiết phiếu" />
        ) : (
          <Space direction="vertical" size="large" className="full-width">
            <Descriptions
              size="small"
              bordered
              column={{ xs: 1, sm: 2 }}
              items={[
                {
                  key: 'type',
                  label: 'Loại phiếu',
                  children: typeLabels[documentDetail.data.type],
                },
                {
                  key: 'status',
                  label: 'Trạng thái',
                  children: (
                    <Tag color={statusColors[documentDetail.data.status]}>
                      {statusLabels[documentDetail.data.status]}
                    </Tag>
                  ),
                },
                {
                  key: 'warehouse',
                  label: documentDetail.data.type === 'TRANSFER' ? 'Luân chuyển kho' : 'Kho',
                  children: warehouseDisplay(documentDetail.data),
                },
                {
                  key: 'created',
                  label: 'Người tạo',
                  children: documentDetail.data.createdByName,
                },
                {
                  key: 'date',
                  label: 'Ngày tạo',
                  children: dateTimeFormat.format(new Date(documentDetail.data.createdAt)),
                },
                {
                  key: 'reference',
                  label: 'Tham chiếu',
                  children: documentDetail.data.reference ?? '—',
                },
                {
                  key: 'note',
                  label: 'Ghi chú',
                  span: 2,
                  children: documentDetail.data.note ?? '—',
                },
              ]}
            />
            <div>
              <Typography.Title level={5}>
                Hàng hóa ({documentDetail.data.lineCount})
              </Typography.Title>
              <div className="document-detail-lines">
                {documentDetail.data.lines.map((line) => (
                  <div className="document-detail-line" key={line.id}>
                    <div className="document-detail-product">
                      <Typography.Text strong>{line.productName}</Typography.Text>
                      <Typography.Text type="secondary">{line.sku}</Typography.Text>
                    </div>
                    <div>
                      <span>Số lượng</span>
                      <strong>
                        {numberFormat.format(line.quantity)} {line.unit}
                      </strong>
                    </div>
                    <div>
                      <span>Đơn giá</span>
                      <strong>{numberFormat.format(line.unitCost)} ₫</strong>
                    </div>
                    <div>
                      <span>Thành tiền</span>
                      <strong>{numberFormat.format(line.totalCost)} ₫</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Space>
        )}
      </Modal>
    </Space>
  );
}
