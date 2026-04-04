import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Card, Descriptions, Table, Spin, Typography, Tag, message, Button,
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { getPurchase } from '../../api/purchases.api';
import { formatINR, formatDate } from '../../utils/formatCurrency';
import PurchaseReturnModal from '../../components/PurchaseReturnModal/PurchaseReturnModal';

const { Title } = Typography;

export default function PurchaseDetailPage() {
  const { id } = useParams();
  const [purchase, setPurchase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [returnModalOpen, setReturnModalOpen] = useState(false);

  const fetchPurchase = () => {
    setLoading(true);
    getPurchase(id)
      .then(({ data }) => setPurchase(data.data))
      .catch(() => message.error('Failed to load purchase'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPurchase();
  }, [id]);

  if (loading) return <div style={{ padding: 48, textAlign: 'center' }}><Spin size="large" /></div>;
  if (!purchase) return <div style={{ padding: 48 }}>Purchase not found</div>;

  const columns = [
    { title: 'Product', dataIndex: 'product_name', key: 'product_name', render: (t) => <strong>{t}</strong> },
    { title: 'Qty', dataIndex: 'qty', key: 'qty', width: 80, align: 'right' },
    { title: 'Unit', dataIndex: 'unit', key: 'unit', width: 80 },
    { title: 'Cost Price', dataIndex: 'cost_price', key: 'cost_price', width: 120, render: (v) => formatINR(v), align: 'right' },
    { title: 'Line Total', dataIndex: 'line_total', key: 'line_total', width: 120, render: (v) => formatINR(v), align: 'right' },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Link to="/purchases"><ArrowLeftOutlined /> Back to Purchases</Link>

      <Card style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Title level={4} style={{ margin: 0 }}>{purchase.po_number}</Title>
          <Button type="default" danger onClick={() => setReturnModalOpen(true)}>Return Items</Button>
        </div>
        <Descriptions column={3} size="small">
          <Descriptions.Item label="Date">{formatDate(purchase.date)}</Descriptions.Item>
          <Descriptions.Item label="Supplier">{purchase.supplier_name}</Descriptions.Item>
          <Descriptions.Item label="Total">{formatINR(purchase.total_amount)}</Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color="green">{purchase.status}</Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="Items" style={{ marginTop: 16 }}>
        <Table
          dataSource={purchase.items}
          columns={columns}
          rowKey="id"
          pagination={false}
          size="small"
          footer={() => (
            <div style={{ textAlign: 'right', fontSize: 16 }}>
              <strong>Total: {formatINR(purchase.total_amount)}</strong>
            </div>
          )}
        />
      </Card>

      <PurchaseReturnModal
        open={returnModalOpen}
        purchase={purchase}
        onClose={() => setReturnModalOpen(false)}
        onSuccess={fetchPurchase}
      />
    </div>
  );
}
