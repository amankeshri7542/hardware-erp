import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Button, Input, InputNumber, Radio, Table, Tag, Modal, DatePicker,
  Alert, message, Space, Row, Col, Card, Divider, Typography, Spin,
  Descriptions,
} from 'antd';
import {
  DeleteOutlined, PrinterOutlined, PlusOutlined,
  ThunderboltOutlined, CheckCircleOutlined, CloseCircleOutlined,
  WalletOutlined, CreditCardOutlined, BankOutlined, QrcodeOutlined,
} from '@ant-design/icons';
import ProductSearch from '../../components/ProductSearch/ProductSearch';
import CustomerSearch from '../../components/CustomerSearch/CustomerSearch';
import { useBilling } from '../../hooks/useBilling';
import { formatINR, formatDate } from '../../utils/formatCurrency';
import { getPdfStatus } from '../../api/invoices.api';
import './BillingPage.css';

const { Title, Text } = Typography;

const PAYMENT_MODES = [
  { key: 'cash', label: 'Cash', icon: <WalletOutlined /> },
  { key: 'upi', label: 'UPI', icon: <QrcodeOutlined /> },
  { key: 'cheque', label: 'Cheque', icon: <CreditCardOutlined /> },
  { key: 'bank', label: 'Bank', icon: <BankOutlined /> },
];

export default function BillingPage() {
  const {
    customer, setCustomer,
    billType, setBillType,
    items, addItem, updateItem, removeItem,
    payment, setPaymentAmount, addPaymentMode, removePaymentMode, setDueDate,
    isSubmitting, errors, setErrors,
    totals, balanceDue, paymentStatus,
    submitInvoice, resetBilling,
  } = useBilling('retail');

  // Quick-bill walk-in name
  const [walkinName, setWalkinName] = useState('');

  // Post-submission modal
  const [submittedInvoice, setSubmittedInvoice] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [pdfReady, setPdfReady] = useState(false);
  const [pdfPolling, setPdfPolling] = useState(false);
  const pdfPollRef = useRef(null);

  // Payment mode input state
  const [payModeSelected, setPayModeSelected] = useState('cash');
  const [payModeAmount, setPayModeAmount] = useState(0);
  const [payModeRef, setPayModeRef] = useState('');

  // Refs for focus management
  const productSearchRef = useRef(null);
  const qtyInputRefs = useRef({});

  // ───── Keyboard shortcuts ─────
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // F2 → toggle Quick Bill
      if (e.key === 'F2') {
        e.preventDefault();
        setBillType(prev => prev === 'quickbill' ? 'retail' : 'quickbill');
        message.info(billType === 'quickbill' ? 'Switched to Retail' : 'Quick Bill mode');
      }
      // F9 → submit invoice
      if (e.key === 'F9') {
        e.preventDefault();
        handleSubmit();
      }
      // F4 → pay full amount
      if (e.key === 'F4') {
        e.preventDefault();
        handlePayFull();
      }
      // Esc → clear bill (only if items exist, no confirmation)
      if (e.key === 'Escape') {
        if (items.length > 0) {
          e.preventDefault();
          resetBilling();
          setWalkinName('');
          setPayModeAmount(0);
          setPayModeRef('');
          message.info('Bill cleared');
        }
      }
      // Ctrl+P → print last invoice
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        if (submittedInvoice) {
          e.preventDefault();
          const pdfUrl = `${import.meta.env.VITE_API_URL || '/api'}/invoices/${submittedInvoice.invoice_id}/pdf`;
          window.open(pdfUrl, '_blank');
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billType, items, customer, payment, submittedInvoice]);

  // ───── Product selected → add item, focus qty ─────
  const handleProductSelect = useCallback((product) => {
    // Check if product already in items
    const existingIdx = items.findIndex(i => i.product_id === product.id);
    if (existingIdx >= 0) {
      updateItem(existingIdx, 'qty', items[existingIdx].qty + 1);
      message.info(`${product.name} qty increased to ${items[existingIdx].qty + 1}`);
      return;
    }
    const newIndex = addItem(product);
    // Focus qty field of the new item after render
    setTimeout(() => {
      const qtyEl = qtyInputRefs.current[newIndex];
      if (qtyEl) {
        qtyEl.focus();
        qtyEl.select();
      }
    }, 50);
  }, [addItem, items, updateItem]);

  // ───── Qty field Enter → return focus to ProductSearch ─────
  const handleQtyKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Focus back to product search
      const searchInput = document.querySelector('.billing-product-search input');
      if (searchInput) searchInput.focus();
    }
  };

  // ───── Submit ─────
  const handleSubmit = async () => {
    if (billType === 'quickbill' && walkinName) {
      setCustomer({ name: walkinName });
    }

    const result = await submitInvoice();
    if (result) {
      message.success(`Invoice ${result.invoice_no || result.invoice_id} created!`);
      setSubmittedInvoice(result);
      setShowSuccessModal(true);
      startPdfPolling(result.invoice_id);
    }
  };

  // ───── PDF polling ─────
  const startPdfPolling = (invoiceId) => {
    setPdfReady(false);
    setPdfPolling(true);
    let attempts = 0;

    pdfPollRef.current = setInterval(async () => {
      attempts++;
      try {
        const { data } = await getPdfStatus(invoiceId);
        if (data.data?.pdf_status === 'ready' || data.data?.pdf_url) {
          clearInterval(pdfPollRef.current);
          setPdfReady(true);
          setPdfPolling(false);
        }
      } catch {
        // PDF service might not exist yet — stop after 10 attempts
      }
      if (attempts >= 10) {
        clearInterval(pdfPollRef.current);
        setPdfPolling(false);
      }
    }, 2000);
  };

  useEffect(() => {
    return () => {
      if (pdfPollRef.current) clearInterval(pdfPollRef.current);
    };
  }, []);

  // ───── Close success modal and reset ─────
  const handleModalClose = () => {
    if (pdfPollRef.current) clearInterval(pdfPollRef.current);
    setShowSuccessModal(false);
    setSubmittedInvoice(null);
    setPdfReady(false);
    setPdfPolling(false);
    setWalkinName('');
    setPayModeSelected('cash');
    setPayModeAmount(0);
    setPayModeRef('');
    resetBilling();
  };

  // ───── Handle "Pay Full" convenience ─────
  const handlePayFull = () => {
    setPaymentAmount(totals.grand_total);
  };

  // ───── Add payment mode entry ─────
  const handleAddPaymentMode = () => {
    if (payModeAmount <= 0) {
      message.warning('Enter a payment amount');
      return;
    }
    addPaymentMode(payModeSelected, payModeAmount, payModeRef);
    const totalModeAmount = payment.modes.reduce((s, m) => s + m.amount, 0) + payModeAmount;
    setPaymentAmount(totalModeAmount);
    setPayModeAmount(0);
    setPayModeRef('');
  };

  // ───── Stock error display ─────
  const stockErrors = errors.stock;

  // ───── Table columns ─────
  const columns = [
    {
      title: '#',
      width: 45,
      render: (_, __, idx) => idx + 1,
    },
    {
      title: 'Product',
      dataIndex: 'product_name_snapshot',
      ellipsis: true,
      width: '25%',
      render: (name, record) => (
        <div>
          <Text strong>{name}</Text>
          {record.hsn_snapshot && (
            <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
              HSN: {record.hsn_snapshot}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: 'Qty',
      dataIndex: 'qty',
      width: 90,
      render: (val, _, idx) => (
        <InputNumber
          ref={(el) => { qtyInputRefs.current[idx] = el; }}
          min={1}
          value={val}
          onChange={(v) => updateItem(idx, 'qty', v || 1)}
          onKeyDown={handleQtyKeyDown}
          onFocus={(e) => e.target.select()}
          size="small"
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: 'Unit',
      dataIndex: 'unit',
      width: 65,
      render: (u) => <Text type="secondary">{u}</Text>,
    },
    {
      title: 'Rate',
      dataIndex: 'rate',
      width: 110,
      render: (val, _, idx) => (
        <InputNumber
          min={0}
          step={0.5}
          value={val}
          onChange={(v) => updateItem(idx, 'rate', v || 0)}
          onFocus={(e) => e.target.select()}
          size="small"
          style={{ width: '100%' }}
          formatter={(v) => `${v}`}
        />
      ),
    },
    {
      title: 'Disc%',
      dataIndex: 'discount_pct',
      width: 80,
      render: (val, _, idx) => (
        <InputNumber
          min={0}
          max={100}
          value={val}
          onChange={(v) => updateItem(idx, 'discount_pct', v || 0)}
          onFocus={(e) => e.target.select()}
          size="small"
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: 'GST%',
      dataIndex: 'gst_pct',
      width: 65,
      render: (val) => <Text type="secondary">{val}%</Text>,
    },
    {
      title: 'Amount',
      dataIndex: 'line_total',
      width: 110,
      align: 'right',
      render: (val) => <Text strong>{formatINR(val)}</Text>,
    },
    {
      title: '',
      width: 40,
      render: (_, __, idx) => (
        <Button
          type="text"
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => removeItem(idx)}
        />
      ),
    },
  ];

  const kbdStyle = {
    display: 'inline-block',
    padding: '1px 6px',
    border: '1px solid #555',
    borderRadius: 3,
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: 600,
    color: '#fff',
    backgroundColor: '#333',
    marginRight: 4,
    lineHeight: '18px',
  };

  const shortcutItemStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    marginRight: 16,
    fontSize: 12,
    color: '#ccc',
  };

  return (
    <div className="billing-page">
      {/* Keyboard shortcuts bar */}
      <div style={{
        background: '#1f1f1f',
        padding: '6px 16px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 4,
        borderBottom: '1px solid #333',
      }}>
        <span style={shortcutItemStyle}><span style={kbdStyle}>F2</span> Quick Bill</span>
        <span style={shortcutItemStyle}><span style={kbdStyle}>F9</span> Finalize</span>
        <span style={shortcutItemStyle}><span style={kbdStyle}>F4</span> Pay Full</span>
        <span style={shortcutItemStyle}><span style={kbdStyle}>Esc</span> Clear Bill</span>
        <span style={shortcutItemStyle}><span style={kbdStyle}>Enter</span> Add Item</span>
        <span style={shortcutItemStyle}><span style={kbdStyle}>Ctrl+P</span> Print Last Invoice</span>
      </div>

      {/* Header */}
      <div className="billing-header">
        <Title level={3} style={{ margin: 0 }}>New Bill</Title>
        <Space>
          <Tag color={billType === 'quickbill' ? 'orange' : billType === 'wholesale' ? 'blue' : 'green'}>
            {billType === 'quickbill' ? 'Quick Bill' : billType === 'wholesale' ? 'Wholesale' : 'Retail'}
          </Tag>
        </Space>
      </div>

      <Row gutter={16} className="billing-body">
        {/* ═══════ LEFT PANEL (65%) ═══════ */}
        <Col xs={24} lg={15} xl={16}>
          {/* Customer section */}
          <Card size="small" className="billing-card">
            <Row gutter={12} align="middle">
              <Col flex="auto">
                {billType === 'quickbill' ? (
                  <Input
                    placeholder="Walk-in customer name (optional)"
                    value={walkinName}
                    onChange={(e) => setWalkinName(e.target.value)}
                    size="large"
                    prefix={<Text type="secondary">Walk-in:</Text>}
                  />
                ) : (
                  <>
                    {customer ? (
                      <div className="selected-customer">
                        <Space>
                          <Text strong>{customer.name}</Text>
                          {customer.business_name && (
                            <Text type="secondary">({customer.business_name})</Text>
                          )}
                          {customer.phone && <Text type="secondary">{customer.phone}</Text>}
                          <Tag color={customer.type === 'wholesale' ? 'blue' : 'green'}>
                            {customer.type}
                          </Tag>
                          <Button
                            type="link"
                            size="small"
                            danger
                            onClick={() => setCustomer(null)}
                          >
                            Change
                          </Button>
                        </Space>
                      </div>
                    ) : (
                      <CustomerSearch
                        onSelect={setCustomer}
                        autoFocus={true}
                      />
                    )}
                  </>
                )}
              </Col>
              <Col>
                <Radio.Group
                  value={billType}
                  onChange={(e) => setBillType(e.target.value)}
                  size="small"
                  buttonStyle="solid"
                >
                  <Radio.Button value="retail">Retail</Radio.Button>
                  <Radio.Button value="wholesale">Wholesale</Radio.Button>
                  <Radio.Button value="quickbill">
                    <ThunderboltOutlined /> Quick
                  </Radio.Button>
                </Radio.Group>
              </Col>
            </Row>
            {errors.customer && (
              <Alert message={errors.customer} type="error" showIcon style={{ marginTop: 8 }} />
            )}
          </Card>

          {/* Product search */}
          <Card size="small" className="billing-card billing-product-search">
            <ProductSearch
              onSelect={handleProductSelect}
              billType={billType === 'quickbill' ? 'retail' : billType}
              autoFocus={billType === 'quickbill'}
              placeholder="Search product by name, code, or barcode..."
            />
          </Card>

          {/* Items table */}
          <Card
            size="small"
            className="billing-card billing-items-card"
            title={
              <Space>
                <Text strong>Items</Text>
                <Tag>{items.length} items, {items.reduce((s, i) => s + (Number(i.qty) || 0), 0)} qty</Tag>
              </Space>
            }
          >
            {errors.items && (
              <Alert message={errors.items} type="error" showIcon style={{ marginBottom: 8 }} />
            )}

            {/* INSUFFICIENT_STOCK error display */}
            {stockErrors && (
              <Alert
                type="error"
                showIcon
                icon={<CloseCircleOutlined />}
                message="Insufficient Stock"
                description={
                  Array.isArray(stockErrors) ? (
                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                      {stockErrors.map((f, i) => (
                        <li key={i}>
                          <strong>{f.product_name || f.product_id}</strong>: requested {f.requested}, available {f.available}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Text>{String(stockErrors)}</Text>
                  )
                }
                closable
                onClose={() => setErrors((prev) => { const { stock, ...rest } = prev; return rest; })}
                style={{ marginBottom: 8 }}
              />
            )}

            <Table
              dataSource={items}
              columns={columns}
              rowKey={(_, idx) => idx}
              pagination={false}
              size="small"
              scroll={{ y: 'calc(100vh - 520px)' }}
              locale={{ emptyText: 'No items added yet. Search for a product above.' }}
            />
          </Card>
        </Col>

        {/* ═══════ RIGHT PANEL (35%) ═══════ */}
        <Col xs={24} lg={9} xl={8}>
          {/* Totals card */}
          <Card size="small" className="billing-card totals-card">
            <div className="totals-row">
              <Text type="secondary">Subtotal</Text>
              <Text>{formatINR(totals.subtotal)}</Text>
            </div>
            {totals.discount_total > 0 && (
              <div className="totals-row">
                <Text type="secondary">Discount</Text>
                <Text type="danger">-{formatINR(totals.discount_total)}</Text>
              </div>
            )}
            <div className="totals-row">
              <Text type="secondary">Taxable</Text>
              <Text>{formatINR(totals.taxable_total)}</Text>
            </div>
            <div className="totals-row">
              <Text type="secondary">GST</Text>
              <Text>{formatINR(totals.gst_total)}</Text>
            </div>
            <Divider style={{ margin: '8px 0' }} />
            <div className="totals-row grand-total-row">
              <Title level={4} style={{ margin: 0 }}>Grand Total</Title>
              <Title level={4} style={{ margin: 0, color: '#1677ff' }}>
                {formatINR(totals.grand_total)}
              </Title>
            </div>
          </Card>

          {/* Payment card */}
          <Card size="small" className="billing-card payment-card" title="Payment">
            {/* Quick pay full */}
            <Space style={{ marginBottom: 12, width: '100%' }} direction="vertical">
              <Row gutter={8} align="middle">
                <Col flex="auto">
                  <InputNumber
                    value={payment.amount_paid}
                    onChange={(v) => setPaymentAmount(v || 0)}
                    min={0}
                    max={totals.grand_total * 2}
                    style={{ width: '100%' }}
                    size="large"
                    prefix={<Text type="secondary">Paid</Text>}
                    formatter={(v) => `${v}`}
                    onFocus={(e) => e.target.select()}
                  />
                </Col>
                <Col>
                  <Button type="primary" ghost onClick={handlePayFull}>
                    Full
                  </Button>
                </Col>
              </Row>

              {/* Balance display */}
              <div className="balance-display">
                <Text type="secondary">Balance Due:</Text>
                <Text
                  strong
                  style={{
                    fontSize: 18,
                    color: balanceDue > 0 ? '#ff4d4f' : '#52c41a',
                  }}
                >
                  {formatINR(Math.max(balanceDue, 0))}
                </Text>
              </div>

              <Tag
                color={
                  paymentStatus === 'paid' ? 'success' :
                  paymentStatus === 'partial' ? 'warning' : 'default'
                }
                icon={paymentStatus === 'paid' ? <CheckCircleOutlined /> : null}
              >
                {paymentStatus === 'paid' ? 'Paid in Full' :
                 paymentStatus === 'partial' ? 'Partial Payment' : 'Unpaid'}
              </Tag>
            </Space>

            <Divider style={{ margin: '8px 0' }} />

            {/* Payment modes */}
            <Text type="secondary" style={{ fontSize: 12, marginBottom: 8, display: 'block' }}>
              Payment Method
            </Text>
            <Space wrap style={{ marginBottom: 8 }}>
              {PAYMENT_MODES.map((m) => (
                <Button
                  key={m.key}
                  type={payModeSelected === m.key ? 'primary' : 'default'}
                  icon={m.icon}
                  size="small"
                  onClick={() => setPayModeSelected(m.key)}
                >
                  {m.label}
                </Button>
              ))}
            </Space>

            <Row gutter={8} style={{ marginBottom: 8 }}>
              <Col span={10}>
                <InputNumber
                  placeholder="Amount"
                  value={payModeAmount}
                  onChange={(v) => setPayModeAmount(v || 0)}
                  min={0}
                  style={{ width: '100%' }}
                  size="small"
                  onFocus={(e) => e.target.select()}
                />
              </Col>
              <Col span={10}>
                <Input
                  placeholder="Ref #"
                  value={payModeRef}
                  onChange={(e) => setPayModeRef(e.target.value)}
                  size="small"
                  disabled={payModeSelected === 'cash'}
                />
              </Col>
              <Col span={4}>
                <Button
                  icon={<PlusOutlined />}
                  size="small"
                  onClick={handleAddPaymentMode}
                  style={{ width: '100%' }}
                />
              </Col>
            </Row>

            {/* Payment mode entries */}
            {payment.modes.length > 0 && (
              <div className="payment-modes-list">
                {payment.modes.map((m, i) => (
                  <div key={i} className="payment-mode-entry">
                    <Tag>{m.mode}</Tag>
                    <Text>{formatINR(m.amount)}</Text>
                    {m.reference_no && <Text type="secondary" style={{ fontSize: 11 }}>Ref: {m.reference_no}</Text>}
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => {
                        removePaymentMode(i);
                        const remaining = payment.modes.filter((_, idx) => idx !== i);
                        const totalRemaining = remaining.reduce((s, pm) => s + pm.amount, 0);
                        setPaymentAmount(totalRemaining);
                      }}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Due date for partial/unpaid */}
            {balanceDue > 0 && billType !== 'quickbill' && (
              <div style={{ marginTop: 12 }}>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                  Due Date (required)
                </Text>
                <DatePicker
                  onChange={(date, dateStr) => setDueDate(dateStr)}
                  style={{ width: '100%' }}
                  size="small"
                  format="DD-MM-YYYY"
                />
                {errors.due_date && (
                  <Text type="danger" style={{ fontSize: 12 }}>{errors.due_date}</Text>
                )}
              </div>
            )}
          </Card>

          {/* Submit errors */}
          {errors.submit && (
            <Alert
              message={errors.submit}
              type="error"
              showIcon
              closable
              onClose={() => setErrors((prev) => { const { submit, ...rest } = prev; return rest; })}
              style={{ marginBottom: 12 }}
            />
          )}

          {/* Action buttons */}
          <Space direction="vertical" style={{ width: '100%' }} size="small">
            <Button
              type="primary"
              size="large"
              block
              loading={isSubmitting}
              onClick={handleSubmit}
              disabled={items.length === 0}
              style={{ height: 48, fontSize: 16, fontWeight: 600 }}
            >
              {isSubmitting ? 'Creating Invoice...' : 'Finalise Bill (F9)'}
            </Button>
            <Button
              block
              danger
              ghost
              onClick={() => {
                if (items.length > 0) {
                  Modal.confirm({
                    title: 'Clear bill?',
                    content: 'All items and payment info will be lost.',
                    okText: 'Clear',
                    okType: 'danger',
                    onOk: () => {
                      resetBilling();
                      setWalkinName('');
                      setPayModeAmount(0);
                      setPayModeRef('');
                    },
                  });
                } else {
                  resetBilling();
                }
              }}
            >
              Clear / New Bill
            </Button>
          </Space>
        </Col>
      </Row>

      {/* ═══════ SUCCESS MODAL ═══════ */}
      <Modal
        open={showSuccessModal}
        onCancel={handleModalClose}
        footer={null}
        width={520}
        centered
        closable
        maskClosable={false}
      >
        {submittedInvoice && (
          <div className="success-modal-content">
            <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a', marginBottom: 16 }} />
            <Title level={4} style={{ marginBottom: 16 }}>Invoice Created!</Title>

            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Invoice #">
                <Text strong>{submittedInvoice.invoice_no}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Type">
                <Tag color={submittedInvoice.bill_type === 'quickbill' ? 'orange' : submittedInvoice.bill_type === 'wholesale' ? 'blue' : 'green'}>
                  {submittedInvoice.bill_type}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Total">
                <Text strong style={{ color: '#1677ff' }}>
                  {formatINR(submittedInvoice.grand_total)}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Paid">
                {formatINR(submittedInvoice.amount_paid || 0)}
              </Descriptions.Item>
              <Descriptions.Item label="Balance">
                <Text type={submittedInvoice.balance_due > 0 ? 'danger' : 'success'}>
                  {formatINR(submittedInvoice.balance_due || 0)}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={
                  submittedInvoice.status === 'paid' ? 'success' :
                  submittedInvoice.status === 'partial' ? 'warning' : 'error'
                }>
                  {submittedInvoice.status}
                </Tag>
              </Descriptions.Item>
            </Descriptions>

            <Divider />

            <Space>
              {pdfPolling && (
                <Button icon={<Spin size="small" />} disabled>
                  Generating PDF...
                </Button>
              )}
              {pdfReady && (
                <Button
                  type="primary"
                  icon={<PrinterOutlined />}
                  onClick={() => {
                    const pdfUrl = `${import.meta.env.VITE_API_URL || '/api'}/invoices/${submittedInvoice.invoice_id}/pdf`;
                    window.open(pdfUrl, '_blank');
                  }}
                >
                  Print / Download PDF
                </Button>
              )}
              {!pdfPolling && !pdfReady && (
                <Button
                  icon={<PrinterOutlined />}
                  onClick={() => {
                    const pdfUrl = `${import.meta.env.VITE_API_URL || '/api'}/invoices/${submittedInvoice.invoice_id}/pdf`;
                    window.open(pdfUrl, '_blank');
                  }}
                >
                  Try Print
                </Button>
              )}
              <Button type="primary" onClick={handleModalClose}>
                New Bill
              </Button>
            </Space>
          </div>
        )}
      </Modal>
    </div>
  );
}
