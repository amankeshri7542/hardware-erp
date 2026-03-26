import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Modal, Form, Input, Tag, Space, Typography,
  message, Spin, Popconfirm,
} from 'antd';
import { PlusOutlined, EditOutlined } from '@ant-design/icons';
import { getSuppliers, createSupplier, updateSupplier } from '../../api/suppliers.api';

const { Title } = Typography;

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState(null);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getSuppliers();
      setSuppliers(data.data.suppliers);
    } catch {
      message.error('Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  const openCreate = () => {
    setEditSupplier(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (record) => {
    setEditSupplier(record);
    form.setFieldsValue(record);
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      if (editSupplier) {
        await updateSupplier(editSupplier.id, values);
        message.success('Supplier updated');
      } else {
        await createSupplier(values);
        message.success('Supplier created');
      }
      setModalOpen(false);
      fetchSuppliers();
    } catch (err) {
      if (!err.errorFields) message.error('Failed to save supplier');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name', render: (t) => <strong>{t}</strong> },
    { title: 'Phone', dataIndex: 'phone', key: 'phone', width: 120 },
    { title: 'GSTIN', dataIndex: 'gstin', key: 'gstin', width: 170 },
    { title: 'Payment Terms', dataIndex: 'payment_terms', key: 'payment_terms', width: 150 },
    {
      title: 'Status', dataIndex: 'is_active', key: 'is_active', width: 90,
      render: (a) => <Tag color={a ? 'green' : 'default'}>{a ? 'Active' : 'Inactive'}</Tag>,
    },
    {
      title: '', key: 'actions', width: 60,
      render: (_, record) => (
        <Button type="text" icon={<EditOutlined />} size="small"
          onClick={() => openEdit(record)} />
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0 }}>Suppliers</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Add Supplier
        </Button>
      </div>

      <Spin spinning={loading}>
        <Table dataSource={suppliers} columns={columns} rowKey="id"
          pagination={false} size="middle" />
      </Spin>

      <Modal title={editSupplier ? 'Edit Supplier' : 'New Supplier'}
        open={modalOpen} onCancel={() => setModalOpen(false)}
        onOk={handleSave} confirmLoading={saving} width={500} destroyOnClose>
        <Form form={form} layout="vertical" requiredMark="optional">
          <Form.Item name="name" label="Supplier Name"
            rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="e.g. ABC Hardware Pvt Ltd" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="phone" label="Phone">
              <Input placeholder="10-digit number" maxLength={10} />
            </Form.Item>
            <Form.Item name="email" label="Email">
              <Input placeholder="supplier@example.com" />
            </Form.Item>
          </div>
          <Form.Item name="gstin" label="GSTIN">
            <Input placeholder="15-character GSTIN" maxLength={15} />
          </Form.Item>
          <Form.Item name="address" label="Address">
            <Input.TextArea rows={2} placeholder="Full address" />
          </Form.Item>
          <Form.Item name="payment_terms" label="Payment Terms">
            <Input placeholder="e.g. Net 30 days" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
