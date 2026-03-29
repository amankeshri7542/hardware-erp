import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal, InputNumber, Input, DatePicker, Radio, Typography, Alert, message, Space, Row, Col,
} from 'antd';
import { formatINR } from '../../utils/formatCurrency';
import { recordPayment } from '../../api/payments.api';

const { Text } = Typography;

/**
 * PaymentModal - record a payment against an invoice.
 *
 * Props:
 *   customerId  - UUID of the customer
 *   invoiceId   - UUID of the invoice
 *   balanceDue  - remaining balance on the invoice
 *   open        - modal visibility
 *   onClose     - called on cancel / close
 *   onSuccess   - called after successful payment with response data
 */
export default function PaymentModal({ customerId, invoiceId, balanceDue, open, onClose, onSuccess }) {
  const [amount, setAmount] = useState(0);
  const [mode, setMode] = useState('cash');
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentDate, setPaymentDate] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setAmount(balanceDue || 0);
      setMode('cash');
      setReferenceNo('');
      setNotes('');
      setPaymentDate(null);
      setError(null);
    }
  }, [open, balanceDue]);

  const handleSubmit = useCallback(async () => {
    if (!amount || amount <= 0) {
      message.warning('Enter a valid payment amount');
      return;
    }
    if (amount > balanceDue) {
      message.warning(`Amount cannot exceed balance due (${formatINR(balanceDue)})`);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        customer_id: customerId,
        invoice_id: invoiceId,
        amount,
        mode,
        reference_no: referenceNo || null,
        notes: notes || null,
        date: paymentDate ? paymentDate.format('YYYY-MM-DD') : new Date().toISOString().split('T')[0],
      };

      const { data } = await recordPayment(payload);
      
      const updatedBalance = data.data.outstanding_balance != null 
        ? data.data.outstanding_balance 
        : (balanceDue - amount);
        
      message.success(`Payment of ${formatINR(amount)} recorded. Outstanding balance: ${formatINR(updatedBalance)}`);
      onSuccess?.(data.data);
      onClose();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to record payment';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }, [amount, balanceDue, customerId, invoiceId, mode, referenceNo, notes, paymentDate, onSuccess, onClose]);

  return (
    <Modal
      title="Record Payment"
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      okText="Record Payment"
      okButtonProps={{ disabled: submitting || !amount, loading: submitting }}
      width={480}
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

      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {/* Balance info */}
        <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6, padding: '8px 12px' }}>
          <Text type="secondary">Balance Due: </Text>
          <Text strong style={{ fontSize: 16 }}>{formatINR(balanceDue)}</Text>
        </div>

        {/* Amount */}
        <div>
          <Text strong style={{ display: 'block', marginBottom: 4 }}>Amount</Text>
          <InputNumber
            value={amount}
            onChange={setAmount}
            min={0.01}
            max={balanceDue}
            precision={2}
            style={{ width: '100%' }}
            size="large"
            prefix="Rs."
            onFocus={(e) => e.target.select()}
            autoFocus
          />
        </div>

        {/* Payment mode */}
        <div>
          <Text strong style={{ display: 'block', marginBottom: 4 }}>Payment Mode</Text>
          <Radio.Group value={mode} onChange={(e) => setMode(e.target.value)}>
            <Radio.Button value="cash">Cash</Radio.Button>
            <Radio.Button value="upi">UPI</Radio.Button>
            <Radio.Button value="bank">Bank</Radio.Button>
            <Radio.Button value="cheque">Cheque</Radio.Button>
          </Radio.Group>
        </div>

        {/* Date */}
        <Row gutter={16}>
          <Col span={12}>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>Date</Text>
            <DatePicker
              value={paymentDate}
              onChange={setPaymentDate}
              style={{ width: '100%' }}
              placeholder="Today"
              format="DD-MM-YYYY"
            />
          </Col>
          <Col span={12}>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>Reference No</Text>
            <Input
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              placeholder="Txn / Cheque No"
              maxLength={50}
            />
          </Col>
        </Row>

        {/* Notes */}
        <div>
          <Text strong style={{ display: 'block', marginBottom: 4 }}>Notes</Text>
          <Input.TextArea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes"
            rows={2}
            maxLength={200}
          />
        </div>
      </Space>
    </Modal>
  );
}
