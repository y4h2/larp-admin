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
import { PageHeader, StatusTag } from '@/components/common';
import { scriptApi, sceneApi } from '@/api';
import { formatDate } from '@/utils';
import type { Script, Scene } from '@/types';

const { Option } = Select;

interface SortableItemProps {
  scene: Scene;
  onEdit: (scene: Scene) => void;
  onDelete: (id: string) => void;
}

function SortableItem({ scene, onEdit, onDelete }: SortableItemProps) {
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
        description={scene.description || 'No description'}
      />
      <StatusTag status={scene.status} />
    </List.Item>
  );
}

export default function ScriptDetail() {
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
      message.error('Failed to load script');
      navigate('/scripts');
    } finally {
      setLoading(false);
    }
  }, [id, form, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async (values: Partial<Script>) => {
    if (!id) return;
    setSaving(true);
    try {
      const updated = await scriptApi.update(id, values);
      setScript(updated);
      message.success('Script saved successfully');
    } catch {
      message.error('Failed to save script');
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
      message.error('Failed to reorder scenes');
    }
  };

  const handleSceneSave = async (values: Partial<Scene>) => {
    if (!id) return;

    try {
      if (editingScene) {
        await sceneApi.update(editingScene.id, values);
        message.success('Scene updated successfully');
      } else {
        await sceneApi.create({
          ...values,
          script_id: id,
          sort_order: scenes.length,
        });
        message.success('Scene created successfully');
      }
      setSceneModalVisible(false);
      setEditingScene(null);
      sceneForm.resetFields();
      fetchData();
    } catch {
      message.error('Failed to save scene');
    }
  };

  const handleSceneDelete = async (sceneId: string) => {
    Modal.confirm({
      title: 'Delete Scene',
      content: 'Are you sure you want to delete this scene? This will also affect related clues and NPCs.',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await sceneApi.delete(sceneId);
          message.success('Scene deleted successfully');
          fetchData();
        } catch {
          message.error('Failed to delete scene');
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
    return <Empty description="Script not found" />;
  }

  return (
    <div>
      <PageHeader
        title={script.name}
        subtitle={`Version ${script.version} - Last updated ${formatDate(script.updated_at)}`}
        breadcrumbs={[
          { title: 'Scripts', path: '/scripts' },
          { title: script.name },
        ]}
        extra={
          <Space>
            <Button
              icon={<NodeIndexOutlined />}
              onClick={() => navigate(`/clues/tree?script_id=${script.id}`)}
            >
              View Clue Tree
            </Button>
            <Button type="primary" loading={saving} onClick={() => form.submit()}>
              Save
            </Button>
          </Space>
        }
      />

      <Tabs
        defaultActiveKey="basic"
        items={[
          {
            key: 'basic',
            label: 'Basic Info',
            children: (
              <Card>
                <Form form={form} layout="vertical" onFinish={handleSave}>
                  <Form.Item
                    name="name"
                    label="Script Name"
                    rules={[{ required: true, message: 'Please enter script name' }]}
                  >
                    <Input placeholder="Enter script name" />
                  </Form.Item>
                  <Form.Item name="description" label="Description">
                    <Input.TextArea placeholder="Enter description" rows={4} />
                  </Form.Item>
                  <Form.Item name="status" label="Status">
                    <Select>
                      <Option value="draft">Draft</Option>
                      <Option value="test">Testing</Option>
                      <Option value="online">Online</Option>
                      <Option value="archived">Archived</Option>
                    </Select>
                  </Form.Item>
                </Form>
              </Card>
            ),
          },
          {
            key: 'scenes',
            label: `Scenes (${scenes.length})`,
            children: (
              <Card
                title="Scene Management"
                extra={
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => openSceneModal()}>
                    Add Scene
                  </Button>
                }
              >
                {scenes.length === 0 ? (
                  <Empty description="No scenes yet" />
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
        title={editingScene ? 'Edit Scene' : 'Create Scene'}
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
            label="Scene Name"
            rules={[{ required: true, message: 'Please enter scene name' }]}
          >
            <Input placeholder="Enter scene name" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea placeholder="Enter description" rows={3} />
          </Form.Item>
          <Form.Item name="status" label="Status" initialValue="active">
            <Select>
              <Option value="active">Active</Option>
              <Option value="archived">Archived</Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingScene ? 'Update' : 'Create'}
              </Button>
              <Button onClick={() => setSceneModalVisible(false)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
