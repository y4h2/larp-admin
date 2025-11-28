import { Avatar, Tag, Tooltip, Space } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { usePresence } from '@/contexts/PresenceContext';
import type { EditingState } from '@/contexts/PresenceContext';

interface EditingIndicatorProps {
  type: EditingState['type'];
  id: string;
  showSelf?: boolean;
}

// Get initials from email
function getInitials(email: string): string {
  const name = email.split('@')[0];
  return name.slice(0, 2).toUpperCase();
}

// Get avatar color based on user id
function getAvatarColor(id: string): string {
  const colors = [
    '#f56a00',
    '#7265e6',
    '#ffbf00',
    '#00a2ae',
    '#eb2f96',
    '#52c41a',
    '#1890ff',
    '#722ed1',
  ];
  const index = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[index % colors.length];
}

export default function EditingIndicator({ type, id, showSelf = false }: EditingIndicatorProps) {
  const { t } = useTranslation();
  const { getUsersEditing, currentUser } = usePresence();

  let editors = getUsersEditing(type, id);

  // Filter out current user if showSelf is false
  if (!showSelf && currentUser) {
    editors = editors.filter((user) => user.id !== currentUser.id);
  }

  if (editors.length === 0) {
    return null;
  }

  const typeLabel = t(`common.${type}`);

  if (editors.length === 1) {
    const editor = editors[0];
    return (
      <Tag
        color="orange"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 8px',
        }}
      >
        <EditOutlined />
        <Tooltip title={editor.email}>
          <Avatar
            size={18}
            style={{
              backgroundColor: getAvatarColor(editor.id),
              fontSize: 10,
            }}
          >
            {getInitials(editor.email)}
          </Avatar>
        </Tooltip>
        <span>{t('presence.editingThis', { name: editor.email.split('@')[0], type: typeLabel })}</span>
      </Tag>
    );
  }

  return (
    <Tag
      color="orange"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
      }}
    >
      <EditOutlined />
      <Space size={-4}>
        {editors.slice(0, 3).map((editor) => (
          <Tooltip key={editor.id} title={editor.email}>
            <Avatar
              size={18}
              style={{
                backgroundColor: getAvatarColor(editor.id),
                fontSize: 10,
                border: '1px solid #fff',
              }}
            >
              {getInitials(editor.email)}
            </Avatar>
          </Tooltip>
        ))}
      </Space>
      <span>{t('presence.multipleEditing', { count: editors.length, type: typeLabel })}</span>
    </Tag>
  );
}
