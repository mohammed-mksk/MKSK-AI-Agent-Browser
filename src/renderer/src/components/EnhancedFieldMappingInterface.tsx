/**
 * Enhanced Field Mapping Interface Component
 * Created: July 30, 2025
 * 
 * Provides enhanced UI for field mapping with user corrections and validation
 * Part of Task 5.2: Create field mapping interface for user corrections
 */

import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Form, 
  Select, 
  Button, 
  Space, 
  Table, 
  Input,
  Tag, 
  Typography,
  Row,
  Col,
  Alert,
  Modal,
  Tooltip,
  Checkbox,
  Divider
} from 'antd';
import {
  EditOutlined,
  SaveOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  DeleteOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { motion } from 'framer-motion';
import { 
  DetectedField, 
  FieldMapping, 
  EnhancedFieldMappingInterfaceProps,
  SemanticFieldType 
} from '../types/fieldDetection.d';

const { Option } = Select;
const { Title, Text } = Typography;

const EnhancedFieldMappingInterface: React.FC<EnhancedFieldMappingInterfaceProps> = ({
  detectedFields,
  initialMappings = {},
  onMappingChange,
  onFieldValidation,
  userData = {}
}) => {
  const [mappings, setMappings] = useState<Record<string, FieldMapping>>({});
  const [isEditing, setIsEditing] = useState<Record<string, boolean>>({});
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [selectedField, setSelectedField] = useState<DetectedField | null>(null);
  const [autoFillEnabled, setAutoFillEnabled] = useState(true);

  const semanticTypes: SemanticFieldType[] = [
    'email',
    'password', 
    'name',
    'departure',
    'destination',
    'phone',
    'address',
    'date',
    'search',
    'text',
    'number',
    'unknown'
  ];

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

  // Initialize mappings from detected fields
  useEffect(() => {
    const newMappings: Record<string, FieldMapping> = {};
    
    detectedFields.forEach(field => {
      newMappings[field.id] = {
        fieldId: field.id,
        originalType: field.semantic,
        correctedType: initialMappings[field.id] || field.semantic,
        confidence: field.score,
        userValidated: false,
        dataValue: getDefaultValueForType(field.semantic)
      };
    });
    
    setMappings(newMappings);
  }, [detectedFields, initialMappings]);

  const getDefaultValueForType = (type: string): string => {
    if (!autoFillEnabled) return '';
    
    const typeToUserDataMap: Record<string, string> = {
      email: userData.email || '',
      name: userData.name || '',
      phone: userData.phone || '',
      departure: userData.departure || '',
      destination: userData.destination || '',
      date: userData.departureDate || ''
    };
    
    return typeToUserDataMap[type] || '';
  };

  const handleTypeChange = (fieldId: string, newType: string) => {
    const updatedMapping = {
      ...mappings[fieldId],
      correctedType: newType,
      userValidated: true,
      dataValue: getDefaultValueForType(newType)
    };
    
    const newMappings = {
      ...mappings,
      [fieldId]: updatedMapping
    };
    
    setMappings(newMappings);
    onMappingChange?.(newMappings);
  };

  const handleDataValueChange = (fieldId: string, value: string) => {
    const updatedMapping = {
      ...mappings[fieldId],
      dataValue: value
    };
    
    const newMappings = {
      ...mappings,
      [fieldId]: updatedMapping
    };
    
    setMappings(newMappings);
    onMappingChange?.(newMappings);
  };

  const handleValidateField = (fieldId: string) => {
    const updatedMapping = {
      ...mappings[fieldId],
      userValidated: true
    };
    
    const newMappings = {
      ...mappings,
      [fieldId]: updatedMapping
    };
    
    setMappings(newMappings);
    onFieldValidation?.(fieldId, true);
  };

  const toggleEditing = (fieldId: string) => {
    setIsEditing(prev => ({
      ...prev,
      [fieldId]: !prev[fieldId]
    }));
  };

  const openValidationModal = (field: DetectedField) => {
    setSelectedField(field);
    setShowValidationModal(true);
  };

  const columns = [
    {
      title: 'Field Info',
      key: 'fieldInfo',
      render: (record: DetectedField) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.context.label || record.attributes.name || `Field ${record.id}`}</Text>
          {record.attributes.placeholder && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.attributes.placeholder}
            </Text>
          )}
          <Text type="secondary" style={{ fontSize: '11px' }}>
            ID: {record.id}
          </Text>
        </Space>
      )
    },
    {
      title: 'Original Type',
      key: 'originalType',
      render: (record: DetectedField) => (
        <Space direction="vertical" size={0}>
          <Tag color={semanticTypeColors[record.semantic as keyof typeof semanticTypeColors]}>
            {semanticTypeLabels[record.semantic as keyof typeof semanticTypeLabels]}
          </Tag>
          <Text type="secondary" style={{ fontSize: '11px' }}>
            {record.score}% confidence
          </Text>
        </Space>
      )
    },
    {
      title: 'Corrected Type',
      key: 'correctedType',
      render: (record: DetectedField) => {
        const mapping = mappings[record.id];
        const isFieldEditing = isEditing[record.id];
        
        return (
          <Space>
            {isFieldEditing ? (
              <Select
                value={mapping?.correctedType || record.semantic}
                onChange={(value) => handleTypeChange(record.id, value)}
                style={{ width: 140 }}
                size="small"
              >
                {semanticTypes.map(type => (
                  <Option key={type} value={type}>
                    {semanticTypeLabels[type as keyof typeof semanticTypeLabels]}
                  </Option>
                ))}
              </Select>
            ) : (
              <Tag 
                color={semanticTypeColors[mapping?.correctedType as keyof typeof semanticTypeColors]}
                style={{ cursor: 'pointer' }}
                onClick={() => toggleEditing(record.id)}
              >
                {semanticTypeLabels[mapping?.correctedType as keyof typeof semanticTypeLabels]}
              </Tag>
            )}
            <Button
              type="text"
              size="small"
              icon={isFieldEditing ? <SaveOutlined /> : <EditOutlined />}
              onClick={() => toggleEditing(record.id)}
            />
          </Space>
        );
      }
    },
    {
      title: 'Data Value',
      key: 'dataValue',
      render: (record: DetectedField) => {
        const mapping = mappings[record.id];
        
        return (
          <Input
            value={mapping?.dataValue || ''}
            onChange={(e) => handleDataValueChange(record.id, e.target.value)}
            placeholder={`Enter ${mapping?.correctedType || record.semantic} value`}
            size="small"
            style={{ width: 150 }}
          />
        );
      }
    },
    {
      title: 'Status',
      key: 'status',
      render: (record: DetectedField) => {
        const mapping = mappings[record.id];
        const isValidated = mapping?.userValidated;
        const hasChanges = mapping?.originalType !== mapping?.correctedType;
        
        return (
          <Space>
            {isValidated ? (
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
            ) : (
              <ExclamationCircleOutlined style={{ color: '#faad14' }} />
            )}
            {hasChanges && <Tag color="orange">Modified</Tag>}
            <Button
              type="link"
              size="small"
              onClick={() => handleValidateField(record.id)}
              disabled={isValidated}
            >
              {isValidated ? 'Validated' : 'Validate'}
            </Button>
          </Space>
        );
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record: DetectedField) => (
        <Space>
          <Tooltip title="Detailed validation">
            <Button
              type="text"
              size="small"
              icon={<ExclamationCircleOutlined />}
              onClick={() => openValidationModal(record)}
            />
          </Tooltip>
        </Space>
      )
    }
  ];

  const validatedCount = Object.values(mappings).filter(m => m.userValidated).length;
  const modifiedCount = Object.values(mappings).filter(m => m.originalType !== m.correctedType).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card 
        title={
          <Space>
            <EditOutlined />
            Field Mapping & Validation
            <Tag color="blue">{detectedFields.length} fields</Tag>
          </Space>
        }
        extra={
          <Space>
            <Tooltip title="Auto-fill fields with user data">
              <Checkbox
                checked={autoFillEnabled}
                onChange={(e) => setAutoFillEnabled(e.target.checked)}
              >
                Auto-fill
              </Checkbox>
            </Tooltip>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              size="small"
            >
              Save All
            </Button>
          </Space>
        }
      >
        {/* Summary Stats */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card size="small" style={{ textAlign: 'center' }}>
              <Title level={4} style={{ margin: 0, color: '#1890ff' }}>
                {detectedFields.length}
              </Title>
              <Text type="secondary">Total Fields</Text>
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" style={{ textAlign: 'center' }}>
              <Title level={4} style={{ margin: 0, color: '#52c41a' }}>
                {validatedCount}
              </Title>
              <Text type="secondary">Validated</Text>
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" style={{ textAlign: 'center' }}>
              <Title level={4} style={{ margin: 0, color: '#fa8c16' }}>
                {modifiedCount}
              </Title>
              <Text type="secondary">Modified</Text>
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" style={{ textAlign: 'center' }}>
              <Title level={4} style={{ margin: 0, color: autoFillEnabled ? '#52c41a' : '#d9d9d9' }}>
                {autoFillEnabled ? 'ON' : 'OFF'}
              </Title>
              <Text type="secondary">Auto-fill</Text>
            </Card>
          </Col>
        </Row>

        {/* Mapping Table */}
        <Table
          dataSource={detectedFields}
          columns={columns}
          rowKey="id"
          size="small"
          pagination={detectedFields.length > 10 ? { pageSize: 10 } : false}
          scroll={{ x: 800 }}
        />

        {/* Validation Progress */}
        {detectedFields.length > 0 && (
          <Alert
            message={`Validation Progress: ${validatedCount}/${detectedFields.length} fields validated`}
            description={
              validatedCount === detectedFields.length
                ? "All fields have been validated! You can proceed with automation."
                : `${detectedFields.length - validatedCount} fields still need validation.`
            }
            type={validatedCount === detectedFields.length ? "success" : "info"}
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </Card>

      {/* Detailed Validation Modal */}
      <Modal
        title={`Validate Field: ${selectedField?.context.label || selectedField?.id}`}
        open={showValidationModal}
        onCancel={() => setShowValidationModal(false)}
        footer={[
          <Button key="cancel" onClick={() => setShowValidationModal(false)}>
            Cancel
          </Button>,
          <Button 
            key="validate" 
            type="primary" 
            onClick={() => {
              if (selectedField) {
                handleValidateField(selectedField.id);
              }
              setShowValidationModal(false);
            }}
          >
            Validate Field
          </Button>
        ]}
      >
        {selectedField && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Divider>Field Information</Divider>
            <Row gutter={16}>
              <Col span={12}>
                <Text strong>Label:</Text> {selectedField.context.label || 'N/A'}
              </Col>
              <Col span={12}>
                <Text strong>Type:</Text> {selectedField.attributes.type || 'N/A'}
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Text strong>Name:</Text> {selectedField.attributes.name || 'N/A'}
              </Col>
              <Col span={12}>
                <Text strong>Placeholder:</Text> {selectedField.attributes.placeholder || 'N/A'}
              </Col>
            </Row>
            
            <Divider>Detection Results</Divider>
            <Row gutter={16}>
              <Col span={12}>
                <Text strong>Detected as:</Text> {semanticTypeLabels[selectedField.semantic as keyof typeof semanticTypeLabels]}
              </Col>
              <Col span={12}>
                <Text strong>Confidence:</Text> {selectedField.score}%
              </Col>
            </Row>
          </Space>
        )}
      </Modal>
    </motion.div>
  );
};

export default EnhancedFieldMappingInterface;
