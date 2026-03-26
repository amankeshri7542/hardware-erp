import { Typography, Card, Space, Spin } from 'antd';

const { Title } = Typography;

export default function ReportLayout({ title, filters, summary, table, exportButton, loading }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>{title}</Title>
        <Space>{exportButton}</Space>
      </div>
      <Card size="small" style={{ marginBottom: 16 }}>{filters}</Card>
      {summary && <div style={{ marginBottom: 16 }}>{summary}</div>}
      <Spin spinning={loading}>{table}</Spin>
    </div>
  );
}
