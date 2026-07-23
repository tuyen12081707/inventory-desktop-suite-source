import {
  AlertOutlined,
  AppstoreOutlined,
  DatabaseOutlined,
  DollarOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { Card, Col, Row, Skeleton, Space, Table, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import type { DashboardSummary, DocumentStatus, DocumentType } from '@inventory/contracts';
import { api } from '../lib/api';
import { currencyFormat, dateTimeFormat, numberFormat } from '../lib/format';

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

export function DashboardPage(): React.JSX.Element {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<DashboardSummary>('/inventory/dashboard'),
  });

  if (isLoading || !data) return <Skeleton active />;

  const stats = [
    {
      title: 'Sản phẩm đang hoạt động',
      value: numberFormat.format(data.totalProducts),
      icon: <AppstoreOutlined />,
    },
    {
      title: 'Tổng số lượng tồn',
      value: numberFormat.format(data.totalQuantity),
      icon: <DatabaseOutlined />,
    },
    {
      title: 'Giá trị tồn kho',
      value: currencyFormat.format(data.inventoryValue),
      icon: <DollarOutlined />,
    },
    {
      title: 'Sản phẩm sắp hết',
      value: numberFormat.format(data.lowStockProducts),
      icon: <AlertOutlined />,
      warning: data.lowStockProducts > 0,
    },
  ];

  return (
    <Space direction="vertical" size="large" className="page-stack">
      <div>
        <Typography.Title level={2}>Tổng quan kho</Typography.Title>
        <Typography.Text type="secondary">
          Số liệu tồn kho cập nhật từ các chứng từ đã ghi sổ
        </Typography.Text>
      </div>
      <Row gutter={[16, 16]}>
        {stats.map((stat) => (
          <Col xs={24} sm={12} xl={6} key={stat.title}>
            <Card>
              <div className="stat-card">
                <div className={stat.warning ? 'stat-icon stat-icon-warning' : 'stat-icon'}>
                  {stat.icon}
                </div>
                <div>
                  <Typography.Text type="secondary">{stat.title}</Typography.Text>
                  <div className={stat.warning ? 'stat-value warning' : 'stat-value'}>
                    {stat.value}
                  </div>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
      <Card
        title={
          <Space>
            <FileTextOutlined />
            Chứng từ gần đây
          </Space>
        }
        extra={<Tag>{data.draftDocuments} phiếu nháp</Tag>}
      >
        <Table
          rowKey="id"
          pagination={false}
          dataSource={data.recentDocuments}
          columns={[
            { title: 'Số phiếu', dataIndex: 'number' },
            {
              title: 'Loại',
              dataIndex: 'type',
              render: (type: DocumentType) => typeLabels[type],
            },
            { title: 'Kho', dataIndex: 'warehouseName' },
            {
              title: 'Trạng thái',
              dataIndex: 'status',
              render: (status: DocumentStatus) => (
                <Tag
                  color={status === 'POSTED' ? 'green' : status === 'APPROVED' ? 'blue' : 'default'}
                >
                  {statusLabels[status]}
                </Tag>
              ),
            },
            {
              title: 'Ngày tạo',
              dataIndex: 'createdAt',
              render: (value: string) => dateTimeFormat.format(new Date(value)),
            },
          ]}
        />
      </Card>
    </Space>
  );
}
