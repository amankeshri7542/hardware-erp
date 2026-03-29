import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Card, Select, DatePicker, Input, Button, Table, InputNumber,
  Typography, Space, message, Divider,
} from 'antd';
import { PlusOutlined, DeleteOutlined, CheckCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { createPurchase } from '../../api/purchases.api';
import { getSuppliers, createSupplier } from '../../api/suppliers.api';
import ProductSearch from '../../components/ProductSearch/ProductSearch';
import { formatINR } from '../../utils/formatCurrency';

const { Title, Text } = Typography;
const { TextArea } = Input;

const UNIT_OPTIONS = ['piece', 'kg', 'box', 'metre', 'litre', 'set'];

export default function NewPurchasePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [suppliers, setSuppliers] = useState([]);
  const [supplierId, setSupplierId] = useState(location.state?.supplierId || null);
  const [date, setDate] = useState(dayjs());
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getSuppliers()
      .then(({ data }) => setSuppliers(data.data.suppliers))
      .catch(() => {});
  }, []);

  // Handle pre-filled product from state (e.g., from quick restock)
  useEffect(() => {
    if (location.state?.product && items.length === 0) {
      const p = location.state.product;
      setItems([{
        key: Date.now(),
        product_id: p.id,
        product_name: p.name,
        qty: 1,
        unit: p.unit || 'piece',
        cost_price: p.purchase_price || 0,
        line_total: p.purchase_price || 0,
      }]);
    }
  }, [location.state]);

  const handleProductSelect = (product) => {
    // Check if product already in items
    if (items.some((item) => item.product_id === product.id)) {
      message.warning('Product already added');
      return;
    }
    setItems((prev) => [
      ...prev,
      {
        key: Date.now(),
        product_id: product.id,
        product_name: product.name,
        qty: 1,
        unit: product.unit || 'piece',
        cost_price: product.purchase_price || 0,
        line_total: product.purchase_price || 0,
      },
    ]);
  };

  const updateItem = (key, field, value) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.key !== key) return item;
        const updated = { ...item, [field]: value };
        updated.line_total = Number((updated.qty * updated.cost_price).toFixed(2));
        return updated;
      }),
    );
  };

  const removeItem = (key) => {
    setItems((prev) => prev.filter((item) => item.key !== key));
  };

  const totalAmount = items.reduce((sum, item) => sum + item.line_total, 0);

  const handleSubmit = async () => {
    if (!supplierId) { message.error('Please select a supplier'); return; }
    if (items.length === 0) { message.error('Add at least one item'); return; }

    setSubmitting(true);
    try {
      const payload = {
        supplier_id: supplierId,
        date: date.format('YYYY-MM-DD'),
        notes,
        items: items.map(({ product_id, qty, unit, cost_price, line_total }) => ({
          product_id, qty, unit, cost_price, line_total,
        })),
      };

      const { data } = await createPurchase(payload);
      const updates = data.data.stockUpdates || [];

      message.success({
        content: (
          <div>
            <div style={{ fontWeight: 600 }}>Stock received successfully!</div>
            {updates.map((u) => (
              <div key={u.product_id} style={{ fontSize: 12, color: '#52c41a' }}>
                <CheckCircleOutlined /> {u.product_name}: {u.stock_after} units now in stock
              </div>
            ))}
          </div>
        ),
        duration: 5,
      });

      navigate(`/purchases/${data.data.purchase.id}`);
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to create purchase');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: 'Product', dataIndex: 'product_name', key: 'product_name',
      render: (t) => <strong>{t}</strong>,
    },
    {
      title: 'Qty', dataIndex: 'qty', key: 'qty', width: 100,
      render: (v, record) => (
        <InputNumber min={0.001} value={v} precision={3} size="small"
          style={{ width: '100%' }}
          onChange={(val) => updateItem(record.key, 'qty', val || 0)} />
      ),
    },
    {
      title: 'Unit', dataIndex: 'unit', key: 'unit', width: 100,
      render: (v, record) => (
        <Select value={v} size="small" style={{ width: '100%' }}
          onChange={(val) => updateItem(record.key, 'unit', val)}
          options={UNIT_OPTIONS.map((u) => ({ label: u, value: u }))} />
      ),
    },
    {
      title: 'Cost Price ₹', dataIndex: 'cost_price', key: 'cost_price', width: 130,
      render: (v, record) => (
        <InputNumber min={0} value={v} precision={2} size="small"
          style={{ width: '100%' }}
          onChange={(val) => updateItem(record.key, 'cost_price', val || 0)} />
      ),
    },
    {
      title: 'Line Total', dataIndex: 'line_total', key: 'line_total', width: 120,
      render: (v) => formatINR(v), align: 'right',
    },
    {
      title: '', key: 'actions', width: 50,
      render: (_, record) => (
        <Button type="text" danger icon={<DeleteOutlined />} size="small"
          onClick={() => removeItem(record.key)} />
      ),
    },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1000 }}>
      <Title level={3}>New Stock-In</Title>

      {/* Header */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Supplier *</Text>
            <Select
              showSearch placeholder="Select supplier" style={{ width: '100%' }}
              value={supplierId} onChange={setSupplierId}
              filterOption={(input, option) =>
                option.label.toLowerCase().includes(input.toLowerCase())
              }
              options={suppliers.map((s) => ({ label: s.name, value: s.id }))}
            />
          </div>
          <div>
            <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Date *</Text>
            <DatePicker value={date} onChange={setDate} style={{ width: '100%' }} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Notes</Text>
          <TextArea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional purchase notes" />
        </div>
      </Card>

      {/* Add Product */}
      <Card title="Add Products" style={{ marginBottom: 16 }}>
        <ProductSearch
          onSelect={handleProductSelect}
          billType="retail"
          placeholder="Search products to add..."
        />
      </Card>

      {/* Items Table */}
      {items.length > 0 && (
        <Card>
          <Table
            dataSource={items}
            columns={columns}
            rowKey="key"
            pagination={false}
            size="small"
            footer={() => (
              <div style={{ textAlign: 'right', fontSize: 16 }}>
                <strong>Total: {formatINR(totalAmount)}</strong>
              </div>
            )}
          />
        </Card>
      )}

      {/* Submit */}
      <div style={{ marginTop: 24, textAlign: 'right' }}>
        <Space>
          <Button onClick={() => navigate('/purchases')}>Cancel</Button>
          <Button type="primary" size="large" loading={submitting}
            onClick={handleSubmit} disabled={items.length === 0 || !supplierId}>
            Receive Stock
          </Button>
        </Space>
      </div>
    </div>
  );
}
