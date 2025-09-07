import React from 'react';
import { Layout, Menu } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  RobotOutlined,
  HistoryOutlined,
  FolderOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined
} from '@ant-design/icons';
import { useAppStore } from '../store/appStore';

const { Sider } = Layout;

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { sidebarCollapsed, setSidebarCollapsed } = useAppStore();

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
    {
      key: '/automation',
      icon: <RobotOutlined />,
      label: 'Automation',
    },
    {
      key: '/history',
      icon: <HistoryOutlined />,
      label: 'History',
    },
    {
      key: '/workflows',
      icon: <FolderOutlined />,
      label: 'Workflows',
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: 'Settings',
    },
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    console.log('Menu clicked:', key);
    console.log('Current location:', location.pathname);
    navigate(key);
    console.log('Navigation called for:', key);
  };

  return (
    <Sider
      trigger={null}
      collapsible
      collapsed={sidebarCollapsed}
      width={240}
      style={{
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(10px)',
        borderRight: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      <div
        style={{
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: sidebarCollapsed ? 'center' : 'space-between',
          padding: sidebarCollapsed ? '0' : '0 16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        {!sidebarCollapsed && (
          <div
            style={{
              color: 'white',
              fontSize: '18px',
              fontWeight: 'bold',
            }}
          >
            AI Automation
          </div>
        )}
        <div
          style={{
            color: 'white',
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '4px',
            transition: 'background 0.3s',
          }}
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          {sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        </div>
      </div>
      
      <Menu
        mode="inline"
        selectedKeys={[location.pathname]}
        items={menuItems}
        onClick={handleMenuClick}
        style={{
          background: 'transparent',
          border: 'none',
          marginTop: '16px',
        }}
      />
    </Sider>
  );
};

export default Sidebar;