import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, theme, Button, Dropdown, Avatar, Space } from 'antd';
import type { MenuProps } from 'antd';
import {
  BookOutlined,
  UserOutlined,
  SearchOutlined,
  BugOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  TeamOutlined,
  NodeIndexOutlined,
  HistoryOutlined,
  FileTextOutlined,
  CommentOutlined,
  MessageOutlined,
  AimOutlined,
  GlobalOutlined,
  TranslationOutlined,
  CodeOutlined,
  ApiOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
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

// Menu items generator function that uses translations
const getMenuItems = (t: (key: string) => string): MenuItem[] => [
  getItem(t('menu.scriptManagement'), 'scripts', <BookOutlined />, [
    getItem(t('menu.scriptList'), '/scripts', <FileTextOutlined />),
  ]),
  getItem(t('menu.npcManagement'), 'npcs', <TeamOutlined />, [
    getItem(t('menu.npcList'), '/npcs', <UserOutlined />),
  ]),
  getItem(t('menu.clueManagement'), 'clues', <SearchOutlined />, [
    getItem(t('menu.clueList'), '/clues', <FileTextOutlined />),
    getItem(t('menu.clueTree'), '/clues/tree', <NodeIndexOutlined />),
  ]),
  getItem(t('menu.debugTools'), 'debug', <BugOutlined />, [
    getItem(t('menu.dialogueSimulation'), '/debug/simulation', <MessageOutlined />),
    getItem(t('menu.singleClueDebug'), '/debug/clue', <AimOutlined />),
    getItem(t('menu.dialogueLogs'), '/debug/logs', <CommentOutlined />),
  ]),
  getItem(t('menu.settings'), 'settings', <SettingOutlined />, [
    getItem(t('menu.globalSettings'), '/settings/global', <GlobalOutlined />),
    getItem(t('menu.templates'), '/settings/templates', <CodeOutlined />),
    getItem(t('menu.llmConfigs'), '/settings/llm-configs', <ApiOutlined />),
  ]),
];

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const { sidebarCollapsed, setSidebarCollapsed, language, setLanguage } = useUIStore();
  const menuItems = getMenuItems(t);
  const [openKeys, setOpenKeys] = useState<string[]>(getAllParentKeys(menuItems));

  const handleLanguageChange = (lang: 'en' | 'zh') => {
    setLanguage(lang);
    i18n.changeLanguage(lang);
  };

  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key.startsWith('/')) {
      navigate(key);
    }
  };

  const userMenuItems: MenuProps['items'] = [
    { key: 'profile', label: t('user.profile'), icon: <UserOutlined /> },
    { key: 'history', label: t('user.activityHistory'), icon: <HistoryOutlined /> },
    { type: 'divider' },
    { key: 'logout', label: t('user.logout'), danger: true },
  ];

  const languageMenuItems: MenuProps['items'] = [
    {
      key: 'en',
      label: t('language.en'),
      disabled: language === 'en',
    },
    {
      key: 'zh',
      label: t('language.zh'),
      disabled: language === 'zh',
    },
  ];

  const handleLanguageMenuClick: MenuProps['onClick'] = ({ key }) => {
    handleLanguageChange(key as 'en' | 'zh');
  };

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
          {sidebarCollapsed ? t('app.shortTitle') : t('app.title')}
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
          <Space size="middle">
            <Dropdown menu={{ items: languageMenuItems, onClick: handleLanguageMenuClick }} placement="bottomRight">
              <Button type="text" icon={<TranslationOutlined />}>
                {language === 'zh' ? '中文' : 'EN'}
              </Button>
            </Dropdown>
            <Dropdown menu={{ items: userMenuItems, onClick: handleUserMenuClick }} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar icon={<UserOutlined />} />
                <span>{t('user.admin')}</span>
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
