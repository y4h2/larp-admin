import { useEffect, useState } from 'react';
import { Table, Card, Typography, Descriptions, Modal } from 'antd';
import type { TableProps } from 'antd';
import { PageHeader, StatusTag } from '@/components/common';
import { algorithmApi } from '@/api';
import type { AlgorithmImplementation } from '@/types';

const { Text } = Typography;

export default function ImplementationList() {
  const [loading, setLoading] = useState(false);
  const [implementations, setImplementations] = useState<AlgorithmImplementation[]>([]);
  const [selectedImpl, setSelectedImpl] = useState<AlgorithmImplementation | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const data = await algorithmApi.listImplementations();
        setImplementations(data);
      } catch {
        // Error handled
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const columns: TableProps<AlgorithmImplementation>['columns'] = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <a
          onClick={() => {
            setSelectedImpl(record);
            setModalVisible(true);
          }}
        >
          {text}
        </a>
      ),
    },
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      render: (id) => <Text code>{id}</Text>,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => <StatusTag status={status} />,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Algorithm Implementations"
        subtitle="View available matching algorithm implementations (read-only)"
      />

      <Table
        columns={columns}
        dataSource={implementations}
        rowKey="id"
        loading={loading}
        pagination={false}
      />

      <Modal
        title={selectedImpl?.name}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={700}
      >
        {selectedImpl && (
          <div>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="ID">
                <Text code>{selectedImpl.id}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Description">
                {selectedImpl.description}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <StatusTag status={selectedImpl.status} />
              </Descriptions.Item>
            </Descriptions>

            <Card title="Parameter Schema" size="small" style={{ marginTop: 16 }}>
              <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, overflow: 'auto' }}>
                {JSON.stringify(selectedImpl.param_schema, null, 2)}
              </pre>
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
}
