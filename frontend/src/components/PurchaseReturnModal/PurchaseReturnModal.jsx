import React, { useState, useEffect } from 'react';
import { Modal, Table, InputNumber, Input, message } from 'antd';
import { createPurchaseReturn } from '../../api/purchases.api';

export default function PurchaseReturnModal({ open, purchase, onClose, onSuccess }) {
  const [returnItems, setReturnItems] = useState({});
  const [globalReason, setGlobalReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && purchase) {
      setReturnItems({});
      setGlobalReason('');
    }
  }, [open, purchase]);

  if (!purchase) return null;

  const handleQtyChange = (productId, val) => {
    setReturnItems(prev => ({
      ...prev,
      [productId]: { ...prev[productId], qty_returned: val }
    }));
  };

  const handleReasonChange = (productId, val) => {
    setReturnItems(prev => ({
      ...prev,
      [productId]: { ...prev[productId], reason: val }
    }));
  };

  const handleSubmit = async () => {
    // Filter items with qty_returned > 0
    const itemsToReturn = purchase.items
      .map(item => {
        const ret = returnItems[item.product_id];
        return {
          product_id: item.product_id,
          qty_returned: ret?.qty_returned || 0,
          reason: ret?.reason || ''
        };
      })
      .filter(item => item.qty_returned > 0);

    if (itemsToReturn.length === 0) {
      message.warning('Please enter return quantity for at least one item');
      return;
    }

    setSubmitting(true);
    try {
      await createPurchaseReturn(purchase.id, {
        reason: globalReason,
        items: itemsToReturn
      });
      message.success('Purchase return submitted and debit note generated successfully');
      onSuccess?.();
      onClose();
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to submit return');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { title: 'Product', dataIndex: 'product_name', key: 'product_name' },
    { title: 'Purchased Qty', dataIndex: 'qty', key: 'qty' },
    { 
      title: 'Return Qty', 
      key: 'return_qty',
      render: (_, record) => (
        <InputNumber 
          min={0} 
          max={Math.min(record.qty, record.current_stock || record.qty)} 
          value={returnItems[record.product_id]?.qty_returned || 0}
          onChange={(val) => handleQtyChange(record.product_id, val)}
          style={{ width: '100%' }}
        />
      )
    },
    {
      title: 'Item Reason (Optional)',
      key: 'reason',
      render: (_, record) => (
        <Input 
          placeholder="e.g. Defective"
          value={returnItems[record.product_id]?.reason || ''}
          onChange={(e) => handleReasonChange(record.product_id, e.target.value)}
          disabled={!returnItems[record.product_id]?.qty_returned}
        />
      )
    }
  ];

  return (
    <Modal
      title={`Return Items - PO: ${purchase.po_number}`}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      okText="Submit Return & Generate Debit Note"
      width={800}
      destroyOnHidden={false}
    >
      <div style={{ marginBottom: 16 }}>
        <p><strong>Supplier:</strong> {purchase.supplier_name}</p>
        <Input.TextArea 
          placeholder="Global reason for return (optional)" 
          value={globalReason}
          onChange={(e) => setGlobalReason(e.target.value)}
          rows={2}
        />
      </div>
      
      <Table 
        columns={columns} 
        dataSource={purchase.items} 
        rowKey="id"
        pagination={false}
        size="small"
      />
    </Modal>
  );
}
