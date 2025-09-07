import React from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  Tag,
  Space,
  Descriptions,
  List,
  Progress,
  Alert,
  Divider,
  Button,
  Tooltip
} from 'antd';
import {
  RobotOutlined,
  BulbOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  PlayCircleOutlined,
  SearchOutlined,
  FormOutlined,
  DatabaseOutlined,
  GlobalOutlined,
  EyeOutlined,
  ExperimentOutlined,
  CaretRightOutlined
} from '@ant-design/icons';
import { motion } from 'framer-motion';

const { Title, Text, Paragraph } = Typography;

interface AIAnalysisDisplayProps {
  parsedCommand: any;
  executionPlan: any;
  onExport?: (format: 'pdf' | 'excel' | 'csv' | 'json') => void;
}

const AIAnalysisDisplay: React.FC<AIAnalysisDisplayProps> = ({ 
  parsedCommand, 
  executionPlan, 
  onExport 
}) => {
  const getIntentIcon = (type: string) => {
    const icons: Record<string, React.ReactNode> = {
      search: <SearchOutlined />,
      form_fill: <FormOutlined />,
      data_extract: <DatabaseOutlined />,
      navigate: <GlobalOutlined />,
      monitor: <EyeOutlined />,
      research: <ExperimentOutlined />
    };
    return icons[type] || <BulbOutlined />;
  };

  const getIntentColor = (type: string) => {
    const colors: Record<string, string> = {
      search: 'blue',
      form_fill: 'orange',
      data_extract: 'green',
      navigate: 'purple',
      monitor: 'cyan',
      research: 'magenta'
    };
    return colors[type] || 'default';
  };

  const getComplexityColor = (complexity: string) => {
    const colors: Record<string, string> = {
      simple: 'green',
      medium: 'orange',
      complex: 'red'
    };
    return colors[complexity] || 'default';
  };

  const getActionIcon = (type: string) => {
    const icons: Record<string, React.ReactNode> = {
      navigate: <GlobalOutlined />,
      click: <CaretRightOutlined />,
      type: <FormOutlined />,
      extract: <DatabaseOutlined />,
      wait: <CheckCircleOutlined />,
      screenshot: <EyeOutlined />
    };
    return icons[type] || <PlayCircleOutlined />;
  };

  return (
    <div className="ai-analysis-display">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header */}
        <Card className="glass-card" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <RobotOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
              <Title level={3} style={{ color: 'white', margin: 0 }}>
                AI Command Analysis
              </Title>
            </Space>
            
            {onExport && (
              <Space>
                <Button onClick={() => onExport('json')} size="small">
                  Export JSON
                </Button>
                <Button onClick={() => onExport('pdf')} size="small" type="primary">
                  Export PDF
                </Button>
              </Space>
            )}
          </div>
        </Card>

        <Row gutter={[16, 16]}>
          {/* Intent Analysis */}
          <Col xs={24} lg={12}>
            <Card className="glass-card">
              <Title level={4} style={{ color: 'white', marginBottom: '16px' }}>
                <BulbOutlined style={{ marginRight: '8px' }} />
                Intent Analysis
              </Title>
              
              <Space direction="vertical" style={{ width: '100%' }} size="large">
                <div>
                  <Space>
                    {getIntentIcon(parsedCommand.parsedIntent.type)}
                    <Tag 
                      color={getIntentColor(parsedCommand.parsedIntent.type)} 
                      style={{ fontSize: '14px', padding: '4px 12px' }}
                    >
                      {parsedCommand.parsedIntent.type.replace('_', ' ').toUpperCase()}
                    </Tag>
                    <Tag 
                      color={getComplexityColor(parsedCommand.parsedIntent.complexity)}
                      style={{ fontSize: '12px' }}
                    >
                      {parsedCommand.parsedIntent.complexity.toUpperCase()}
                    </Tag>
                  </Space>
                </div>

                <div>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.8)', display: 'block', marginBottom: '8px' }}>
                    Description:
                  </Text>
                  <Paragraph style={{ color: 'white', margin: 0 }}>
                    {parsedCommand.parsedIntent.description}
                  </Paragraph>
                </div>

                <div>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.8)', display: 'block', marginBottom: '8px' }}>
                    Confidence Level:
                  </Text>
                  <Progress
                    percent={Math.round(parsedCommand.confidence * 100)}
                    strokeColor={
                      parsedCommand.confidence > 0.8 ? '#52c41a' : 
                      parsedCommand.confidence > 0.6 ? '#faad14' : '#ff4d4f'
                    }
                    format={(percent) => `${percent}% Confident`}
                  />
                </div>
              </Space>
            </Card>
          </Col>

          {/* Parameters */}
          <Col xs={24} lg={12}>
            <Card className="glass-card">
              <Title level={4} style={{ color: 'white', marginBottom: '16px' }}>
                <InfoCircleOutlined style={{ marginRight: '8px' }} />
                Extracted Parameters
              </Title>

              <Descriptions bordered size="small" column={1}>
                {parsedCommand.parameters.urls && parsedCommand.parameters.urls.length > 0 && (
                  <Descriptions.Item 
                    label={<span style={{ color: 'rgba(255,255,255,0.8)' }}>URLs</span>}
                  >
                    <div>
                      {parsedCommand.parameters.urls.map((url: string, index: number) => (
                        <Tag key={index} color="blue" style={{ margin: '2px' }}>
                          {url}
                        </Tag>
                      ))}
                    </div>
                  </Descriptions.Item>
                )}

                {parsedCommand.parameters.searchTerms && parsedCommand.parameters.searchTerms.length > 0 && (
                  <Descriptions.Item 
                    label={<span style={{ color: 'rgba(255,255,255,0.8)' }}>Search Terms</span>}
                  >
                    <div>
                      {parsedCommand.parameters.searchTerms.map((term: string, index: number) => (
                        <Tag key={index} color="green" style={{ margin: '2px' }}>
                          {term}
                        </Tag>
                      ))}
                    </div>
                  </Descriptions.Item>
                )}

                {parsedCommand.parameters.extractionTargets && parsedCommand.parameters.extractionTargets.length > 0 && (
                  <Descriptions.Item 
                    label={<span style={{ color: 'rgba(255,255,255,0.8)' }}>Extraction Targets</span>}
                  >
                    <div>
                      {parsedCommand.parameters.extractionTargets.map((target: string, index: number) => (
                        <Tag key={index} color="purple" style={{ margin: '2px' }}>
                          {target}
                        </Tag>
                      ))}
                    </div>
                  </Descriptions.Item>
                )}

                {parsedCommand.parameters.formData && Object.keys(parsedCommand.parameters.formData).length > 0 && (
                  <Descriptions.Item 
                    label={<span style={{ color: 'rgba(255,255,255,0.8)' }}>Form Data</span>}
                  >
                    <div>
                      {Object.entries(parsedCommand.parameters.formData).map(([key, value], index) => (
                        <div key={index} style={{ marginBottom: '4px' }}>
                          <Text style={{ color: 'rgba(255,255,255,0.6)' }}>{key}:</Text>
                          <Text style={{ color: 'white', marginLeft: '8px' }}>{String(value)}</Text>
                        </div>
                      ))}
                    </div>
                  </Descriptions.Item>
                )}

                {parsedCommand.parameters.filters && parsedCommand.parameters.filters.length > 0 && (
                  <Descriptions.Item 
                    label={<span style={{ color: 'rgba(255,255,255,0.8)' }}>Filters</span>}
                  >
                    <div>
                      {parsedCommand.parameters.filters.map((filter: any, index: number) => (
                        <Tag key={index} color="orange" style={{ margin: '2px' }}>
                          {filter.field} {filter.operator} {filter.value}
                        </Tag>
                      ))}
                    </div>
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>
          </Col>

          {/* Suggested Actions */}
          <Col span={24}>
            <Card className="glass-card">
              <Title level={4} style={{ color: 'white', marginBottom: '16px' }}>
                <ThunderboltOutlined style={{ marginRight: '8px' }} />
                AI-Generated Action Plan
              </Title>

              {parsedCommand.suggestedActions && parsedCommand.suggestedActions.length > 0 ? (
                <List
                  dataSource={parsedCommand.suggestedActions}
                  renderItem={(action: any, index: number) => (
                    <List.Item
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        margin: '8px 0',
                        padding: '16px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.1)'
                      }}
                    >
                      <List.Item.Meta
                        avatar={
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white'
                          }}>
                            {getActionIcon(action.type)}
                          </div>
                        }
                        title={
                          <Space>
                            <Text style={{ color: 'white', fontWeight: 'bold' }}>
                              Step {index + 1}: {action.type.replace('_', ' ').toUpperCase()}
                            </Text>
                            <Tag color="blue">
                              ID: {action.id}
                            </Tag>
                          </Space>
                        }
                        description={
                          <div>
                            <Space direction="vertical" style={{ width: '100%' }}>
                              <div>
                                <Text style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                                  Target: <code style={{ color: '#1890ff' }}>{action.target?.css || 'N/A'}</code>
                                </Text>
                              </div>
                              
                              {action.value && (
                                <div>
                                  <Text style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                                    Value: <Text style={{ color: 'white' }}>{action.value}</Text>
                                  </Text>
                                </div>
                              )}
                              
                              <div>
                                <Space>
                                  <Tooltip title="Timeout">
                                    <Tag color="orange">
                                      ⏱️ {action.timeout || 5000}ms
                                    </Tag>
                                  </Tooltip>
                                  <Tooltip title="Retry Count">
                                    <Tag color="purple">
                                      🔄 {action.retryCount || 3} retries
                                    </Tag>
                                  </Tooltip>
                                </Space>
                              </div>
                            </Space>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <Alert
                  message="No specific actions suggested"
                  description="The AI didn't generate specific automation steps for this command."
                  type="info"
                  showIcon
                />
              )}
            </Card>
          </Col>

          {/* AI Provider Info */}
          <Col span={24}>
            <Card className="glass-card">
              <Title level={4} style={{ color: 'white', marginBottom: '16px' }}>
                <RobotOutlined style={{ marginRight: '8px' }} />
                AI Analysis Details
              </Title>

              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} md={6}>
                  <div style={{ textAlign: 'center' }}>
                    <Text style={{ color: 'rgba(255, 255, 255, 0.6)', display: 'block' }}>
                      AI Provider
                    </Text>
                    <Text style={{ color: 'white', fontSize: '16px', fontWeight: 'bold' }}>
                      {parsedCommand.aiProvider || 'OpenAI'}
                    </Text>
                  </div>
                </Col>
                
                <Col xs={24} sm={12} md={6}>
                  <div style={{ textAlign: 'center' }}>
                    <Text style={{ color: 'rgba(255, 255, 255, 0.6)', display: 'block' }}>
                      Analysis Time
                    </Text>
                    <Text style={{ color: 'white', fontSize: '16px', fontWeight: 'bold' }}>
                      {new Date(parsedCommand.timestamp).toLocaleTimeString()}
                    </Text>
                  </div>
                </Col>
                
                <Col xs={24} sm={12} md={6}>
                  <div style={{ textAlign: 'center' }}>
                    <Text style={{ color: 'rgba(255, 255, 255, 0.6)', display: 'block' }}>
                      Confidence Score
                    </Text>
                    <Text style={{ 
                      color: parsedCommand.confidence > 0.8 ? '#52c41a' : 
                             parsedCommand.confidence > 0.6 ? '#faad14' : '#ff4d4f',
                      fontSize: '16px', 
                      fontWeight: 'bold' 
                    }}>
                      {Math.round(parsedCommand.confidence * 100)}%
                    </Text>
                  </div>
                </Col>
                
                <Col xs={24} sm={12} md={6}>
                  <div style={{ textAlign: 'center' }}>
                    <Text style={{ color: 'rgba(255, 255, 255, 0.6)', display: 'block' }}>
                      Actions Generated
                    </Text>
                    <Text style={{ color: 'white', fontSize: '16px', fontWeight: 'bold' }}>
                      {parsedCommand.suggestedActions?.length || 0}
                    </Text>
                  </div>
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>
      </motion.div>
    </div>
  );
};

export default AIAnalysisDisplay;