import React, { useEffect, useState } from 'react';
import {
  Modal, Form, Input, InputNumber, Select, Switch, AutoComplete,
  message, Spin,
} from 'antd';
import { createProduct, updateProduct, getProduct } from '../../api/products.api';

const UNIT_OPTIONS = [
  { label: 'Piece', value: 'piece' },
  { label: 'Kg', value: 'kg' },
  { label: 'Box', value: 'box' },
  { label: 'Metre', value: 'metre' },
  { label: 'Litre', value: 'litre' },
  { label: 'Set', value: 'set' },
];

const GST_OPTIONS = [
  { label: '0%', value: 0 },
  { label: '5%', value: 5 },
  { label: '12%', value: 12 },
  { label: '18%', value: 18 },
  { label: '28%', value: 28 },
];

const CATEGORY_OPTIONS = [
  'Hardware', 'Plumbing', 'Electrical', 'Paint', 'Tools',
  'Cement', 'Iron & Steel', 'Sanitary', 'Wood', 'Glass',
];

export default function ProductFormModal({ open, onClose, onSuccess, productId }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const isEdit = !!productId;

  useEffect(() => {
    if (open && productId) {
      setFetching(true);
      getProduct(productId)
        .then(({ data }) => {
          form.setFieldsValue(data.data);
        })
        .catch(() => message.error('Failed to load product'))
        .finally(() => setFetching(false));
    } else if (open) {
      form.resetFields();
      form.setFieldsValue({ unit: 'piece', gst_rate: 18, min_stock: 0, is_active: true });
    }
  }, [open, productId, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      if (isEdit) {
        await updateProduct(productId, values);
        message.success('Product updated');
      } else {
        await createProduct(values);
        message.success('Product created');
      }
      onSuccess();
      onClose();
    } catch (err) {
      if (err.response?.status === 409) {
        const errData = err.response.data;
        if (errData.code === 'DUPLICATE_SKU') {
          form.setFields([{ name: 'sku', errors: ['This SKU already exists'] }]);
        } else if (errData.code === 'DUPLICATE_BARCODE') {
          form.setFields([{ name: 'barcode', errors: ['This barcode already exists'] }]);
        }
      } else if (err.errorFields) {
        // form validation error — do nothing, antd shows inline
      } else {
        message.error('Failed to save product');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={isEdit ? 'Edit Product' : 'New Product'}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      width={640}
      destroyOnClose
    >
      <Spin spinning={fetching}>
        <Form form={form} layout="vertical" requiredMark="optional">
          <Form.Item name="name" label="Product Name"
            rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="e.g. Ambuja Cement 50kg" />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="category" label="Category"
              rules={[{ required: true, message: 'Required' }]}>
              <AutoComplete
                options={CATEGORY_OPTIONS.map((c) => ({ value: c }))}
                placeholder="Select or type"
                filterOption={(input, option) =>
                  option.value.toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>

            <Form.Item name="brand" label="Brand">
              <Input placeholder="e.g. Ambuja" />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Form.Item name="unit" label="Unit"
              rules={[{ required: true, message: 'Required' }]}>
              <Select options={UNIT_OPTIONS} />
            </Form.Item>

            <Form.Item name="hsn_code" label="HSN Code">
              <Input placeholder="e.g. 2523" />
            </Form.Item>

            <Form.Item name="gst_rate" label="GST Rate %"
              rules={[{ required: true, message: 'Required' }]}>
              <Select options={GST_OPTIONS} />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Form.Item name="mrp" label="MRP ₹"
              rules={[{ required: true, message: 'Required' }]}>
              <InputNumber min={0} precision={2} style={{ width: '100%' }}
                placeholder="0.00" />
            </Form.Item>

            <Form.Item name="wholesale_price" label="Wholesale Price ₹"
              rules={[{ required: true, message: 'Required' }]}>
              <InputNumber min={0} precision={2} style={{ width: '100%' }}
                placeholder="0.00" />
            </Form.Item>

            <Form.Item name="purchase_price" label="Cost Price ₹"
              rules={[{ required: true, message: 'Required' }]}
              extra="Used for profit calculation">
              <InputNumber min={0} precision={2} style={{ width: '100%' }}
                placeholder="0.00" />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Form.Item name="sku" label="SKU Code">
              <Input placeholder="e.g. CEM-AMB-50" />
            </Form.Item>

            <Form.Item name="barcode" label="Barcode">
              <Input placeholder="Scan or type" />
            </Form.Item>

            <Form.Item name="min_stock" label="Min Stock Level"
              rules={[{ required: true, message: 'Required' }]}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </div>

          <Form.Item name="is_active" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Spin>
    </Modal>
  );
}
