import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  Tabs,
  Table,
  Tag,
  Button,
  Switch,
  Space,
  Input,
  Select,
  Collapse,
  Image,
  Progress,
  Statistic,
  Row,
  Col,
  Typography,
  Alert,
  Tooltip,
  Modal,
  List,
  Timeline,
  Badge
} from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  ClearOutlined,
  DownloadOutlined,
  EyeOutlined,
  BugOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';

const { TabPane } = Tabs;
const { Panel } = Collapse;
const { Text, Title } = Typography;
const { Search } = Input;
const { Option } = Select;

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  data?: any;
  context?: string;
  sessionId?: string;
}

interface DebugStep {
  id: string;
  stepIndex: number;
  step: any;
  result: any;
  timestamp: number;
  duration: number;
  screenshot?: string;
  pageState?: any;
  errors?: string[];
}

interface DebugSession {
  id: string;
  startTime: number;
  endTime?: number;
  steps: DebugStep[];
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

const DebugViewer: React.FC = () => {
  const [realTimeEnabled, setRealTimeEnabled] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [currentSession, setCurrentSession] = useState<DebugSession | null>(null);
  const [allSessions, setAllSessions] = useState<DebugSession[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics[]>([]);
  const [debugStats, setDebugStats] = useState<DebugStats | null>(null);
  const [selectedLogLevel, setSelectedLogLevel] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [screenshotModalVisible, setScreenshotModalVisible] = useState(false);
  const [selectedScreenshot, setSelectedScreenshot] = useState<string>('');
  const [autoScroll, setAutoScroll] = useState(true);
  
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Initialize debug viewer
  useEffect(() => {
    loadInitialData();
    
    // Set up real-time listeners if available
    if (window.electronAPI?.debug) {
      setupRealTimeListeners();
    }
    
    return () => {
      cleanupListeners();
    };
  }, []);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Filter logs based on level and search term
  useEffect(() => {
    let filtered = logs;
    
    if (selectedLogLevel !== 'all') {
      filtered = filtered.filter(log => log.level === selectedLogLevel);
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(term) ||
        (log.data && JSON.stringify(log.data).toLowerCase().includes(term))
      );
    }
    
    setFilteredLogs(filtered);
  }, [logs, selectedLogLevel, searchTerm]);

  const loadInitialData = async () => {
    try {
      // Load recent logs
      const recentLogs = await window.electronAPI?.debug?.getRecentLogs?.(100) || [];
      setLogs(recentLogs);
      
      // Load current session
      const session = await window.electronAPI?.debug?.getCurrentSession?.() || null;
      setCurrentSession(session);
      
      // Load all sessions
      const sessions = await window.electronAPI?.debug?.getAllSessions?.() || [];
      setAllSessions(sessions);
      
      // Load debug stats
      const stats = await window.electronAPI?.debug?.getStats?.() || null;
      setDebugStats(stats);
      
      // Load performance metrics
      const metrics = await window.electronAPI?.debug?.getPerformanceHistory?.(50) || [];
      setPerformanceMetrics(metrics);
      
    } catch (error) {
      console.error('Failed to load debug data:', error);
    }
  };

  const setupRealTimeListeners = () => {
    // Listen for real-time log events
    window.electronAPI?.debug?.onLog?.((logEntry: LogEntry) => {
      setLogs(prev => [...prev.slice(-999), logEntry]); // Keep last 1000 logs
    });
    
    // Listen for debug step events
    window.electronAPI?.debug?.onDebugStep?.((step: DebugStep) => {
      if (currentSession) {
        setCurrentSession(prev => prev ? {
          ...prev,
          steps: [...prev.steps, step]
        } : null);
      }
    });
    
    // Listen for performance metrics
    window.electronAPI?.debug?.onPerformanceMetrics?.((metrics: PerformanceMetrics) => {
      setPerformanceMetrics(prev => [...prev.slice(-49), metrics]); // Keep last 50 metrics
    });
  };

  const cleanupListeners = () => {
    window.electronAPI?.debug?.removeLogListener?.();
    window.electronAPI?.debug?.removeDebugStepListener?.();
    window.electronAPI?.debug?.removePerformanceListener?.();
  };

  const handleRealTimeToggle = async (enabled: boolean) => {
    setRealTimeEnabled(enabled);
    try {
      await window.electronAPI?.debug?.setRealTimeEnabled?.(enabled);
    } catch (error) {
      console.error('Failed to toggle real-time mode:', error);
    }
  };

  const handleDebugModeToggle = async (enabled: boolean) => {
    setDebugMode(enabled);
    try {
      await window.electronAPI?.debug?.setDebugMode?.(enabled);
    } catch (error) {
      console.error('Failed to toggle debug mode:', error);
    }
  };

  const handleClearLogs = () => {
    setLogs([]);
    setFilteredLogs([]);
  };

  const handleExportLogs = async () => {
    try {
      const result = await window.electronAPI?.utils?.showSaveDialog?.({
        defaultPath: `debug-logs-${new Date().toISOString().split('T')[0]}.json`,
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      
      if (result) {
        await window.electronAPI?.debug?.exportLogs?.(result, {
          level: selectedLogLevel !== 'all' ? selectedLogLevel : undefined,
          searchTerm: searchTerm || undefined
        });
      }
    } catch (error) {
      console.error('Failed to export logs:', error);
    }
  };

  const handleViewScreenshot = (screenshot: string) => {
    setSelectedScreenshot(screenshot);
    setScreenshotModalVisible(true);
  };

  const getLogLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error': return 'red';
      case 'warn': return 'orange';
      case 'info': return 'blue';
      case 'debug': return 'purple';
      case 'trace': return 'gray';
      default: return 'default';
    }
  };

  const getLogLevelIcon = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error': return <ExclamationCircleOutlined />;
      case 'warn': return <WarningOutlined />;
      case 'info': return <InfoCircleOutlined />;
      case 'debug': return <BugOutlined />;
      default: return <InfoCircleOutlined />;
    }
  };

  const getStepStatusIcon = (success: boolean) => {
    return success ? 
      <CheckCircleOutlined style={{ color: '#52c41a' }} /> : 
      <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
  };

  const formatTimestamp = (timestamp: number | string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString() + '.' + date.getMilliseconds().toString().padStart(3, '0');
  };

  const formatDuration = (duration: number) => {
    if (duration < 1000) {
      return `${duration}ms`;
    }
    return `${(duration / 1000).toFixed(2)}s`;
  };

  const logColumns = [
    {
      title: 'Time',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 120,
      render: (timestamp: string) => (
        <Text code style={{ fontSize: '11px' }}>
          {formatTimestamp(timestamp)}
        </Text>
      )
    },
    {
      title: 'Level',
      dataIndex: 'level',
      key: 'level',
      width: 80,
      render: (level: string) => (
        <Tag color={getLogLevelColor(level)} icon={getLogLevelIcon(level)}>
          {level.toUpperCase()}
        </Tag>
      )
    },
    {
      title: 'Message',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
      render: (message: string, record: LogEntry) => (
        <div>
          <Text>{message}</Text>
          {record.context && (
            <Tag style={{ marginLeft: 8, fontSize: '11px' }}>
              {record.context}
            </Tag>
          )}
        </div>
      )
    },
    {
      title: 'Data',
      dataIndex: 'data',
      key: 'data',
      width: 100,
      render: (data: any) => (
        data ? (
          <Tooltip title={<pre>{JSON.stringify(data, null, 2)}</pre>}>
            <Button size="small" icon={<EyeOutlined />} />
          </Tooltip>
        ) : null
      )
    }
  ];

  const stepColumns = [
    {
      title: 'Step',
      dataIndex: 'stepIndex',
      key: 'stepIndex',
      width: 60,
      render: (index: number) => <Badge count={index + 1} />
    },
    {
      title: 'Type',
      dataIndex: ['step', 'type'],
      key: 'type',
      width: 100,
      render: (type: string) => <Tag>{type}</Tag>
    },
    {
      title: 'Status',
      dataIndex: ['result', 'success'],
      key: 'status',
      width: 80,
      render: (success: boolean) => getStepStatusIcon(success)
    },
    {
      title: 'Duration',
      dataIndex: 'duration',
      key: 'duration',
      width: 100,
      render: (duration: number) => (
        <Text code>{formatDuration(duration)}</Text>
      )
    },
    {
      title: 'Description',
      dataIndex: ['step', 'description'],
      key: 'description',
      ellipsis: true
    },
    {
      title: 'Screenshot',
      dataIndex: 'screenshot',
      key: 'screenshot',
      width: 100,
      render: (screenshot: string) => (
        screenshot ? (
          <Button 
            size="small" 
            icon={<EyeOutlined />}
            onClick={() => handleViewScreenshot(screenshot)}
          >
            View
          </Button>
        ) : null
      )
    }
  ];

  return (
    <div style={{ padding: '16px', height: '100vh', overflow: 'auto' }}>
      <Title level={3}>
        <BugOutlined /> Debug & Logging Console
      </Title>
      
      {/* Control Panel */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
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
          <Col>
            <Space>
              <Text>Debug Mode:</Text>
              <Switch 
                checked={debugMode}
                onChange={handleDebugModeToggle}
              />
            </Space>
          </Col>
          <Col>
            <Space>
              <Text>Auto-scroll:</Text>
              <Switch 
                checked={autoScroll}
                onChange={setAutoScroll}
              />
            </Space>
          </Col>
          <Col flex="auto" />
          <Col>
            <Space>
              <Button 
                icon={<ClearOutlined />}
                onClick={handleClearLogs}
              >
                Clear
              </Button>
              <Button 
                icon={<DownloadOutlined />}
                onClick={handleExportLogs}
              >
                Export
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Statistics */}
      {debugStats && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={4}>
            <Statistic 
              title="Active Sessions" 
              value={debugStats.activeSessions}
              prefix={<PlayCircleOutlined />}
            />
          </Col>
          <Col span={4}>
            <Statistic 
              title="Total Steps" 
              value={debugStats.totalSteps}
            />
          </Col>
          <Col span={4}>
            <Statistic 
              title="Screenshots" 
              value={debugStats.totalScreenshots}
            />
          </Col>
          <Col span={4}>
            <Statistic 
              title="Log Entries" 
              value={debugStats.totalLogs}
            />
          </Col>
          <Col span={4}>
            <Statistic 
              title="Memory Usage" 
              value={Math.round(debugStats.memoryUsage / 1024 / 1024)}
              suffix="MB"
            />
          </Col>
          <Col span={4}>
            <Statistic 
              title="Total Sessions" 
              value={debugStats.totalSessions}
            />
          </Col>
        </Row>
      )}

      <Tabs defaultActiveKey="logs">
        <TabPane tab="Live Logs" key="logs">
          <Card>
            <Space style={{ marginBottom: 16, width: '100%' }} direction="vertical">
              <Row gutter={16}>
                <Col span={8}>
                  <Search
                    placeholder="Search logs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    allowClear
                  />
                </Col>
                <Col span={6}>
                  <Select
                    value={selectedLogLevel}
                    onChange={setSelectedLogLevel}
                    style={{ width: '100%' }}
                  >
                    <Option value="all">All Levels</Option>
                    <Option value="error">Error</Option>
                    <Option value="warn">Warning</Option>
                    <Option value="info">Info</Option>
                    <Option value="debug">Debug</Option>
                    <Option value="trace">Trace</Option>
                  </Select>
                </Col>
              </Row>
            </Space>
            
            <Table
              columns={logColumns}
              dataSource={filteredLogs}
              rowKey="timestamp"
              size="small"
              scroll={{ y: 400 }}
              pagination={{
                pageSize: 50,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total) => `Total ${total} logs`
              }}
            />
            <div ref={logsEndRef} />
          </Card>
        </TabPane>

        <TabPane tab="Current Session" key="session">
          {currentSession ? (
            <Card>
              <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={8}>
                  <Statistic 
                    title="Session ID" 
                    value={currentSession.id}
                    valueStyle={{ fontSize: '14px' }}
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
              
              <Table
                columns={stepColumns}
                dataSource={currentSession.steps}
                rowKey="id"
                size="small"
                scroll={{ y: 400 }}
                expandable={{
                  expandedRowRender: (record: DebugStep) => (
                    <div style={{ padding: '8px 0' }}>
                      <Collapse size="small">
                        <Panel header="Step Details" key="details">
                          <pre>{JSON.stringify(record.step, null, 2)}</pre>
                        </Panel>
                        <Panel header="Result" key="result">
                          <pre>{JSON.stringify(record.result, null, 2)}</pre>
                        </Panel>
                        {record.pageState && (
                          <Panel header="Page State" key="pageState">
                            <pre>{JSON.stringify(record.pageState, null, 2)}</pre>
                          </Panel>
                        )}
                      </Collapse>
                    </div>
                  )
                }}
              />
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

        <TabPane tab="Performance" key="performance">
          <Card>
            {performanceMetrics.length > 0 ? (
              <div>
                <Row gutter={16} style={{ marginBottom: 16 }}>
                  {performanceMetrics.slice(-1).map(metrics => (
                    <React.Fragment key={metrics.timestamp}>
                      <Col span={6}>
                        <Statistic 
                          title="Memory Usage" 
                          value={metrics.memory.percentUsed}
                          suffix="%"
                          valueStyle={{ 
                            color: metrics.memory.percentUsed > 80 ? '#ff4d4f' : '#3f8600' 
                          }}
                        />
                        <Progress 
                          percent={metrics.memory.percentUsed} 
                          size="small"
                          status={metrics.memory.percentUsed > 80 ? 'exception' : 'normal'}
                        />
                      </Col>
                      <Col span={6}>
                        <Statistic 
                          title="CPU Usage" 
                          value={metrics.cpu.usage}
                          suffix="%"
                          valueStyle={{ 
                            color: metrics.cpu.usage > 80 ? '#ff4d4f' : '#3f8600' 
                          }}
                        />
                        <Progress 
                          percent={metrics.cpu.usage} 
                          size="small"
                          status={metrics.cpu.usage > 80 ? 'exception' : 'normal'}
                        />
                      </Col>
                      <Col span={6}>
                        <Statistic 
                          title="Browser Instances" 
                          value={metrics.browser.instances}
                        />
                      </Col>
                      <Col span={6}>
                        <Statistic 
                          title="Database Queries" 
                          value={metrics.database.queries}
                        />
                      </Col>
                    </React.Fragment>
                  ))}
                </Row>
                
                <Timeline mode="left">
                  {performanceMetrics.slice(-10).reverse().map(metrics => (
                    <Timeline.Item 
                      key={metrics.timestamp}
                      label={formatTimestamp(metrics.timestamp)}
                      color={
                        metrics.memory.percentUsed > 80 || metrics.cpu.usage > 80 
                          ? 'red' : 'green'
                      }
                    >
                      <Text>
                        Memory: {metrics.memory.percentUsed}%, 
                        CPU: {metrics.cpu.usage}%, 
                        Browsers: {metrics.browser.instances}
                      </Text>
                    </Timeline.Item>
                  ))}
                </Timeline>
              </div>
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

        <TabPane tab="Sessions" key="sessions">
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
                        <Text code>{session.id}</Text>
                        {!session.endTime && <Badge status="processing" text="Active" />}
                      </Space>
                    }
                    description={
                      <Space>
                        <Text>Started: {new Date(session.startTime).toLocaleString()}</Text>
                        <Text>Steps: {session.steps.length}</Text>
                        <Text>Duration: {formatDuration(
                          (session.endTime || Date.now()) - session.startTime
                        )}</Text>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </TabPane>
      </Tabs>

      {/* Screenshot Modal */}
      <Modal
        title="Debug Screenshot"
        open={screenshotModalVisible}
        onCancel={() => setScreenshotModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedScreenshot && (
          <Image
            src={`data:image/png;base64,${selectedScreenshot}`}
            alt="Debug Screenshot"
            style={{ width: '100%' }}
          />
        )}
      </Modal>
    </div>
  );
};

export default DebugViewer;