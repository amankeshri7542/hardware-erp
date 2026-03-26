import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Card, Statistic, Table, Button, Select, Switch, Space, message } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import ReportLayout from '../../components/Reports/ReportLayout';
import { getCustomerDuesReport, exportReport } from '../../api/reports.api';
import { formatINR, formatDate } from '../../utils/formatCurrency';

const { Option } = Select;

const TYPE_OPTIONS = [
  { label: 'All Customers', value: '' },
  { label: 'Retail', value: 'retail' },
  { label: 'Wholesale', value: 'wholesale' },
];

export default function CustomerDuesPage() {
  const navigate = useNavigate();

  const [customerType, setCustomerType] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (customerType) params.type = customerType;
      if (overdueOnly) params.overdue = true;

      const res = await getCustomerDuesReport(params);
      const result = res.data.data;
      setData(result.customers || []);
      setSummary(result.summary || null);
    } catch {
      message.error('Failed to load customer dues report');
    } finally {
      setLoading(false);
    }
  }, [customerType, overdueOnly]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = {};
      if (customerType) params.type = customerType;
      if (overdueOnly) params.overdue = true;
      await exportReport('customer-dues', params);
      message.success('Customer dues report exported');
    } catch {
      message.error('Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  const getRowStyle = (record) => {
    const days = record.days_overdue || 0;
    if (days > 90) return { background: '#fff2f0' };
    if (days > 60) return { background: '#fff7e6' };
    if (days > 30) return { background: '#fffbe6' };
    return {};
  };

  const columns = [
    {
      title: 'Customer Name',
      dataIndex: 'customer_name',
      key: 'customer_name',
      ellipsis: true,
      render: (text, record) => (
        <Button type="link" size="small" onClick={() => navigate(`/customers/${record.customer_id}`)}>
          {text}
        </Button>
      ),
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: 'Type',
      dataIndex: 'customer_type',
      key: 'customer_type',
      render: (val) => val?.toUpperCase() || '\u2014',
    },
    {
      title: 'Outstanding',
      dataIndex: 'outstanding_balance',
      key: 'outstanding_balance',
      align: 'right',
      render: (val) => formatINR(val),
      sorter: (a, b) => (a.outstanding_balance || 0) - (b.outstanding_balance || 0),
      defaultSortOrder: 'descend',
    },
    {
      title: 'Total Invoices',
      dataIndex: 'total_invoices',
      key: 'total_invoices',
      align: 'center',
    },
    {
      title: 'Unpaid Invoices',
      dataIndex: 'unpaid_invoices',
      key: 'unpaid_invoices',
      align: 'center',
    },
    {
      title: 'Days Overdue',
      dataIndex: 'days_overdue',
      key: 'days_overdue',
      align: 'center',
      render: (val) => {
        if (!val || val <= 0) return '\u2014';
        const color = val > 90 ? '#ff4d4f' : val > 60 ? '#fa8c16' : val > 30 ? '#faad14' : '#595959';
        return <span style={{ color, fontWeight: 600 }}>{val} days</span>;
      },
      sorter: (a, b) => (a.days_overdue || 0) - (b.days_overdue || 0),
    },
    {
      title: 'Last Payment',
      dataIndex: 'last_payment_date',
      key: 'last_payment_date',
      render: (val) => formatDate(val),
    },
  ];

  const summaryCards = summary ? (
    <Row gutter={[16, 16]}>
      <Col xs={12} sm={8} lg={6}>
        <Card size="small" bordered={false} style={{ background: '#e6f7ff' }}>
          <Statistic title="Total Customers" value={summary.total_customers || 0} />
        </Card>
      </Col>
      <Col xs={12} sm={8} lg={6}>
        <Card size="small" bordered={false} style={{ background: '#fff2f0' }}>
          <Statistic
            title="Total Outstanding"
            value={summary.total_outstanding || 0}
            formatter={(val) => formatINR(val)}
            valueStyle={{ color: '#ff4d4f' }}
          />
        </Card>
      </Col>
      <Col xs={12} sm={8} lg={6}>
        <Card size="small" bordered={false} style={{ background: '#fff7e6' }}>
          <Statistic title="Overdue Customers" value={summary.overdue_customers || 0} valueStyle={{ color: '#fa8c16' }} />
        </Card>
      </Col>
      <Col xs={12} sm={8} lg={6}>
        <Card size="small" bordered={false} style={{ background: '#f6ffed' }}>
          <Statistic
            title="Avg Outstanding"
            value={summary.avg_outstanding || 0}
            formatter={(val) => formatINR(val)}
          />
        </Card>
      </Col>
    </Row>
  ) : null;

  const filters = (
    <Space wrap>
      <Select
        value={customerType}
        onChange={setCustomerType}
        style={{ width: 180 }}
        placeholder="Customer Type"
      >
        {TYPE_OPTIONS.map((opt) => (
          <Option key={opt.value} value={opt.value}>{opt.label}</Option>
        ))}
      </Select>
      <Space>
        <Switch checked={overdueOnly} onChange={setOverdueOnly} />
        <span>Overdue Only</span>
      </Space>
    </Space>
  );

  return (
    <div style={{ padding: 24 }}>
      <ReportLayout
        title="Customer Dues"
        exportButton={
          <Button icon={<DownloadOutlined />} loading={exporting} onClick={handleExport}>
            Export Excel
          </Button>
        }
        filters={filters}
        summary={summaryCards}
        loading={loading}
        table={
          <Table
            dataSource={data}
            columns={columns}
            rowKey={(record) => record.customer_id || record.id}
            size="small"
            scroll={{ x: 900 }}
            pagination={{ pageSize: 50, showTotal: (total) => `Total ${total} customers` }}
            onRow={(record) => ({ style: getRowStyle(record) })}
          />
        }
      />
    </div>
  );
}
