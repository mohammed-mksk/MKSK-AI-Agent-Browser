import React, { useEffect, useState } from 'react';
import { Layout, Badge, Button, Dropdown, Space, Typography } from 'antd';
import {
  BellOutlined,
  UserOutlined,
  PoweroffOutlined,
  SettingOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { useAppStore } from '../store/appStore';

const { Header: AntHeader } = Layout;
const { Text } = Typography;

const Header: React.FC = () => {
  const { 
    isAutomationRunning, 
    automationProgress, 
    currentAIProvider,
    availableProviders 
  } = useAppStore();
  
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const userMenuItems = [
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Settings',
    },
    {
      key: 'about',
      icon: <InfoCircleOutlined />,
      label: 'About',
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <PoweroffOutlined />,
      label: 'Exit Application',
      danger: true,
    },
  ];

  const handleUserMenuClick = ({ key }: { key: string }) => {
    switch (key) {
      case 'settings':
        // Navigate to settings
        break;
      case 'about':
        // Show about dialog
        break;
      case 'logout':
        // Close application
        if (window.electronAPI) {
          // Add close app functionality
        }
        break;
    }
  };

  const getStatusColor = () => {
    if (isAutomationRunning) return '#52c41a'; // Green
    if (automationProgress?.status === 'error') return '#ff4d4f'; // Red
    return '#1890ff'; // Blue
  };

  const getStatusText = () => {
    if (isAutomationRunning) {
      return `Running: ${automationProgress?.currentAction || 'Processing...'}`;
    }
    return 'Ready';
  };

  return (
    <AntHeader
      style={{
        padding: '0 24px',
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        {/* Status Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            className="status-dot"
            style={{
              backgroundColor: getStatusColor(),
              animation: isAutomationRunning ? 'pulse 1.5s infinite' : 'none',
            }}
          />
          <Text style={{ color: 'white', fontSize: '14px' }}>
            {getStatusText()}
          </Text>
        </div>

        {/* AI Provider Status */}
        {currentAIProvider && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Text style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '12px' }}>
              AI Provider:
            </Text>
            <Text style={{ color: 'white', fontSize: '12px', fontWeight: 'bold' }}>
              {currentAIProvider}
            </Text>
          </div>
        )}

        {/* Progress Info */}
        {automationProgress && isAutomationRunning && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Text style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '12px' }}>
              Progress:
            </Text>
            <Text style={{ color: 'white', fontSize: '12px' }}>
              {automationProgress.completedSteps}/{automationProgress.totalSteps}
            </Text>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Current Time */}
        <Text style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '14px' }}>
          {currentTime.toLocaleTimeString()}
        </Text>

        {/* Notifications */}
        <Badge count={0} size="small">
          <Button
            type="text"
            icon={<BellOutlined />}
            style={{ color: 'white' }}
          />
        </Badge>

        {/* User Menu */}
        <Dropdown
          menu={{
            items: userMenuItems,
            onClick: handleUserMenuClick,
          }}
          placement="bottomRight"
          trigger={['click']}
        >
          <Button
            type="text"
            icon={<UserOutlined />}
            style={{ color: 'white' }}
          />
        </Dropdown>
      </div>
    </AntHeader>
  );
};

export default Header;