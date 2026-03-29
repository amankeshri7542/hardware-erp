import React from 'react';
import { Typography, Space, Badge } from 'antd';
import { formatINR, formatDate } from '../utils/formatCurrency';

const { Text } = Typography;

export default function PriceHistoryChart({ data = [], height = 220 }) {
  if (!data || data.length < 2) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa', borderRadius: 8 }}>
        <Text type="secondary">Not enough data to display chart</Text>
      </div>
    );
  }

  // Use effective_from date, sorting chronological
  const sortedData = [...data].sort((a, b) => new Date(a.effective_from) - new Date(b.effective_from));
  
  // Extract all points for global min/max
  let minPrice = Infinity;
  let maxPrice = -Infinity;
  sortedData.forEach(d => {
    const pp = parseFloat(d.purchase_price) || 0;
    const wr = parseFloat(d.wholesale_price) || 0;
    const mrp = parseFloat(d.mrp) || 0;
    if (pp < minPrice && pp > 0) minPrice = pp;
    if (wr < minPrice && wr > 0) minPrice = wr;
    if (mrp < minPrice && mrp > 0) minPrice = mrp;
    
    if (pp > maxPrice) maxPrice = pp;
    if (wr > maxPrice) maxPrice = wr;
    if (mrp > maxPrice) maxPrice = mrp;
  });

  if (minPrice === Infinity) minPrice = 0;
  if (minPrice === maxPrice) {
    minPrice = minPrice * 0.9;
    maxPrice = maxPrice * 1.1;
  } else {
    minPrice = minPrice * 0.9; // 10% padding
    maxPrice = maxPrice * 1.1;
  }
  const range = maxPrice - minPrice;

  // ViewBox dimensions
  const vbW = 600;
  const vbH = height - 40; // reserve space for legend
  const paddingX = 30;
  const paddingY = 20;

  const w = vbW - paddingX * 2;
  const h = vbH - paddingY * 2;

  const getPoints = (key) => sortedData.map((d, i) => {
    const val = parseFloat(d[key]) || 0;
    const cx = paddingX + (i / (Math.max(sortedData.length - 1, 1))) * w;
    const cy = paddingY + h - ((val - minPrice) / (range || 1)) * h;
    return { x: cx, y: cy, val, label: formatDate(d.effective_from) };
  });

  const purchasePoints = getPoints('purchase_price');
  const wholesalePoints = getPoints('wholesale_price');
  const mrpPoints = getPoints('mrp');

  const makePath = (pts) => pts.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ');

  const renderLine = (pts, color) => (
    <>
      <path d={makePath(pts)} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      {pts.map((pt, i) => (
        <g key={i}>
          <circle cx={pt.x} cy={pt.y} r="4" fill={color} stroke="#fff" strokeWidth="2">
            <title>{`${pt.label}: ${formatINR(pt.val)}`}</title>
          </circle>
          <text x={pt.x} y={pt.y - 10} fontSize="10" fill="#666" textAnchor="middle">
            {formatINR(pt.val)}
          </text>
        </g>
      ))}
    </>
  );

  return (
    <div style={{ position: 'relative', width: '100%', marginBottom: 24 }}>
      {/* Legend */}
      <Space style={{ marginBottom: 12, justifyContent: 'center', display: 'flex' }}>
        <Badge color="#1890ff" text="Purchase Price (Cost)" />
        <Badge color="#722ed1" text="Wholesale Price" />
        <Badge color="#52c41a" text="Retail Price (MRP)" />
      </Space>

      <div style={{ height: vbH, width: '100%' }}>
        <svg viewBox={`0 0 ${vbW} ${vbH}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          {/* Draw a subtle grid */}
          <line x1={paddingX} y1={paddingY} x2={vbW - paddingX} y2={paddingY} stroke="#f0f0f0" strokeDasharray="4" />
          <line x1={paddingX} y1={vbH - paddingY} x2={vbW - paddingX} y2={vbH - paddingY} stroke="#f0f0f0" strokeDasharray="4" />

          {/* Lines */}
          {renderLine(purchasePoints, '#1890ff')}
          {renderLine(wholesalePoints, '#722ed1')}
          {renderLine(mrpPoints, '#52c41a')}
        </svg>
      </div>
    </div>
  );
}
