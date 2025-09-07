/**
 * Field Mapping Interface Component
 * Created: July 30, 2025
 * 
 * Allows users to map detected fields to data types and correct AI suggestions
 */

import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Table, 
  Select, 
  Button, 
  Space, 
  Tag, 
  Typography, 
  Row, 
  Col,
  Alert,
  Progress,
  Tooltip,
  Badge,
  Input,
  Popover
} from 'antd';
import {
  LinkOutlined,
  CheckOutlined,
  CloseOutlined,
  EditOutlined,
  InfoCircleOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';
import { motion } from 'framer-motion';

const { Title, Text } = Typography;
const { Option } = Select;

interface DetectedField {
  id: string;
  semantic: string;
  score: number;
  attributes: any;
  context: any;
  rect: any;
}

interface FieldMapping {
  fieldId: string;
  dataType: string;
  confidence: number;
  userConfirmed: boolean;
  aiSuggested: boolean;
}

interface FieldMappingInterfaceProps {
  detectedFields: DetectedField[];
  userData: Record<string, string>;
  onMappingConfirmed?: (mappings: FieldMapping[]) => void;
  onFieldFill?: (fieldId: string, value: string) => void;
}

const FieldMappingInterface: React.FC<FieldMappingInterfaceProps> = ({
  detectedFields,
  userData,
  onMappingConfirmed,
  onFieldFill
}) => {
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [previewValues, setPreviewValues] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);

  const dataTypes = [
    { value: 'email', label: '📧 Email', color: '#3b82f6' },
    { value: 'password', label: '🔒 Password', color: '#ef4444' },
    { value: 'name', label: '👤 Name', color: '#10b981' },
    { value: 'firstName', label: '👤 First Name', color: '#10b981' },
    { value: 'lastName', label: '👤 Last Name', color: '#10b981' },
    { value: 'phone', label: '📞 Phone', color: '#06b6d4' },
    { value: 'address', label: '🏠 Address', color: '#84cc16' },
    { value: 'departure', label: '🛫 From', color: '#f59e0b' },
    { value: 'destination', label: '🛬 To', color: '#8b5cf6' },
    { value: 'departureDate', label: '📅 Departure Date', color: '#f97316' },
    { value: 'returnDate', label: '📅 Return Date', color: '#f97316' },
    { value: 'passengers', label: '👥 Passengers', color: '#0ea5e9' },
    { value: 'ignore', label: '❌ Ignore', color: '#9ca3af' }
  ];

  // Initialize mappings based on AI suggestions
  useEffect(() => {
    const aiMappings: FieldMapping[] = detectedFields.map(field => {
      const confidence = calculateMappingConfidence(field, userData);
      const suggestedDataType = getSuggestedDataType(field, userData);
      
      return {
        fieldId: field.id,
        dataType: suggestedDataType,
        confidence,
        userConfirmed: false,
        aiSuggested: true
      };
    });
    
    setMappings(aiMappings);
    
    // Initialize preview values
    const previews: Record<string, string> = {};
    aiMappings.forEach(mapping => {
      if (mapping.dataType !== 'ignore' && userData[mapping.dataType]) {
        previews[mapping.fieldId] = userData[mapping.dataType];
      }
    });
    setPreviewValues(previews);
  }, [detectedFields, userData]);

  const calculateMappingConfidence = (field: DetectedField, userData: Record<string, string>): number => {
    let confidence = field.score / 100;
    
    // Boost confidence for exact semantic matches
    if (userData[field.semantic]) {
      confidence = Math.min(1, confidence + 0.3);
    }
    
    // Check context matching
    const contextText = [
      field.context.label,
      field.attributes.placeholder,
      field.attributes.name
    ].filter(Boolean).join(' ').toLowerCase();
    
    Object.keys(userData).forEach(dataKey => {
      if (contextText.includes(dataKey.toLowerCase())) {
        confidence = Math.min(1, confidence + 0.2);
      }
    });
    
    return Math.round(confidence * 100);
  };

  const getSuggestedDataType = (field: DetectedField, userData: Record<string, string>): string => {
    // Direct semantic match
    if (userData[field.semantic]) {
      return field.semantic;
    }
    
    // Pattern-based suggestions
    const contextText = [
      field.context.label,
      field.attributes.placeholder,
      field.attributes.name
    ].filter(Boolean).join(' ').toLowerCase();
    
    // Check for specific patterns
    if (/first.*name|given.*name/i.test(contextText)) return 'firstName';
    if (/last.*name|family.*name|surname/i.test(contextText)) return 'lastName';
    if (/depart.*date|outbound.*date/i.test(contextText)) return 'departureDate';
    if (/return.*date|inbound.*date/i.test(contextText)) return 'returnDate';
    if (/passenger|traveler|people/i.test(contextText)) return 'passengers';
    
    // Fallback to semantic type or ignore
    return Object.keys(userData).includes(field.semantic) ? field.semantic : 'ignore';
  };

  const updateMapping = (fieldId: string, dataType: string) => {
    setMappings(prev => prev.map(mapping => 
      mapping.fieldId === fieldId 
        ? { 
            ...mapping, 
            dataType, 
            userConfirmed: true,
            confidence: dataType === 'ignore' ? 0 : Math.max(80, mapping.confidence)
          }
        : mapping
    ));
    
    // Update preview value
    if (dataType !== 'ignore' && userData[dataType]) {
      setPreviewValues(prev => ({ ...prev, [fieldId]: userData[dataType] }));
    } else {
      setPreviewValues(prev => {
        const updated = { ...prev };
        delete updated[fieldId];
        return updated;
      });
    }
  };

  const confirmMapping = (fieldId: string) => {
    setMappings(prev => prev.map(mapping => 
      mapping.fieldId === fieldId 
        ? { ...mapping, userConfirmed: true }
        : mapping
    ));
  };

  const applyAllMappings = async () => {
    setIsProcessing(true);
    
    try {
      const confirmedMappings = mappings.filter(m => m.dataType !== 'ignore');
      
      for (const mapping of confirmedMappings) {
        const value = userData[mapping.dataType];
        if (value && onFieldFill) {
          await onFieldFill(mapping.fieldId, value);
        }
      }
      
      onMappingConfirmed?.(mappings);
    } catch (error) {
      console.error('Error applying mappings:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const getFieldByMapping = (mapping: FieldMapping): DetectedField | undefined => {
    return detectedFields.find(f => f.id === mapping.fieldId);
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 80) return '#52c41a';
    if (confidence >= 60) return '#faad14';
    return '#ff4d4f';
  };

  const getDataTypeOption = (dataType: string) => {
    return dataTypes.find(dt => dt.value === dataType);
  };

  const columns = [
    {
      title: 'Field',
      key: 'field',
      render: (record: FieldMapping) => {
        const field = getFieldByMapping(record);
        if (!field) return '-';
        
        return (
          <Space direction="vertical" size={0}>
            <Tag color={field.semantic === 'unknown' ? 'default' : 'blue'}>
              {field.semantic}
            </Tag>
            {field.context.label && (
              <Text strong style={{ fontSize: '12px' }}>{field.context.label}</Text>
            )}
            {field.attributes.placeholder && (
              <Text type="secondary" style={{ fontSize: '11px' }}>
                "{field.attributes.placeholder}"
              </Text>
            )}
          </Space>
        );
      }
    },
    {
      title: 'Suggested Mapping',
      key: 'mapping',
      render: (record: FieldMapping) => (
        <Space direction="vertical" size={4}>
          <Select
            value={record.dataType}
            onChange={(value) => updateMapping(record.fieldId, value)}
            style={{ width: 180 }}
            size="small"
          >
            {dataTypes.map(dt => (
              <Option key={dt.value} value={dt.value}>
                <span style={{ color: dt.color }}>{dt.label}</span>
              </Option>
            ))}
          </Select>
          
          {record.aiSuggested && !record.userConfirmed && (
            <Tag color="orange">
              <ThunderboltOutlined /> AI Suggested
            </Tag>
          )}
        </Space>
      )
    },
    {
      title: 'Confidence',
      key: 'confidence',
      render: (record: FieldMapping) => (
        <Progress
          percent={record.confidence}
          size="small"
          strokeColor={getConfidenceColor(record.confidence)}
          format={() => `${record.confidence}%`}
          style={{ width: 80 }}
        />
      )
    },
    {
      title: 'Preview',
      key: 'preview',
      render: (record: FieldMapping) => {
        const previewValue = previewValues[record.fieldId];
        
        if (!previewValue || record.dataType === 'ignore') {
          return <Text type="secondary">-</Text>;
        }
        
        const isPassword = record.dataType === 'password';
        
        return (
          <Tooltip title={isPassword ? 'Password hidden' : previewValue}>
            <Text code style={{ fontSize: '11px', maxWidth: 100 }}>
              {isPassword ? '••••••••' : 
               previewValue.length > 15 ? `${previewValue.substring(0, 15)}...` : previewValue}
            </Text>
          </Tooltip>
        );
      }
    },
    {
      title: 'Action',
      key: 'action',
      render: (record: FieldMapping) => (
        <Space>
          {record.userConfirmed ? (
            <Tag color="success" icon={<CheckOutlined />}>Confirmed</Tag>
          ) : (
            <Button
              size="small"
              type="primary"
              icon={<CheckOutlined />}
              onClick={() => confirmMapping(record.fieldId)}
              disabled={record.dataType === 'ignore'}
            >
              Confirm
            </Button>
          )}
        </Space>
      )
    }
  ];

  const confirmedMappings = mappings.filter(m => m.userConfirmed && m.dataType !== 'ignore');
  const totalMappings = mappings.filter(m => m.dataType !== 'ignore');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card
        title={
          <Space>
            <LinkOutlined />
            Field Mapping
            <Badge count={`${confirmedMappings.length}/${totalMappings.length}`} />
          </Space>
        }
        extra={
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            onClick={applyAllMappings}
            loading={isProcessing}
            disabled={confirmedMappings.length === 0}
          >
            Apply Mappings ({confirmedMappings.length})
          </Button>
        }
      >
        {/* Summary Stats */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card size="small" style={{ textAlign: 'center' }}>
              <Title level={5} style={{ margin: 0, color: '#1890ff' }}>
                {totalMappings.length}
              </Title>
              <Text type="secondary">Total Mappings</Text>
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" style={{ textAlign: 'center' }}>
              <Title level={5} style={{ margin: 0, color: '#52c41a' }}>
                {confirmedMappings.length}
              </Title>
              <Text type="secondary">Confirmed</Text>
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" style={{ textAlign: 'center' }}>
              <Title level={5} style={{ margin: 0, color: '#faad14' }}>
                {mappings.filter(m => m.aiSuggested && !m.userConfirmed).length}
              </Title>
              <Text type="secondary">AI Suggested</Text>
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" style={{ textAlign: 'center' }}>
              <Title level={5} style={{ margin: 0, color: '#ff4d4f' }}>
                {mappings.filter(m => m.confidence < 60).length}
              </Title>
              <Text type="secondary">Low Confidence</Text>
            </Card>
          </Col>
        </Row>

        {/* Mapping Table */}
        <Table
          dataSource={mappings}
          columns={columns}
          rowKey="fieldId"
          size="small"
          pagination={false}
          rowClassName={(record) => 
            record.userConfirmed ? 'mapping-row-confirmed' : 
            record.confidence >= 80 ? 'mapping-row-high-confidence' :
            'mapping-row-needs-review'
          }
        />

        {/* Help Text */}
        {mappings.length > 0 && (
          <Alert
            message="Field Mapping Instructions"
            description={
              <Space direction="vertical" size={0}>
                <Text>• Review AI suggestions and adjust mappings as needed</Text>
                <Text>• Confirm accurate mappings by clicking the Confirm button</Text>
                <Text>• Set unwanted fields to 'Ignore' to exclude them</Text>
                <Text>• Click 'Apply Mappings' to fill all confirmed fields automatically</Text>
              </Space>
            }
            type="info"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </Card>

      <style>{`
        .mapping-row-confirmed {
          background-color: #f6ffed;
        }
        .mapping-row-high-confidence {
          background-color: #e6f7ff;
        }
        .mapping-row-needs-review {
          background-color: #fff2f0;
        }
      `}</style>
    </motion.div>
  );
};

export default FieldMappingInterface;
