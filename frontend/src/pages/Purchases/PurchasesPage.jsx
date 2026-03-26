import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table, Button, Typography, DatePicker, Select, Space, Spin, message,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { getPurchases } from '../../api/purchases.api';
import { getSuppliers } from '../../api/suppliers.api';
import { formatINR, formatDate } from '../../utils/formatCurrency';

const { Title } = Typography;
const { RangePicker } = DatePicker;

export default function PurchasesPage() {
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [dateRange, setDateRange] = useState([null, null]);
  const [supplierId, setSupplierId] = useState(undefined);
  const [suppliers, setSuppliers] = useState([]);

  useEffect(() => {
    getSuppliers()
      .then(({ data }) => setSuppliers(data.data.suppliers))
      .catch(() => {});
  }, []);

  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: pagination.page, limit: pagination.limit };
      if (dateRange[0]) params.from = dateRange[0].format('YYYY-MM-DD');
      if (dateRange[1]) params.to = dateRange[1].format('YYYY-MM-DD');
      if (supplierId) params.supplier_id = supplierId;

      const { data } = await getPurchases(params);
      setPurchases(data.data.purchases);
      setPagination((prev) => ({ ...prev, total: data.data.pagination.total }));
    } catch {
      message.error('Failed to load purchases');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, dateRange, supplierId]);

  useEffect(() => { fetchPurchases(); }, [fetchPurchases]);

  const columns = [
    {
      title: 'PO Number', dataIndex: 'po_number', key: 'po_number',
      render: (text, record) => (
        <a onClick={() => navigate(`/purchases/${record.id}`)} style={{ fontWeight: 600 }}>
          {text}
        </a>
      ),
    },
    {
      title: 'Date', dataIndex: 'date', key: 'date', width: 110,
      render: (v) => formatDate(v),
    },
    { title: 'Supplier', dataIndex: 'supplier_name', key: 'supplier_name' },
    {
      title: 'Items', dataIndex: 'item_count', key: 'item_count', width: 80,
      align: 'center',
    },
    {
      title: 'Total', dataIndex: 'total_amount', key: 'total_amount', width: 120,
      render: (v) => formatINR(v), align: 'right',
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0 }}>Purchases</Title>
        <Button type="primary" icon={<PlusOutlined />}
          onClick={() => navigate('/purchases/new')}>
          New Stock-In
        </Button>
      </div>

      <Space style={{ marginBottom: 16 }}>
        <RangePicker onChange={(dates) => setDateRange(dates || [null, null])} />
        <Select
          placeholder="All Suppliers" allowClear style={{ width: 200 }}
          onChange={setSupplierId}
          options={suppliers.map((s) => ({ label: s.name, value: s.id }))}
        />
      </Space>

      <Spin spinning={loading}>
        <Table
          dataSource={purchases}
          columns={columns}
          rowKey="id"
          size="middle"
          onRow={(record) => ({ onClick: () => navigate(`/purchases/${record.id}`), style: { cursor: 'pointer' } })}
          pagination={{
            current: pagination.page,
            pageSize: pagination.limit,
            total: pagination.total,
            showTotal: (total) => `${total} purchases`,
            onChange: (page, pageSize) =>
              setPagination((prev) => ({ ...prev, page, limit: pageSize })),
          }}
        />
      </Spin>
    </div>
  );
}
