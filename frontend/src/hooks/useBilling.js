import { useState, useCallback, useMemo } from 'react';
import { calculateLineItem, calculateInvoiceTotals, getPaymentStatus } from '../utils/billing.calculations';
import { createInvoice } from '../api/invoices.api';

export function useBilling(initialBillType = 'retail') {
  const [customer, setCustomerState] = useState(null);
  const [billType, setBillType] = useState(initialBillType);
  const [items, setItems] = useState([]);
  const [payment, setPayment] = useState({
    amount_paid: 0,
    modes: [],
    due_date: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  // When customer is set, auto-set billType
  const setCustomer = useCallback((cust) => {
    setCustomerState(cust);
    if (cust && cust.type === 'wholesale') {
      setBillType('wholesale');
    } else if (cust) {
      setBillType('retail');
    }
  }, []);

  // Add item from ProductSearch onSelect
  const addItem = useCallback((product) => {
    const mrp = parseFloat(product.mrp) || 0;
    const wholesalePrice = parseFloat(product.wholesale_price) || mrp;
    const newItem = {
      product_id: product.id,
      product_name_snapshot: product.name || 'Unknown Product',
      hsn_snapshot: product.hsn_code || '',
      qty: 1,
      unit: product.unit || product.base_unit || 'piece',
      base_unit: product.base_unit || product.unit || 'piece',
      rate: billType === 'wholesale' ? (wholesalePrice || mrp) : mrp,
      discount_pct: 0,
      discount_amount: 0,
      gst_pct: parseFloat(product.gst_rate) || 0,
      cost_price_snapshot: parseFloat(product.purchase_price) || 0,
    };
    const computed = calculateLineItem(newItem);
    setItems(prev => [...prev, computed]);
    return items.length; // index of new item
  }, [billType, items.length]);

  // Update item field and recalculate
  const updateItem = useCallback((index, field, value) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      // Recalculate if discount_pct changed
      if (field === 'discount_pct') {
        updated[index].discount_amount = updated[index].rate * (value / 100);
      }
      updated[index] = calculateLineItem(updated[index]);
      return updated;
    });
  }, []);

  // Update multiple fields on an item at once (avoids multiple re-renders)
  const updateItemFields = useCallback((index, fieldsObj) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...fieldsObj };
      if ('discount_pct' in fieldsObj) {
        updated[index].discount_amount = updated[index].rate * (fieldsObj.discount_pct / 100);
      }
      updated[index] = calculateLineItem(updated[index]);
      return updated;
    });
  }, []);

  const removeItem = useCallback((index) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Computed totals
  const totals = useMemo(() => calculateInvoiceTotals(items), [items]);

  const balanceDue = useMemo(() => {
    return parseFloat((totals.grand_total - payment.amount_paid).toFixed(2));
  }, [totals.grand_total, payment.amount_paid]);

  const paymentStatus = useMemo(() => {
    return getPaymentStatus(totals.grand_total, payment.amount_paid);
  }, [totals.grand_total, payment.amount_paid]);

  const setPaymentAmount = useCallback((amount) => {
    setPayment(prev => ({ ...prev, amount_paid: amount }));
  }, []);

  const addPaymentMode = useCallback((mode, amount, reference_no) => {
    setPayment(prev => ({
      ...prev,
      modes: [...prev.modes, { mode, amount, reference_no: reference_no || '' }],
    }));
  }, []);

  const removePaymentMode = useCallback((index) => {
    setPayment(prev => ({
      ...prev,
      modes: prev.modes.filter((_, i) => i !== index),
    }));
  }, []);

  const setDueDate = useCallback((date) => {
    setPayment(prev => ({ ...prev, due_date: date }));
  }, []);

  const submitInvoice = useCallback(async () => {
    setErrors({});
    // Validate
    if (items.length === 0) {
      setErrors({ items: 'At least one item required' });
      return null;
    }
    if (billType !== 'quickbill' && !customer) {
      setErrors({ customer: 'Customer required for retail/wholesale bills' });
      return null;
    }
    if (billType === 'quickbill' && !customer && balanceDue > 0) {
      setErrors({ customer: 'Walk-in customers must pay in full. Select or create a customer to allow dues.' });
      return null;
    }
    if (balanceDue > 0 && !payment.due_date && billType !== 'quickbill') {
      setErrors({ due_date: 'Due date required when balance is due' });
      return null;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        customer_id: customer ? customer.id : null,
        customer_name_walkin: billType === 'quickbill' ? (customer?.name || null) : null,
        bill_type: billType,
        date: new Date().toISOString().split('T')[0],
        items: items.map(item => ({
          product_id: item.product_id,
          product_name_snapshot: item.product_name_snapshot,
          hsn_snapshot: item.hsn_snapshot,
          qty: item.qty,
          unit: item.unit,
          rate: item.rate,
          discount_pct: item.discount_pct || 0,
          discount_amount: item.discount_amount || 0,
          gst_pct: item.gst_pct,
          cost_price_snapshot: item.cost_price_snapshot,
          ...(item.alt_unit ? {
            alt_qty: item.alt_qty,
            alt_unit: item.alt_unit,
            base_qty: item.base_qty,
          } : {}),
        })),
        payment: {
          amount_paid: payment.amount_paid,
          modes: payment.modes.length > 0 ? payment.modes :
            (payment.amount_paid > 0 ? [{ mode: 'cash', amount: payment.amount_paid, reference_no: '' }] : []),
          due_date: payment.due_date || null,
        },
      };
      const { data } = await createInvoice(payload);
      return data.data;
    } catch (err) {
      if (err.response?.data?.code === 'INSUFFICIENT_STOCK') {
        setErrors({ stock: err.response.data.failures || err.response.data.error });
      } else {
        setErrors({ submit: err.response?.data?.error || 'Failed to create invoice' });
      }
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [items, customer, billType, payment, balanceDue]);

  const resetBilling = useCallback(() => {
    setCustomerState(null);
    setBillType('retail');
    setItems([]);
    setPayment({ amount_paid: 0, modes: [], due_date: null });
    setErrors({});
  }, []);

  return {
    customer, setCustomer,
    billType, setBillType,
    items, addItem, updateItem, updateItemFields, removeItem,
    payment, setPaymentAmount, addPaymentMode, removePaymentMode, setDueDate,
    isSubmitting, errors, setErrors,
    totals, balanceDue, paymentStatus,
    submitInvoice, resetBilling,
  };
}
