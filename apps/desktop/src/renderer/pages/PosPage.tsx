import {
  BarcodeOutlined,
  CameraOutlined,
  ClearOutlined,
  CloseOutlined,
  MinusOutlined,
  PlusOutlined,
  PrinterOutlined,
  SearchOutlined,
  ShoppingCartOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  App,
  Button,
  Card,
  Col,
  Empty,
  Input,
  InputNumber,
  Modal,
  Radio,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import type { InputRef } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  PaymentMethod,
  PosCatalogItem,
  SaleReceipt,
  WarehouseSummary,
} from '@inventory/contracts';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';
import { api, ApiError } from '../lib/api';
import { currencyFormat, numberFormat } from '../lib/format';
import { desktop } from '../lib/platform';

interface CartLine {
  product: PosCatalogItem;
  quantity: number;
}

const paymentLabels: Record<PaymentMethod, string> = {
  CASH: 'Tiền mặt',
  CARD: 'Thẻ',
  BANK_TRANSFER: 'Chuyển khoản',
};

export function PosPage(): React.JSX.Element {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const scanInputRef = useRef<InputRef>(null);
  const [warehouseId, setWarehouseId] = useState('');
  const [search, setSearch] = useState('');
  const [scanCode, setScanCode] = useState('');
  const [category, setCategory] = useState('Tất cả');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discount, setDiscount] = useState(0);
  const [taxRate, setTaxRate] = useState(8);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [receipt, setReceipt] = useState<SaleReceipt | null>(null);
  const [checkoutKey, setCheckoutKey] = useState(() => crypto.randomUUID());

  const warehouses = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api<WarehouseSummary[]>('/warehouses'),
  });

  useEffect(() => {
    if (!warehouseId && warehouses.data?.[0]) setWarehouseId(warehouses.data[0].id);
  }, [warehouseId, warehouses.data]);

  const catalog = useQuery({
    queryKey: ['pos-catalog', warehouseId, search],
    queryFn: () =>
      api<PosCatalogItem[]>(
        `/sales/catalog?warehouseId=${encodeURIComponent(warehouseId)}&search=${encodeURIComponent(search)}`,
      ),
    enabled: Boolean(warehouseId),
  });

  const resetCheckoutKey = (): void => setCheckoutKey(crypto.randomUUID());

  const addToCart = useCallback(
    (product: PosCatalogItem): void => {
      if (product.stockQuantity <= 0) {
        message.warning(`${product.name} đã hết hàng`);
        return;
      }
      setCart((current) => {
        const existing = current.find((line) => line.product.id === product.id);
        if (existing && existing.quantity >= product.stockQuantity) {
          message.warning(`Chỉ còn ${numberFormat.format(product.stockQuantity)} ${product.unit}`);
          return current;
        }
        if (existing) {
          return current.map((line) =>
            line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line,
          );
        }
        return [...current, { product, quantity: 1 }];
      });
      resetCheckoutKey();
      window.setTimeout(() => scanInputRef.current?.focus(), 0);
    },
    [message],
  );

  const resolveProduct = useMutation({
    mutationFn: (code: string) =>
      api<PosCatalogItem>(
        `/sales/resolve?warehouseId=${encodeURIComponent(warehouseId)}&code=${encodeURIComponent(code)}`,
      ),
    onSuccess: (product) => {
      addToCart(product);
      setScanCode('');
      message.success(`Đã thêm ${product.name}`);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : 'Không đọc được mã sản phẩm');
      window.setTimeout(() => scanInputRef.current?.focus(), 0);
    },
  });

  const submitCode = (rawCode: string): void => {
    const code = rawCode.trim();
    if (!warehouseId) {
      message.warning('Hãy chọn kho bán hàng');
      return;
    }
    if (!code || resolveProduct.isPending) return;
    resolveProduct.mutate(code);
  };

  const updateQuantity = (productId: string, nextQuantity: number): void => {
    setCart((current) =>
      current
        .map((line) => {
          if (line.product.id !== productId) return line;
          const quantity = Math.min(line.product.stockQuantity, Math.max(0, nextQuantity));
          return { ...line, quantity };
        })
        .filter((line) => line.quantity > 0),
    );
    resetCheckoutKey();
  };

  const subtotal = useMemo(
    () => cart.reduce((sum, line) => sum + line.product.salePrice * line.quantity, 0),
    [cart],
  );
  const safeDiscount = Math.min(discount, subtotal);
  const taxAmount = ((subtotal - safeDiscount) * taxRate) / 100;
  const total = subtotal - safeDiscount + taxAmount;
  const totalItems = cart.reduce((sum, line) => sum + line.quantity, 0);

  const checkout = useMutation({
    mutationFn: () =>
      api<SaleReceipt>('/sales/checkout', {
        method: 'POST',
        body: JSON.stringify({
          warehouseId,
          customerName: customerName || undefined,
          customerPhone: customerPhone || undefined,
          discount: safeDiscount,
          taxRate,
          paymentMethod,
          idempotencyKey: checkoutKey,
          lines: cart.map((line) => ({
            productId: line.product.id,
            quantity: line.quantity,
          })),
        }),
      }),
    onSuccess: async (sale) => {
      setReceipt(sale);
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setDiscount(0);
      setCheckoutKey(crypto.randomUUID());
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['pos-catalog'] }),
        queryClient.invalidateQueries({ queryKey: ['stock'] }),
        queryClient.invalidateQueries({ queryKey: ['products'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['documents'] }),
      ]);
      window.setTimeout(() => scanInputRef.current?.focus(), 0);
    },
    onError: (error) =>
      message.error(error instanceof ApiError ? error.message : 'Thanh toán không thành công'),
  });

  const categories = useMemo(
    () => ['Tất cả', ...new Set(catalog.data?.map((product) => product.category) ?? [])],
    [catalog.data],
  );
  const visibleProducts =
    category === 'Tất cả'
      ? catalog.data
      : catalog.data?.filter((product) => product.category === category);

  useEffect(() => {
    if (!categories.includes(category)) setCategory('Tất cả');
  }, [categories, category]);

  useEffect(() => {
    const focusScanner = (event: KeyboardEvent): void => {
      if (event.key === 'F2') {
        event.preventDefault();
        scanInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', focusScanner);
    return () => window.removeEventListener('keydown', focusScanner);
  }, []);

  return (
    <div className="pos-page">
      <section className="pos-catalog">
        <div className="pos-toolbar">
          <div>
            <Typography.Title level={2}>Bán hàng POS</Typography.Title>
            <Typography.Text type="secondary">
              Quét barcode, nhập SKU hoặc ID sản phẩm
            </Typography.Text>
          </div>
          <Select
            value={warehouseId || undefined}
            loading={warehouses.isLoading}
            disabled={cart.length > 0}
            placeholder="Chọn kho bán hàng"
            className="pos-warehouse"
            options={warehouses.data?.map((warehouse) => ({
              value: warehouse.id,
              label: `${warehouse.code} — ${warehouse.name}`,
            }))}
            onChange={(value) => {
              setWarehouseId(value);
              setCart([]);
            }}
          />
        </div>

        <Card className="scanner-card">
          <Input
            ref={scanInputRef}
            size="large"
            autoFocus
            value={scanCode}
            prefix={<BarcodeOutlined />}
            suffix={<Typography.Text type="secondary">Enter · F2</Typography.Text>}
            placeholder="Quét barcode hoặc nhập SKU / Product ID rồi nhấn Enter"
            onChange={(event) => setScanCode(event.target.value)}
            onPressEnter={() => submitCode(scanCode)}
          />
          <Button size="large" icon={<CameraOutlined />} onClick={() => setScannerOpen(true)}>
            Camera
          </Button>
        </Card>

        <div className="catalog-filters">
          <Segmented
            options={categories}
            value={category}
            onChange={(value) => setCategory(String(value))}
          />
          <Input
            allowClear
            value={search}
            prefix={<SearchOutlined />}
            placeholder="Tìm tên, SKU, barcode…"
            className="pos-search"
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {catalog.isLoading ? (
          <div className="catalog-loading">
            <Spin size="large" />
          </div>
        ) : visibleProducts?.length ? (
          <Row gutter={[16, 16]} className="product-grid">
            {visibleProducts.map((product) => {
              const outOfStock = product.stockQuantity <= 0;
              const lowStock =
                product.stockQuantity > 0 && product.stockQuantity <= product.reorderPoint;
              return (
                <Col xs={24} sm={12} xl={8} xxl={6} key={product.id}>
                  <Card
                    hoverable={!outOfStock}
                    className={`pos-product-card${outOfStock ? ' is-disabled' : ''}`}
                    onClick={() => !outOfStock && addToCart(product)}
                  >
                    <div className="product-visual">
                      <ShoppingCartOutlined />
                      <Tag color={outOfStock ? 'default' : lowStock ? 'red' : 'green'}>
                        {outOfStock
                          ? 'Hết hàng'
                          : lowStock
                            ? `Sắp hết: ${numberFormat.format(product.stockQuantity)}`
                            : `Còn: ${numberFormat.format(product.stockQuantity)}`}
                      </Tag>
                    </div>
                    <Typography.Text type="secondary" className="product-sku">
                      {product.sku}
                    </Typography.Text>
                    <Typography.Title level={5} ellipsis={{ rows: 2 }}>
                      {product.name}
                    </Typography.Title>
                    <Typography.Text strong className="product-price">
                      {currencyFormat.format(product.salePrice)}
                    </Typography.Text>
                    <Button
                      type="primary"
                      ghost
                      block
                      icon={<PlusOutlined />}
                      disabled={outOfStock}
                    >
                      Thêm
                    </Button>
                  </Card>
                </Col>
              );
            })}
          </Row>
        ) : (
          <Empty description="Không có sản phẩm phù hợp" className="catalog-empty" />
        )}
      </section>

      <aside className="pos-cart">
        <div className="cart-heading">
          <div>
            <Typography.Title level={3}>Hóa đơn bán hàng</Typography.Title>
            <Typography.Text type="secondary">
              {numberFormat.format(totalItems)} sản phẩm
            </Typography.Text>
          </div>
          <Button
            danger
            type="text"
            icon={<ClearOutlined />}
            disabled={!cart.length}
            onClick={() => {
              setCart([]);
              setDiscount(0);
              resetCheckoutKey();
            }}
          >
            Xóa giỏ
          </Button>
        </div>

        <div className="customer-fields">
          <Input
            placeholder="Tên khách hàng (không bắt buộc)"
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
          />
          <Input
            placeholder="Số điện thoại"
            value={customerPhone}
            onChange={(event) => setCustomerPhone(event.target.value)}
          />
        </div>

        <div className="cart-lines">
          {cart.length ? (
            cart.map((line) => (
              <div className="cart-line" key={line.product.id}>
                <div className="cart-line-top">
                  <div>
                    <Typography.Text strong>{line.product.name}</Typography.Text>
                    <Typography.Text type="secondary" className="cart-line-meta">
                      {line.product.sku} · {currencyFormat.format(line.product.salePrice)}
                    </Typography.Text>
                  </div>
                  <Button
                    danger
                    type="text"
                    size="small"
                    icon={<CloseOutlined />}
                    aria-label={`Xóa ${line.product.name}`}
                    onClick={() => updateQuantity(line.product.id, 0)}
                  />
                </div>
                <div className="cart-line-bottom">
                  <Space.Compact>
                    <Button
                      icon={<MinusOutlined />}
                      onClick={() => updateQuantity(line.product.id, line.quantity - 1)}
                    />
                    <InputNumber
                      min={1}
                      max={line.product.stockQuantity}
                      precision={3}
                      value={line.quantity}
                      controls={false}
                      onChange={(value) => updateQuantity(line.product.id, Number(value ?? 1))}
                    />
                    <Button
                      icon={<PlusOutlined />}
                      disabled={line.quantity >= line.product.stockQuantity}
                      onClick={() => updateQuantity(line.product.id, line.quantity + 1)}
                    />
                  </Space.Compact>
                  <Typography.Text strong>
                    {currencyFormat.format(line.quantity * line.product.salePrice)}
                  </Typography.Text>
                </div>
              </div>
            ))
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Quét mã hoặc chọn sản phẩm để bắt đầu"
              className="cart-empty"
            />
          )}
        </div>

        <div className="cart-summary">
          <div className="summary-inputs">
            <label>
              <span>Giảm giá</span>
              <InputNumber
                min={0}
                max={subtotal}
                precision={0}
                value={discount}
                addonAfter="₫"
                onChange={(value) => {
                  setDiscount(Number(value ?? 0));
                  resetCheckoutKey();
                }}
              />
            </label>
            <label>
              <span>VAT</span>
              <InputNumber
                min={0}
                max={100}
                precision={1}
                value={taxRate}
                addonAfter="%"
                onChange={(value) => {
                  setTaxRate(Number(value ?? 0));
                  resetCheckoutKey();
                }}
              />
            </label>
          </div>
          <div className="summary-row">
            <span>Tạm tính</span>
            <strong>{currencyFormat.format(subtotal)}</strong>
          </div>
          <div className="summary-row">
            <span>Chiết khấu</span>
            <strong className="discount-value">
              {safeDiscount > 0
                ? `-${currencyFormat.format(safeDiscount)}`
                : currencyFormat.format(0)}
            </strong>
          </div>
          <div className="summary-row">
            <span>Thuế VAT ({taxRate}%)</span>
            <strong>{currencyFormat.format(taxAmount)}</strong>
          </div>
          <div className="summary-total">
            <span>Tổng cộng</span>
            <strong>{currencyFormat.format(total)}</strong>
          </div>
          <Radio.Group
            value={paymentMethod}
            optionType="button"
            buttonStyle="solid"
            className="payment-methods"
            options={Object.entries(paymentLabels).map(([value, label]) => ({ value, label }))}
            onChange={(event) => {
              setPaymentMethod(event.target.value as PaymentMethod);
              resetCheckoutKey();
            }}
          />
          <Button
            type="primary"
            size="large"
            block
            className="checkout-button"
            icon={<WalletOutlined />}
            loading={checkout.isPending}
            disabled={!cart.length || !warehouseId}
            onClick={() => checkout.mutate()}
          >
            Thanh toán {currencyFormat.format(total)}
          </Button>
          <Typography.Text type="secondary" className="checkout-note">
            Thanh toán sẽ tự động tạo phiếu xuất và trừ tồn kho.
          </Typography.Text>
        </div>
      </aside>

      <BarcodeScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={(code) => {
          setScannerOpen(false);
          setScanCode(code);
          submitCode(code);
        }}
      />

      <Modal
        open={Boolean(receipt)}
        title="Thanh toán thành công"
        onCancel={() => setReceipt(null)}
        footer={[
          <Button key="close" onClick={() => setReceipt(null)}>
            Đóng
          </Button>,
          <Button
            key="print"
            type="primary"
            icon={<PrinterOutlined />}
            onClick={() => void desktop.printCurrentWindow()}
          >
            In hóa đơn
          </Button>,
        ]}
      >
        {receipt && (
          <div className="receipt-summary">
            <div className="receipt-success">
              <WalletOutlined />
            </div>
            <Typography.Title level={3}>{receipt.number}</Typography.Title>
            <Typography.Text type="secondary">
              {receipt.warehouseName} · {receipt.soldByName}
            </Typography.Text>
            <div className="summary-total">
              <span>Đã thanh toán</span>
              <strong>{currencyFormat.format(receipt.total)}</strong>
            </div>
            <Typography.Text>
              Đã trừ {receipt.lines.reduce((sum, line) => sum + line.quantity, 0)} sản phẩm khỏi tồn
              kho.
            </Typography.Text>
          </div>
        )}
      </Modal>
    </div>
  );
}
