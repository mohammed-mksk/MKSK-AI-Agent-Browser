/**
 * Field Detection Panel Component
 * Created: July 30, 2025
 * 
 * Provides UI for dynamic field detection and visual highlighting
 * Integrates with DynamicFieldDetector and FieldHighlighter services
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Card, 
  Button, 
  Switch, 
  Badge, 
  Tag, 
  Space, 
  Table, 
  Tooltip, 
  Progress,
  Alert,
  Typography,
  Row,
  Col,
  Divider
} from 'antd';
import {
  EyeOutlined,
  EyeInvisibleOutlined,
  ReloadOutlined,
  SettingOutlined,
  BugOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined
} from '@ant-design/icons';
import { motion } from 'framer-motion';
import { DetectedField, FieldDetectionPanelProps, DetectionStats } from '../types/fieldDetection.d';

const { Title, Text } = Typography;

const FieldDetectionPanel: React.FC<FieldDetectionPanelProps> = ({
  onFieldsDetected,
  onFieldSelected,
  onMappingChanged
}) => {
  const [isHighlighting, setIsHighlighting] = useState(false);
  const [detectedFields, setDetectedFields] = useState<DetectedField[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [autoDetectionEnabled, setAutoDetectionEnabled] = useState(true);
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({});
  const [selectedField, setSelectedField] = useState<DetectedField | null>(null);
  const [detectionStats, setDetectionStats] = useState<DetectionStats>({
    totalFields: 0,
    identifiedFields: 0,
    highConfidenceFields: 0
  });

  const semanticTypeColors = {
    email: '#3b82f6',
    password: '#ef4444', 
    name: '#10b981',
    departure: '#f59e0b',
    destination: '#8b5cf6',
    phone: '#06b6d4',
    address: '#84cc16',
    date: '#f97316',
    search: '#6366f1',
    text: '#64748b',
    number: '#0ea5e9',
    unknown: '#9ca3af'
  };

  const semanticTypeLabels = {
    email: '📧 Email',
    password: '🔒 Password',
    name: '👤 Name',
    departure: '🛫 From',
    destination: '🛬 To',
    phone: '📞 Phone',
    address: '🏠 Address',
    date: '📅 Date',
    search: '🔍 Search',
    text: '📝 Text',
    number: '🔢 Number',
    unknown: '❓ Unknown'
  };

  const detectFields = useCallback(async () => {
    setIsDetecting(true);
    
    try {
      // Call Electron API to detect fields
      if (window.electronAPI?.fieldDetection) {
        const response = await window.electronAPI.fieldDetection.detect();
        
        if (response.success) {
          const fields = response.data.fields || [];
          setDetectedFields(fields);
          
          // Calculate stats
          const stats = {
            totalFields: fields.length,
            identifiedFields: fields.filter(f => f.semantic !== 'unknown').length,
            highConfidenceFields: fields.filter(f => f.score >= 80).length
          };
          setDetectionStats(stats);
          
          onFieldsDetected?.(fields);
        } else {
          console.error('Field detection failed:', response.error);
        }
      } else {
        // Fallback: simulate field detection for development
        const mockFields: DetectedField[] = [
          {
            id: 'field_1',
            semantic: 'email',
            score: 95,
            attributes: { type: 'email', placeholder: 'Enter your email' },
            context: { label: 'Email Address' },
            rect: { x: 100, y: 200, width: 200, height: 40 }
          },
          {
            id: 'field_2', 
            semantic: 'password',
            score: 90,
            attributes: { type: 'password', name: 'password' },
            context: { label: 'Password' },
            rect: { x: 100, y: 260, width: 200, height: 40 }
          }
        ];
        
        setDetectedFields(mockFields);
        setDetectionStats({
          totalFields: mockFields.length,
          identifiedFields: mockFields.filter(f => f.semantic !== 'unknown').length,
          highConfidenceFields: mockFields.filter(f => f.score >= 80).length
        });
        
        onFieldsDetected?.(mockFields);
      }
    } catch (error) {
      console.error('Error detecting fields:', error);
    } finally {
      setIsDetecting(false);
    }
  }, [onFieldsDetected]);

  const toggleHighlighting = useCallback(async () => {
    const newState = !isHighlighting;
    setIsHighlighting(newState);
    
    try {
      if (window.electronAPI?.fieldDetection) {
        if (newState) {
          await window.electronAPI.fieldDetection.highlight(detectedFields);
        } else {
          await window.electronAPI.fieldDetection.removeHighlights();
        }
      }
    } catch (error) {
      console.error('Error toggling highlights:', error);
    }
  }, [isHighlighting, detectedFields]);

  const handleFieldClick = (field: DetectedField) => {
    setSelectedField(field);
    onFieldSelected?.(field);
  };

  const updateFieldMapping = (fieldId: string, dataType: string) => {
    const newMappings = { ...fieldMappings, [fieldId]: dataType };
    setFieldMappings(newMappings);
    onMappingChanged?.(newMappings);
  };

  // Auto-detection effect
  useEffect(() => {
    if (autoDetectionEnabled) {
      const autoDetectInterval = setInterval(() => {
        if (!isDetecting) {
          detectFields();
        }
      }, 5000); // Auto-detect every 5 seconds

      return () => clearInterval(autoDetectInterval);
    }
  }, [autoDetectionEnabled, isDetecting, detectFields]);

  const tableColumns = [
    {
      title: 'Status',
      key: 'status',
      width: 80,
      render: (record: DetectedField) => (
        <Space>
          {selectedField?.id === record.id && <Tag color="blue">Selected</Tag>}
          {record.score >= 90 ? (
            <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '16px' }} />
          ) : record.score >= 70 ? (
            <ExclamationCircleOutlined style={{ color: '#faad14', fontSize: '16px' }} />
          ) : (
            <ExclamationCircleOutlined style={{ color: '#ff4d4f', fontSize: '16px' }} />
          )}
        </Space>
      )
    },
    {
      title: 'Type',
      dataIndex: 'semantic',
      key: 'semantic',
      render: (semantic: string) => (
        <Tag color={semanticTypeColors[semantic as keyof typeof semanticTypeColors]}>
          {semanticTypeLabels[semantic as keyof typeof semanticTypeLabels]}
        </Tag>
      )
    },
    {
      title: 'Confidence',
      dataIndex: 'score',
      key: 'score',
      render: (score: number) => (
        <Space direction="vertical" size={0}>
          <Progress 
            percent={score} 
            size="small" 
            status={score >= 80 ? 'success' : score >= 60 ? 'normal' : 'exception'}
            format={() => `${score}%`}
          />
          <Text type="secondary" style={{ fontSize: '11px' }}>
            {score >= 90 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Fair' : 'Poor'}
          </Text>
        </Space>
      )
    },
    {
      title: 'Context',
      key: 'context',
      render: (record: DetectedField) => (
        <Space direction="vertical" size={0}>
          {record.context.label && <Text strong>{record.context.label}</Text>}
          {record.attributes.placeholder && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              💬 {record.attributes.placeholder}
            </Text>
          )}
          {record.attributes.name && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              🏷️ {record.attributes.name}
            </Text>
          )}
        </Space>
      )
    },
    debugMode && {
      title: 'Debug',
      key: 'debug',
      render: (record: DetectedField) => (
        <Space direction="vertical" size={0}>
          <Text code style={{ fontSize: '10px' }}>ID: {record.id}</Text>
          <Text code style={{ fontSize: '10px' }}>
            Pos: {Math.round(record.rect.x)}, {Math.round(record.rect.y)}
          </Text>
          <Text code style={{ fontSize: '10px' }}>
            Size: {Math.round(record.rect.width)}×{Math.round(record.rect.height)}
          </Text>
        </Space>
      )
    }
  ].filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card 
        title={
          <Space>
            <EyeOutlined />
            Field Detection
            <Badge count={detectedFields.length} showZero color="#52c41a" />
          </Space>
        }
        extra={
          <Space>
            <Tooltip title="Debug Mode">
              <Switch
                checked={debugMode}
                onChange={setDebugMode}
                checkedChildren={<BugOutlined />}
                unCheckedChildren={<BugOutlined />}
                size="small"
              />
            </Tooltip>
            <Button 
              size="small" 
              icon={<SettingOutlined />}
              type="text"
            />
          </Space>
        }
      >
        {/* Enhanced Control Panel */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <Card size="small" style={{ backgroundColor: '#f8f9fa' }}>
              <Row gutter={[16, 8]} align="middle">
                <Col span={8}>
                  <Space direction="vertical" size={0}>
                    <Text strong>Auto Detection</Text>
                    <Switch
                      checked={autoDetectionEnabled}
                      onChange={setAutoDetectionEnabled}
                      checkedChildren="ON"
                      unCheckedChildren="OFF"
                    />
                  </Space>
                </Col>
                <Col span={8}>
                  <Button
                    type="primary"
                    icon={isDetecting ? <LoadingOutlined /> : <ReloadOutlined />}
                    onClick={detectFields}
                    loading={isDetecting}
                    size="large"
                    block
                  >
                    {isDetecting ? 'Detecting...' : 'Detect Fields'}
                  </Button>
                </Col>
                <Col span={8}>
                  <Button
                    type={isHighlighting ? "default" : "dashed"}
                    icon={isHighlighting ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                    onClick={toggleHighlighting}
                    disabled={detectedFields.length === 0}
                    size="large"
                    block
                  >
                    {isHighlighting ? 'Hide' : 'Show'} Highlights
                  </Button>
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>

        {/* Enhanced Statistics */}
        {detectedFields.length > 0 && (
          <>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={6}>
                <Card size="small" style={{ textAlign: 'center' }}>
                  <Title level={4} style={{ margin: 0, color: '#1890ff' }}>
                    {detectionStats.totalFields}
                  </Title>
                  <Text type="secondary">Total Fields</Text>
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small" style={{ textAlign: 'center' }}>
                  <Title level={4} style={{ margin: 0, color: '#52c41a' }}>
                    {detectionStats.identifiedFields}
                  </Title>
                  <Text type="secondary">Identified</Text>
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small" style={{ textAlign: 'center' }}>
                  <Title level={4} style={{ margin: 0, color: '#fa8c16' }}>
                    {detectionStats.highConfidenceFields}
                  </Title>
                  <Text type="secondary">High Confidence</Text>
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small" style={{ textAlign: 'center' }}>
                  <Title level={4} style={{ margin: 0, color: isHighlighting ? '#52c41a' : '#d9d9d9' }}>
                    {isHighlighting ? 'ON' : 'OFF'}
                  </Title>
                  <Text type="secondary">Highlighting</Text>
                </Card>
              </Col>
            </Row>

            {/* Quick Field Type Summary */}
            <Card size="small" style={{ marginBottom: 16 }}>
              <Title level={5} style={{ margin: '0 0 8px 0' }}>Field Types Detected</Title>
              <Space wrap>
                {Object.entries(
                  detectedFields.reduce((acc, field) => {
                    acc[field.semantic] = (acc[field.semantic] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                ).map(([type, count]) => (
                  <Tag 
                    key={type}
                    color={semanticTypeColors[type as keyof typeof semanticTypeColors]}
                  >
                    {semanticTypeLabels[type as keyof typeof semanticTypeLabels]} ({count})
                  </Tag>
                ))}
              </Space>
            </Card>

            <Divider />

            {/* Field List */}
            <Table
              dataSource={detectedFields}
              columns={tableColumns}
              rowKey="id"
              size="small"
              pagination={detectedFields.length > 10 ? { pageSize: 10 } : false}
              onRow={(record) => ({
                onClick: () => handleFieldClick(record),
                style: { cursor: 'pointer' }
              })}
              rowClassName={(record) => 
                record.score >= 80 ? 'field-row-high-confidence' : 
                record.score >= 60 ? 'field-row-medium-confidence' : 
                'field-row-low-confidence'
              }
            />
          </>
        )}

        {/* No Fields Message */}
        {detectedFields.length === 0 && !isDetecting && (
          <Alert
            message="No fields detected"
            description="Click 'Detect Fields' to scan the current page for input fields."
            type="info"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}

        {/* Status Messages */}
        {isHighlighting && (
          <Alert
            message="Field highlighting is active"
            description="Input fields are highlighted on the page with color-coded semantic types."
            type="success"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </Card>

      <style>{`
        .field-row-high-confidence {
          background-color: #f6ffed;
        }
        .field-row-medium-confidence {
          background-color: #fffbe6;
        }
        .field-row-low-confidence {
          background-color: #fff2f0;
        }
        .field-row-high-confidence:hover,
        .field-row-medium-confidence:hover,
        .field-row-low-confidence:hover {
          background-color: #e6f7ff !important;
        }
      `}</style>
    </motion.div>
  );
};

export default FieldDetectionPanel;
