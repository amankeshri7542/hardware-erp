import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Card, Statistic, Table, Button, DatePicker, Space, message } from 'antd';
import { DownloadOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import ReportLayout from '../../components/Reports/ReportLayout';
import { getProfitReport, exportReport } from '../../api/reports.api';
import { formatINR, formatDate } from '../../utils/formatCurrency';

const { RangePicker } = DatePicker;

export default function ProfitReportPage() {
  const navigate = useNavigate();

  const [dateRange, setDateRange] = useState([dayjs().startOf('month'), dayjs()]);
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        from: dateRange[0].format('YYYY-MM-DD'),
        to: dateRange[1].format('YYYY-MM-DD'),
      };
      const res = await getProfitReport(params);
      const result = res.data.data;
      setData(result.invoices || []);
      setSummary(result.summary || null);
    } catch {
      message.error('Failed to load profit report');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = {
        from: dateRange[0].format('YYYY-MM-DD'),
        to: dateRange[1].format('YYYY-MM-DD'),
      };
      await exportReport('profit', params);
      message.success('Profit report exported');
    } catch {
      message.error('Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  const columns = [
    {
      title: 'Invoice No',
      dataIndex: 'invoice_no',
      key: 'invoice_no',
      render: (text, record) => (
        <Button type="link" size="small" onClick={() => navigate(`/invoices/${record.id}`)}>
          {text}
        </Button>
      ),
    },
    {
      title: 'Date',
      dataIndex: 'invoice_date',
      key: 'invoice_date',
      render: (val) => formatDate(val),
    },
    {
      title: 'Customer',
      dataIndex: 'customer_name',
      key: 'customer_name',
      ellipsis: true,
      render: (val) => val || 'Walk-in',
    },
    {
      title: 'Sales Amount',
      dataIndex: 'taxable_total',
      key: 'taxable_total',
      align: 'right',
      render: (val) => formatINR(val),
    },
    {
      title: 'Cost',
      dataIndex: 'total_cost',
      key: 'total_cost',
      align: 'right',
      render: (val) => formatINR(val),
    },
    {
      title: 'Profit',
      dataIndex: 'profit_amount',
      key: 'profit_amount',
      align: 'right',
      render: (val) => {
        const num = Number(val) || 0;
        return (
          <span style={{ color: num >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: 600 }}>
            {formatINR(num)}
          </span>
        );
      },
      sorter: (a, b) => (a.profit_amount || 0) - (b.profit_amount || 0),
    },
    {
      title: 'Margin %',
      dataIndex: 'profit_pct',
      key: 'profit_pct',
      align: 'right',
      render: (val) => {
        const num = Number(val) || 0;
        return (
          <span style={{ color: num >= 0 ? '#52c41a' : '#ff4d4f' }}>
            {num.toFixed(1)}%
          </span>
        );
      },
    },
  ];

  const summaryCards = summary ? (
    <Row gutter={[16, 16]}>
      <Col xs={12} sm={8} lg={6}>
        <Card size="small" bordered={false} style={{ background: '#e6f7ff' }}>
          <Statistic title="Total Sales" value={summary.total_sales || 0} formatter={(val) => formatINR(val)} />
        </Card>
      </Col>
      <Col xs={12} sm={8} lg={6}>
        <Card size="small" bordered={false} style={{ background: '#fff7e6' }}>
          <Statistic title="Total Cost" value={summary.total_cost || 0} formatter={(val) => formatINR(val)} />
        </Card>
      </Col>
      <Col xs={12} sm={8} lg={6}>
        <Card size="small" bordered={false} style={{ background: (summary.total_profit || 0) >= 0 ? '#f6ffed' : '#fff2f0' }}>
          <Statistic
            title="Total Profit"
            value={summary.total_profit || 0}
            formatter={(val) => formatINR(val)}
            valueStyle={{ color: (summary.total_profit || 0) >= 0 ? '#52c41a' : '#ff4d4f' }}
            prefix={(summary.total_profit || 0) >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
          />
        </Card>
      </Col>
      <Col xs={12} sm={8} lg={6}>
        <Card size="small" bordered={false} style={{ background: '#f9f0ff' }}>
          <Statistic
            title="Avg Margin"
            value={summary.avg_margin || 0}
            precision={1}
            suffix="%"
            valueStyle={{ color: (summary.avg_margin || 0) >= 0 ? '#52c41a' : '#ff4d4f' }}
          />
        </Card>
      </Col>
    </Row>
  ) : null;

  const filters = (
    <Space>
      <RangePicker
        value={dateRange}
        onChange={(dates) => dates && setDateRange(dates)}
        format="DD-MM-YYYY"
        allowClear={false}
      />
    </Space>
  );

  return (
    <div style={{ padding: 24 }}>
      <ReportLayout
        title="Profit Report"
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
            rowKey={(record) => record.id || record.invoice_no}
            size="small"
            scroll={{ x: 900 }}
            pagination={{ pageSize: 50, showTotal: (total) => `Total ${total} invoices` }}
          />
        }
      />
    </div>
  );
}
