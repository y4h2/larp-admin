import { Avatar, Tooltip, Badge, Dropdown, Typography, Space, Empty } from 'antd';
import { TeamOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { usePresence, type UserPresence } from '@/contexts/PresenceContext';

const { Text } = Typography;

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

// Format page path to readable text
function formatPagePath(path: string, t: (key: string) => string): string {
  const pathMap: Record<string, string> = {
    '/scripts': t('menu.scriptList'),
    '/npcs': t('menu.npcList'),
    '/clues': t('menu.clueList'),
    '/clues/tree': t('menu.clueTree'),
    '/debug/simulation': t('menu.dialogueSimulation'),
    '/debug/logs': t('menu.dialogueLogs'),
    '/settings/templates': t('menu.templates'),
    '/settings/llm-configs': t('menu.llmConfigs'),
  };

  // Check exact match
  if (pathMap[path]) {
    return pathMap[path];
  }

  // Check patterns
  if (path.startsWith('/scripts/')) {
    return t('script.title');
  }
  if (path.startsWith('/npcs/')) {
    return t('npc.title');
  }
  if (path.startsWith('/clues/')) {
    return t('clue.title');
  }
  if (path.startsWith('/settings/templates/')) {
    return t('template.title');
  }

  return path;
}

// User list item for dropdown
function UserListItem({ user }: { user: UserPresence }) {
  const { t } = useTranslation();
  const isEditing = !!user.editing;

  return (
    <Space style={{ padding: '4px 0' }}>
      <Badge dot={isEditing} color="green" offset={[-2, 2]}>
        <Avatar
          size={28}
          style={{ backgroundColor: getAvatarColor(user.id) }}
        >
          {getInitials(user.email)}
        </Avatar>
      </Badge>
      <div>
        <div style={{ fontWeight: 500 }}>{user.email.split('@')[0]}</div>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {formatPagePath(user.currentPage, t)}
        </Text>
      </div>
    </Space>
  );
}

interface OnlineUsersProps {
  maxVisible?: number;
}

export default function OnlineUsers({ maxVisible = 5 }: OnlineUsersProps) {
  const { t } = useTranslation();
  const { onlineUsers, isConnected } = usePresence();

  if (!isConnected || onlineUsers.length === 0) {
    return null;
  }

  const visibleUsers = onlineUsers.slice(0, maxVisible);
  const hiddenCount = onlineUsers.length - maxVisible;

  const dropdownItems = {
    items: onlineUsers.map((user) => ({
      key: user.id,
      label: <UserListItem user={user} />,
    })),
  };

  return (
    <Dropdown
      menu={dropdownItems}
      trigger={['click']}
      placement="bottomRight"
      popupRender={(menu) => (
        <div
          style={{
            backgroundColor: '#fff',
            borderRadius: 8,
            boxShadow: '0 6px 16px rgba(0,0,0,0.08)',
            padding: 8,
            minWidth: 200,
          }}
        >
          <div
            style={{
              padding: '8px 12px',
              borderBottom: '1px solid #f0f0f0',
              marginBottom: 8,
            }}
          >
            <Space>
              <TeamOutlined />
              <Text strong>
                {t('presence.onlineUsers')} ({onlineUsers.length})
              </Text>
            </Space>
          </div>
          {onlineUsers.length > 0 ? (
            <div style={{ maxHeight: 300, overflow: 'auto' }}>
              {menu}
            </div>
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t('common.noData')}
              style={{ margin: '16px 0' }}
            />
          )}
        </div>
      )}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          paddingLeft: 12,
        }}
      >
        <Avatar.Group
          max={{
            count: maxVisible,
            style: {
              color: '#fff',
              backgroundColor: '#1890ff',
              cursor: 'pointer',
            },
          }}
        >
          {visibleUsers.map((user) => (
            <Tooltip key={user.id} title={user.email}>
              <Avatar
                style={{
                  backgroundColor: getAvatarColor(user.id),
                  border: '2px solid #fff',
                }}
              >
                {getInitials(user.email)}
              </Avatar>
            </Tooltip>
          ))}
        </Avatar.Group>
        {hiddenCount > 0 && (
          <Avatar
            style={{
              backgroundColor: '#1890ff',
              marginLeft: -8,
              border: '2px solid #fff',
            }}
          >
            +{hiddenCount}
          </Avatar>
        )}
      </div>
    </Dropdown>
  );
}
