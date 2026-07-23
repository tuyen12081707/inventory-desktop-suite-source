import { useQuery } from '@tanstack/react-query';
import { Button, Skeleton, Typography } from 'antd';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ReportOverview } from '@inventory/contracts';
import { api } from '../lib/api';
import { currencyFormat, numberFormat } from '../lib/format';

export function ReportPrintPage(): React.JSX.Element {
  const [params] = useSearchParams();
  const report = useQuery({
    queryKey: ['report-print', params.toString()],
    queryFn: () => api<ReportOverview>(`/reports/overview?${params.toString()}`),
  });
  useEffect(() => {
    if (report.data) window.setTimeout(() => window.print(), 250);
  }, [report.data]);
  if (!report.data)
    return (
      <div className="print-page-loading">
        <Skeleton active />
      </div>
    );
  const data = report.data;
  return (
    <main className="report-print-page">
      <div className="no-print">
        <Button type="primary" onClick={() => window.print()}>
          In / Lưu PDF
        </Button>
      </div>
      <article className="report-document">
        <header>
          <Typography.Title level={2}>{data.companyName}</Typography.Title>
          <Typography.Title level={3}>BÁO CÁO KINH DOANH</Typography.Title>
          <Typography.Text>
            Từ {new Date(data.from).toLocaleDateString('vi-VN')} đến{' '}
            {new Date(data.to).toLocaleDateString('vi-VN')}
          </Typography.Text>
        </header>
        <section className="report-print-kpis">
          <div>
            Doanh thu<strong>{currencyFormat.format(data.revenue)}</strong>
          </div>
          <div>
            Lợi nhuận gộp<strong>{currencyFormat.format(data.grossProfit)}</strong>
          </div>
          <div>
            Hóa đơn<strong>{numberFormat.format(data.invoiceCount)}</strong>
          </div>
          <div>
            Giá trị tồn<strong>{currencyFormat.format(data.inventoryValue)}</strong>
          </div>
        </section>
        <Typography.Title level={4}>Sản phẩm bán chạy</Typography.Title>
        <table className="report-print-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Sản phẩm</th>
              <th>SL</th>
              <th>Doanh thu</th>
              <th>Lợi nhuận gộp</th>
            </tr>
          </thead>
          <tbody>
            {data.topProducts.map((item) => (
              <tr key={item.productId}>
                <td>{item.sku}</td>
                <td>{item.name}</td>
                <td>{numberFormat.format(item.quantity)}</td>
                <td>{currencyFormat.format(item.revenue)}</td>
                <td>{currencyFormat.format(item.grossProfit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Typography.Title level={4}>Cảnh báo tồn kho</Typography.Title>
        <table className="report-print-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Sản phẩm</th>
              <th>Tồn</th>
              <th>Ngưỡng</th>
            </tr>
          </thead>
          <tbody>
            {data.lowStock.map((item) => (
              <tr key={item.productId}>
                <td>{item.sku}</td>
                <td>{item.name}</td>
                <td>{numberFormat.format(item.quantity)}</td>
                <td>{numberFormat.format(item.reorderPoint)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <footer>Xuất lúc {new Date().toLocaleString('vi-VN')}</footer>
      </article>
    </main>
  );
}
