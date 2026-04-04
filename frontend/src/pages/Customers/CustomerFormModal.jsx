import React, { useEffect, useState } from 'react';
import {
  Modal, Form, Input, InputNumber, Select, message, Spin,
} from 'antd';
import { createCustomer, updateCustomer } from '../../api/customers.api';

const { TextArea } = Input;

const TYPE_OPTIONS = [
  { label: 'Retail', value: 'retail' },
  { label: 'Wholesale', value: 'wholesale' },
  { label: 'Both', value: 'both' },
];

export default function CustomerFormModal({ open, onClose, onSuccess, customer }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const isEdit = !!customer;

  useEffect(() => {
    if (open && customer) {
      form.setFieldsValue(customer);
    } else if (open) {
      form.resetFields();
      form.setFieldsValue({ type: 'retail', credit_limit: 0 });
    }
  }, [open, customer, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      // Strip non-digits from phone fields
      if (values.phone) values.phone = values.phone.replace(/\D/g, '');
      if (values.alt_phone) values.alt_phone = values.alt_phone.replace(/\D/g, '');
      // Auto-uppercase GSTIN
      if (values.gstin) values.gstin = values.gstin.toUpperCase();

      let finalCustomerId = isEdit ? customer.id : null;
      if (isEdit) {
        await updateCustomer(customer.id, values);
        message.success('Customer updated');
      } else {
        const res = await createCustomer(values);
        finalCustomerId = res.data.id;
        message.success('Customer created');
      }
      onSuccess({ ...values, id: finalCustomerId });
      onClose();
    } catch (err) {
      if (err.response?.status === 409) {
        const errData = err.response.data;
        if (errData.code === 'DUPLICATE_PHONE') {
          form.setFields([{ name: 'phone', errors: ['This phone number is already registered'] }]);
        } else {
          message.error(errData.error || 'A duplicate record already exists');
        }
      } else if (err.errorFields) {
        // form validation error — antd shows inline
      } else {
        message.error('Failed to save customer');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={isEdit ? 'Edit Customer' : 'New Customer'}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      width={500}
      destroyOnHidden={false}
    >
      <Form form={form} layout="vertical" requiredMark="optional">
        <Form.Item name="name" label="Name"
          rules={[{ required: true, message: 'Customer name is required' }]}>
          <Input placeholder="e.g. Ramesh Kumar" />
        </Form.Item>

        <Form.Item name="business_name" label="Business Name">
          <Input placeholder="e.g. Kumar Hardware Store" />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item name="phone" label="Phone"
            rules={[
              { required: true, message: 'Phone is required' },
              { pattern: /^\d{10}$/, message: 'Must be 10 digits' },
            ]}
            normalize={(val) => val ? val.replace(/\D/g, '') : val}>
            <Input placeholder="10-digit mobile number" maxLength={10}
              style={{ fontFamily: 'monospace' }} />
          </Form.Item>

          <Form.Item name="alt_phone" label="Alt Phone"
            rules={[
              { pattern: /^\d{10}$/, message: 'Must be 10 digits' },
            ]}
            normalize={(val) => val ? val.replace(/\D/g, '') : val}>
            <Input placeholder="Optional" maxLength={10}
              style={{ fontFamily: 'monospace' }} />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item name="email" label="Email"
            rules={[{ type: 'email', message: 'Invalid email' }]}>
            <Input placeholder="email@example.com" />
          </Form.Item>

          <Form.Item name="type" label="Type"
            rules={[{ required: true, message: 'Required' }]}>
            <Select options={TYPE_OPTIONS} />
          </Form.Item>
        </div>

        <Form.Item name="address" label="Address">
          <TextArea rows={2} placeholder="Full address" />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <Form.Item name="city" label="City">
            <Input placeholder="e.g. Mumbai" />
          </Form.Item>

          <Form.Item name="pincode" label="Pincode"
            rules={[{ pattern: /^\d{6}$/, message: 'Must be 6 digits' }]}>
            <Input placeholder="400001" maxLength={6} />
          </Form.Item>

          <Form.Item name="gstin" label="GSTIN"
            rules={[
              { len: 15, message: 'Must be 15 characters' },
            ]}
            normalize={(val) => val ? val.toUpperCase() : val}>
            <Input placeholder="15-char GST number" maxLength={15}
              style={{ textTransform: 'uppercase' }} />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item name="credit_limit" label="Credit Limit">
            <InputNumber min={0} precision={2} prefix="₹"
              style={{ width: '100%' }} placeholder="0.00" />
          </Form.Item>

          <Form.Item name="payment_terms" label="Payment Terms">
            <Input placeholder="e.g. Net 30" />
          </Form.Item>
        </div>

        <Form.Item name="notes" label="Notes">
          <TextArea rows={2} placeholder="Internal notes about this customer" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
