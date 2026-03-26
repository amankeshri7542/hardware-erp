import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Card, Descriptions, Badge, Table, Tag, DatePicker, Select,
  Spin, Typography, Row, Col, Button, Space, message,
} from 'antd';
import { ArrowLeftOutlined, EditOutlined } from '@ant-design/icons';
import { getProduct, getStockLedger } from '../../api/products.api';
import { formatINR, formatDate } from '../../utils/formatCurrency';
import ProductFormModal from './ProductFormModal';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const MOVEMENT_COLORS = {
  in: 'green',
  out: 'orange',
  return_in: 'blue',
  return_out: 'red',
  adjustment: 'purple',
};

export default function ProductDetailPage() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ledger, setLedger] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerPagination, setLedgerPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [dateRange, setDateRange] = useState([null, null]);
  const [typeFilter, setTypeFilter] = useState(undefined);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchProduct = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getProduct(id);
      setProduct(data.data);
    } catch {
      message.error('Failed to load product');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchLedger = useCallback(async () => {
    setLedgerLoading(true);
    try {
      const params = {
        page: ledgerPagination.page,
        limit: ledgerPagination.limit,
      };
      if (dateRange[0]) params.from = dateRange[0].format('YYYY-MM-DD');
      if (dateRange[1]) params.to = dateRange[1].format('YYYY-MM-DD');

      const { data } = await getStockLedger(id, params);
      let entries = data.data.entries;
      if (typeFilter) {
        entries = entries.filter((e) => e.movement_type === typeFilter);
      }
      setLedger(entries);
      setLedgerPagination((prev) => ({ ...prev, total: data.data.pagination.total }));
    } catch {
      message.error('Failed to load stock ledger');
    } finally {
      setLedgerLoading(false);
    }
  }, [id, ledgerPagination.page, ledgerPagination.limit, dateRange, typeFilter]);

  useEffect(() => { fetchProduct(); }, [fetchProduct]);
  useEffect(() => { fetchLedger(); }, [fetchLedger]);

  const ledgerColumns = [
    {
      title: 'Date', dataIndex: 'date', key: 'date', width: 110,
      render: (v) => formatDate(v),
    },
    {
      title: 'Type', dataIndex: 'movement_type', key: 'movement_type', width: 110,
      render: (type) => (
        <Tag color={MOVEMENT_COLORS[type] || 'default'}>
          {type.replace('_', ' ').toUpperCase()}
        </Tag>
      ),
    },
    { title: 'Qty In', dataIndex: 'qty_in', key: 'qty_in', width: 80, align: 'right' },
    { title: 'Qty Out', dataIndex: 'qty_out', key: 'qty_out', width: 80, align: 'right' },
    { title: 'Stock After', dataIndex: 'stock_after', key: 'stock_after', width: 100, align: 'right' },
    { title: 'Reference', key: 'ref', width: 120,
      render: (_, r) => r.reference_type ? `${r.reference_type} #${r.reference_id}` : '—'
    },
    { title: 'Notes', dataIndex: 'notes', key: 'notes', ellipsis: true },
    { title: 'By', dataIndex: 'created_by_name', key: 'created_by_name', width: 100 },
  ];

  if (loading) return <div style={{ padding: 48, textAlign: 'center' }}><Spin size="large" /></div>;
  if (!product) return <div style={{ padding: 48 }}>Product not found</div>;

  const isLowStock = product.current_stock < product.min_stock;

  return (
    <div style={{ padding: 24 }}>
      <Link to="/products"><ArrowLeftOutlined /> Back to Products</Link>

      <Row gutter={24} style={{ marginTop: 16 }}>
        <Col span={18}>
          <Card
            title={<Title level={4} style={{ margin: 0 }}>{product.name}</Title>}
            extra={
              <Button icon={<EditOutlined />} onClick={() => setModalOpen(true)}>
                Edit
              </Button>
            }
          >
            <Descriptions column={3} size="small">
              <Descriptions.Item label="SKU">{product.sku || '—'}</Descriptions.Item>
              <Descriptions.Item label="Barcode">{product.barcode || '—'}</Descriptions.Item>
              <Descriptions.Item label="Category">{product.category}</Descriptions.Item>
              <Descriptions.Item label="Brand">{product.brand || '—'}</Descriptions.Item>
              <Descriptions.Item label="Unit">{product.unit}</Descriptions.Item>
              <Descriptions.Item label="HSN">{product.hsn_code || '—'}</Descriptions.Item>
              <Descriptions.Item label="GST Rate">{product.gst_rate}%</Descriptions.Item>
              <Descriptions.Item label="MRP">{formatINR(product.mrp)}</Descriptions.Item>
              <Descriptions.Item label="Wholesale">{formatINR(product.wholesale_price)}</Descriptions.Item>
              <Descriptions.Item label="Cost Price">{formatINR(product.purchase_price)}</Descriptions.Item>
              <Descriptions.Item label="Min Stock">{product.min_stock}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={product.is_active ? 'green' : 'default'}>
                  {product.is_active ? 'Active' : 'Inactive'}
                </Tag>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col span={6}>
          <Card style={{ textAlign: 'center' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>CURRENT STOCK</Text>
            <div style={{
              fontSize: 42,
              fontWeight: 800,
              color: isLowStock ? '#ff4d4f' : '#52c41a',
              lineHeight: 1.2,
              margin: '8px 0',
            }}>
              {product.current_stock}
            </div>
            <Text type="secondary">{product.unit}s</Text>
            {isLowStock && (
              <div style={{ marginTop: 8 }}>
                <Badge status="error" text={`Below min (${product.min_stock})`} />
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Stock Ledger */}
      <Card title="Stock Ledger" style={{ marginTop: 24 }}>
        <Space style={{ marginBottom: 16 }}>
          <RangePicker onChange={(dates) => setDateRange(dates || [null, null])} />
          <Select placeholder="Movement Type" allowClear onChange={setTypeFilter}
            style={{ width: 150 }}
            options={[
              { label: 'Stock In', value: 'in' },
              { label: 'Stock Out', value: 'out' },
              { label: 'Return In', value: 'return_in' },
              { label: 'Return Out', value: 'return_out' },
              { label: 'Adjustment', value: 'adjustment' },
            ]}
          />
        </Space>
        <Table
          dataSource={ledger}
          columns={ledgerColumns}
          rowKey="id"
          loading={ledgerLoading}
          size="small"
          pagination={{
            current: ledgerPagination.page,
            pageSize: ledgerPagination.limit,
            total: ledgerPagination.total,
            onChange: (page, pageSize) =>
              setLedgerPagination((prev) => ({ ...prev, page, limit: pageSize })),
          }}
        />
      </Card>

      <ProductFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => { fetchProduct(); fetchLedger(); }}
        productId={id}
      />
    </div>
  );
}
