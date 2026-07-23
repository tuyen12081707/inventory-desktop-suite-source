import { PrinterOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Skeleton, Space, Typography } from 'antd';
import { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import type { PaymentMethod, SaleReceipt } from '@inventory/contracts';
import { api } from '../lib/api';
import { currencyFormat, dateTimeFormat, numberFormat } from '../lib/format';

const paymentLabels: Record<PaymentMethod, string> = {
  CASH: 'Tiền mặt',
  CARD: 'Thẻ',
  BANK_TRANSFER: 'Chuyển khoản',
};

export function ReceiptPage(): React.JSX.Element {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const receipt = useQuery({
    queryKey: ['receipt', id],
    queryFn: () => api<SaleReceipt>(`/sales/${id}/receipt`),
    enabled: Boolean(id),
  });

  useEffect(() => {
    if (receipt.data && params.get('print') === '1') window.setTimeout(() => window.print(), 250);
  }, [params, receipt.data]);

  if (receipt.isLoading)
    return (
      <div className="print-page-loading">
        <Skeleton active />
      </div>
    );
  if (!receipt.data) return <Alert type="error" showIcon message="Không thể tải hóa đơn" />;
  const sale = receipt.data;
  const companyLines = [
    sale.company.address,
    sale.company.phone,
    sale.company.email,
    sale.company.taxCode ? `MST: ${sale.company.taxCode}` : undefined,
  ].filter((line): line is string => Boolean(line));

  return (
    <main className={`receipt-page receipt-${sale.company.receiptPaperSize.toLowerCase()}`}>
      <div className="receipt-actions no-print">
        <Space>
          <Button icon={<PrinterOutlined />} type="primary" onClick={() => window.print()}>
            In hóa đơn
          </Button>
          <Typography.Text type="secondary">
            Chọn “Save as PDF” trong hộp in để lưu PDF hóa đơn.
          </Typography.Text>
        </Space>
      </div>
      <article className="receipt-document">
        <header className="receipt-header">
          {sale.company.logoKey ? (
            <img src={sale.company.logoKey} alt="Logo doanh nghiệp" className="receipt-logo" />
          ) : null}
          <Typography.Title level={3}>{sale.company.name}</Typography.Title>
          {companyLines.map((line) => (
            <Typography.Text key={line} className="receipt-company-line">
              {line}
            </Typography.Text>
          ))}
          <Typography.Title level={4}>HÓA ĐƠN BÁN HÀNG</Typography.Title>
          <Typography.Text strong>{sale.number}</Typography.Text>
        </header>
        <section className="receipt-meta">
          <span>Ngày: {dateTimeFormat.format(new Date(sale.soldAt))}</span>
          <span>Kho: {sale.warehouseName}</span>
          <span>Thu ngân: {sale.soldByName}</span>
          {sale.customerName ? (
            <span>
              Khách: {sale.customerName}
              {sale.customerPhone ? ` · ${sale.customerPhone}` : ''}
            </span>
          ) : null}
        </section>
        <table className="receipt-table">
          <thead>
            <tr>
              <th>Hàng hóa</th>
              <th>SL</th>
              <th>Đơn giá</th>
              <th>T.Tiền</th>
            </tr>
          </thead>
          <tbody>
            {sale.lines.map((line) => (
              <tr key={line.productId}>
                <td>
                  <strong>{line.name}</strong>
                  <small>{line.sku}</small>
                </td>
                <td>{numberFormat.format(line.quantity)}</td>
                <td>{currencyFormat.format(line.unitPrice)}</td>
                <td>{currencyFormat.format(line.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <section className="receipt-totals">
          <div>
            <span>Tạm tính</span>
            <strong>{currencyFormat.format(sale.subtotal)}</strong>
          </div>
          <div>
            <span>Giảm giá</span>
            <strong>-{currencyFormat.format(sale.discount)}</strong>
          </div>
          <div>
            <span>VAT ({sale.taxRate}%)</span>
            <strong>{currencyFormat.format(sale.taxAmount)}</strong>
          </div>
          <div className="receipt-grand-total">
            <span>TỔNG THANH TOÁN</span>
            <strong>{currencyFormat.format(sale.total)}</strong>
          </div>
          <div>
            <span>Thanh toán</span>
            <strong>{paymentLabels[sale.paymentMethod]}</strong>
          </div>
        </section>
        <footer className="receipt-footer">
          {sale.company.receiptFooter || 'Cảm ơn quý khách và hẹn gặp lại.'}
        </footer>
      </article>
    </main>
  );
}
