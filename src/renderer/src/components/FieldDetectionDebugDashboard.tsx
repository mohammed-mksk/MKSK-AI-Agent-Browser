/**
 * Field Detection Debug Dashboard
 * Created: July 30, 2025
 * 
 * Provides comprehensive debug interface for field detection development
 * Part of Task 5.5: Add debug/development mode with detailed field info
 */

import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Collapse, 
  Typography, 
  Space, 
  Table, 
  Tag, 
  Descriptions,
  Alert,
  Button,
  Switch,
  Row,
  Col,
  Statistic,
  Progress,
  Timeline,
  Divider,
  Tooltip,
  Modal
} from 'antd';
import {
  BugOutlined,
  CodeOutlined,
  EyeOutlined,
  InfoCircleOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { motion } from 'framer-motion';
import { 
  DetectedField, 
  DetectionLog, 
  PerformanceMetrics,
  FieldDetectionDebugDashboardProps 
} from '../types/fieldDetection.d';

const { Panel } = Collapse;
const { Title, Text, Paragraph } = Typography;

const FieldDetectionDebugDashboard: React.FC<FieldDetectionDebugDashboardProps> = ({
  detectedFields,
  isEnabled,
  onToggle
}) => {
  const [detectionLogs, setDetectionLogs] = useState<DetectionLog[]>([]);
  const [selectedField, setSelectedField] = useState<DetectedField | null>(null);
  const [showFieldDetails, setShowFieldDetails] = useState(false);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    detectionTime: 0,
    fieldsPerSecond: 0,
    averageConfidence: 0,
    lastDetection: Date.now()
  });

  useEffect(() => {
    if (detectedFields.length > 0) {
      const averageConfidence = detectedFields.reduce((sum, field) => sum + field.score, 0) / detectedFields.length;
      const detectionTime = Date.now() - performanceMetrics.lastDetection;
      
      setPerformanceMetrics(prev => ({
        ...prev,
        detectionTime,
        fieldsPerSecond: detectedFields.length / (detectionTime / 1000),
        averageConfidence,
        lastDetection: Date.now()
      }));

      // Add to detection logs
      const newLog: DetectionLog = {
        timestamp: Date.now(),
        event: 'Fields Detected',
        data: {
          count: detectedFields.length,
          averageConfidence,
          types: [...new Set(detectedFields.map(f => f.semantic))]
        },
        level: 'success'
      };
      
      setDetectionLogs(prev => [newLog, ...prev.slice(0, 49)]); // Keep last 50 logs
    }
  }, [detectedFields]);

  const fieldAnalysisColumns = [
    {
      title: 'Field ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => (
        <Button 
          type="link" 
          size="small"
          onClick={() => {
            setSelectedField(detectedFields.find(f => f.id === id) || null);
            setShowFieldDetails(true);
          }}
        >
          {id}
        </Button>
      )
    },
    {
      title: 'DOM Info',
      key: 'domInfo',
      render: (record: DetectedField) => (
        <Space direction="vertical" size={0}>
          {record.attributes.name && <Text code>name="{record.attributes.name}"</Text>}
          {record.attributes.id && <Text code>id="{record.attributes.id}"</Text>}
          {record.attributes.type && <Text code>type="{record.attributes.type}"</Text>}
          {record.attributes.className && <Text code>class="{record.attributes.className}"</Text>}
        </Space>
      )
    },
    {
      title: 'Detection Score',
      dataIndex: 'score',
      key: 'score',
      render: (score: number) => (
        <Space direction="vertical" size={0}>
          <Progress 
            percent={score} 
            size="small" 
            status={score >= 80 ? 'success' : score >= 60 ? 'normal' : 'exception'}
          />
          <Text type="secondary" style={{ fontSize: '11px' }}>
            {score >= 90 ? 'Very High' : score >= 70 ? 'High' : score >= 50 ? 'Medium' : 'Low'}
          </Text>
        </Space>
      )
    },
    {
      title: 'Position',
      key: 'position',
      render: (record: DetectedField) => (
        <Space direction="vertical" size={0}>
          <Text code>x: {record.rect.x}, y: {record.rect.y}</Text>
          <Text code>{record.rect.width}×{record.rect.height}</Text>
        </Space>
      )
    },
    {
      title: 'Context Analysis',
      key: 'context',
      render: (record: DetectedField) => {
        const hasLabel = !!record.context.label;
        const hasNearbyText = record.context.nearbyText && record.context.nearbyText.length > 0;
        const hasFormContext = !!record.context.formContext;
        
        return (
          <Space>
            <Tooltip title={hasLabel ? `Label: ${record.context.label}` : 'No label found'}>
              <Tag color={hasLabel ? 'green' : 'red'}>
                {hasLabel ? 'L' : '✗L'}
              </Tag>
            </Tooltip>
            <Tooltip title={hasNearbyText ? `${record.context.nearbyText?.length} nearby texts` : 'No nearby text'}>
              <Tag color={hasNearbyText ? 'green' : 'red'}>
                {hasNearbyText ? 'T' : '✗T'}
              </Tag>
            </Tooltip>
            <Tooltip title={hasFormContext ? `Form: ${record.context.formContext}` : 'No form context'}>
              <Tag color={hasFormContext ? 'green' : 'red'}>
                {hasFormContext ? 'F' : '✗F'}
              </Tag>
            </Tooltip>
          </Space>
        );
      }
    }
  ];

  const logTimelineItems = detectionLogs.slice(0, 10).map(log => ({
    dot: log.level === 'success' ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> :
         log.level === 'warning' ? <WarningOutlined style={{ color: '#faad14' }} /> :
         log.level === 'error' ? <WarningOutlined style={{ color: '#ff4d4f' }} /> :
         <InfoCircleOutlined style={{ color: '#1890ff' }} />,
    children: (
      <Space direction="vertical" size={0}>
        <Text strong>{log.event}</Text>
        <Text type="secondary" style={{ fontSize: '11px' }}>
          {new Date(log.timestamp).toLocaleTimeString()}
        </Text>
        {log.data && (
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {JSON.stringify(log.data, null, 2)}
          </Text>
        )}
      </Space>
    )
  }));

  if (!isEnabled) {
    return (
      <Card size="small">
        <Space>
          <BugOutlined />
          <Text>Debug mode is disabled</Text>
          <Switch 
            checked={false} 
            onChange={onToggle}
            checkedChildren="ON"
            unCheckedChildren="OFF"
          />
        </Space>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card 
        title={
          <Space>
            <BugOutlined />
            Field Detection Debug Dashboard
            <Tag color="orange">Development Mode</Tag>
          </Space>
        }
        extra={
          <Switch 
            checked={isEnabled} 
            onChange={onToggle}
            checkedChildren="ON"
            unCheckedChildren="OFF"
          />
        }
      >
        {/* Performance Metrics */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Statistic
              title="Detection Time"
              value={performanceMetrics.detectionTime}
              suffix="ms"
              valueStyle={{ color: performanceMetrics.detectionTime < 1000 ? '#52c41a' : '#faad14' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Fields/Second"
              value={performanceMetrics.fieldsPerSecond}
              precision={2}
              valueStyle={{ color: '#3f8600' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Avg Confidence"
              value={performanceMetrics.averageConfidence}
              suffix="%"
              precision={1}
              valueStyle={{ color: performanceMetrics.averageConfidence >= 70 ? '#52c41a' : '#faad14' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Total Fields"
              value={detectedFields.length}
              valueStyle={{ color: '#1890ff' }}
            />
          </Col>
        </Row>

        <Divider />

        {/* Debug Panels */}
        <Collapse defaultActiveKey={['fields']} size="small">
          <Panel header="Field Analysis Table" key="fields" extra={<CodeOutlined />}>
            <Table
              dataSource={detectedFields}
              columns={fieldAnalysisColumns}
              size="small"
              rowKey="id"
              pagination={detectedFields.length > 5 ? { pageSize: 5 } : false}
              scroll={{ x: 800 }}
            />
          </Panel>

          <Panel header="Detection Logs" key="logs" extra={<ClockCircleOutlined />}>
            <Timeline 
              items={logTimelineItems}
              style={{ maxHeight: 300, overflow: 'auto' }}
            />
          </Panel>

          <Panel header="Algorithm Analysis" key="algorithm" extra={<SettingOutlined />}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Alert
                message="Detection Algorithm Performance"
                description={
                  <Space direction="vertical">
                    <Text>
                      Using 15+ field selectors with semantic classification
                    </Text>
                    <Text>
                      Current confidence threshold: 50%
                    </Text>
                    <Text>
                      Average processing time: {performanceMetrics.detectionTime}ms
                    </Text>
                  </Space>
                }
                type="info"
                showIcon
              />
              
              {/* Field Type Distribution */}
              <Title level={5}>Field Type Distribution</Title>
              <Space wrap>
                {Object.entries(
                  detectedFields.reduce((acc, field) => {
                    acc[field.semantic] = (acc[field.semantic] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                ).map(([type, count]) => (
                  <Tag key={type} color="blue">
                    {type}: {count}
                  </Tag>
                ))}
              </Space>
            </Space>
          </Panel>

          <Panel header="DOM Inspector" key="dom" extra={<EyeOutlined />}>
            <Alert
              message="DOM Inspector"
              description="Click on any field ID in the table above to inspect its detailed DOM properties and detection logic."
              type="info"
              showIcon
            />
          </Panel>
        </Collapse>
      </Card>

      {/* Field Details Modal */}
      <Modal
        title={`Field Debug Info: ${selectedField?.id}`}
        open={showFieldDetails}
        onCancel={() => setShowFieldDetails(false)}
        footer={[
          <Button key="close" onClick={() => setShowFieldDetails(false)}>
            Close
          </Button>
        ]}
        width={800}
      >
        {selectedField && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Descriptions title="Field Properties" bordered size="small">
              <Descriptions.Item label="Field ID">{selectedField.id}</Descriptions.Item>
              <Descriptions.Item label="Semantic Type">{selectedField.semantic}</Descriptions.Item>
              <Descriptions.Item label="Confidence Score">{selectedField.score}%</Descriptions.Item>
              <Descriptions.Item label="DOM Name">{selectedField.attributes.name || 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="DOM ID">{selectedField.attributes.id || 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="Input Type">{selectedField.attributes.type || 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="CSS Classes" span={3}>
                {selectedField.attributes.className || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Placeholder" span={3}>
                {selectedField.attributes.placeholder || 'N/A'}
              </Descriptions.Item>
            </Descriptions>

            <Descriptions title="Context Analysis" bordered size="small">
              <Descriptions.Item label="Label Text" span={3}>
                {selectedField.context.label || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Form Context" span={3}>
                {selectedField.context.formContext || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Nearby Text" span={3}>
                {selectedField.context.nearbyText?.join(', ') || 'N/A'}
              </Descriptions.Item>
            </Descriptions>

            <Descriptions title="Position & Dimensions" bordered size="small">
              <Descriptions.Item label="X Position">{selectedField.rect.x}px</Descriptions.Item>
              <Descriptions.Item label="Y Position">{selectedField.rect.y}px</Descriptions.Item>
              <Descriptions.Item label="Width">{selectedField.rect.width}px</Descriptions.Item>
              <Descriptions.Item label="Height">{selectedField.rect.height}px</Descriptions.Item>
            </Descriptions>
          </Space>
        )}
      </Modal>
    </motion.div>
  );
};

export default FieldDetectionDebugDashboard;
