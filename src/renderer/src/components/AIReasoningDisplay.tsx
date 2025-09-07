import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  Timeline,
  Progress,
  Tag,
  Space,
  Collapse,
  Alert,
  Tooltip,
  Badge,
  Row,
  Col,
  Statistic,
  Button
} from 'antd';
import {
  BulbOutlined,
  ThunderboltOutlined,
  EyeOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  RobotOutlined,
  WarningOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';

const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;

export interface AIReasoningStep {
  id: string;
  timestamp: number;
  type: 'analysis' | 'decision' | 'action' | 'adaptation' | 'recovery' | 'learning';
  title: string;
  description: string;
  thinking: string;
  confidence: number;
  alternatives?: string[];
  context?: any;
  outcome?: 'success' | 'failure' | 'pending';
  executionTime?: number;
  memoryUsed?: boolean;
  cacheHit?: boolean;
}

export interface AIExecutionContext {
  taskId: string;
  objective: string;
  currentStep: number;
  totalSteps: number;
  startTime: number;
  reasoning: AIReasoningStep[];
  adaptations: string[];
  errors: string[];
  performance: {
    executionTime: number;
    memoryUsage: number;
    cacheHitRate: number;
    successRate: number;
  };
}

interface AIReasoningDisplayProps {
  context: AIExecutionContext | null;
  isLive?: boolean;
  showDetails?: boolean;
  onStepClick?: (step: AIReasoningStep) => void;
}

const AIReasoningDisplay: React.FC<AIReasoningDisplayProps> = ({
  context,
  isLive = false,
  showDetails = true,
  onStepClick
}) => {
  const [expandedPanels, setExpandedPanels] = useState<string[]>([]);
  const [highlightedStep, setHighlightedStep] = useState<string | null>(null);

  useEffect(() => {
    if (isLive && context?.reasoning.length) {
      const latestStep = context.reasoning[context.reasoning.length - 1];
      setHighlightedStep(latestStep.id);
      
      // Auto-expand latest step
      if (!expandedPanels.includes(latestStep.id)) {
        setExpandedPanels(prev => [...prev, latestStep.id]);
      }

      // Remove highlight after 3 seconds
      const timer = setTimeout(() => {
        setHighlightedStep(null);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [context?.reasoning, isLive, expandedPanels]);

  if (!context) {
    return (
      <Card className="glass-card">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <RobotOutlined style={{ fontSize: '48px', color: 'rgba(255, 255, 255, 0.5)' }} />
          <Title level={4} style={{ color: 'rgba(255, 255, 255, 0.7)', marginTop: '16px' }}>
            No AI reasoning data available
          </Title>
          <Text style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
            Start an automation task to see AI decision-making in real-time
          </Text>
        </div>
      </Card>
    );
  }

  const getStepIcon = (type: AIReasoningStep['type']) => {
    switch (type) {
      case 'analysis':
        return <EyeOutlined />;
      case 'decision':
        return <BulbOutlined />;
      case 'action':
        return <ThunderboltOutlined />;
      case 'adaptation':
        return <SettingOutlined />;
      case 'recovery':
        return <WarningOutlined />;
      case 'learning':
        return <BulbOutlined />;
      default:
        return <InfoCircleOutlined />;
    }
  };

  const getStepColor = (step: AIReasoningStep) => {
    if (step.outcome === 'success') return '#52c41a';
    if (step.outcome === 'failure') return '#ff4d4f';
    if (step.outcome === 'pending') return '#1890ff';
    return '#faad14';
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return '#52c41a';
    if (confidence >= 0.6) return '#faad14';
    return '#ff4d4f';
  };

  const formatExecutionTime = (time?: number) => {
    if (!time) return 'N/A';
    if (time < 1000) return `${time}ms`;
    return `${(time / 1000).toFixed(1)}s`;
  };

  const renderPerformanceStats = () => (
    <Row gutter={16} style={{ marginBottom: '16px' }}>
      <Col span={6}>
        <Statistic
          title="Execution Time"
          value={formatExecutionTime(context.performance?.executionTime)}
          prefix={<ClockCircleOutlined />}
          valueStyle={{ color: 'white', fontSize: '16px' }}
        />
      </Col>
      <Col span={6}>
        <Statistic
          title="Memory Usage"
          value={context.performance?.memoryUsage?.toFixed(1) || '0'}
          suffix="MB"
          valueStyle={{ color: 'white', fontSize: '16px' }}
        />
      </Col>
      <Col span={6}>
        <Statistic
          title="Cache Hit Rate"
          value={((context.performance?.cacheHitRate || 0) * 100).toFixed(1)}
          suffix="%"
          valueStyle={{ color: 'white', fontSize: '16px' }}
        />
      </Col>
      <Col span={6}>
        <Statistic
          title="Success Rate"
          value={((context.performance?.successRate || 0) * 100).toFixed(1)}
          suffix="%"
          valueStyle={{ color: 'white', fontSize: '16px' }}
        />
      </Col>
    </Row>
  );

  const renderReasoningTimeline = () => (
    <Timeline
      mode="left"
      items={context.reasoning.map((step, index) => ({
        key: step.id,
        dot: (
          <Badge
            count={step.cacheHit ? 'C' : step.memoryUsed ? 'M' : ''}
            size="small"
            style={{ backgroundColor: '#52c41a' }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: getStepColor(step),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '14px'
              }}
            >
              {getStepIcon(step.type)}
            </div>
          </Badge>
        ),
        color: getStepColor(step),
        children: (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ 
              opacity: 1, 
              x: 0,
              scale: highlightedStep === step.id ? 1.02 : 1
            }}
            transition={{ duration: 0.3 }}
            style={{
              border: highlightedStep === step.id ? '2px solid #1890ff' : 'none',
              borderRadius: '8px',
              padding: highlightedStep === step.id ? '8px' : '0',
              backgroundColor: highlightedStep === step.id ? 'rgba(24, 144, 255, 0.1)' : 'transparent'
            }}
          >
            <Card
              size="small"
              className="glass-card"
              style={{ marginBottom: '8px', cursor: onStepClick ? 'pointer' : 'default' }}
              onClick={() => onStepClick?.(step)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                    <Tag color={step.type === 'analysis' ? 'blue' : step.type === 'decision' ? 'purple' : 
                              step.type === 'action' ? 'green' : step.type === 'adaptation' ? 'orange' :
                              step.type === 'recovery' ? 'red' : 'gold'}>
                      {step.type.toUpperCase()}
                    </Tag>
                    <Text style={{ color: 'white', fontWeight: 'bold' }}>
                      {step.title}
                    </Text>
                  </div>
                  
                  <Paragraph style={{ color: 'rgba(255, 255, 255, 0.8)', marginBottom: '8px' }}>
                    {step.description}
                  </Paragraph>

                  {showDetails && (
                    <Collapse
                      ghost
                      size="small"
                      activeKey={expandedPanels}
                      onChange={(keys) => setExpandedPanels(keys as string[])}
                    >
                      <Panel
                        header={
                          <Text style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                            <BulbOutlined style={{ marginRight: '8px' }} />
                            AI Thinking Process
                          </Text>
                        }
                        key={step.id}
                      >
                        <div style={{ padding: '8px', backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: '4px' }}>
                          <Text style={{ color: 'rgba(255, 255, 255, 0.9)', fontFamily: 'monospace', fontSize: '12px' }}>
                            {step.thinking}
                          </Text>
                        </div>
                        
                        {step.alternatives && step.alternatives.length > 0 && (
                          <div style={{ marginTop: '8px' }}>
                            <Text style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '12px' }}>
                              Alternatives considered:
                            </Text>
                            <div style={{ marginTop: '4px' }}>
                              {step.alternatives.map((alt, idx) => (
                                <Tag key={idx} style={{ margin: '2px', fontSize: '12px' }}>
                                  {alt}
                                </Tag>
                              ))}
                            </div>
                          </div>
                        )}
                      </Panel>
                    </Collapse>
                  )}
                </div>

                <div style={{ marginLeft: '16px', textAlign: 'right' }}>
                  <div style={{ marginBottom: '4px' }}>
                    <Tooltip title={`Confidence: ${(step.confidence * 100).toFixed(1)}%`}>
                      <Progress
                        type="circle"
                        size={40}
                        percent={step.confidence * 100}
                        strokeColor={getConfidenceColor(step.confidence)}
                        format={() => `${Math.round(step.confidence * 100)}%`}
                      />
                    </Tooltip>
                  </div>
                  
                  <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.5)' }}>
                    {formatExecutionTime(step.executionTime)}
                  </div>
                  
                  <div style={{ marginTop: '4px' }}>
                    {step.cacheHit && (
                      <Tooltip title="Cache Hit">
                        <Tag color="green" style={{ fontSize: '12px' }}>C</Tag>
                      </Tooltip>
                    )}
                    {step.memoryUsed && (
                      <Tooltip title="Memory Pattern Used">
                        <Tag color="blue" style={{ fontSize: '12px' }}>M</Tag>
                      </Tooltip>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )
      }))}
    />
  );

  const renderAdaptationsAndErrors = () => (
    <Row gutter={16}>
      {context.adaptations.length > 0 && (
        <Col span={12}>
          <Alert
            message="Adaptations Made"
            description={
              <ul style={{ margin: 0, paddingLeft: '16px' }}>
                {context.adaptations.map((adaptation, idx) => (
                  <li key={idx} style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                    {adaptation}
                  </li>
                ))}
              </ul>
            }
            type="info"
            showIcon
            icon={<SettingOutlined />}
            style={{ marginBottom: '16px' }}
          />
        </Col>
      )}
      
      {context.errors.length > 0 && (
        <Col span={12}>
          <Alert
            message="Errors Encountered"
            description={
              <ul style={{ margin: 0, paddingLeft: '16px' }}>
                {context.errors.map((error, idx) => (
                  <li key={idx} style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                    {error}
                  </li>
                ))}
              </ul>
            }
            type="error"
            showIcon
            icon={<ExclamationCircleOutlined />}
            style={{ marginBottom: '16px' }}
          />
        </Col>
      )}
    </Row>
  );

  return (
    <div>
      <Card className="glass-card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <Title level={4} style={{ color: 'white', margin: 0 }}>
            <BulbOutlined style={{ marginRight: '8px' }} />
            AI Reasoning & Decision Making
            {isLive && (
              <Badge
                status="processing"
                text="Live"
                style={{ marginLeft: '12px', color: 'rgba(255, 255, 255, 0.7)' }}
              />
            )}
          </Title>
          
          <Space>
            <Text style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
              Task: {context.objective}
            </Text>
            <Tag color="blue">
              Step {context.currentStep}/{context.totalSteps}
            </Tag>
          </Space>
        </div>

        {context.performance && renderPerformanceStats()}
        
        {(context.adaptations.length > 0 || context.errors.length > 0) && 
         renderAdaptationsAndErrors()}
      </Card>

      <Card className="glass-card">
        <Title level={5} style={{ color: 'white', marginBottom: '16px' }}>
          Reasoning Timeline
        </Title>
        
        {context.reasoning.length > 0 ? (
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {renderReasoningTimeline()}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <BulbOutlined style={{ fontSize: '32px', color: 'rgba(255, 255, 255, 0.5)' }} />
            <Text style={{ color: 'rgba(255, 255, 255, 0.7)', display: 'block', marginTop: '8px' }}>
              AI reasoning will appear here as the task progresses
            </Text>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AIReasoningDisplay;