import React, { useState, useMemo } from 'react';
import {
  Card,
  Table,
  Row,
  Col,
  Button,
  Input,
  Select,
  Space,
  Tag,
  Typography,
  Image,
  Collapse,
  Statistic,
  Tooltip,
  Modal,
  Tabs,
  List,
  Progress,
  Empty,
  Divider,
  Badge,
  DatePicker,
  Slider,
  Switch,
  Timeline,
  Alert,
  Descriptions,
  Rate
} from 'antd';
import {
  TableOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  SearchOutlined,
  FilterOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined,
  EyeOutlined,
  DownloadOutlined,
  ExpandOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  LinkOutlined,
  FileTextOutlined,
  PictureOutlined,
  InfoCircleOutlined,
  CalendarOutlined,
  GlobalOutlined,
  CodeOutlined,
  SettingOutlined,
  StarOutlined,
  ThunderboltOutlined,
  BugOutlined,
  HistoryOutlined
} from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';
import type { AutomationResult, ExtractedData } from '../../../shared/types';

const { Text, Title, Paragraph } = Typography;
const { Panel } = Collapse;
const { Option } = Select;
const { TabPane } = Tabs;

interface ResultsDisplayProps {
  result: AutomationResult;
  onExport?: (format: 'pdf' | 'excel' | 'csv' | 'json') => void;
}

type ViewMode = 'table' | 'cards' | 'charts';
type SortField = 'timestamp' | 'confidence' | 'type' | 'source';
type SortOrder = 'asc' | 'desc';

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ result, onExport }) => {
  // Early return if result is not provided
  if (!result) {
    return (
      <Card className="glass-card">
        <Empty
          description={
            <Text style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
              No results available
            </Text>
          }
        />
      </Card>
    );
  }

  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedData, setSelectedData] = useState<ExtractedData | null>(null);
  const [screenshotModalVisible, setScreenshotModalVisible] = useState(false);
  const [selectedScreenshot, setSelectedScreenshot] = useState<string>('');
  
  // Advanced filtering states
  const [confidenceRange, setConfidenceRange] = useState<[number, number]>([0, 100]);
  const [dateRange, setDateRange] = useState<[any, any] | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  
  // Expandable sections states
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    summary: true,
    filters: false,
    metadata: false,
    errors: false
  });

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    // Ensure extractedData exists and is an array
    let filtered = result?.extractedData || [];

    // Apply search filter
    if (searchTerm && filtered.length > 0) {
      filtered = filtered.filter(item =>
        JSON.stringify(item.content).toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.source.url.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.type.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply type filter
    if (filterType !== 'all' && filtered.length > 0) {
      filtered = filtered.filter(item => item.type === filterType);
    }

    // Apply confidence range filter
    if (filtered.length > 0) {
      filtered = filtered.filter(item => {
        const confidencePercent = item.confidence * 100;
        return confidencePercent >= confidenceRange[0] && confidencePercent <= confidenceRange[1];
      });
    }

    // Apply date range filter
    if (dateRange && dateRange[0] && dateRange[1] && filtered.length > 0) {
      filtered = filtered.filter(item => {
        const itemDate = new Date(item.source.timestamp);
        return itemDate >= dateRange[0].toDate() && itemDate <= dateRange[1].toDate();
      });
    }

    // Apply source filter
    if (selectedSources && selectedSources.length > 0 && filtered.length > 0) {
      filtered = filtered.filter(item => {
        try {
          const hostname = new URL(item.source.url).hostname;
          return selectedSources.includes(hostname);
        } catch {
          // If URL is invalid, include it if 'invalid-url' is selected
          return selectedSources.includes('invalid-url');
        }
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortField) {
        case 'timestamp':
          aValue = new Date(a.source.timestamp).getTime();
          bValue = new Date(b.source.timestamp).getTime();
          break;
        case 'confidence':
          aValue = a.confidence;
          bValue = b.confidence;
          break;
        case 'type':
          aValue = a.type;
          bValue = b.type;
          break;
        case 'source':
          aValue = a.source.url;
          bValue = b.source.url;
          break;
        default:
          return 0;
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [result?.extractedData, searchTerm, filterType, sortField, sortOrder, confidenceRange, dateRange, selectedSources]);

  // Get unique data types for filter
  const dataTypes = useMemo(() => {
    const extractedData = result?.extractedData || [];
    const types = [...new Set(extractedData.map(item => item.type))];
    return types;
  }, [result?.extractedData]);

  // Get unique sources for filter
  const uniqueSources = useMemo(() => {
    const extractedData = result?.extractedData || [];
    const sources = [...new Set(extractedData.map(item => {
      try {
        return new URL(item.source.url).hostname;
      } catch {
        return 'invalid-url';
      }
    }))];
    return sources;
  }, [result?.extractedData]);

  // Convert screenshots to base64 URLs
  const screenshotUrls = useMemo(() => {
    if (!result?.screenshots) return [];
    
    return (result.screenshots as any[]).map((screenshot: any, index: number) => {
      try {
        // Handle different screenshot formats
        if (typeof screenshot === 'string') {
          // Already a base64 data URL
          return screenshot.startsWith('data:') ? screenshot : `data:image/png;base64,${screenshot}`;
        } else if (screenshot && typeof screenshot === 'object') {
          // Buffer-like object
          if (screenshot.type === 'Buffer' && screenshot.data) {
            // Node.js Buffer serialized as JSON
            const buffer = Buffer.from(screenshot.data);
            return `data:image/png;base64,${buffer.toString('base64')}`;
          } else if (screenshot.toString) {
            // Direct Buffer object
            return `data:image/png;base64,${screenshot.toString('base64')}`;
          }
        }
        return '';
      } catch (error) {
        console.warn(`Failed to process screenshot ${index}:`, error);
        return '';
      }
    }).filter(url => url.length > 0);
  }, [result?.screenshots]);

  // Statistics
  const stats = useMemo(() => {
    const extractedData = result?.extractedData || [];
    const totalItems = extractedData.length;
    const successRate = result?.success ? 100 : 0;
    const avgConfidence = totalItems > 0 
      ? extractedData.reduce((sum, item) => sum + item.confidence, 0) / totalItems 
      : 0;
    const typeDistribution = extractedData.reduce((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalItems,
      successRate,
      avgConfidence: Math.round(avgConfidence * 100),
      typeDistribution,
      duration: Math.round((result?.duration || 0) / 1000),
      errorCount: (result?.errors || []).length
    };
  }, [result]);

  const renderTableView = () => {
    const columns = [
      {
        title: 'Type',
        dataIndex: 'type',
        key: 'type',
        render: (type: string) => (
          <Tag color={getTypeColor(type)}>{type.toUpperCase()}</Tag>
        ),
        filters: dataTypes.map(type => ({ text: type.toUpperCase(), value: type })),
        onFilter: (value: any, record: ExtractedData) => record.type === value,
      },
      {
        title: 'Content Preview',
        dataIndex: 'content',
        key: 'content',
        render: (content: any) => (
          <Text style={{ color: 'white' }}>
            {typeof content === 'string' 
              ? content.substring(0, 100) + (content.length > 100 ? '...' : '')
              : JSON.stringify(content).substring(0, 100) + '...'
            }
          </Text>
        ),
      },
      {
        title: 'Source',
        dataIndex: ['source', 'url'],
        key: 'source',
        render: (url: string) => {
          try {
            const hostname = new URL(url).hostname;
            return (
              <Tooltip title={url}>
                <Button 
                  type="link" 
                  icon={<LinkOutlined />}
                  style={{ color: '#1890ff', padding: 0 }}
                  onClick={() => window.open(url, '_blank')}
                >
                  {hostname}
                </Button>
              </Tooltip>
            );
          } catch {
            return (
              <Text style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                {url.length > 30 ? `${url.substring(0, 30)}...` : url}
              </Text>
            );
          }
        },
      },
      {
        title: 'Confidence',
        dataIndex: 'confidence',
        key: 'confidence',
        render: (confidence: number) => (
          <Progress
            percent={Math.round(confidence * 100)}
            size="small"
            strokeColor={confidence > 0.8 ? '#52c41a' : confidence > 0.6 ? '#faad14' : '#ff4d4f'}
          />
        ),
        sorter: (a: ExtractedData, b: ExtractedData) => a.confidence - b.confidence,
      },
      {
        title: 'Actions',
        key: 'actions',
        render: (record: ExtractedData) => (
          <Space>
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => setSelectedData(record)}
              style={{ color: '#1890ff' }}
            />
          </Space>
        ),
      },
    ];

    return (
      <Table
        dataSource={filteredAndSortedData}
        columns={columns}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        scroll={{ x: 800 }}
        className="results-table"
      />
    );
  };

  const renderCardsView = () => {
    return (
      <Row gutter={[16, 16]}>
        {filteredAndSortedData.map((item, index) => (
          <Col xs={24} sm={12} lg={8} key={item.id}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card
                className="glass-card result-card"
                hoverable
                actions={[
                  <Button
                    key="view"
                    type="text"
                    icon={<EyeOutlined />}
                    onClick={() => setSelectedData(item)}
                    style={{ color: '#1890ff' }}
                  >
                    View Details
                  </Button>
                ]}
              >
                <div style={{ marginBottom: '12px' }}>
                  <Space>
                    <Tag color={getTypeColor(item.type)}>{item.type.toUpperCase()}</Tag>
                    <Badge
                      count={`${Math.round(item.confidence * 100)}%`}
                      style={{ 
                        backgroundColor: item.confidence > 0.8 ? '#52c41a' : 
                                       item.confidence > 0.6 ? '#faad14' : '#ff4d4f' 
                      }}
                    />
                  </Space>
                </div>
                
                <Paragraph
                  ellipsis={{ rows: 3, expandable: true }}
                  style={{ color: 'rgba(255, 255, 255, 0.9)', marginBottom: '12px' }}
                >
                  {typeof item.content === 'string' 
                    ? item.content 
                    : JSON.stringify(item.content, null, 2)
                  }
                </Paragraph>

                <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)' }}>
                  <div>
                    <LinkOutlined style={{ marginRight: '4px' }} />
                    {(() => {
                      try {
                        return new URL(item.source.url).hostname;
                      } catch {
                        return item.source.url.length > 30 ? `${item.source.url.substring(0, 30)}...` : item.source.url;
                      }
                    })()}
                  </div>
                  <div style={{ marginTop: '4px' }}>
                    <ClockCircleOutlined style={{ marginRight: '4px' }} />
                    {new Date(item.source.timestamp).toLocaleString()}
                  </div>
                </div>
              </Card>
            </motion.div>
          </Col>
        ))}
      </Row>
    );
  };

  const renderChartsView = () => {
    return (
      <Row gutter={[16, 16]}>
        {/* Summary Statistics */}
        <Col xs={24} lg={12}>
          <Card className="glass-card">
            <Title level={4} style={{ color: 'white', marginBottom: '16px' }}>
              Extraction Summary
            </Title>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Statistic
                  title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>Total Items</span>}
                  value={stats.totalItems}
                  valueStyle={{ color: 'white' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>Avg Confidence</span>}
                  value={stats.avgConfidence}
                  suffix="%"
                  valueStyle={{ color: 'white' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>Duration</span>}
                  value={stats.duration}
                  suffix="s"
                  valueStyle={{ color: 'white' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>Success Rate</span>}
                  value={stats.successRate}
                  suffix="%"
                  valueStyle={{ color: stats.successRate === 100 ? '#52c41a' : '#ff4d4f' }}
                />
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Data Type Distribution */}
        <Col xs={24} lg={12}>
          <Card className="glass-card">
            <Title level={4} style={{ color: 'white', marginBottom: '16px' }}>
              Data Type Distribution
            </Title>
            <div>
              {Object.entries(stats.typeDistribution).map(([type, count]) => (
                <div key={type} style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <Text style={{ color: 'white' }}>{type.toUpperCase()}</Text>
                    <Text style={{ color: 'white' }}>{count}</Text>
                  </div>
                  <Progress
                    percent={Math.round((count / stats.totalItems) * 100)}
                    strokeColor={getTypeColor(type)}
                    showInfo={false}
                  />
                </div>
              ))}
            </div>
          </Card>
        </Col>

        {/* Confidence Distribution */}
        <Col span={24}>
          <Card className="glass-card">
            <Title level={4} style={{ color: 'white', marginBottom: '16px' }}>
              Confidence Distribution
            </Title>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {['High (80-100%)', 'Medium (60-80%)', 'Low (0-60%)'].map((range, index) => {
                const [min, max] = index === 0 ? [0.8, 1] : index === 1 ? [0.6, 0.8] : [0, 0.6];
                const count = filteredAndSortedData.filter(item => 
                  item.confidence >= min && item.confidence < (index === 0 ? 1.1 : max)
                ).length;
                const percentage = stats.totalItems > 0 ? Math.round((count / stats.totalItems) * 100) : 0;
                
                return (
                  <div key={range} style={{ flex: 1, minWidth: '200px' }}>
                    <Text style={{ color: 'rgba(255, 255, 255, 0.8)' }}>{range}</Text>
                    <Progress
                      percent={percentage}
                      strokeColor={index === 0 ? '#52c41a' : index === 1 ? '#faad14' : '#ff4d4f'}
                      format={() => `${count} items`}
                    />
                  </div>
                );
              })}
            </div>
          </Card>
        </Col>
      </Row>
    );
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      text: 'blue',
      table: 'green',
      form: 'orange',
      image: 'purple',
      link: 'cyan',
      structured: 'magenta'
    };
    return colors[type] || 'default';
  };

  return (
    <div className="results-display">
      {/* Expandable Summary Section */}
      <Collapse 
        className="glass-card" 
        style={{ marginBottom: '16px' }}
        activeKey={Object.keys(expandedSections).filter(key => expandedSections[key])}
        onChange={(keys) => {
          const newExpanded = { ...expandedSections };
          Object.keys(newExpanded).forEach(key => {
            newExpanded[key] = Array.isArray(keys) ? keys.includes(key) : keys === key;
          });
          setExpandedSections(newExpanded);
        }}
      >
        <Panel 
          header={
            <Space>
              <InfoCircleOutlined />
              <Text style={{ color: 'white', fontWeight: 'bold' }}>Automation Summary</Text>
              <Badge count={stats.totalItems} style={{ backgroundColor: '#1890ff' }} />
            </Space>
          } 
          key="summary"
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>Command</span>}
                value={result?.command || ''}
                valueStyle={{ color: 'white', fontSize: '14px' }}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>Intent</span>}
                value={(result?.intent?.type || '').replace('_', ' ').toUpperCase()}
                valueStyle={{ color: 'white', fontSize: '14px' }}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>Complexity</span>}
                value={(result?.intent?.complexity || '').toUpperCase()}
                valueStyle={{ 
                  color: result?.intent?.complexity === 'simple' ? '#52c41a' : 
                         result?.intent?.complexity === 'medium' ? '#faad14' : '#ff4d4f',
                  fontSize: '14px'
                }}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>Status</span>}
                value={result?.success ? 'SUCCESS' : 'FAILED'}
                valueStyle={{ 
                  color: result?.success ? '#52c41a' : '#ff4d4f',
                  fontSize: '14px'
                }}
              />
            </Col>
          </Row>
        </Panel>

        <Panel 
          header={
            <Space>
              <FilterOutlined />
              <Text style={{ color: 'white', fontWeight: 'bold' }}>Advanced Filters</Text>
              <Switch 
                size="small" 
                checked={showAdvancedFilters}
                onChange={setShowAdvancedFilters}
              />
            </Space>
          } 
          key="filters"
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={8}>
              <Text style={{ color: 'rgba(255, 255, 255, 0.8)', display: 'block', marginBottom: '8px' }}>
                Confidence Range: {confidenceRange[0]}% - {confidenceRange[1]}%
              </Text>
              <Slider
                range
                min={0}
                max={100}
                value={confidenceRange}
                onChange={(value) => setConfidenceRange(value as [number, number])}
                marks={{
                  0: '0%',
                  50: '50%',
                  100: '100%'
                }}
              />
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Text style={{ color: 'rgba(255, 255, 255, 0.8)', display: 'block', marginBottom: '8px' }}>
                Date Range
              </Text>
              <DatePicker.RangePicker
                value={dateRange}
                onChange={setDateRange}
                style={{ width: '100%' }}
              />
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Text style={{ color: 'rgba(255, 255, 255, 0.8)', display: 'block', marginBottom: '8px' }}>
                Sources
              </Text>
              <Select
                mode="multiple"
                placeholder="Select sources"
                value={selectedSources}
                onChange={setSelectedSources}
                style={{ width: '100%' }}
              >
                {uniqueSources.map(source => (
                  <Option key={source} value={source}>{source}</Option>
                ))}
              </Select>
            </Col>
          </Row>
        </Panel>

        <Panel 
          header={
            <Space>
              <SettingOutlined />
              <Text style={{ color: 'white', fontWeight: 'bold' }}>Execution Metadata</Text>
              <Badge count={result?.metadata?.totalSteps || 0} style={{ backgroundColor: '#722ed1' }} />
            </Space>
          } 
          key="metadata"
        >
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item 
              label={<span style={{ color: 'rgba(255,255,255,0.8)' }}>Browser Version</span>}
            >
              <Text style={{ color: 'white' }}>{result?.metadata?.browserVersion || 'N/A'}</Text>
            </Descriptions.Item>
            <Descriptions.Item 
              label={<span style={{ color: 'rgba(255,255,255,0.8)' }}>User Agent</span>}
            >
              <Text style={{ color: 'white', fontSize: '12px' }}>
                {result?.metadata?.userAgent ? `${result.metadata.userAgent.substring(0, 50)}...` : 'N/A'}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item 
              label={<span style={{ color: 'rgba(255,255,255,0.8)' }}>Viewport</span>}
            >
              <Text style={{ color: 'white' }}>
                {result?.metadata?.viewport ? `${result.metadata.viewport.width} × ${result.metadata.viewport.height}` : 'N/A'}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item 
              label={<span style={{ color: 'rgba(255,255,255,0.8)' }}>Total Steps</span>}
            >
              <Text style={{ color: 'white' }}>{result?.metadata?.totalSteps || 0}</Text>
            </Descriptions.Item>
            <Descriptions.Item 
              label={<span style={{ color: 'rgba(255,255,255,0.8)' }}>Successful Steps</span>}
            >
              <Text style={{ color: '#52c41a' }}>{result?.metadata?.successfulSteps || 0}</Text>
            </Descriptions.Item>
            <Descriptions.Item 
              label={<span style={{ color: 'rgba(255,255,255,0.8)' }}>Failed Steps</span>}
            >
              <Text style={{ color: '#ff4d4f' }}>{result?.metadata?.failedSteps || 0}</Text>
            </Descriptions.Item>
          </Descriptions>
        </Panel>

        {(result?.errors && result.errors.length > 0) && (
          <Panel 
            header={
              <Space>
                <BugOutlined />
                <Text style={{ color: 'white', fontWeight: 'bold' }}>Errors & Issues</Text>
                <Badge count={result?.errors?.length || 0} style={{ backgroundColor: '#ff4d4f' }} />
              </Space>
            } 
            key="errors"
          >
            <Timeline>
              {(result?.errors || []).map((error, index) => (
                <Timeline.Item
                  key={error.id}
                  color={error.type === 'timeout' ? 'orange' : 'red'}
                  dot={<ExclamationCircleOutlined />}
                >
                  <div>
                    <Text style={{ color: 'white', fontWeight: 'bold' }}>
                      {error.type.replace('_', ' ').toUpperCase()}
                    </Text>
                    <br />
                    <Text style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                      {error.message}
                    </Text>
                    <br />
                    <Text style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px' }}>
                      {new Date(error.timestamp).toLocaleString()}
                    </Text>
                  </div>
                </Timeline.Item>
              ))}
            </Timeline>
          </Panel>
        )}
      </Collapse>

      {/* Header with controls */}
      <Card className="glass-card" style={{ marginBottom: '16px' }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={8}>
            <Space>
              <Text style={{ color: 'white', fontWeight: 'bold' }}>View Mode:</Text>
              <Button.Group>
                <Button
                  type={viewMode === 'table' ? 'primary' : 'default'}
                  icon={<TableOutlined />}
                  onClick={() => setViewMode('table')}
                >
                  Table
                </Button>
                <Button
                  type={viewMode === 'cards' ? 'primary' : 'default'}
                  icon={<AppstoreOutlined />}
                  onClick={() => setViewMode('cards')}
                >
                  Cards
                </Button>
                <Button
                  type={viewMode === 'charts' ? 'primary' : 'default'}
                  icon={<BarChartOutlined />}
                  onClick={() => setViewMode('charts')}
                >
                  Charts
                </Button>
              </Button.Group>
            </Space>
          </Col>

          <Col xs={24} sm={12} md={8}>
            <Input
              placeholder="Search results..."
              prefix={<SearchOutlined />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                color: 'white'
              }}
            />
          </Col>

          <Col xs={24} sm={24} md={8}>
            <Space>
              <Select
                value={filterType}
                onChange={setFilterType}
                style={{ width: 120 }}
                placeholder="Filter by type"
              >
                <Option value="all">All Types</Option>
                {dataTypes.map(type => (
                  <Option key={type} value={type}>{type.toUpperCase()}</Option>
                ))}
              </Select>

              <Select
                value={`${sortField}-${sortOrder}`}
                onChange={(value) => {
                  const [field, order] = value.split('-');
                  setSortField(field as SortField);
                  setSortOrder(order as SortOrder);
                }}
                style={{ width: 140 }}
              >
                <Option value="timestamp-desc">Latest First</Option>
                <Option value="timestamp-asc">Oldest First</Option>
                <Option value="confidence-desc">High Confidence</Option>
                <Option value="confidence-asc">Low Confidence</Option>
                <Option value="type-asc">Type A-Z</Option>
                <Option value="type-desc">Type Z-A</Option>
              </Select>
            </Space>
          </Col>
        </Row>

        {/* Quick Stats Bar */}
        <Divider style={{ borderColor: 'rgba(255, 255, 255, 0.2)', margin: '16px 0' }} />
        <Row gutter={[16, 8]}>
          <Col xs={12} sm={6}>
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>Showing</span>}
              value={filteredAndSortedData.length}
              suffix={`of ${stats.totalItems}`}
              valueStyle={{ color: 'white', fontSize: '16px' }}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>Avg Confidence</span>}
              value={filteredAndSortedData.length > 0 
                ? Math.round(filteredAndSortedData.reduce((sum, item) => sum + item.confidence, 0) / filteredAndSortedData.length * 100)
                : 0
              }
              suffix="%"
              valueStyle={{ color: 'white', fontSize: '16px' }}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>Duration</span>}
              value={stats.duration}
              suffix="s"
              valueStyle={{ color: 'white', fontSize: '16px' }}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>Screenshots</span>}
              value={screenshotUrls.length}
              valueStyle={{ color: 'white', fontSize: '16px' }}
            />
          </Col>
        </Row>
      </Card>

      {/* Results content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={viewMode}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          {filteredAndSortedData.length === 0 ? (
            <Card className="glass-card">
              <Empty
                description={
                  <Text style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                    No results found matching your criteria
                  </Text>
                }
              />
            </Card>
          ) : (
            <>
              {viewMode === 'table' && renderTableView()}
              {viewMode === 'cards' && renderCardsView()}
              {viewMode === 'charts' && renderChartsView()}
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Enhanced Screenshots Gallery */}
      {screenshotUrls.length > 0 && (
        <Card className="glass-card" style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <Title level={4} style={{ color: 'white', margin: 0 }}>
              <PictureOutlined style={{ marginRight: '8px' }} />
              Screenshots Gallery
            </Title>
            <Space>
              <Badge count={screenshotUrls.length} style={{ backgroundColor: '#722ed1' }} />
              <Text style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px' }}>
                Captured during automation
              </Text>
            </Space>
          </div>
          
          <div className="screenshot-gallery">
            {screenshotUrls.map((url, index) => (
              <motion.div
                key={index}
                className="screenshot-item"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <div style={{ position: 'relative' }}>
                  <Image
                    width={180}
                    height={120}
                    src={url}
                    style={{ 
                      objectFit: 'cover', 
                      borderRadius: '8px',
                      cursor: 'pointer'
                    }}
                    preview={{
                      mask: (
                        <div className="screenshot-overlay">
                          <Space direction="vertical" align="center">
                            <EyeOutlined style={{ fontSize: '24px', color: 'white' }} />
                            <Text style={{ color: 'white', fontSize: '12px' }}>
                              Step {index + 1}
                            </Text>
                          </Space>
                        </div>
                      )
                    }}
                  />
                  <div style={{
                    position: 'absolute',
                    bottom: '4px',
                    left: '4px',
                    right: '4px',
                    background: 'rgba(0, 0, 0, 0.7)',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    backdropFilter: 'blur(4px)'
                  }}>
                    <Text style={{ color: 'white', fontSize: '11px' }}>
                      Screenshot {index + 1}
                    </Text>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          
          {screenshotUrls.length > 6 && (
            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <Button
                type="link"
                icon={<ExpandOutlined />}
                style={{ color: '#1890ff' }}
                onClick={() => {
                  // Open all screenshots in a modal gallery
                  Modal.info({
                    title: 'All Screenshots',
                    width: '90%',
                    content: (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                        {screenshotUrls.map((url, index) => (
                          <Image key={index} src={url} style={{ borderRadius: '8px' }} />
                        ))}
                      </div>
                    ),
                    className: 'detail-modal'
                  });
                }}
              >
                View All {screenshotUrls.length} Screenshots
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Export Actions */}
      {onExport && (
        <Card className="glass-card" style={{ marginTop: '16px' }}>
          <Title level={4} style={{ color: 'white', marginBottom: '16px' }}>
            <DownloadOutlined style={{ marginRight: '8px' }} />
            Export Results
          </Title>
          <Space>
            <Button
              type="primary"
              icon={<FileTextOutlined />}
              onClick={() => onExport('pdf')}
            >
              Export PDF
            </Button>
            <Button
              icon={<TableOutlined />}
              onClick={() => onExport('excel')}
            >
              Export Excel
            </Button>
            <Button
              icon={<FileTextOutlined />}
              onClick={() => onExport('csv')}
            >
              Export CSV
            </Button>
            <Button
              icon={<FileTextOutlined />}
              onClick={() => onExport('json')}
            >
              Export JSON
            </Button>
          </Space>
        </Card>
      )}

      {/* Enhanced Detail Modal */}
      <Modal
        title={
          <Space>
            <EyeOutlined style={{ color: 'white' }} />
            <span style={{ color: 'white' }}>Data Details</span>
            {selectedData && (
              <Tag color={getTypeColor(selectedData.type)}>
                {selectedData.type.toUpperCase()}
              </Tag>
            )}
          </Space>
        }
        open={!!selectedData}
        onCancel={() => setSelectedData(null)}
        footer={null}
        width={900}
        className="detail-modal"
      >
        {selectedData && (
          <Tabs defaultActiveKey="content">
            <TabPane 
              tab={
                <Space>
                  <CodeOutlined />
                  Content
                </Space>
              } 
              key="content"
            >
              <div style={{ marginBottom: '16px' }}>
                <Space>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.8)' }}>Data Quality:</Text>
                  <Rate 
                    disabled 
                    value={Math.round(selectedData.confidence * 5)} 
                    style={{ color: '#faad14' }}
                  />
                  <Text style={{ color: 'white' }}>
                    ({Math.round(selectedData.confidence * 100)}% confidence)
                  </Text>
                </Space>
              </div>
              
              <div className="code-block" style={{ maxHeight: '400px', overflow: 'auto' }}>
                <pre style={{ color: 'white', fontSize: '14px', lineHeight: '1.5' }}>
                  {typeof selectedData.content === 'string' 
                    ? selectedData.content 
                    : JSON.stringify(selectedData.content, null, 2)
                  }
                </pre>
              </div>
              
              <div style={{ marginTop: '16px', textAlign: 'right' }}>
                <Space>
                  <Button
                    size="small"
                    icon={<FileTextOutlined />}
                    onClick={() => {
                      const content = typeof selectedData.content === 'string' 
                        ? selectedData.content 
                        : JSON.stringify(selectedData.content, null, 2);
                      navigator.clipboard.writeText(content);
                    }}
                  >
                    Copy Content
                  </Button>
                  <Button
                    size="small"
                    icon={<LinkOutlined />}
                    onClick={() => window.open(selectedData.source.url, '_blank')}
                  >
                    Open Source
                  </Button>
                </Space>
              </div>
            </TabPane>
            
            <TabPane 
              tab={
                <Space>
                  <InfoCircleOutlined />
                  Metadata
                </Space>
              } 
              key="metadata"
            >
              <Descriptions bordered size="small" column={1}>
                <Descriptions.Item 
                  label={
                    <Space>
                      <StarOutlined />
                      <span style={{ color: 'rgba(255,255,255,0.8)' }}>Data Type</span>
                    </Space>
                  }
                >
                  <Tag color={getTypeColor(selectedData.type)}>
                    {selectedData.type.toUpperCase()}
                  </Tag>
                </Descriptions.Item>
                
                <Descriptions.Item 
                  label={
                    <Space>
                      <ThunderboltOutlined />
                      <span style={{ color: 'rgba(255,255,255,0.8)' }}>Confidence Score</span>
                    </Space>
                  }
                >
                  <Space>
                    <Progress
                      percent={Math.round(selectedData.confidence * 100)}
                      size="small"
                      style={{ width: '150px' }}
                      strokeColor={
                        selectedData.confidence > 0.8 ? '#52c41a' : 
                        selectedData.confidence > 0.6 ? '#faad14' : '#ff4d4f'
                      }
                    />
                    <Text style={{ 
                      color: selectedData.confidence > 0.8 ? '#52c41a' : 
                             selectedData.confidence > 0.6 ? '#faad14' : '#ff4d4f'
                    }}>
                      {selectedData.confidence > 0.8 ? 'High' : 
                       selectedData.confidence > 0.6 ? 'Medium' : 'Low'}
                    </Text>
                  </Space>
                </Descriptions.Item>
                
                <Descriptions.Item 
                  label={
                    <Space>
                      <GlobalOutlined />
                      <span style={{ color: 'rgba(255,255,255,0.8)' }}>Source URL</span>
                    </Space>
                  }
                >
                  <Button
                    type="link"
                    onClick={() => window.open(selectedData.source.url, '_blank')}
                    style={{ color: '#1890ff', padding: 0 }}
                  >
                    {selectedData.source.url}
                  </Button>
                </Descriptions.Item>
                
                <Descriptions.Item 
                  label={
                    <Space>
                      <CodeOutlined />
                      <span style={{ color: 'rgba(255,255,255,0.8)' }}>CSS Selector</span>
                    </Space>
                  }
                >
                  <div className="code-block" style={{ padding: '8px', margin: 0 }}>
                    <Text style={{ color: 'white', fontFamily: 'monospace', fontSize: '12px' }}>
                      {selectedData.source.selector}
                    </Text>
                  </div>
                </Descriptions.Item>
                
                <Descriptions.Item 
                  label={
                    <Space>
                      <HistoryOutlined />
                      <span style={{ color: 'rgba(255,255,255,0.8)' }}>Extraction Time</span>
                    </Space>
                  }
                >
                  <Space direction="vertical" size="small">
                    <Text style={{ color: 'white' }}>
                      {new Date(selectedData.source.timestamp).toLocaleString()}
                    </Text>
                    <Text style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px' }}>
                      {new Date(selectedData.source.timestamp).toISOString()}
                    </Text>
                  </Space>
                </Descriptions.Item>
                
                <Descriptions.Item 
                  label={
                    <Space>
                      <FileTextOutlined />
                      <span style={{ color: 'rgba(255,255,255,0.8)' }}>Content Size</span>
                    </Space>
                  }
                >
                  <Text style={{ color: 'white' }}>
                    {typeof selectedData.content === 'string' 
                      ? `${selectedData.content.length} characters`
                      : `${JSON.stringify(selectedData.content).length} characters (JSON)`
                    }
                  </Text>
                </Descriptions.Item>
              </Descriptions>
            </TabPane>
            
            <TabPane 
              tab={
                <Space>
                  <SettingOutlined />
                  Actions
                </Space>
              } 
              key="actions"
            >
              <Space direction="vertical" style={{ width: '100%' }} size="large">
                <Alert
                  message="Data Actions"
                  description="Perform actions on this extracted data item"
                  type="info"
                  showIcon
                />
                
                <Row gutter={[16, 16]}>
                  <Col span={12}>
                    <Button
                      block
                      icon={<FileTextOutlined />}
                      onClick={() => {
                        const content = typeof selectedData.content === 'string' 
                          ? selectedData.content 
                          : JSON.stringify(selectedData.content, null, 2);
                        navigator.clipboard.writeText(content);
                      }}
                    >
                      Copy Content
                    </Button>
                  </Col>
                  <Col span={12}>
                    <Button
                      block
                      icon={<LinkOutlined />}
                      onClick={() => window.open(selectedData.source.url, '_blank')}
                    >
                      Open Source Page
                    </Button>
                  </Col>
                  <Col span={12}>
                    <Button
                      block
                      icon={<DownloadOutlined />}
                      onClick={() => {
                        const dataStr = JSON.stringify(selectedData, null, 2);
                        const dataBlob = new Blob([dataStr], { type: 'application/json' });
                        const url = URL.createObjectURL(dataBlob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `extracted-data-${selectedData.id}.json`;
                        link.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      Export as JSON
                    </Button>
                  </Col>
                  <Col span={12}>
                    <Button
                      block
                      icon={<CodeOutlined />}
                      onClick={() => {
                        navigator.clipboard.writeText(selectedData.source.selector);
                      }}
                    >
                      Copy Selector
                    </Button>
                  </Col>
                </Row>
              </Space>
            </TabPane>
          </Tabs>
        )}
      </Modal>
    </div>
  );
};

export default ResultsDisplay;