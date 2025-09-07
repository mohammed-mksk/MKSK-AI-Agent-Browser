import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Input,
  Select,
  Row,
  Col,
  Typography,
  Tooltip,
  DatePicker,
  Switch,
  Statistic,
  Empty,
  Spin
} from 'antd';
import {
  SearchOutlined,
  ClearOutlined,
  DownloadOutlined,
  EyeOutlined,
  FilterOutlined,
  ReloadOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  BugOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;
const { Search } = Input;
const { Option } = Select;
const { RangePicker } = DatePicker;

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  data?: any;
  context?: string;
  sessionId?: string;
}

interface LogFilter {
  level?: string;
  startDate?: Date;
  endDate?: Date;
  context?: string;
  searchTerm?: string;
  limit?: number;
}

interface LogStats {
  totalEntries: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  debugCount: number;
  fileSize: number;
  oldestEntry?: Date;
  newestEntry?: Date;
}

interface LogViewerProps {
  height?: number;
  showControls?: boolean;
  showStats?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
  maxEntries?: number;
}

const LogViewer: React.FC<LogViewerProps> = ({
  height = 600,
  showControls = true,
  showStats = true,
  autoRefresh = false,
  refreshInterval = 5000,
  maxEntries = 1000
}) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [logStats, setLogStats] = useState<LogStats | null>(null);
  const [selectedLogLevel, setSelectedLogLevel] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedContext, setSelectedContext] = useState<string>('all');
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [realTimeEnabled, setRealTimeEnabled] = useState(false);
  
  const logsEndRef = useRef<HTMLDivElement>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize log viewer
  useEffect(() => {
    loadLogs();
    
    if (autoRefresh) {
      startAutoRefresh();
    }
    
    return () => {
      stopAutoRefresh();
    };
  }, [autoRefresh, refreshInterval]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Filter logs based on criteria
  useEffect(() => {
    let filtered = logs;
    
    // Filter by level
    if (selectedLogLevel !== 'all') {
      filtered = filtered.filter(log => log.level === selectedLogLevel);
    }
    
    // Filter by context
    if (selectedContext !== 'all') {
      filtered = filtered.filter(log => log.context === selectedContext);
    }
    
    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(term) ||
        (log.data && JSON.stringify(log.data).toLowerCase().includes(term)) ||
        (log.context && log.context.toLowerCase().includes(term))
      );
    }
    
    // Filter by date range
    if (dateRange[0] && dateRange[1]) {
      filtered = filtered.filter(log => {
        const logDate = new Date(log.timestamp);
        return logDate >= dateRange[0]! && logDate <= dateRange[1]!;
      });
    }
    
    setFilteredLogs(filtered);
  }, [logs, selectedLogLevel, selectedContext, searchTerm, dateRange]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const response = await window.electronAPI?.debug?.getRecentLogs?.(maxEntries);
      if (response && typeof response === 'object' && 'success' in response && response.success) {
        setLogs((response as any).data || []);
      } else {
        setLogs([]);
      }
      
      // Load log stats
      const statsResponse = await window.electronAPI?.debug?.getLogStats?.();
      if (statsResponse?.success) {
        setLogStats(statsResponse.data);
      }
    } catch (error) {
      console.error('Failed to load logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const startAutoRefresh = () => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }
    
    refreshIntervalRef.current = setInterval(() => {
      loadLogs();
    }, refreshInterval);
  };

  const stopAutoRefresh = () => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
  };

  const handleRealTimeToggle = async (enabled: boolean) => {
    setRealTimeEnabled(enabled);
    try {
      await window.electronAPI?.debug?.setRealTimeEnabled?.(enabled);
      
      if (enabled) {
        // Set up real-time listener
        window.electronAPI?.debug?.onLog?.((logEntry: LogEntry) => {
          setLogs(prev => [...prev.slice(-(maxEntries - 1)), logEntry]);
        });
      } else {
        // Remove real-time listener
        window.electronAPI?.debug?.removeLogListener?.();
      }
    } catch (error) {
      console.error('Failed to toggle real-time mode:', error);
    }
  };

  const handleClearLogs = async () => {
    try {
      await window.electronAPI?.debug?.clearLogs?.();
      setLogs([]);
      setFilteredLogs([]);
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  };

  const handleExportLogs = async () => {
    try {
      const result = await window.electronAPI?.utils?.showSaveDialog?.({
        defaultPath: `logs-${new Date().toISOString().split('T')[0]}.json`,
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'CSV Files', extensions: ['csv'] },
          { name: 'Text Files', extensions: ['txt'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      
      if (result) {
        const filter: LogFilter = {
          level: selectedLogLevel !== 'all' ? selectedLogLevel : undefined,
          context: selectedContext !== 'all' ? selectedContext : undefined,
          searchTerm: searchTerm || undefined,
          startDate: dateRange[0] || undefined,
          endDate: dateRange[1] || undefined
        };
        
        await window.electronAPI?.debug?.exportLogs?.(result, filter);
      }
    } catch (error) {
      console.error('Failed to export logs:', error);
    }
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

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString() + '.' + date.getMilliseconds().toString().padStart(3, '0');
  };

  const getUniqueContexts = () => {
    const contexts = new Set(logs.map(log => log.context).filter(Boolean));
    return Array.from(contexts);
  };

  const columns: ColumnsType<LogEntry> = [
    {
      title: 'Time',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      sorter: (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
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
      width: 100,
      filters: [
        { text: 'Error', value: 'error' },
        { text: 'Warning', value: 'warn' },
        { text: 'Info', value: 'info' },
        { text: 'Debug', value: 'debug' },
        { text: 'Trace', value: 'trace' }
      ],
      onFilter: (value, record) => record.level === value,
      render: (level: string) => (
        <Tag color={getLogLevelColor(level)} icon={getLogLevelIcon(level)}>
          {level.toUpperCase()}
        </Tag>
      )
    },
    {
      title: 'Context',
      dataIndex: 'context',
      key: 'context',
      width: 120,
      filters: getUniqueContexts().map(context => ({ text: context, value: context })),
      onFilter: (value, record) => record.context === value,
      render: (context: string) => (
        context ? (
          <Tag style={{ fontSize: '11px' }}>
            {context}
          </Tag>
        ) : null
      )
    },
    {
      title: 'Message',
      dataIndex: 'message',
      key: 'message',
      ellipsis: { showTitle: false },
      render: (message: string) => (
        <Tooltip title={message}>
          <Text>{message}</Text>
        </Tooltip>
      )
    },
    {
      title: 'Data',
      dataIndex: 'data',
      key: 'data',
      width: 80,
      render: (data: any) => (
        data ? (
          <Tooltip title={<pre style={{ maxHeight: '300px', overflow: 'auto' }}>{JSON.stringify(data, null, 2)}</pre>}>
            <Button size="small" icon={<EyeOutlined />} />
          </Tooltip>
        ) : null
      )
    }
  ];

  return (
    <div>
      {/* Statistics */}
      {showStats && logStats && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={4}>
            <Statistic 
              title="Total Entries" 
              value={logStats.totalEntries}
            />
          </Col>
          <Col span={4}>
            <Statistic 
              title="Errors" 
              value={logStats.errorCount}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Col>
          <Col span={4}>
            <Statistic 
              title="Warnings" 
              value={logStats.warningCount}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Col>
          <Col span={4}>
            <Statistic 
              title="Info" 
              value={logStats.infoCount}
              valueStyle={{ color: '#1890ff' }}
            />
          </Col>
          <Col span={4}>
            <Statistic 
              title="Debug" 
              value={logStats.debugCount}
              valueStyle={{ color: '#722ed1' }}
            />
          </Col>
          <Col span={4}>
            <Statistic 
              title="File Size" 
              value={Math.round(logStats.fileSize / 1024)}
              suffix="KB"
            />
          </Col>
        </Row>
      )}

      {/* Controls */}
      {showControls && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Row gutter={16} align="middle">
            <Col span={6}>
              <Search
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                allowClear
                prefix={<SearchOutlined />}
              />
            </Col>
            <Col span={3}>
              <Select
                value={selectedLogLevel}
                onChange={setSelectedLogLevel}
                style={{ width: '100%' }}
                placeholder="Level"
              >
                <Option value="all">All Levels</Option>
                <Option value="error">Error</Option>
                <Option value="warn">Warning</Option>
                <Option value="info">Info</Option>
                <Option value="debug">Debug</Option>
                <Option value="trace">Trace</Option>
              </Select>
            </Col>
            <Col span={3}>
              <Select
                value={selectedContext}
                onChange={setSelectedContext}
                style={{ width: '100%' }}
                placeholder="Context"
              >
                <Option value="all">All Contexts</Option>
                {getUniqueContexts().map(context => (
                  <Option key={context} value={context}>{context}</Option>
                ))}
              </Select>
            </Col>
            <Col span={6}>
              <RangePicker
                showTime
                value={dateRange as any}
                onChange={(dates) => setDateRange(dates as any)}
                style={{ width: '100%' }}
              />
            </Col>
            <Col span={6}>
              <Space>
                <Tooltip title="Real-time updates">
                  <Switch 
                    checked={realTimeEnabled}
                    onChange={handleRealTimeToggle}
                    checkedChildren="Live"
                    unCheckedChildren="Static"
                  />
                </Tooltip>
                <Tooltip title="Auto-scroll to bottom">
                  <Switch 
                    checked={autoScroll}
                    onChange={setAutoScroll}
                    checkedChildren="Scroll"
                    unCheckedChildren="Fixed"
                  />
                </Tooltip>
                <Button 
                  icon={<ReloadOutlined />}
                  onClick={loadLogs}
                  loading={loading}
                  size="small"
                />
                <Button 
                  icon={<ClearOutlined />}
                  onClick={handleClearLogs}
                  size="small"
                />
                <Button 
                  icon={<DownloadOutlined />}
                  onClick={handleExportLogs}
                  size="small"
                />
              </Space>
            </Col>
          </Row>
        </Card>
      )}

      {/* Log Table */}
      <Card>
        <Spin spinning={loading}>
          {filteredLogs.length > 0 ? (
            <Table
              columns={columns}
              dataSource={filteredLogs}
              rowKey={(record) => `${record.timestamp}-${record.message}`}
              size="small"
              scroll={{ y: height - 200 }}
              pagination={{
                pageSize: 100,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => 
                  `${range[0]}-${range[1]} of ${total} logs`,
                pageSizeOptions: ['50', '100', '200', '500']
              }}
              rowClassName={(record) => {
                switch (record.level) {
                  case 'error': return 'log-row-error';
                  case 'warn': return 'log-row-warning';
                  default: return '';
                }
              }}
            />
          ) : (
            <Empty 
              description="No logs available"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )}
        </Spin>
        <div ref={logsEndRef} />
      </Card>

      <style>{`
        .log-row-error {
          background-color: #fff2f0;
        }
        .log-row-warning {
          background-color: #fffbe6;
        }
      `}</style>
    </div>
  );
};

export default LogViewer;