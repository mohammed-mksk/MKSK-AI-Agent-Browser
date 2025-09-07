import React, { useState, useEffect } from 'react';
import {
  Card,
  Tabs,
  Row,
  Col,
  Statistic,
  Progress,
  Timeline,
  Alert,
  Switch,
  Button,
  Space,
  Typography,
  Badge,
  Divider,
  List,
  Tag
} from 'antd';
import {
  BugOutlined,
  DashboardOutlined,
  HistoryOutlined,
  BarChartOutlined,
  SettingOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  ClearOutlined
} from '@ant-design/icons';
import LogViewer from './LogViewer';

const { TabPane } = Tabs;
const { Title, Text } = Typography;

interface DebugSession {
  id: string;
  startTime: number;
  endTime?: number;
  steps: any[];
  screenshots: any[];
  logs: any[];
  performance: any[];
  metadata: Record<string, any>;
}

interface PerformanceMetrics {
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    percentUsed: number;
  };
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  browser: {
    instances: number;
    pages: number;
    memoryEstimate: number;
  };
  database: {
    size: number;
    connections: number;
    queries: number;
    cacheSize: number;
    cacheHitRate: number;
  };
  timestamp: number;
}

interface DebugStats {
  totalSessions: number;
  activeSessions: number;
  totalSteps: number;
  totalScreenshots: number;
  totalLogs: number;
  memoryUsage: number;
}

const DebugDashboard: React.FC = () => {
  const [debugMode, setDebugMode] = useState(false);
  const [realTimeEnabled, setRealTimeEnabled] = useState(false);
  const [currentSession, setCurrentSession] = useState<DebugSession | null>(null);
  const [allSessions, setAllSessions] = useState<DebugSession[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics[]>([]);
  const [debugStats, setDebugStats] = useState<DebugStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDebugData();
    
    // Set up real-time listeners
    if (realTimeEnabled) {
      setupRealTimeListeners();
    }
    
    return () => {
      cleanupListeners();
    };
  }, [realTimeEnabled]);

  const loadDebugData = async () => {
    setLoading(true);
    try {
      // Load current session
      const sessionResponse = await window.electronAPI?.debug?.getCurrentSession?.();
      if (sessionResponse?.success) {
        setCurrentSession(sessionResponse.data);
      }
      
      // Load all sessions
      const sessionsResponse = await window.electronAPI?.debug?.getAllSessions?.();
      if (sessionsResponse && typeof sessionsResponse === 'object' && 'success' in sessionsResponse && sessionsResponse.success) {
        setAllSessions((sessionsResponse as any).data || []);
      }
      
      // Load debug stats
      const statsResponse = await window.electronAPI?.debug?.getStats?.();
      if (statsResponse?.success) {
        setDebugStats(statsResponse.data);
      }
      
      // Load performance metrics
      const metricsResponse = await window.electronAPI?.debug?.getPerformanceHistory?.(20);
      if (metricsResponse && typeof metricsResponse === 'object' && 'success' in metricsResponse && metricsResponse.success) {
        setPerformanceMetrics((metricsResponse as any).data || []);
      }
    } catch (error) {
      console.error('Failed to load debug data:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupRealTimeListeners = () => {
    // Listen for debug step events
    window.electronAPI?.debug?.onDebugStep?.((step: any) => {
      if (currentSession) {
        setCurrentSession(prev => prev ? {
          ...prev,
          steps: [...prev.steps, step]
        } : null);
      }
    });
    
    // Listen for performance metrics
    window.electronAPI?.debug?.onPerformanceMetrics?.((metrics: PerformanceMetrics) => {
      setPerformanceMetrics(prev => [...prev.slice(-19), metrics]);
    });
  };

  const cleanupListeners = () => {
    window.electronAPI?.debug?.removeDebugStepListener?.();
    window.electronAPI?.debug?.removePerformanceListener?.();
  };

  const handleDebugModeToggle = async (enabled: boolean) => {
    setDebugMode(enabled);
    try {
      await window.electronAPI?.debug?.setDebugMode?.(enabled);
    } catch (error) {
      console.error('Failed to toggle debug mode:', error);
    }
  };

  const handleRealTimeToggle = async (enabled: boolean) => {
    setRealTimeEnabled(enabled);
    try {
      await window.electronAPI?.debug?.setRealTimeEnabled?.(enabled);
    } catch (error) {
      console.error('Failed to toggle real-time mode:', error);
    }
  };

  const handleClearSessions = async () => {
    try {
      await window.electronAPI?.debug?.clearAllSessions?.();
      setAllSessions([]);
      setCurrentSession(null);
    } catch (error) {
      console.error('Failed to clear sessions:', error);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatDuration = (duration: number) => {
    if (duration < 1000) {
      return `${duration}ms`;
    }
    return `${(duration / 1000).toFixed(2)}s`;
  };

  const getCurrentPerformanceMetrics = () => {
    return performanceMetrics.length > 0 ? performanceMetrics[performanceMetrics.length - 1] : null;
  };

  const currentMetrics = getCurrentPerformanceMetrics();

  return (
    <div style={{ padding: '16px', height: '100vh', overflow: 'auto' }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>
          <BugOutlined /> Debug Dashboard
        </Title>
        
        {/* Control Panel */}
        <Card size="small" style={{ marginBottom: 16 }}>
          <Row gutter={16} align="middle">
            <Col>
              <Space>
                <Text>Debug Mode:</Text>
                <Switch 
                  checked={debugMode}
                  onChange={handleDebugModeToggle}
                  checkedChildren="ON"
                  unCheckedChildren="OFF"
                />
              </Space>
            </Col>
            <Col>
              <Space>
                <Text>Real-time:</Text>
                <Switch 
                  checked={realTimeEnabled}
                  onChange={handleRealTimeToggle}
                  checkedChildren={<PlayCircleOutlined />}
                  unCheckedChildren={<PauseCircleOutlined />}
                />
              </Space>
            </Col>
            <Col flex="auto" />
            <Col>
              <Space>
                <Button 
                  icon={<ClearOutlined />}
                  onClick={handleClearSessions}
                  size="small"
                >
                  Clear Sessions
                </Button>
              </Space>
            </Col>
          </Row>
        </Card>

        {/* Statistics Overview */}
        {debugStats && (
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={4}>
              <Card>
                <Statistic 
                  title="Active Sessions" 
                  value={debugStats.activeSessions}
                  prefix={<PlayCircleOutlined />}
                  valueStyle={{ color: debugStats.activeSessions > 0 ? '#52c41a' : '#8c8c8c' }}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card>
                <Statistic 
                  title="Total Steps" 
                  value={debugStats.totalSteps}
                  prefix={<HistoryOutlined />}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card>
                <Statistic 
                  title="Screenshots" 
                  value={debugStats.totalScreenshots}
                  prefix={<DashboardOutlined />}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card>
                <Statistic 
                  title="Log Entries" 
                  value={debugStats.totalLogs}
                  prefix={<BugOutlined />}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card>
                <Statistic 
                  title="Memory Usage" 
                  value={Math.round(debugStats.memoryUsage / 1024 / 1024)}
                  suffix="MB"
                  prefix={<BarChartOutlined />}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card>
                <Statistic 
                  title="Total Sessions" 
                  value={debugStats.totalSessions}
                  prefix={<SettingOutlined />}
                />
              </Card>
            </Col>
          </Row>
        )}

        {/* Performance Metrics */}
        {currentMetrics && (
          <Card title="System Performance" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={6}>
                <div>
                  <Text strong>Memory Usage</Text>
                  <Progress 
                    percent={currentMetrics.memory.percentUsed} 
                    status={currentMetrics.memory.percentUsed > 80 ? 'exception' : 'normal'}
                    format={(percent) => `${percent}%`}
                  />
                  <Text type="secondary">
                    {currentMetrics.memory.heapUsed}MB / {currentMetrics.memory.heapTotal}MB
                  </Text>
                </div>
              </Col>
              <Col span={6}>
                <div>
                  <Text strong>CPU Usage</Text>
                  <Progress 
                    percent={currentMetrics.cpu.usage} 
                    status={currentMetrics.cpu.usage > 80 ? 'exception' : 'normal'}
                    format={(percent) => `${percent}%`}
                  />
                  <Text type="secondary">
                    Load: {currentMetrics.cpu.loadAverage[0]?.toFixed(2) || 'N/A'}
                  </Text>
                </div>
              </Col>
              <Col span={6}>
                <div>
                  <Text strong>Browser Instances</Text>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>
                    {currentMetrics.browser.instances}
                  </div>
                  <Text type="secondary">
                    Pages: {currentMetrics.browser.pages}
                  </Text>
                </div>
              </Col>
              <Col span={6}>
                <div>
                  <Text strong>Database</Text>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>
                    {currentMetrics.database.queries}
                  </div>
                  <Text type="secondary">
                    Cache Hit: {currentMetrics.database.cacheHitRate}%
                  </Text>
                </div>
              </Col>
            </Row>
          </Card>
        )}
      </div>

      <Tabs defaultActiveKey="logs">
        <TabPane tab="Live Logs" key="logs">
          <LogViewer 
            height={500}
            showControls={true}
            showStats={true}
            autoRefresh={realTimeEnabled}
            refreshInterval={5000}
            maxEntries={1000}
          />
        </TabPane>

        <TabPane tab="Current Session" key="session">
          {currentSession ? (
            <Card>
              <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={8}>
                  <Statistic 
                    title="Session ID" 
                    value={currentSession.id}
                    valueStyle={{ fontSize: '14px', fontFamily: 'monospace' }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic 
                    title="Steps Executed" 
                    value={currentSession.steps.length}
                  />
                </Col>
                <Col span={8}>
                  <Statistic 
                    title="Duration" 
                    value={formatDuration(
                      (currentSession.endTime || Date.now()) - currentSession.startTime
                    )}
                  />
                </Col>
              </Row>
              
              <Divider />
              
              <Timeline mode="left">
                {currentSession.steps.slice(-10).map((step, index) => (
                  <Timeline.Item 
                    key={step.id || index}
                    color={step.result?.success ? 'green' : 'red'}
                    label={formatTimestamp(step.timestamp)}
                  >
                    <div>
                      <Tag color={step.result?.success ? 'success' : 'error'}>
                        {step.step?.type || 'Unknown'}
                      </Tag>
                      <Text>{step.step?.description || 'No description'}</Text>
                      {step.duration && (
                        <Text type="secondary" style={{ marginLeft: 8 }}>
                          ({formatDuration(step.duration)})
                        </Text>
                      )}
                    </div>
                  </Timeline.Item>
                ))}
              </Timeline>
            </Card>
          ) : (
            <Alert
              message="No Active Session"
              description="Start an automation to see debug information here."
              type="info"
              showIcon
            />
          )}
        </TabPane>

        <TabPane tab="Performance History" key="performance">
          <Card>
            {performanceMetrics.length > 0 ? (
              <Timeline mode="left">
                {performanceMetrics.slice(-15).reverse().map(metrics => (
                  <Timeline.Item 
                    key={metrics.timestamp}
                    label={formatTimestamp(metrics.timestamp)}
                    color={
                      metrics.memory.percentUsed > 80 || metrics.cpu.usage > 80 
                        ? 'red' : 'green'
                    }
                  >
                    <Space direction="vertical" size="small">
                      <Text>
                        <strong>Memory:</strong> {metrics.memory.percentUsed}% 
                        ({metrics.memory.heapUsed}MB used)
                      </Text>
                      <Text>
                        <strong>CPU:</strong> {metrics.cpu.usage}%
                      </Text>
                      <Text>
                        <strong>Browsers:</strong> {metrics.browser.instances} instances, 
                        {metrics.browser.pages} pages
                      </Text>
                      <Text>
                        <strong>Database:</strong> {metrics.database.queries} queries, 
                        {metrics.database.cacheHitRate}% cache hit rate
                      </Text>
                    </Space>
                  </Timeline.Item>
                ))}
              </Timeline>
            ) : (
              <Alert
                message="No Performance Data"
                description="Performance monitoring will appear here when available."
                type="info"
                showIcon
              />
            )}
          </Card>
        </TabPane>

        <TabPane tab="Session History" key="sessions">
          <Card>
            <List
              dataSource={allSessions}
              renderItem={(session: DebugSession) => (
                <List.Item
                  actions={[
                    <Button 
                      size="small" 
                      onClick={() => setCurrentSession(session)}
                    >
                      View Details
                    </Button>
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <Text code style={{ fontSize: '12px' }}>{session.id}</Text>
                        {!session.endTime && <Badge status="processing" text="Active" />}
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size="small">
                        <Text type="secondary">
                          Started: {formatTimestamp(session.startTime)}
                        </Text>
                        <Space>
                          <Tag>Steps: {session.steps.length}</Tag>
                          <Tag>Screenshots: {session.screenshots.length}</Tag>
                          <Tag>Logs: {session.logs.length}</Tag>
                          <Tag>
                            Duration: {formatDuration(
                              (session.endTime || Date.now()) - session.startTime
                            )}
                          </Tag>
                        </Space>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </TabPane>
      </Tabs>
    </div>
  );
};

export default DebugDashboard;