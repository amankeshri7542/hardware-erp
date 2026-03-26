import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Modal, Table, InputNumber, Typography, Alert, message, Divider, Row,
} from 'antd';
import { formatINR } from '../../utils/formatCurrency';
import { processReturn } from '../../api/invoices.api';

const { Text, Title } = Typography;

/**
 * ReturnModal - process full or partial returns against an invoice.
 *
 * Props:
 *   invoiceId  - UUID of the invoice
 *   invoice    - full invoice object with items array
 *   open       - modal visibility
 *   onClose    - called on cancel / close
 *   onSuccess  - called after successful return with response data
 */
export default function ReturnModal({ invoiceId, invoice, open, onClose, onSuccess }) {
  const [returnQtys, setReturnQtys] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Reset state when modal opens
  useEffect(() => {
    if (open && invoice?.items) {
      const initial = {};
      invoice.items.forEach((item, idx) => {
        initial[idx] = 0;
      });
      setReturnQtys(initial);
      setError(null);
    }
  }, [open, invoice]);

  const handleQtyChange = useCallback((index, value) => {
    setReturnQtys((prev) => ({ ...prev, [index]: value || 0 }));
  }, []);

  // Calculate return totals
  const returnSummary = useMemo(() => {
    if (!invoice?.items) return { items: [], totalReturn: 0, totalGst: 0, grandReturn: 0, hasItems: false };

    let totalReturn = 0;
    let totalGst = 0;
    const items = invoice.items.map((item, idx) => {
      const returnQty = returnQtys[idx] || 0;
      const rate = Number(item.rate) || 0;
      const discountPct = Number(item.discount_pct) || 0;
      const gstPct = Number(item.gst_pct) || 0;

      const lineTotal = returnQty * rate;
      const discount = lineTotal * (discountPct / 100);
      const taxable = lineTotal - discount;
      const gst = taxable * (gstPct / 100);
      const net = taxable + gst;

      totalReturn += taxable;
      totalGst += gst;

      return {
        ...item,
        return_qty: returnQty,
        return_taxable: taxable,
        return_gst: gst,
        return_net: net,
      };
    });

    return {
      items,
      totalReturn,
      totalGst,
      grandReturn: totalReturn + totalGst,
      hasItems: Object.values(returnQtys).some((q) => q > 0),
    };
  }, [invoice, returnQtys]);

  const handleSubmit = async () => {
    if (!returnSummary.hasItems) {
      message.warning('Set return quantity for at least one item');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const returnItems = invoice.items
        .map((item, idx) => ({
          invoice_item_id: item.id,
          product_id: item.product_id,
          qty: returnQtys[idx] || 0,
        }))
        .filter((ri) => ri.qty > 0);

      const { data } = await processReturn(invoiceId, { items: returnItems });
      message.success('Return processed successfully');
      onSuccess?.(data.data);
      onClose();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to process return';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: 'Product',
      dataIndex: 'product_name_snapshot',
      ellipsis: true,
    },
    {
      title: 'Billed Qty',
      dataIndex: 'qty',
      width: 90,
      align: 'center',
    },
    {
      title: 'Rate',
      dataIndex: 'rate',
      width: 100,
      align: 'right',
      render: (v) => formatINR(v),
    },
    {
      title: 'Return Qty',
      width: 110,
      align: 'center',
      render: (_, record, idx) => (
        <InputNumber
          min={0}
          max={record.qty}
          precision={3}
          value={returnQtys[idx] || 0}
          size="small"
          style={{ width: '100%' }}
          onChange={(v) => handleQtyChange(idx, v)}
          onFocus={(e) => e.target.select()}
        />
      ),
    },
    {
      title: 'Return Amount',
      width: 120,
      align: 'right',
      render: (_, __, idx) => {
        const item = returnSummary.items[idx];
        return item?.return_net > 0 ? formatINR(item.return_net) : '--';
      },
    },
  ];

  return (
    <Modal
      title="Process Return"
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      okText="Process Return"
      okButtonProps={{
        disabled: !returnSummary.hasItems || submitting,
        loading: submitting,
        danger: true,
      }}
      width={720}
      destroyOnClose
    >
      {error && (
        <Alert
          type="error"
          message={error}
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      <Text type="secondary">
        Invoice: <Text strong>{invoice?.invoice_no}</Text>
      </Text>

      <Table
        dataSource={invoice?.items || []}
        columns={columns}
        rowKey={(record) => record.id || record.product_id}
        pagination={false}
        size="small"
        style={{ marginTop: 12 }}
      />

      {returnSummary.hasItems && (
        <>
          <Divider style={{ margin: '12px 0' }} />
          <Row justify="end">
            <div style={{ textAlign: 'right' }}>
              <div>
                <Text type="secondary">Return Taxable: </Text>
                <Text>{formatINR(returnSummary.totalReturn)}</Text>
              </div>
              <div>
                <Text type="secondary">Return GST: </Text>
                <Text>{formatINR(returnSummary.totalGst)}</Text>
              </div>
              <div style={{ marginTop: 4 }}>
                <Text type="secondary">Total Refund: </Text>
                <Title level={5} type="danger" style={{ display: 'inline', margin: 0 }}>
                  {formatINR(returnSummary.grandReturn)}
                </Title>
              </div>
            </div>
          </Row>
        </>
      )}
    </Modal>
  );
}
