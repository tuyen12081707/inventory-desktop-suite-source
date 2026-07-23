import { useQuery } from '@tanstack/react-query';
import { Card, Select, Space, Table, Tag, Typography } from 'antd';
import { useState } from 'react';
import type { WarehouseSummary } from '@inventory/contracts';
import { api } from '../lib/api';
import { currencyFormat, numberFormat } from '../lib/format';

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
}

export function InventoryPage(): React.JSX.Element {
  const [warehouseId, setWarehouseId] = useState<string>();
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
          onChange={setWarehouseId}
          options={warehouses.data?.map((warehouse) => ({
            value: warehouse.id,
            label: `${warehouse.code} — ${warehouse.name}`,
          }))}
          className="warehouse-filter"
        />
      </div>
      <Card>
        <Table
          rowKey={(row) => `${row.warehouseId}-${row.productId}`}
          loading={stock.isLoading}
          dataSource={stock.data}
          pagination={{ pageSize: 25, showSizeChanger: true }}
          columns={[
            { title: 'Kho', dataIndex: 'warehouseName' },
            { title: 'SKU', dataIndex: 'sku', width: 130 },
            { title: 'Sản phẩm', dataIndex: 'productName' },
            {
              title: 'Tồn',
              dataIndex: 'quantity',
              align: 'right',
              render: (value: number, row: StockRow) => (
                <Space>
                  <span>
                    {numberFormat.format(value)} {row.unit}
                  </span>
                  {value <= row.reorderPoint && <Tag color="red">Sắp hết</Tag>}
                </Space>
              ),
            },
            {
              title: 'Giá vốn bình quân',
              dataIndex: 'averageCost',
              align: 'right',
              render: (value: number) => currencyFormat.format(value),
            },
            {
              title: 'Giá trị',
              dataIndex: 'value',
              align: 'right',
              render: (value: number) => currencyFormat.format(value),
            },
          ]}
        />
      </Card>
    </Space>
  );
}
