import { useQuery } from '@tanstack/react-query';
import { Card, Empty, Pagination, Select, Skeleton, Space, Table, Tag, Typography } from 'antd';
import { useState } from 'react';
import type { WarehouseSummary } from '@inventory/contracts';
import { api } from '../lib/api';
import { currencyFormat, numberFormat } from '../lib/format';
import { getStockLevel } from '../lib/stock-level';

const PAGE_SIZE = 25;

interface StockRow {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  productId: string;
  sku: string;
  productName: string;
  unit: string;
  quantity: number;
  averageCost: number;
  value: number;
  reorderPoint: number;
  productStockTotal: number;
}

function StockAlertTag({
  total,
  reorderPoint,
}: {
  total: number;
  reorderPoint: number;
}): React.JSX.Element | null {
  const level = getStockLevel(total, reorderPoint);
  if (level === 'OUT_OF_STOCK') return <Tag color="red">Hết hàng</Tag>;
  if (level === 'LOW_STOCK') return <Tag color="orange">Tổng tồn thấp</Tag>;
  return null;
}

export function InventoryPage(): React.JSX.Element {
  const [warehouseId, setWarehouseId] = useState<string>();
  const [page, setPage] = useState(1);
  const warehouses = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api<WarehouseSummary[]>('/warehouses'),
  });
  const stock = useQuery({
    queryKey: ['stock', warehouseId],
    queryFn: () =>
      api<StockRow[]>(
        `/inventory/stock${warehouseId ? `?warehouseId=${encodeURIComponent(warehouseId)}` : ''}`,
      ),
  });
  const stockData = stock.data ?? [];
  const mobilePageData = stockData.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <Space direction="vertical" size="large" className="page-stack">
      <div className="page-heading">
        <div>
          <Typography.Title level={2}>Tồn kho hiện tại</Typography.Title>
          <Typography.Text type="secondary">
            Số liệu tổng hợp từ stock ledger đã ghi sổ
          </Typography.Text>
        </div>
        <Select
          allowClear
          placeholder="Tất cả kho"
          value={warehouseId}
          onChange={(value) => {
            setWarehouseId(value);
            setPage(1);
          }}
          options={warehouses.data?.map((warehouse) => ({
            value: warehouse.id,
            label: `${warehouse.code} — ${warehouse.name}`,
          }))}
          className="warehouse-filter"
        />
      </div>
      <Card className="inventory-panel">
        <div className="inventory-desktop-table">
          <Table
            rowKey={(row) => `${row.warehouseId}-${row.productId}`}
            loading={stock.isLoading}
            dataSource={stockData}
            scroll={{ x: 1060 }}
            pagination={{ pageSize: PAGE_SIZE, showSizeChanger: true }}
            columns={[
              { title: 'Kho', dataIndex: 'warehouseName', width: 170, fixed: 'left' },
              { title: 'SKU', dataIndex: 'sku', width: 120 },
              { title: 'Sản phẩm', dataIndex: 'productName', width: 210, ellipsis: true },
              {
                title: 'Tồn tại kho',
                dataIndex: 'quantity',
                align: 'right',
                width: 130,
                render: (value: number, row: StockRow) =>
                  `${numberFormat.format(value)} ${row.unit}`,
              },
              {
                title: 'Tổng tồn',
                dataIndex: 'productStockTotal',
                align: 'right',
                width: 180,
                render: (value: number | undefined, row: StockRow) => {
                  const total = value ?? row.quantity;
                  return (
                    <Space>
                      <span>{numberFormat.format(total)}</span>
                      <StockAlertTag total={total} reorderPoint={row.reorderPoint} />
                    </Space>
                  );
                },
              },
              {
                title: 'Giá vốn bình quân',
                dataIndex: 'averageCost',
                align: 'right',
                width: 160,
                render: (value: number) => currencyFormat.format(value),
              },
              {
                title: 'Giá trị tại kho',
                dataIndex: 'value',
                align: 'right',
                width: 150,
                render: (value: number) => currencyFormat.format(value),
              },
            ]}
          />
        </div>

        <div className="inventory-mobile-list">
          {stock.isLoading ? (
            <div className="mobile-list-loading">
              <Skeleton active paragraph={{ rows: 3 }} />
              <Skeleton active paragraph={{ rows: 3 }} />
            </div>
          ) : stock.isError ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không thể tải tồn kho" />
          ) : mobilePageData.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Kho chưa có số dư" />
          ) : (
            mobilePageData.map((row) => {
              const total = row.productStockTotal ?? row.quantity;
              return (
                <article
                  className="mobile-inventory-card"
                  key={`${row.warehouseId}-${row.productId}`}
                >
                  <div className="mobile-list-card-header">
                    <div>
                      <Typography.Text strong className="mobile-list-card-title">
                        {row.productName}
                      </Typography.Text>
                      <Typography.Text type="secondary" className="mobile-list-card-code">
                        {row.sku}
                      </Typography.Text>
                    </div>
                    <StockAlertTag total={total} reorderPoint={row.reorderPoint} />
                  </div>

                  <div className="mobile-warehouse-name">{row.warehouseName}</div>

                  <div className="mobile-list-metrics">
                    <div>
                      <span>Tồn tại kho</span>
                      <strong>
                        {numberFormat.format(row.quantity)} {row.unit}
                      </strong>
                    </div>
                    <div>
                      <span>Tổng tất cả kho</span>
                      <strong>
                        {numberFormat.format(total)} {row.unit}
                      </strong>
                    </div>
                  </div>

                  <div className="mobile-list-meta">
                    <span>
                      Ngưỡng riêng: <strong>{numberFormat.format(row.reorderPoint)}</strong>
                    </span>
                    <span>
                      Giá vốn BQ: <strong>{currencyFormat.format(row.averageCost)}</strong>
                    </span>
                    <span>
                      Giá trị tại kho: <strong>{currencyFormat.format(row.value)}</strong>
                    </span>
                  </div>
                </article>
              );
            })
          )}

          {stockData.length > PAGE_SIZE && (
            <Pagination
              simple
              current={page}
              pageSize={PAGE_SIZE}
              total={stockData.length}
              showSizeChanger={false}
              onChange={setPage}
              className="mobile-list-pagination"
            />
          )}
        </div>
      </Card>
    </Space>
  );
}
