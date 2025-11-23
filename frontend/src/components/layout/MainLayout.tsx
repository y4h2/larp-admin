import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, theme, Button, Dropdown, Avatar, Space } from 'antd';
import type { MenuProps } from 'antd';
import {
  BookOutlined,
  UserOutlined,
  SearchOutlined,
  ExperimentOutlined,
  BugOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  TeamOutlined,
  NodeIndexOutlined,
  RobotOutlined,
  HistoryOutlined,
  FileTextOutlined,
  FunctionOutlined,
  ControlOutlined,
  CommentOutlined,
  LineChartOutlined,
  SplitCellsOutlined,
  MessageOutlined,
  AimOutlined,
  GlobalOutlined,
  AuditOutlined,
} from '@ant-design/icons';
import { useUIStore } from '@/store';

const { Header, Sider, Content } = Layout;

type MenuItem = Required<MenuProps>['items'][number];

function getItem(
  label: React.ReactNode,
  key: string,
  icon?: React.ReactNode,
  children?: MenuItem[]
): MenuItem {
  return {
    key,
    icon,
    children,
    label,
  } as MenuItem;
}

const menuItems: MenuItem[] = [
  getItem('Script Management', 'scripts', <BookOutlined />, [
    getItem('Script List', '/scripts', <FileTextOutlined />),
  ]),
  getItem('NPC Management', 'npcs', <TeamOutlined />, [
    getItem('NPC List', '/npcs', <UserOutlined />),
  ]),
  getItem('Clue Management', 'clues', <SearchOutlined />, [
    getItem('Clue List', '/clues', <FileTextOutlined />),
    getItem('Clue Tree', '/clues/tree', <NodeIndexOutlined />),
  ]),
  getItem('Algorithm', 'algorithms', <RobotOutlined />, [
    getItem('Implementations', '/algorithms/implementations', <FunctionOutlined />),
    getItem('Strategies', '/algorithms/strategies', <ControlOutlined />),
  ]),
  getItem('Experiment', 'experiments', <ExperimentOutlined />, [
    getItem('Dialogue Logs', '/experiments/logs', <CommentOutlined />),
    getItem('Offline Evaluation', '/experiments/evaluation', <LineChartOutlined />),
    getItem('A/B Test Config', '/experiments/ab-tests', <SplitCellsOutlined />),
  ]),
  getItem('Debug Tools', 'debug', <BugOutlined />, [
    getItem('Dialogue Simulation', '/debug/simulation', <MessageOutlined />),
    getItem('Single Clue Debug', '/debug/clue', <AimOutlined />),
  ]),
  getItem('Settings', 'settings', <SettingOutlined />, [
    getItem('Global Strategy', '/settings/global', <GlobalOutlined />),
    getItem('Users & Permissions', '/settings/users', <TeamOutlined />),
    getItem('Audit Logs', '/settings/audit-logs', <AuditOutlined />),
  ]),
];

// Get all keys for default open
const getAllParentKeys = (items: MenuItem[]): string[] => {
  const keys: string[] = [];
  items.forEach((item) => {
    if (item && 'children' in item && item.children) {
      keys.push(item.key as string);
    }
  });
  return keys;
};

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sidebarCollapsed, setSidebarCollapsed } = useUIStore();
  const [openKeys, setOpenKeys] = useState<string[]>(getAllParentKeys(menuItems));

  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key.startsWith('/')) {
      navigate(key);
    }
  };

  const userMenuItems: MenuProps['items'] = [
    { key: 'profile', label: 'Profile', icon: <UserOutlined /> },
    { key: 'history', label: 'Activity History', icon: <HistoryOutlined /> },
    { type: 'divider' },
    { key: 'logout', label: 'Logout', danger: true },
  ];

  const handleUserMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'logout') {
      localStorage.removeItem('auth_token');
      navigate('/login');
    } else if (key === 'profile') {
      navigate('/settings/profile');
    }
  };

  // Find selected key based on current path
  const getSelectedKey = () => {
    const path = location.pathname;
    // Try exact match first
    return path;
  };

  const handleOpenChange = (keys: string[]) => {
    setOpenKeys(keys);
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={sidebarCollapsed}
        width={240}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
        }}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: sidebarCollapsed ? 16 : 18,
            fontWeight: 'bold',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          {sidebarCollapsed ? 'MM' : 'Murder Mystery Admin'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[getSelectedKey()]}
          openKeys={sidebarCollapsed ? [] : openKeys}
          onOpenChange={handleOpenChange}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout style={{ marginLeft: sidebarCollapsed ? 80 : 240, transition: 'margin-left 0.2s' }}>
        <Header
          style={{
            padding: '0 24px',
            background: colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 1,
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          }}
        >
          <Button
            type="text"
            icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            style={{ fontSize: 16, width: 48, height: 48 }}
          />
          <Space>
            <Dropdown menu={{ items: userMenuItems, onClick: handleUserMenuClick }} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar icon={<UserOutlined />} />
                <span>Admin</span>
              </Space>
            </Dropdown>
          </Space>
        </Header>
        <Content
          style={{
            margin: 24,
            padding: 24,
            minHeight: 280,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
