import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table, Input, Switch, Button, Tag, Space, Popconfirm,
  message, Spin, Typography, Row, Col, Card, Badge, Segmented,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  SearchOutlined, EyeOutlined,
} from '@ant-design/icons';
import { listCustomers, deactivateCustomer } from '../../api/customers.api';
import { formatINR } from '../../utils/formatCurrency';
import CustomerFormModal from './CustomerFormModal';

const { Title } = Typography;

const TYPE_COLORS = { retail: 'blue', wholesale: 'green', both: 'purple' };

export default function CustomersPage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [duesFilter, setDuesFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);

  // Debounced search — 200ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (typeFilter !== 'all') params.type = typeFilter;
      if (cityFilter) params.city = cityFilter;
      if (!showInactive) params.is_active = 'true';
      if (duesFilter !== 'all') params.dues_filter = duesFilter;

      const { data } = await listCustomers(params);
      setCustomers(data.data.customers);
      setPagination((prev) => ({ ...prev, total: data.data.pagination.total }));
    } catch {
      message.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, debouncedSearch, typeFilter, cityFilter, showInactive, duesFilter]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [debouncedSearch, typeFilter, cityFilter, showInactive]);

  const handleDeactivate = async (id) => {
    try {
      await deactivateCustomer(id);
      message.success('Customer deactivated');
      fetchCustomers();
    } catch {
      message.error('Failed to deactivate customer');
    }
  };

  const openEdit = (record) => {
    setEditCustomer(record);
    setModalOpen(true);
  };

  const openCreate = () => {
    setEditCustomer(null);
    setModalOpen(true);
  };

  const columns = [
    {
      title: 'Name', dataIndex: 'name', key: 'name',
      render: (text, record) => (
        <div>
          <a onClick={() => navigate(`/customers/${record.id}`)}
             style={{ fontWeight: 600 }}>
            {text}
          </a>
          {record.business_name && (
            <div style={{ fontSize: 12, color: '#888' }}>{record.business_name}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Phone', dataIndex: 'phone', key: 'phone', width: 130,
      render: (v) => <span style={{ fontFamily: 'monospace' }}>{v}</span>,
    },
    {
      title: 'Type', dataIndex: 'type', key: 'type', width: 100,
      render: (type) => (
        <Tag color={TYPE_COLORS[type] || 'default'}>
          {type ? type.charAt(0).toUpperCase() + type.slice(1) : '—'}
        </Tag>
      ),
    },
    { title: 'City', dataIndex: 'city', key: 'city', width: 120 },
    {
      title: 'Outstanding', dataIndex: 'outstanding_balance', key: 'outstanding_balance',
      width: 140, align: 'right',
      render: (val) => {
        const amount = Number(val) || 0;
        return (
          <span style={{ color: amount > 0 ? '#ff4d4f' : '#52c41a', fontWeight: 600 }}>
            {formatINR(amount)}
          </span>
        );
      },
    },
    {
      title: 'Status', dataIndex: 'is_active', key: 'is_active', width: 90,
      render: (active) => (
        <Tag color={active ? 'green' : 'red'}>
          {active ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: '', key: 'actions', width: 120,
      render: (_, record) => (
        <Space>
          <Button type="text" icon={<EyeOutlined />} size="small"
            onClick={() => navigate(`/customers/${record.id}`)} />
          <Button type="text" icon={<EditOutlined />} size="small"
            onClick={(e) => { e.stopPropagation(); openEdit(record); }} />
          {record.is_active && (
            <Popconfirm title="Deactivate this customer?"
              onConfirm={() => handleDeactivate(record.id)} okText="Yes" cancelText="No">
              <Button type="text" danger icon={<DeleteOutlined />} size="small" />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
        <Col>
          <Space align="center">
            <Title level={3} style={{ margin: 0 }}>Customers</Title>
            <Badge count={pagination.total} showZero
              style={{ backgroundColor: '#1677ff' }} overflowCount={9999} />
          </Space>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Add Customer
          </Button>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }} bodyStyle={{ padding: '12px 16px' }}>
        <Row gutter={16} align="middle">
          <Col flex="auto">
            <Input prefix={<SearchOutlined />} placeholder="Search by name or phone..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              allowClear style={{ maxWidth: 320 }} />
          </Col>
          <Col>
            <Segmented
              value={typeFilter}
              onChange={setTypeFilter}
              options={[
                { label: 'All', value: 'all' },
                { label: 'Retail', value: 'retail' },
                { label: 'Wholesale', value: 'wholesale' },
                { label: 'Both', value: 'both' },
              ]}
            />
          </Col>
          <Col>
            <Input placeholder="City" value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              allowClear style={{ width: 140 }} />
          </Col>
          <Col>
            <Space>
              <span>Inactive</span>
              <Switch checked={showInactive} onChange={setShowInactive} size="small" />
            </Space>
          </Col>
        </Row>
      </Card>

      <Spin spinning={loading}>
        <Table
          dataSource={customers}
          columns={columns}
          rowKey="id"
          onRow={(record) => ({
            onClick: () => navigate(`/customers/${record.id}`),
            style: { cursor: 'pointer' },
          })}
          pagination={{
            current: pagination.page,
            pageSize: pagination.limit,
            total: pagination.total,
            showTotal: (total) => `${total} customers`,
            onChange: (page, pageSize) =>
              setPagination((prev) => ({ ...prev, page, limit: pageSize })),
          }}
          size="middle"
          scroll={{ x: 800 }}
        />
      </Spin>

      <CustomerFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditCustomer(null); }}
        onSuccess={fetchCustomers}
        customer={editCustomer}
      />
    </div>
  );
}
