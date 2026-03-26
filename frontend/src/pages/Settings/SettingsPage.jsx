import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Row, Col, Card, Statistic, Descriptions, Typography, Spin, Button, Space, Divider, message,
} from 'antd';
import {
  TeamOutlined, ShoppingOutlined, FileTextOutlined, DollarOutlined,
  ShopOutlined, DatabaseOutlined, DownloadOutlined, BarChartOutlined,
  ReloadOutlined, InfoCircleOutlined,
} from '@ant-design/icons';
import { getSettings } from '../../api/settings.api';
import { exportReport } from '../../api/reports.api';

const { Title, Text } = Typography;

export default function SettingsPage() {
  const navigate = useNavigate();
  const [store, setStore] = useState(null);
  const [dbStats, setDbStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await getSettings();
      const { store: storeData, dbStats: statsData } = res.data.data;
      setStore(storeData);
      setDbStats(statsData);
    } catch (err) {
      message.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleExportFullData = async () => {
    setExporting(true);
    try {
      await exportReport('full-export');
      message.success('Full data export downloaded');
    } catch (err) {
      message.error('Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Spin size="large" tip="Loading settings..." />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>Settings</Title>
        <Button icon={<ReloadOutlined />} onClick={fetchSettings}>Refresh</Button>
      </div>

      {/* Section 1: Store Info */}
      <Card title="Store Information" style={{ marginBottom: 24 }}>
        <Descriptions column={{ xs: 1, sm: 2, md: 2 }} bordered>
          <Descriptions.Item label="Store Name">{store?.store_name || '—'}</Descriptions.Item>
          <Descriptions.Item label="Address">{store?.store_address || '—'}</Descriptions.Item>
          <Descriptions.Item label="Phone">{store?.store_phone || '—'}</Descriptions.Item>
          <Descriptions.Item label="GSTIN">{store?.store_gstin || '—'}</Descriptions.Item>
          <Descriptions.Item label="Invoice Prefix">{store?.invoice_prefix || '—'}</Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Section 2: Database Stats */}
      <Card title="Database Statistics" style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={8} md={4}>
            <Statistic
              title="Customers"
              value={dbStats?.total_customers ?? 0}
              prefix={<TeamOutlined />}
            />
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Statistic
              title="Products"
              value={dbStats?.total_products ?? 0}
              prefix={<ShoppingOutlined />}
            />
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Statistic
              title="Invoices"
              value={dbStats?.total_invoices ?? 0}
              prefix={<FileTextOutlined />}
            />
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Statistic
              title="Payments"
              value={dbStats?.total_payments ?? 0}
              prefix={<DollarOutlined />}
            />
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Statistic
              title="Suppliers"
              value={dbStats?.total_suppliers ?? 0}
              prefix={<ShopOutlined />}
            />
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Statistic
              title="Database Size"
              value={dbStats?.db_size ?? '—'}
              prefix={<DatabaseOutlined />}
            />
          </Col>
        </Row>
      </Card>

      {/* Section 3: Quick Actions */}
      <Card title="Quick Actions" style={{ marginBottom: 24 }}>
        <Space size="middle">
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            loading={exporting}
            onClick={handleExportFullData}
          >
            Export Full Data
          </Button>
          <Button
            icon={<BarChartOutlined />}
            onClick={() => navigate('/reports')}
          >
            View Reports
          </Button>
        </Space>
      </Card>

      {/* Section 4: System Info */}
      <Card title="System Information">
        <Descriptions column={{ xs: 1, sm: 2 }} bordered>
          <Descriptions.Item label="Version">1.0.0</Descriptions.Item>
          <Descriptions.Item label="Backend">Node.js + Express</Descriptions.Item>
          <Descriptions.Item label="Frontend">React.js + Ant Design</Descriptions.Item>
          <Descriptions.Item label="Database">PostgreSQL on AWS RDS</Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );
}
