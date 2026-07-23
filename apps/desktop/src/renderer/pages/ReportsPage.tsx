import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import {
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Typography,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useMemo, useState } from 'react';
import type { ReportOverview, WarehouseSummary } from '@inventory/contracts';
import { api } from '../lib/api';
import { currencyFormat, numberFormat } from '../lib/format';

const { RangePicker } = DatePicker;

export function ReportsPage(): React.JSX.Element {
  const [dates, setDates] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs()]);
  const [warehouseId, setWarehouseId] = useState<string>();
  const params = useMemo(
    () =>
      new URLSearchParams({
        from: dates[0].format('YYYY-MM-DD'),
        to: dates[1].format('YYYY-MM-DD'),
        ...(warehouseId ? { warehouseId } : {}),
      }).toString(),
    [dates, warehouseId],
  );
  const report = useQuery({
    queryKey: ['reports', params],
    queryFn: () => api<ReportOverview>(`/reports/overview?${params}`),
  });
  const warehouses = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api<WarehouseSummary[]>('/warehouses'),
  });
  const exportPdf = (): void => {
    const origin = window.location.href.replace(/#.*/, '');
    window.open(`${origin}#/reports/print?${params}`, '_blank', 'noopener');
  };
  const data = report.data;
  const maxRevenue = Math.max(...(data?.revenueSeries.map((row) => row.revenue) ?? [1]));
  return (
    <Space direction="vertical" size="large" className="page-stack">
      <div className="page-heading report-heading">
        <div>
          <Typography.Title level={2}>Báo cáo & phân tích</Typography.Title>
          <Typography.Text type="secondary">
            Theo dõi doanh thu, lợi nhuận gộp và tình hình tồn kho
          </Typography.Text>
        </div>
        <Button type="primary" icon={<DownloadOutlined />} disabled={!data} onClick={exportPdf}>
          Xuất PDF
        </Button>
      </div>
      <Card className="report-filter">
        <Space wrap>
          <RangePicker
            value={dates}
            format="DD/MM/YYYY"
            allowClear={false}
            onChange={(value) => value?.[0] && value[1] && setDates([value[0], value[1]])}
          />
          <Select
            allowClear
            placeholder="Tất cả kho"
            value={warehouseId}
            className="warehouse-filter"
            options={warehouses.data?.map((warehouse) => ({
              value: warehouse.id,
              label: `${warehouse.code} — ${warehouse.name}`,
            }))}
            onChange={setWarehouseId}
          />
          <Button icon={<ReloadOutlined />} onClick={() => report.refetch()}>
            Cập nhật
          </Button>
        </Space>
      </Card>
      <Row gutter={[16, 16]}>
        {[
          ['Doanh thu thuần', data?.revenue, true],
          ['Lợi nhuận gộp', data?.grossProfit, true],
          ['Số hóa đơn', data?.invoiceCount, false],
          ['Giá trị tồn', data?.inventoryValue, true],
        ].map(([title, value, money]) => (
          <Col xs={24} sm={12} xl={6} key={String(title)}>
            <Card loading={report.isLoading}>
              <Statistic
                title={title}
                value={Number(value ?? 0)}
                formatter={(current) =>
                  money
                    ? currencyFormat.format(Number(current))
                    : numberFormat.format(Number(current))
                }
              />
            </Card>
          </Col>
        ))}
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={15}>
          <Card title="Doanh thu theo ngày" loading={report.isLoading}>
            <div className="report-bars">
              {data?.revenueSeries.length ? (
                data.revenueSeries.map((row) => (
                  <div className="report-bar-row" key={row.date}>
                    <span>{dayjs(row.date).format('DD/MM')}</span>
                    <div className="report-bar-track">
                      <div
                        className="report-bar"
                        style={{ width: `${Math.max(3, (row.revenue / maxRevenue) * 100)}%` }}
                      />
                    </div>
                    <strong>{currencyFormat.format(row.revenue)}</strong>
                  </div>
                ))
              ) : (
                <Empty description="Chưa có doanh thu trong khoảng đã chọn" />
              )}
            </div>
          </Card>
        </Col>
        <Col xs={24} xl={9}>
          <Card title={`Cảnh báo tồn (${data?.lowStockProducts ?? 0})`} loading={report.isLoading}>
            <Table
              size="small"
              pagination={false}
              dataSource={data?.lowStock}
              rowKey="productId"
              scroll={{ x: 420 }}
              columns={[
                {
                  title: 'Sản phẩm',
                  dataIndex: 'name',
                  render: (name: string, row: { sku: string }) => (
                    <>
                      <div>{name}</div>
                      <Typography.Text type="secondary">{row.sku}</Typography.Text>
                    </>
                  ),
                },
                {
                  title: 'Tồn',
                  dataIndex: 'quantity',
                  align: 'right',
                  render: (value: number) => numberFormat.format(value),
                },
                { title: 'Ngưỡng', dataIndex: 'reorderPoint', align: 'right' },
              ]}
            />
          </Card>
        </Col>
      </Row>
      <Card title="Sản phẩm bán chạy" loading={report.isLoading}>
        <Table
          rowKey="productId"
          pagination={false}
          scroll={{ x: 700 }}
          dataSource={data?.topProducts}
          columns={[
            { title: 'SKU', dataIndex: 'sku' },
            { title: 'Sản phẩm', dataIndex: 'name' },
            {
              title: 'Số lượng',
              dataIndex: 'quantity',
              align: 'right',
              render: (value: number) => numberFormat.format(value),
            },
            {
              title: 'Doanh thu',
              dataIndex: 'revenue',
              align: 'right',
              render: (value: number) => currencyFormat.format(value),
            },
            {
              title: 'Lợi nhuận gộp',
              dataIndex: 'grossProfit',
              align: 'right',
              render: (value: number) => currencyFormat.format(value),
            },
          ]}
        />
      </Card>
    </Space>
  );
}
