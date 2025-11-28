import { Avatar, Badge, Typography, Space, Tooltip } from 'antd';
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
function formatPagePath(path: string): string {
  // Return simplified path
  if (path.startsWith('/scripts/')) return 'Script';
  if (path.startsWith('/npcs/')) return 'NPC';
  if (path.startsWith('/clues/')) return 'Clue';
  if (path === '/scripts') return 'Scripts';
  if (path === '/npcs') return 'NPCs';
  if (path === '/clues') return 'Clues';
  if (path === '/debug/simulation') return 'Simulation';
  if (path === '/debug/logs') return 'Logs';
  if (path.startsWith('/settings/')) return 'Settings';
  return path.split('/').pop() || path;
}

interface SidebarOnlineUsersProps {
  collapsed?: boolean;
}

export default function SidebarOnlineUsers({ collapsed = false }: SidebarOnlineUsersProps) {
  const { t } = useTranslation();
  const { onlineUsers, isConnected } = usePresence();

  if (!isConnected || onlineUsers.length === 0) {
    return null;
  }

  // Collapsed view - just show count
  if (collapsed) {
    return (
      <Tooltip title={`${onlineUsers.length} ${t('presence.onlineUsers')}`} placement="right">
        <div
          style={{
            padding: '12px',
            textAlign: 'center',
            borderTop: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <Badge count={onlineUsers.length} size="small" offset={[0, 0]}>
            <Avatar
              size={32}
              icon={<TeamOutlined />}
              style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
            />
          </Badge>
        </div>
      </Tooltip>
    );
  }

  // Expanded view - show user list
  return (
    <div
      style={{
        padding: '12px 16px',
        borderTop: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      <Space style={{ marginBottom: 8 }}>
        <TeamOutlined style={{ color: 'rgba(255,255,255,0.65)' }} />
        <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>
          {t('presence.onlineUsers')} ({onlineUsers.length})
        </Text>
      </Space>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {onlineUsers.slice(0, 5).map((user) => (
          <UserItem key={user.id} user={user} />
        ))}
        {onlineUsers.length > 5 && (
          <Text
            style={{
              color: 'rgba(255,255,255,0.45)',
              fontSize: 12,
              paddingLeft: 4,
            }}
          >
            +{onlineUsers.length - 5} more
          </Text>
        )}
      </div>
    </div>
  );
}

function UserItem({ user }: { user: UserPresence }) {
  const isEditing = !!user.editing;

  return (
    <Space size={8} style={{ width: '100%' }}>
      <Badge dot={isEditing} color="green" offset={[-2, 2]}>
        <Avatar
          size={24}
          style={{
            backgroundColor: getAvatarColor(user.id),
            fontSize: 10,
          }}
        >
          {getInitials(user.email)}
        </Avatar>
      </Badge>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text
          ellipsis
          style={{
            color: '#fff',
            fontSize: 12,
            display: 'block',
            maxWidth: 120,
          }}
        >
          {user.email.split('@')[0]}
        </Text>
        <Text
          style={{
            color: 'rgba(255,255,255,0.45)',
            fontSize: 10,
          }}
        >
          {formatPagePath(user.currentPage)}
        </Text>
      </div>
    </Space>
  );
}
