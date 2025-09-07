import React, { useState, useEffect } from 'react';
import {
  Card,
  Progress,
  Typography,
  Timeline,
  Tag,
  Space,
  Row,
  Col,
  Statistic,
  Alert,
  Tooltip,
  Button,
  Collapse,
  Badge
} from 'antd';
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  ExclamationCircleOutlined,
  ThunderboltOutlined,
  EyeOutlined,
  BulbOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  StopOutlined
} from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';

const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;

export interface TaskStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startTime?: number;
  endTime?: number;
  progress: number;
  aiInsights?: {
    confidence: number;
    reasoning: string;
    alternatives: string[];
    adaptations: string[];
    obstacles: string[];
  };
  subSteps?: TaskStep[];
  metadata?: {
    retryCount: number;
    cacheHit: boolean;
    memoryUsed: boolean;
    executionTime: number;
  };
}

export interface TaskProgress {
  taskId: string;
  objective: string;
  status: 'initializing' | 'planning' | 'executing' | 'completed' | 'failed' | 'paused';
  overallProgress: number;
  currentStep: number;
  totalSteps: number;
  steps: TaskStep[];
  startTime: number;
  estimatedCompletion?: number;
  actualCompletion?: number;
  performance: {
    successRate: number;
    averageStepTime: number;
    totalRetries: number;
    cacheHitRate: number;
    adaptationCount: number;
  };
  obstacles: string[];
  adaptations: string[];
}

interface AIProgressMonitorProps {
  progress: TaskProgress | null;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
  onStepClick?: (step: TaskStep) => void;
  showDetails?: boolean;
}

const AIProgressMonitor: React.FC<AIProgressMonitorProps> = ({
  progress,
  onPause,
  onResume,
  onStop,
  onStepClick,
  showDetails = true
}) => {
  const [expandedSteps, setExpandedSteps] = useState<string[]>([]);
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (progress?.steps) {
      const runningStep = progress.steps.find(step => step.status === 'running');
      if (runningStep && !expandedSteps.includes(runningStep.id)) {
        setExpandedSteps(prev => [...prev, runningStep.id]);
      }
    }
  }, [progress?.steps, expandedSteps]);

  if (!progress) {
    return (
      <Card className="glass-card">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <ClockCircleOutlined style={{ fontSize: '48px', color: 'rgba(255, 255, 255, 0.5)' }} />
          <Title level={4} style={{ color: 'rgba(255, 255, 255, 0.7)', marginTop: '16px' }}>
            No task in progress
          </Title>
          <Text style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
            Start an automation task to monitor progress
          </Text>
        </div>
      </Card>
    );
  }

  const getStatusIcon = (status: TaskStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'running':
        return <LoadingOutlined style={{ color: '#1890ff' }} />;
      case 'failed':
        return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
      case 'skipped':
        return <ExclamationCircleOutlined style={{ color: '#faad14' }} />;
      default:
        return <ClockCircleOutlined style={{ color: 'rgba(255, 255, 255, 0.5)' }} />;
    }
  };

  const getStatusColor = (status: TaskStep['status']) => {
    switch (status) {
      case 'completed':
        return '#52c41a';
      case 'running':
        return '#1890ff';
      case 'failed':
        return '#ff4d4f';
      case 'skipped':
        return '#faad14';
      default:
        return 'rgba(255, 255, 255, 0.3)';
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const getElapsedTime = () => {
    return currentTime - progress.startTime;
  };

  const getEstimatedTimeRemaining = () => {
    if (progress.estimatedCompletion) {
      const remaining = progress.estimatedCompletion - currentTime;
      return remaining > 0 ? remaining : 0;
    }
    return null;
  };

  const renderOverallProgress = () => (
    <Card className="glass-card" style={{ marginBottom: '16px' }}>
      <Row gutter={16} align="middle">
        <Col span={12}>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <Title level={4} style={{ color: 'white', margin: 0 }}>
                {progress.objective}
              </Title>
              <Tag color={progress.status === 'executing' ? 'blue' : 
                         progress.status === 'completed' ? 'green' :
                         progress.status === 'failed' ? 'red' : 'orange'}>
                {progress.status.toUpperCase()}
              </Tag>
            </div>
            
            <Progress
              percent={progress.overallProgress}
              status={progress.status === 'executing' ? 'active' : 
                     progress.status === 'completed' ? 'success' :
                     progress.status === 'failed' ? 'exception' : 'normal'}
              strokeColor={{
                '0%': '#667eea',
                '100%': '#764ba2',
              }}
              trailColor="rgba(255, 255, 255, 0.1)"
            />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
              <Text style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                Step {progress.currentStep} of {progress.totalSteps}
              </Text>
              <Text style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                {progress.overallProgress.toFixed(1)}% Complete
              </Text>
            </div>
          </div>
        </Col>
        
        <Col span={12}>
          <Row gutter={16}>
            <Col span={8}>
              <Statistic
                title="Elapsed Time"
                value={formatDuration(getElapsedTime())}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: 'white', fontSize: '14px' }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Est. Remaining"
                value={getEstimatedTimeRemaining() ? formatDuration(getEstimatedTimeRemaining()!) : 'Calculating...'}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: 'white', fontSize: '14px' }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Success Rate"
                value={`${(progress.performance.successRate * 100).toFixed(1)}%`}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: 'white', fontSize: '14px' }}
              />
            </Col>
          </Row>
        </Col>
      </Row>

      {(onPause || onResume || onStop) && (
        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <Space>
            {progress.status === 'executing' && onPause && (
              <Button
                icon={<PauseCircleOutlined />}
                onClick={onPause}
                type="default"
              >
                Pause
              </Button>
            )}
            {progress.status === 'paused' && onResume && (
              <Button
                icon={<PlayCircleOutlined />}
                onClick={onResume}
                type="primary"
              >
                Resume
              </Button>
            )}
            {onStop && (
              <Button
                icon={<StopOutlined />}
                onClick={onStop}
                danger
              >
                Stop
              </Button>
            )}
          </Space>
        </div>
      )}
    </Card>
  );

  const renderPerformanceMetrics = () => (
    <Card className="glass-card" style={{ marginBottom: '16px' }}>
      <Title level={5} style={{ color: 'white', marginBottom: '16px' }}>
        Performance Metrics
      </Title>
      
      <Row gutter={16}>
        <Col span={6}>
          <Statistic
            title="Avg Step Time"
            value={formatDuration(progress.performance.averageStepTime)}
            prefix={<ThunderboltOutlined />}
            valueStyle={{ color: 'white', fontSize: '14px' }}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="Cache Hit Rate"
            value={`${(progress.performance.cacheHitRate * 100).toFixed(1)}%`}
            prefix={<EyeOutlined />}
            valueStyle={{ color: 'white', fontSize: '14px' }}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="Adaptations"
            value={progress.performance.adaptationCount}
            prefix={<BulbOutlined />}
            valueStyle={{ color: 'white', fontSize: '14px' }}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="Retries"
            value={progress.performance.totalRetries}
            prefix={<WarningOutlined />}
            valueStyle={{ color: 'white', fontSize: '14px' }}
          />
        </Col>
      </Row>
    </Card>
  );

  const renderStepDetails = (step: TaskStep) => (
    <div style={{ padding: '12px', backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px' }}>
      {step.aiInsights && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <Text style={{ color: 'white', fontWeight: 'bold' }}>
              <BulbOutlined style={{ marginRight: '8px' }} />
              AI Insights
            </Text>
            <Progress
              type="circle"
              size={32}
              percent={step.aiInsights.confidence * 100}
              format={() => `${Math.round(step.aiInsights.confidence * 100)}%`}
              strokeColor={step.aiInsights.confidence > 0.8 ? '#52c41a' : 
                          step.aiInsights.confidence > 0.6 ? '#faad14' : '#ff4d4f'}
            />
          </div>
          
          <Paragraph style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '12px', fontFamily: 'monospace' }}>
            {step.aiInsights.reasoning}
          </Paragraph>

          {step.aiInsights.alternatives.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <Text style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '12px' }}>
                Alternatives considered:
              </Text>
              <div style={{ marginTop: '4px' }}>
                {step.aiInsights.alternatives.map((alt, idx) => (
                  <Tag key={idx} style={{ margin: '2px', fontSize: '12px' }}>
                    {alt}
                  </Tag>
                ))}
              </div>
            </div>
          )}

          {step.aiInsights.obstacles.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <Alert
                message="Obstacles Detected"
                description={step.aiInsights.obstacles.join(', ')}
                type="warning"
                showIcon
                style={{ fontSize: '12px' }}
              />
            </div>
          )}
        </div>
      )}

      {step.metadata && (
        <Row gutter={8}>
          <Col span={6}>
            <Text style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '11px' }}>
              Execution: {formatDuration(step.metadata.executionTime)}
            </Text>
          </Col>
          <Col span={6}>
            <Text style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '11px' }}>
              Retries: {step.metadata.retryCount}
            </Text>
          </Col>
          <Col span={6}>
            {step.metadata.cacheHit && (
              <Tag color="green" style={{ fontSize: '12px' }}>Cache Hit</Tag>
            )}
          </Col>
          <Col span={6}>
            {step.metadata.memoryUsed && (
              <Tag color="blue" style={{ fontSize: '12px' }}>Memory Used</Tag>
            )}
          </Col>
        </Row>
      )}

      {step.subSteps && step.subSteps.length > 0 && (
        <div style={{ marginTop: '12px' }}>
          <Text style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '12px' }}>
            Sub-steps:
          </Text>
          <div style={{ marginTop: '8px', marginLeft: '16px' }}>
            {step.subSteps.map((subStep, idx) => (
              <div key={subStep.id} style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                {getStatusIcon(subStep.status)}
                <Text style={{ color: 'rgba(255, 255, 255, 0.8)', marginLeft: '8px', fontSize: '11px' }}>
                  {subStep.name}
                </Text>
                {subStep.progress > 0 && (
                  <Progress
                    percent={subStep.progress}
                    size="small"
                    style={{ marginLeft: '8px', width: '60px' }}
                    showInfo={false}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderStepsTimeline = () => (
    <Card className="glass-card">
      <Title level={5} style={{ color: 'white', marginBottom: '16px' }}>
        Task Steps
      </Title>
      
      <Timeline
        mode="left"
        items={progress.steps.map((step, index) => ({
          key: step.id,
          dot: (
            <Badge
              count={step.metadata?.retryCount || 0}
              size="small"
              style={{ backgroundColor: '#ff4d4f' }}
              offset={[8, -8]}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: getStatusColor(step.status),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '14px'
                }}
              >
                {getStatusIcon(step.status)}
              </div>
            </Badge>
          ),
          color: getStatusColor(step.status),
          children: (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <Card
                size="small"
                className="glass-card"
                style={{ 
                  marginBottom: '8px',
                  cursor: onStepClick ? 'pointer' : 'default',
                  border: step.status === 'running' ? '2px solid #1890ff' : 'none'
                }}
                onClick={() => onStepClick?.(step)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                      <Text style={{ color: 'white', fontWeight: 'bold' }}>
                        {step.name}
                      </Text>
                      {step.status === 'running' && (
                        <Badge status="processing" style={{ marginLeft: '8px' }} />
                      )}
                    </div>
                    
                    <Paragraph style={{ color: 'rgba(255, 255, 255, 0.8)', marginBottom: '8px' }}>
                      {step.description}
                    </Paragraph>

                    {step.progress > 0 && step.status !== 'completed' && (
                      <Progress
                        percent={step.progress}
                        size="small"
                        status={step.status === 'running' ? 'active' : 'normal'}
                        strokeColor="#1890ff"
                        trailColor="rgba(255, 255, 255, 0.1)"
                      />
                    )}

                    {showDetails && (step.aiInsights || step.metadata || (step.subSteps && step.subSteps.length > 0)) && (
                      <Collapse
                        ghost
                        size="small"
                        activeKey={expandedSteps}
                        onChange={(keys) => setExpandedSteps(keys as string[])}
                      >
                        <Panel
                          header={
                            <Text style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                              <InfoCircleOutlined style={{ marginRight: '8px' }} />
                              Details
                            </Text>
                          }
                          key={step.id}
                        >
                          {renderStepDetails(step)}
                        </Panel>
                      </Collapse>
                    )}
                  </div>

                  <div style={{ marginLeft: '16px', textAlign: 'right' }}>
                    {step.startTime && (
                      <Text style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '10px' }}>
                        {new Date(step.startTime).toLocaleTimeString()}
                      </Text>
                    )}
                    {step.endTime && step.startTime && (
                      <div style={{ marginTop: '2px' }}>
                        <Text style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '10px' }}>
                          {formatDuration(step.endTime - step.startTime)}
                        </Text>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          )
        }))}
      />
    </Card>
  );

  const renderObstaclesAndAdaptations = () => (
    <Row gutter={16}>
      {progress.obstacles.length > 0 && (
        <Col span={12}>
          <Alert
            message="Obstacles Encountered"
            description={
              <ul style={{ margin: 0, paddingLeft: '16px' }}>
                {progress.obstacles.map((obstacle, idx) => (
                  <li key={idx} style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                    {obstacle}
                  </li>
                ))}
              </ul>
            }
            type="warning"
            showIcon
            style={{ marginBottom: '16px' }}
          />
        </Col>
      )}
      
      {progress.adaptations.length > 0 && (
        <Col span={12}>
          <Alert
            message="Adaptations Made"
            description={
              <ul style={{ margin: 0, paddingLeft: '16px' }}>
                {progress.adaptations.map((adaptation, idx) => (
                  <li key={idx} style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                    {adaptation}
                  </li>
                ))}
              </ul>
            }
            type="info"
            showIcon
            style={{ marginBottom: '16px' }}
          />
        </Col>
      )}
    </Row>
  );

  return (
    <div>
      {renderOverallProgress()}
      {renderPerformanceMetrics()}
      {(progress.obstacles.length > 0 || progress.adaptations.length > 0) && 
       renderObstaclesAndAdaptations()}
      {renderStepsTimeline()}
    </div>
  );
};

export default AIProgressMonitor;