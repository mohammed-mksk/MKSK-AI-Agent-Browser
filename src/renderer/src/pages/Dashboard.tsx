import React, { useEffect } from 'react';
import { Row, Col, Card, Statistic, List, Button, Typography, Space } from 'antd';
import { 
  RobotOutlined, 
  HistoryOutlined, 
  FolderOutlined, 
  PlayCircleOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';

const { Title, Text } = Typography;

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { 
    history, 
    workflows, 
    setHistory, 
    setWorkflows,
    currentAIProvider,
    setCurrentAIProvider,
    setAvailableProviders
  } = useAppStore();

  // Initialize with sample data for now
  useEffect(() => {
    // Sample history data
    const sampleHistory = [
      {
        id: '1',
        command: 'Navigate to Google and search for "AI automation"',
        timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
        result: {
          id: '1',
          command: 'Navigate to Google and search for "AI automation"',
          intent: { type: 'search' as const, description: 'Search operation', complexity: 'simple' as const },
          executionPlan: { id: 'plan_1', steps: [], estimatedDuration: 5000, requiredResources: [], fallbackStrategies: [] },
          extractedData: [],
          screenshots: [],
          duration: 5000,
          success: true,
          errors: [],
          timestamp: new Date(Date.now() - 1000 * 60 * 30),
          metadata: { browserVersion: 'Chrome 120.0.0.0', userAgent: 'Mozilla/5.0...', viewport: { width: 1920, height: 1080 }, totalSteps: 3, successfulSteps: 3, failedSteps: 0 }
        }
      },
      {
        id: '2',
        command: 'Fill out contact form on example.com',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
        result: {
          id: '2',
          command: 'Fill out contact form on example.com',
          intent: { type: 'form_fill' as const, description: 'Form filling operation', complexity: 'medium' as const },
          executionPlan: { id: 'plan_2', steps: [], estimatedDuration: 8000, requiredResources: [], fallbackStrategies: [] },
          extractedData: [],
          screenshots: [],
          duration: 8000,
          success: true,
          errors: [],
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
          metadata: { browserVersion: 'Chrome 120.0.0.0', userAgent: 'Mozilla/5.0...', viewport: { width: 1920, height: 1080 }, totalSteps: 5, successfulSteps: 5, failedSteps: 0 }
        }
      },
      {
        id: '3',
        command: 'Extract product data from e-commerce site',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
        result: {
          id: '3',
          command: 'Extract product data from e-commerce site',
          intent: { type: 'data_extract' as const, description: 'Data extraction operation', complexity: 'complex' as const },
          executionPlan: { id: 'plan_3', steps: [], estimatedDuration: 12000, requiredResources: [], fallbackStrategies: [] },
          extractedData: [],
          screenshots: [],
          duration: 12000,
          success: false,
          errors: [{ id: 'err_1', type: 'element_not_found' as const, message: 'Failed to locate product elements', context: {}, timestamp: new Date() }],
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
          metadata: { browserVersion: 'Chrome 120.0.0.0', userAgent: 'Mozilla/5.0...', viewport: { width: 1920, height: 1080 }, totalSteps: 7, successfulSteps: 4, failedSteps: 3 }
        }
      }
    ];

    // Sample workflows data
    const sampleWorkflows = [
      {
        id: '1',
        name: 'Daily News Scraper',
        description: 'Scrapes latest news from multiple sources',
        command: 'Scrape latest news from CNN, BBC, and Reuters',
        parameters: { urls: ['cnn.com', 'bbc.com', 'reuters.com'] },
        executionPlan: { id: 'workflow_plan_1', steps: [], estimatedDuration: 30000, requiredResources: [], fallbackStrategies: [] },
        tags: ['news', 'scraping', 'daily'],
        useCount: 15,
        lastUsed: new Date(Date.now() - 1000 * 60 * 60 * 12), // 12 hours ago
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7) // 1 week ago
      },
      {
        id: '2',
        name: 'Social Media Poster',
        description: 'Posts content to multiple social platforms',
        command: 'Post content to Twitter, LinkedIn, and Facebook',
        parameters: { platforms: ['twitter', 'linkedin', 'facebook'] },
        executionPlan: { id: 'workflow_plan_2', steps: [], estimatedDuration: 15000, requiredResources: [], fallbackStrategies: [] },
        tags: ['social', 'posting', 'automation'],
        useCount: 8,
        lastUsed: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 days ago
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14) // 2 weeks ago
      }
    ];

    setHistory(sampleHistory);
    setWorkflows(sampleWorkflows);
    setAvailableProviders(['OpenAI GPT-4', 'Claude 3', 'Local AI']);
    setCurrentAIProvider('OpenAI GPT-4');
  }, [setHistory, setWorkflows, setAvailableProviders, setCurrentAIProvider]);

  const recentHistory = history?.slice(0, 5) || [];
  const recentWorkflows = workflows?.slice(0, 5) || [];

  const stats = {
    totalAutomations: (history || []).length,
    successfulAutomations: (history || []).filter(h => h.result.success).length,
    totalWorkflows: (workflows || []).length,
    recentActivity: (history || []).filter(h => {
      const dayAgo = new Date();
      dayAgo.setDate(dayAgo.getDate() - 1);
      return h.timestamp > dayAgo;
    }).length
  };

  const quickActions = [
    {
      title: 'New Automation',
      description: 'Start a new automation task',
      icon: <RobotOutlined />,
      action: () => navigate('/automation'),
      color: '#1890ff'
    },
    {
      title: 'View History',
      description: 'Browse automation history',
      icon: <HistoryOutlined />,
      action: () => navigate('/history'),
      color: '#52c41a'
    },
    {
      title: 'Manage Workflows',
      description: 'Create and edit workflows',
      icon: <FolderOutlined />,
      action: () => navigate('/workflows'),
      color: '#722ed1'
    }
  ];

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Title level={2} style={{ color: 'white', marginBottom: '24px' }}>
          Dashboard
        </Title>

        {/* Statistics Cards */}
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col xs={24} sm={12} lg={6}>
            <motion.div whileHover={{ scale: 1.02 }} transition={{ duration: 0.2 }}>
              <Card className="glass-card">
                <Statistic
                  title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>Total Automations</span>}
                  value={stats.totalAutomations}
                  prefix={<RobotOutlined style={{ color: '#1890ff' }} />}
                  valueStyle={{ color: 'white' }}
                />
              </Card>
            </motion.div>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <motion.div whileHover={{ scale: 1.02 }} transition={{ duration: 0.2 }}>
              <Card className="glass-card">
                <Statistic
                  title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>Successful</span>}
                  value={stats.successfulAutomations}
                  prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                  valueStyle={{ color: 'white' }}
                />
              </Card>
            </motion.div>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <motion.div whileHover={{ scale: 1.02 }} transition={{ duration: 0.2 }}>
              <Card className="glass-card">
                <Statistic
                  title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>Workflows</span>}
                  value={stats.totalWorkflows}
                  prefix={<FolderOutlined style={{ color: '#722ed1' }} />}
                  valueStyle={{ color: 'white' }}
                />
              </Card>
            </motion.div>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <motion.div whileHover={{ scale: 1.02 }} transition={{ duration: 0.2 }}>
              <Card className="glass-card">
                <Statistic
                  title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>Recent Activity</span>}
                  value={stats.recentActivity}
                  prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
                  valueStyle={{ color: 'white' }}
                />
              </Card>
            </motion.div>
          </Col>
        </Row>

        {/* Quick Actions */}
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col span={24}>
            <Card className="glass-card">
              <Title level={4} style={{ color: 'white', marginBottom: '16px' }}>
                Quick Actions
              </Title>
              <Row gutter={[16, 16]}>
                {quickActions.map((action, index) => (
                  <Col xs={24} sm={8} key={index}>
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Card
                        hoverable
                        style={{
                          background: `linear-gradient(135deg, ${action.color}20, ${action.color}10)`,
                          border: `1px solid ${action.color}40`,
                          cursor: 'pointer'
                        }}
                        onClick={action.action}
                      >
                        <Space direction="vertical" size="small">
                          <div style={{ fontSize: '24px', color: action.color }}>
                            {action.icon}
                          </div>
                          <Title level={5} style={{ color: 'white', margin: 0 }}>
                            {action.title}
                          </Title>
                          <Text style={{ color: 'rgba(255,255,255,0.7)' }}>
                            {action.description}
                          </Text>
                        </Space>
                      </Card>
                    </motion.div>
                  </Col>
                ))}
              </Row>
            </Card>
          </Col>
        </Row>

        {/* Recent Activity */}
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <Title level={4} style={{ color: 'white', margin: 0 }}>
                  Recent Automations
                </Title>
                <Button type="link" onClick={() => navigate('/history')} style={{ color: '#1890ff' }}>
                  View All
                </Button>
              </div>
              <List
                dataSource={recentHistory}
                renderItem={(item) => (
                  <List.Item style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <List.Item.Meta
                      avatar={
                        item.result.success ? (
                          <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '16px' }} />
                        ) : (
                          <ExclamationCircleOutlined style={{ color: '#ff4d4f', fontSize: '16px' }} />
                        )
                      }
                      title={
                        <Text style={{ color: 'white' }}>
                          {item.command.length > 50 ? `${item.command.substring(0, 50)}...` : item.command}
                        </Text>
                      }
                      description={
                        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>
                          {item.timestamp.toLocaleString()}
                        </Text>
                      }
                    />
                  </List.Item>
                )}
                locale={{ emptyText: 'No recent automations' }}
              />
            </Card>
          </Col>
          
          <Col xs={24} lg={12}>
            <Card className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <Title level={4} style={{ color: 'white', margin: 0 }}>
                  Recent Workflows
                </Title>
                <Button type="link" onClick={() => navigate('/workflows')} style={{ color: '#1890ff' }}>
                  View All
                </Button>
              </div>
              <List
                dataSource={recentWorkflows}
                renderItem={(item) => (
                  <List.Item 
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}
                    actions={[
                      <Button
                        key="run"
                        type="text"
                        icon={<PlayCircleOutlined />}
                        style={{ color: '#1890ff' }}
                        onClick={() => {
                          // Run workflow logic
                          navigate('/automation');
                        }}
                      />
                    ]}
                  >
                    <List.Item.Meta
                      avatar={<FolderOutlined style={{ color: '#722ed1', fontSize: '16px' }} />}
                      title={<Text style={{ color: 'white' }}>{item.name}</Text>}
                      description={
                        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>
                          Used {item.useCount} times • {item.lastUsed.toLocaleDateString()}
                        </Text>
                      }
                    />
                  </List.Item>
                )}
                locale={{ emptyText: 'No workflows created yet' }}
              />
            </Card>
          </Col>
        </Row>
      </motion.div>
    </div>
  );
};

export default Dashboard;