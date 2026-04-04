import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal, InputNumber, Input, DatePicker, Radio, Typography,
  Alert, message, Space, Row, Col, Select, Tag, Spin,
} from 'antd';
import { formatINR, formatDate } from '../../utils/formatCurrency';
import { recordPayment } from '../../api/payments.api';
import { listInvoices } from '../../api/invoices.api';

const { Text } = Typography;

const STATUS_COLORS = { unpaid: 'red', partial: 'orange' };

/**
 * PaymentModal - record a payment against an invoice or a customer.
 *
 * Props:
 *   customerId  - integer ID of the customer
 *   invoiceId   - integer ID of a specific invoice (null = let user pick from dropdown)
 *   balanceDue  - balance on the specific invoice (used only when invoiceId is pre-set)
 *   open        - modal visibility
 *   onClose     - called on cancel / close
 *   onSuccess   - called after successful payment with response data
 */
export default function PaymentModal({ customerId, invoiceId: propInvoiceId, balanceDue: propBalanceDue, open, onClose, onSuccess }) {
  // If invoiceId is pre-set (from Invoice Detail page), use it directly.
  // If null (from Customer Detail page), let user pick via dropdown.
  const isCustomerLevel = !propInvoiceId && !!customerId;

  const [selectedInvoiceId, setSelectedInvoiceId] = useState(propInvoiceId || null);
  const [selectedBalance, setSelectedBalance] = useState(propBalanceDue || 0);
  const [unpaidInvoices, setUnpaidInvoices] = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  const [amount, setAmount] = useState(0);
  const [mode, setMode] = useState('cash');
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentDate, setPaymentDate] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // The effective invoice ID and balance to use
  const effectiveInvoiceId = propInvoiceId || selectedInvoiceId;
  const effectiveBalance = propInvoiceId ? propBalanceDue : selectedBalance;

  // Fetch unpaid invoices when modal opens in customer-level mode
  useEffect(() => {
    if (open && isCustomerLevel && customerId) {
      setInvoicesLoading(true);
      Promise.all([
        listInvoices({ customer_id: customerId, status: 'unpaid', limit: 50 }),
        listInvoices({ customer_id: customerId, status: 'partial', limit: 50 }),
      ])
        .then(([unpaidRes, partialRes]) => {
          const all = [
            ...(unpaidRes.data.data?.invoices || []),
            ...(partialRes.data.data?.invoices || []),
          ];
          // Sort oldest first
          all.sort((a, b) => new Date(a.date) - new Date(b.date));
          setUnpaidInvoices(all);
        })
        .catch(() => setUnpaidInvoices([]))
        .finally(() => setInvoicesLoading(false));
    }
  }, [open, isCustomerLevel, customerId]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setSelectedInvoiceId(propInvoiceId || null);
      setSelectedBalance(propBalanceDue || 0);
      setAmount(propInvoiceId ? (propBalanceDue || 0) : 0);
      setMode('cash');
      setReferenceNo('');
      setNotes('');
      setPaymentDate(null);
      setError(null);
    }
  }, [open, propInvoiceId, propBalanceDue]);

  // When user selects an invoice from the dropdown, update balance and amount
  const handleInvoiceSelect = useCallback((invoiceId) => {
    setSelectedInvoiceId(invoiceId);
    const inv = unpaidInvoices.find((i) => i.id === invoiceId);
    if (inv) {
      const bal = parseFloat(inv.balance_due) || 0;
      setSelectedBalance(bal);
      setAmount(bal); // pre-fill with full balance
    } else {
      setSelectedBalance(0);
      setAmount(0);
    }
  }, [unpaidInvoices]);

  const handleSubmit = useCallback(async () => {
    if (!amount || amount <= 0) {
      message.warning('Enter a valid payment amount');
      return;
    }
    // Must select an invoice when in customer-level mode
    if (isCustomerLevel && !selectedInvoiceId) {
      message.warning('Please select which invoice this payment is for');
      return;
    }
    // Cap amount at balance due for invoice-linked payments
    if (effectiveInvoiceId && amount > effectiveBalance) {
      message.warning(`Amount cannot exceed balance due (${formatINR(effectiveBalance)})`);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        customer_id: customerId,
        invoice_id: effectiveInvoiceId || null,
        amount,
        mode,
        payment_date: paymentDate
          ? paymentDate.format('YYYY-MM-DD')
          : new Date().toISOString().split('T')[0],
      };
      // Exclude optional fields entirely when empty — express-validator optional()
      // only skips 'undefined', not 'null', so we must omit the key.
      if (referenceNo) payload.reference_no = referenceNo;
      if (notes) payload.notes = notes;

      const { data } = await recordPayment(payload);

      const updatedBalance = data.data.outstanding_balance != null
        ? data.data.outstanding_balance
        : (effectiveBalance - amount);

      message.success(
        `Payment of ${formatINR(amount)} recorded. Customer outstanding: ${formatINR(updatedBalance)}`
      );
      onSuccess?.(data.data);
      onClose();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to record payment';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }, [
    amount, effectiveBalance, effectiveInvoiceId, customerId,
    isCustomerLevel, selectedInvoiceId,
    mode, referenceNo, notes, paymentDate, onSuccess, onClose,
  ]);

  return (
    <Modal
      title="Record Payment"
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      okText="Record Payment"
      okButtonProps={{ disabled: submitting || !amount, loading: submitting }}
      confirmLoading={submitting}
      destroyOnHidden
      width={520}
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

        {/* ── Invoice Selector (only shown when opened from Customer page) ── */}
        {isCustomerLevel && (
          <div>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>
              Apply to Invoice <Text type="danger">*</Text>
            </Text>
            {invoicesLoading ? (
              <Spin size="small" />
            ) : unpaidInvoices.length === 0 ? (
              <Alert
                type="info"
                message="No unpaid or partial invoices found for this customer."
                showIcon
                style={{ marginBottom: 0 }}
              />
            ) : (
              <Select
                style={{ width: '100%' }}
                placeholder="Select unpaid invoice..."
                value={selectedInvoiceId}
                onChange={handleInvoiceSelect}
                size="large"
                optionLabelProp="label"
              >
                {unpaidInvoices.map((inv) => (
                  <Select.Option
                    key={inv.id}
                    value={inv.id}
                    label={`${inv.invoice_no} — ${formatINR(inv.balance_due)} due`}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <Text strong>{inv.invoice_no}</Text>
                        <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                          {formatDate(inv.date)}
                        </Text>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <Text style={{ color: '#ff4d4f', fontWeight: 600 }}>
                          {formatINR(inv.balance_due)} due
                        </Text>
                        <Tag color={STATUS_COLORS[inv.status]} style={{ marginLeft: 8, fontSize: 11 }}>
                          {inv.status?.toUpperCase()}
                        </Tag>
                      </div>
                    </div>
                  </Select.Option>
                ))}
              </Select>
            )}
          </div>
        )}

        {/* ── Balance info ── */}
        <div style={{
          background: effectiveInvoiceId ? '#f6ffed' : '#fffbe6',
          border: `1px solid ${effectiveInvoiceId ? '#b7eb8f' : '#ffe58f'}`,
          borderRadius: 6,
          padding: '8px 12px',
        }}>
          <Text type="secondary">
            {effectiveInvoiceId ? 'Invoice Balance Due: ' : 'Customer Total Outstanding: '}
          </Text>
          <Text strong style={{ fontSize: 16 }}>
            {formatINR(effectiveBalance)}
          </Text>
        </div>

        {/* ── Amount ── */}
        <div>
          <Text strong style={{ display: 'block', marginBottom: 4 }}>Amount</Text>
          <InputNumber
            value={amount}
            onChange={setAmount}
            min={0.01}
            max={effectiveInvoiceId ? effectiveBalance : undefined}
            precision={2}
            style={{ width: '100%' }}
            size="large"
            prefix="Rs."
            onFocus={(e) => e.target.select()}
            autoFocus
          />
        </div>

        {/* ── Payment mode ── */}
        <div>
          <Text strong style={{ display: 'block', marginBottom: 4 }}>Payment Mode</Text>
          <Radio.Group value={mode} onChange={(e) => setMode(e.target.value)}>
            <Radio.Button value="cash">Cash</Radio.Button>
            <Radio.Button value="upi">UPI</Radio.Button>
            <Radio.Button value="bank">Bank</Radio.Button>
            <Radio.Button value="cheque">Cheque</Radio.Button>
          </Radio.Group>
        </div>

        {/* ── Date + Reference ── */}
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

        {/* ── Notes ── */}
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
