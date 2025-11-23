import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Table,
  Button,
  Space,
  Input,
  Select,
  Modal,
  Form,
  Popconfirm,
} from 'antd';
import type { TableProps } from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { PageHeader, StatusTag, RoleTypeTag } from '@/components/common';
import { useNpcs, useScripts, useScenes } from '@/hooks';
import { formatDate } from '@/utils';
import type { NPC } from '@/types';

const { Option } = Select;

export default function NpcList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form] = Form.useForm();
  const { loading, npcs, total, fetchNpcs, createNpc, deleteNpc } = useNpcs();
  const { scripts, fetchScripts } = useScripts();
  const { scenes, fetchScenes } = useScenes();

  const [modalVisible, setModalVisible] = useState(false);
  const [filters, setFilters] = useState<{
    script_id?: string;
    scene_id?: string;
    role_type?: NPC['role_type'];
    status?: NPC['status'];
    search?: string;
    page: number;
    page_size: number;
  }>({
    script_id: searchParams.get('script_id') || undefined,
    page: 1,
    page_size: 10,
  });

  useEffect(() => {
    fetchScripts();
  }, [fetchScripts]);

  useEffect(() => {
    if (filters.script_id) {
      fetchScenes({ script_id: filters.script_id });
    }
  }, [filters.script_id, fetchScenes]);

  useEffect(() => {
    fetchNpcs(filters);
  }, [filters, fetchNpcs]);

  const handleCreate = async (values: Partial<NPC>) => {
    try {
      const npc = await createNpc({
        ...values,
        personality: '',
        speech_style: '',
        background_story: '',
        relations: {},
        system_prompt_template: '',
        extra_prompt_vars: {},
      });
      setModalVisible(false);
      form.resetFields();
      navigate(`/npcs/${npc.id}`);
    } catch {
      // Error handled in hook
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNpc(id);
      fetchNpcs(filters);
    } catch {
      // Error handled in hook
    }
  };

  const columns: TableProps<NPC>['columns'] = [
    {
      title: t('common.name'),
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <a onClick={() => navigate(`/npcs/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: t('npc.role'),
      dataIndex: 'role_type',
      key: 'role_type',
      width: 100,
      render: (roleType) => <RoleTypeTag roleType={roleType} />,
    },
    {
      title: t('npc.job'),
      dataIndex: 'job',
      key: 'job',
      width: 120,
      render: (job) => job || '-',
    },
    {
      title: t('npc.age'),
      dataIndex: 'age',
      key: 'age',
      width: 60,
      render: (age) => age || '-',
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => <StatusTag status={status} />,
    },
    {
      title: t('common.updatedAt'),
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 180,
      render: (date) => formatDate(date),
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => navigate(`/npcs/${record.id}`)}
          />
          <Popconfirm
            title={t('npc.deleteNpc')}
            description={t('npc.deleteConfirm')}
            onConfirm={() => handleDelete(record.id)}
            okText={t('common.delete')}
            okType="danger"
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('npc.title')}
        subtitle={t('npc.subtitle')}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
            {t('npc.createNpc')}
          </Button>
        }
      />

      <Space style={{ marginBottom: 16 }} wrap>
        <Input
          placeholder={t('npc.searchPlaceholder')}
          prefix={<SearchOutlined />}
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
          style={{ width: 200 }}
          allowClear
        />
        <Select
          placeholder={t('npc.selectScript')}
          value={filters.script_id}
          onChange={(value) =>
            setFilters({ ...filters, script_id: value, scene_id: undefined, page: 1 })
          }
          style={{ width: 180 }}
          allowClear
        >
          {scripts.map((s) => (
            <Option key={s.id} value={s.id}>
              {s.name}
            </Option>
          ))}
        </Select>
        <Select
          placeholder={t('npc.selectScene')}
          value={filters.scene_id}
          onChange={(value) => setFilters({ ...filters, scene_id: value, page: 1 })}
          style={{ width: 180 }}
          allowClear
          disabled={!filters.script_id}
        >
          {scenes.map((s) => (
            <Option key={s.id} value={s.id}>
              {s.name}
            </Option>
          ))}
        </Select>
        <Select
          placeholder={t('npc.roleType')}
          value={filters.role_type}
          onChange={(value) => setFilters({ ...filters, role_type: value, page: 1 })}
          style={{ width: 120 }}
          allowClear
        >
          <Option value="suspect">{t('npc.suspect')}</Option>
          <Option value="witness">{t('npc.witness')}</Option>
          <Option value="other">{t('npc.other')}</Option>
        </Select>
        <Select
          placeholder={t('common.status')}
          value={filters.status}
          onChange={(value) => setFilters({ ...filters, status: value, page: 1 })}
          style={{ width: 120 }}
          allowClear
        >
          <Option value="active">{t('npc.active')}</Option>
          <Option value="archived">{t('npc.archived')}</Option>
        </Select>
      </Space>

      <Table
        columns={columns}
        dataSource={npcs}
        rowKey="id"
        loading={loading}
        pagination={{
          current: filters.page,
          pageSize: filters.page_size,
          total,
          showSizeChanger: true,
          showTotal: (total) => t('npc.totalNpcs', { total }),
          onChange: (page, pageSize) =>
            setFilters({ ...filters, page, page_size: pageSize }),
        }}
      />

      <Modal
        title={t('npc.createNpc')}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="script_id"
            label={t('script.title')}
            rules={[{ required: true, message: t('npc.pleaseSelectScript') }]}
            initialValue={filters.script_id}
          >
            <Select placeholder={t('npc.selectScript')}>
              {scripts.map((s) => (
                <Option key={s.id} value={s.id}>
                  {s.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="name"
            label={t('npc.npcName')}
            rules={[{ required: true, message: t('npc.enterNpcName') }]}
          >
            <Input placeholder={t('npc.enterNpcName')} />
          </Form.Item>
          <Form.Item name="name_en" label={t('npc.englishName')}>
            <Input placeholder={t('npc.enterEnglishName')} />
          </Form.Item>
          <Form.Item
            name="role_type"
            label={t('npc.roleType')}
            rules={[{ required: true, message: t('npc.pleaseSelectRoleType') }]}
          >
            <Select placeholder={t('npc.roleType')}>
              <Option value="suspect">{t('npc.suspect')}</Option>
              <Option value="witness">{t('npc.witness')}</Option>
              <Option value="other">{t('npc.other')}</Option>
            </Select>
          </Form.Item>
          <Form.Item name="age" label={t('npc.age')}>
            <Input type="number" placeholder={t('npc.enterAge')} />
          </Form.Item>
          <Form.Item name="job" label={t('npc.job')}>
            <Input placeholder={t('npc.enterJob')} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {t('common.create')}
              </Button>
              <Button onClick={() => setModalVisible(false)}>{t('common.cancel')}</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
