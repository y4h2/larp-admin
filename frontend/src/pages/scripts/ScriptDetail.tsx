import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  Space,
  Tabs,
  List,
  Modal,
  Spin,
  Empty,
  message,
} from 'antd';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  HolderOutlined,
  NodeIndexOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { PageHeader, StatusTag } from '@/components/common';
import { scriptApi, sceneApi } from '@/api';
import { formatDate } from '@/utils';
import type { Script, Scene } from '@/types';

const { Option } = Select;

interface SortableItemProps {
  scene: Scene;
  onEdit: (scene: Scene) => void;
  onDelete: (id: string) => void;
  noDescriptionText: string;
}

function SortableItem({ scene, onEdit, onDelete, noDescriptionText }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: scene.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <List.Item
      ref={setNodeRef}
      style={style}
      actions={[
        <Button
          key="edit"
          type="text"
          icon={<EditOutlined />}
          onClick={() => onEdit(scene)}
        />,
        <Button
          key="delete"
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => onDelete(scene.id)}
        />,
      ]}
    >
      <List.Item.Meta
        avatar={
          <Button
            type="text"
            icon={<HolderOutlined />}
            style={{ cursor: 'grab' }}
            {...attributes}
            {...listeners}
          />
        }
        title={scene.name}
        description={scene.description || noDescriptionText}
      />
      <StatusTag status={scene.status} />
    </List.Item>
  );
}

export default function ScriptDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [sceneForm] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [script, setScript] = useState<Script | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [sceneModalVisible, setSceneModalVisible] = useState(false);
  const [editingScene, setEditingScene] = useState<Scene | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [scriptData, scenesData] = await Promise.all([
        scriptApi.get(id),
        sceneApi.list({ script_id: id }),
      ]);
      setScript(scriptData);
      setScenes(scenesData.items.sort((a, b) => a.sort_order - b.sort_order));
      form.setFieldsValue(scriptData);
    } catch {
      message.error(t('common.loadFailed'));
      navigate('/scripts');
    } finally {
      setLoading(false);
    }
  }, [id, form, navigate, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async (values: Partial<Script>) => {
    if (!id) return;
    setSaving(true);
    try {
      const updated = await scriptApi.update(id, values);
      setScript(updated);
      message.success(t('common.saveSuccess'));
    } catch {
      message.error(t('common.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !id) return;

    const oldIndex = scenes.findIndex((s) => s.id === active.id);
    const newIndex = scenes.findIndex((s) => s.id === over.id);

    const newScenes = arrayMove(scenes, oldIndex, newIndex);
    setScenes(newScenes);

    try {
      await sceneApi.reorder(id, newScenes.map((s) => s.id));
    } catch {
      // Revert on error
      setScenes(scenes);
      message.error(t('common.saveFailed'));
    }
  };

  const handleSceneSave = async (values: Partial<Scene>) => {
    if (!id) return;

    try {
      if (editingScene) {
        await sceneApi.update(editingScene.id, values);
        message.success(t('common.saveSuccess'));
      } else {
        await sceneApi.create({
          ...values,
          script_id: id,
          sort_order: scenes.length,
        });
        message.success(t('common.saveSuccess'));
      }
      setSceneModalVisible(false);
      setEditingScene(null);
      sceneForm.resetFields();
      fetchData();
    } catch {
      message.error(t('common.saveFailed'));
    }
  };

  const handleSceneDelete = async (sceneId: string) => {
    Modal.confirm({
      title: t('scene.deleteScene'),
      content: t('scene.deleteConfirm'),
      okText: t('common.delete'),
      okType: 'danger',
      onOk: async () => {
        try {
          await sceneApi.delete(sceneId);
          message.success(t('common.saveSuccess'));
          fetchData();
        } catch {
          message.error(t('common.saveFailed'));
        }
      },
    });
  };

  const openSceneModal = (scene?: Scene) => {
    setEditingScene(scene || null);
    if (scene) {
      sceneForm.setFieldsValue(scene);
    } else {
      sceneForm.resetFields();
    }
    setSceneModalVisible(true);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!script) {
    return <Empty description={t('script.notFound')} />;
  }

  return (
    <div>
      <PageHeader
        title={script.name}
        subtitle={`${t('common.version')} ${script.version} - ${t('common.updatedAt')} ${formatDate(script.updated_at)}`}
        breadcrumbs={[
          { title: t('script.title'), path: '/scripts' },
          { title: script.name },
        ]}
        extra={
          <Space>
            <Button
              icon={<NodeIndexOutlined />}
              onClick={() => navigate(`/clues/tree?script_id=${script.id}`)}
            >
              {t('script.viewClueTree')}
            </Button>
            <Button type="primary" loading={saving} onClick={() => form.submit()}>
              {t('common.save')}
            </Button>
          </Space>
        }
      />

      <Tabs
        defaultActiveKey="basic"
        items={[
          {
            key: 'basic',
            label: t('common.basicInfo'),
            children: (
              <Card>
                <Form form={form} layout="vertical" onFinish={handleSave}>
                  <Form.Item
                    name="name"
                    label={t('script.scriptName')}
                    rules={[{ required: true, message: t('script.enterScriptName') }]}
                  >
                    <Input placeholder={t('script.enterScriptName')} />
                  </Form.Item>
                  <Form.Item name="description" label={t('common.description')}>
                    <Input.TextArea placeholder={t('script.enterDescription')} rows={4} />
                  </Form.Item>
                  <Form.Item name="status" label={t('common.status')}>
                    <Select>
                      <Option value="draft">{t('script.draft')}</Option>
                      <Option value="test">{t('script.test')}</Option>
                      <Option value="online">{t('script.online')}</Option>
                      <Option value="archived">{t('script.archived')}</Option>
                    </Select>
                  </Form.Item>
                </Form>
              </Card>
            ),
          },
          {
            key: 'scenes',
            label: `${t('scene.title')} (${scenes.length})`,
            children: (
              <Card
                title={t('scene.management')}
                extra={
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => openSceneModal()}>
                    {t('scene.addScene')}
                  </Button>
                }
              >
                {scenes.length === 0 ? (
                  <Empty description={t('scene.noScenes')} />
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={scenes.map((s) => s.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <List
                        dataSource={scenes}
                        renderItem={(scene) => (
                          <SortableItem
                            key={scene.id}
                            scene={scene}
                            onEdit={openSceneModal}
                            onDelete={handleSceneDelete}
                            noDescriptionText={t('scene.noDescription')}
                          />
                        )}
                      />
                    </SortableContext>
                  </DndContext>
                )}
              </Card>
            ),
          },
        ]}
      />

      <Modal
        title={editingScene ? t('scene.editScene') : t('scene.createScene')}
        open={sceneModalVisible}
        onCancel={() => {
          setSceneModalVisible(false);
          setEditingScene(null);
          sceneForm.resetFields();
        }}
        footer={null}
      >
        <Form form={sceneForm} layout="vertical" onFinish={handleSceneSave}>
          <Form.Item
            name="name"
            label={t('scene.sceneName')}
            rules={[{ required: true, message: t('scene.enterSceneName') }]}
          >
            <Input placeholder={t('scene.enterSceneName')} />
          </Form.Item>
          <Form.Item name="description" label={t('common.description')}>
            <Input.TextArea placeholder={t('script.enterDescription')} rows={3} />
          </Form.Item>
          <Form.Item name="status" label={t('common.status')} initialValue="active">
            <Select>
              <Option value="active">{t('npc.active')}</Option>
              <Option value="archived">{t('npc.archived')}</Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingScene ? t('common.save') : t('common.create')}
              </Button>
              <Button onClick={() => setSceneModalVisible(false)}>{t('common.cancel')}</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
