import React, { useState, useEffect } from 'react';
import { Table, Typography, Spin, message, Tag } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import { getLowStockProducts } from '../../api/products.api';
import { formatINR } from '../../utils/formatCurrency';

const { Title } = Typography;

export default function LowStockPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLowStockProducts()
      .then(({ data }) => setProducts(Array.isArray(data.data.products) ? data.data.products : []))
      .catch(() => message.error('Failed to load low stock products'))
      .finally(() => setLoading(false));
  }, []);

  const columns = [
    { title: 'Product Name', dataIndex: 'name', key: 'name', render: (t) => <strong>{t}</strong> },
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 100 },
    { title: 'Category', dataIndex: 'category', key: 'category', width: 120 },
    { title: 'Unit', dataIndex: 'unit', key: 'unit', width: 80 },
    {
      title: 'Current Stock', dataIndex: 'current_stock', key: 'current_stock', width: 120,
      render: (v) => <span style={{ color: '#ff4d4f', fontWeight: 700 }}>{v}</span>,
      align: 'right',
    },
    {
      title: 'Min Stock', dataIndex: 'min_stock', key: 'min_stock', width: 100,
      align: 'right',
    },
    {
      title: 'Deficit', key: 'deficit', width: 100, align: 'right',
      render: (_, r) => (
        <Tag color="red" icon={<WarningOutlined />}>
          {(r.min_stock - r.current_stock).toFixed(1)}
        </Tag>
      ),
    },
    {
      title: 'MRP', dataIndex: 'mrp', key: 'mrp', width: 110,
      render: (v) => formatINR(v), align: 'right',
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}>Low Stock Products</Title>
      <Spin spinning={loading}>
        <Table
          dataSource={products}
          columns={columns}
          rowKey="id"
          pagination={false}
          size="middle"
        />
      </Spin>
    </div>
  );
}
