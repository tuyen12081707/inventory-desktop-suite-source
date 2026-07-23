import { PlusOutlined, ShopOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Card, Col, Form, Input, Modal, Row, Space, Tag, Typography } from 'antd';
import { useState } from 'react';
import type { WarehouseSummary } from '@inventory/contracts';
import { api, ApiError } from '../lib/api';

interface WarehouseFormValues {
  code: string;
  name: string;
  address?: string;
}

export function WarehousesPage(): React.JSX.Element {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm<WarehouseFormValues>();
  const warehouses = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api<WarehouseSummary[]>('/warehouses'),
  });
  const createWarehouse = useMutation({
    mutationFn: (values: WarehouseFormValues) =>
      api<WarehouseSummary>('/warehouses', {
        method: 'POST',
        body: JSON.stringify(values),
      }),
    onSuccess: async () => {
      message.success('Đã tạo kho');
      setModalOpen(false);
      form.resetFields();
      await queryClient.invalidateQueries({ queryKey: ['warehouses'] });
    },
    onError: (error) =>
      message.error(error instanceof ApiError ? error.message : 'Không thể tạo kho'),
  });

  return (
    <Space direction="vertical" size="large" className="page-stack">
      <div className="page-heading">
        <div>
          <Typography.Title level={2}>Kho hàng</Typography.Title>
          <Typography.Text type="secondary">Danh sách kho và địa điểm lưu trữ</Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          Thêm kho
        </Button>
      </div>
      <Row gutter={[16, 16]}>
        {warehouses.data?.map((warehouse) => (
          <Col xs={24} md={12} xl={8} key={warehouse.id}>
            <Card loading={warehouses.isLoading}>
              <Space align="start">
                <div className="warehouse-icon">
                  <ShopOutlined />
                </div>
                <div>
                  <Space>
                    <Typography.Title level={4}>{warehouse.name}</Typography.Title>
                    <Tag color={warehouse.active ? 'green' : 'default'}>
                      {warehouse.active ? 'Hoạt động' : 'Tạm ngưng'}
                    </Tag>
                  </Space>
                  <Typography.Paragraph strong>{warehouse.code}</Typography.Paragraph>
                  <Typography.Text type="secondary">
                    {warehouse.address ?? 'Chưa có địa chỉ'}
                  </Typography.Text>
                </div>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
      <Modal
        title="Thêm kho"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createWarehouse.isPending}
        destroyOnHidden
      >
        <Form<WarehouseFormValues>
          form={form}
          layout="vertical"
          onFinish={(values) => createWarehouse.mutate(values)}
        >
          <Form.Item label="Mã kho" name="code" rules={[{ required: true, min: 2 }]}>
            <Input autoFocus />
          </Form.Item>
          <Form.Item label="Tên kho" name="name" rules={[{ required: true, min: 2 }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Địa chỉ" name="address">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
