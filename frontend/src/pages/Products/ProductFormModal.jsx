import React, { useEffect, useState } from 'react';
import {
  Modal, Form, Input, InputNumber, Select, Switch, AutoComplete,
  message, Spin, Button, Space, Typography,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { 
  createProduct, updateProduct, getProduct, 
  getUnitConversions, createUnitConversion, deleteUnitConversion,
  getProductSuppliers, linkProductSupplier
} from '../../api/products.api';
import { getSuppliers } from '../../api/suppliers.api';

const { Text } = Typography;

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
  'Cement', 'Steel', 'Sanitary', 'Pipes', 'Adhesive',
  'Waterproofing', 'Wood', 'Glass', 'Iron & Steel',
];

export default function ProductFormModal({ open, onClose, onSuccess, productId }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const isEdit = !!productId;

  useEffect(() => {
    if (open) {
      getSuppliers().then(res => setSuppliers(res.data.data.suppliers || [])).catch(() => {});
    }

    if (open && productId) {
      setFetching(true);
      Promise.all([
        getProduct(productId),
        getUnitConversions(productId).catch(() => ({ data: { data: { conversions: [] } } })),
        getProductSuppliers(productId).catch(() => ({ data: { data: { suppliers: [] } } }))
      ])
        .then(([prodRes, convRes, suppRes]) => {
          const productData = prodRes.data.data;
          const conversions = convRes.data.data.conversions || [];
          const productSuppliers = suppRes.data.data.suppliers || [];
          const primarySupplier = productSuppliers.find(s => s.is_primary_supplier) || productSuppliers[0];
          
          form.setFieldsValue({ 
            ...productData, 
            conversions,
            supplier_id: primarySupplier ? primarySupplier.supplier_id : undefined
          });
        })
        .catch(() => message.error('Failed to load product'))
        .finally(() => setFetching(false));
    } else if (open) {
      form.resetFields();
      form.setFieldsValue({ unit: 'piece', gst_rate: 18, min_stock: 0, current_stock: 0, is_active: true, conversions: [] });
    }
  }, [open, productId, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const { conversions, supplier_id, ...productValues } = values;
      let finalProductId = productId;

      if (isEdit) {
        await updateProduct(productId, productValues);
        message.success('Product updated');
      } else {
        const res = await createProduct(productValues);
        finalProductId = res.data.data ? res.data.data.id : res.data.id;
        message.success('Product created');
      }

      // Link supplier if selected
      if (supplier_id) {
        await linkProductSupplier(finalProductId, {
          supplier_id: supplier_id,
          last_price: productValues.purchase_price,
          is_primary_supplier: true
        }).catch(() => message.error('Failed to link supplier'));
      }

      // Handle conversions separately
      if (isEdit) {
        const oldConv = await getUnitConversions(finalProductId);
        for (const c of (oldConv.data.data.conversions || [])) {
          await deleteUnitConversion(c.id).catch(() => {});
        }
      }
      if (conversions && conversions.length > 0) {
        await Promise.all(
          conversions.map((conv) => createUnitConversion(finalProductId, conv))
        );
      }

      onSuccess({ ...productValues, id: finalProductId });
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
      destroyOnClose={false}
      destroyOnHidden
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

            <Form.Item name="supplier_id" label="Primary Supplier">
              <Select 
                placeholder="Select a supplier"
                allowClear
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={suppliers.map(s => ({ label: s.name, value: s.id }))}
              />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="current_stock" label="Current Stock"
              extra={isEdit ? 'Set overall stock quantity' : 'Initial stock quantity'}
              rules={[{ required: true, message: 'Required' }]}>
              <InputNumber min={0} precision={3} style={{ width: '100%' }}
                placeholder="0" />
            </Form.Item>
          </div>

          <div style={{ marginBottom: 24, padding: 16, background: '#fafafa', borderRadius: 8 }}>
            <Text strong>Unit Conversions (Optional)</Text>
            <p style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
              Define alternate units (e.g., 1 Box = 10 Pieces). Base unit is defined above.
            </p>
            <Form.List name="conversions">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                      <Form.Item
                        {...restField}
                        name={[name, 'unit_name']}
                        rules={[{ required: true, message: 'Unit name' }]}
                      >
                        <Select options={UNIT_OPTIONS} placeholder="Alt Unit (e.g. Box)" style={{ width: 140 }} />
                      </Form.Item>
                      <Text>=</Text>
                      <Form.Item
                        {...restField}
                        name={[name, 'conversion_value']}
                        rules={[{ required: true, message: 'Value' }]}
                      >
                        <InputNumber min={0.0001} precision={4} placeholder="Qty" style={{ width: 100 }} />
                      </Form.Item>
                      <Text>Base Units</Text>
                      <DeleteOutlined onClick={() => remove(name)} style={{ color: 'red', marginLeft: 8 }} />
                    </Space>
                  ))}
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                    Add Unit Conversion
                  </Button>
                </>
              )}
            </Form.List>
          </div>

          <Form.Item name="is_active" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Spin>
    </Modal>
  );
}
