import React, { useState } from 'react';
import {
  Card,
  Typography,
  Button,
  Modal,
  Input,
  Select,
  Space,
  Alert,
  Tooltip,
  Tag,
  Collapse,
  Row,
  Col,
  Progress,
  Switch,
  Slider,
  Divider
} from 'antd';
import {
  QuestionCircleOutlined,
  EditOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  BulbOutlined,
  SettingOutlined,
  InfoCircleOutlined,
  WarningOutlined,
  ThunderboltOutlined,
  EyeOutlined
} from '@ant-design/icons';
import { motion } from 'framer-motion';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;
const { Panel } = Collapse;

export interface AIDecision {
  id: string;
  timestamp: number;
  type: 'element_selection' | 'action_choice' | 'strategy_adaptation' | 'error_recovery' | 'data_extraction';
  title: string;
  description: string;
  reasoning: string;
  confidence: number;
  alternatives: {
    id: string;
    description: string;
    confidence: number;
    pros: string[];
    cons: string[];
  }[];
  context: {
    pageUrl: string;
    pageTitle: string;
    currentStep: number;
    totalSteps: number;
    previousActions: string[];
  };
  userOverridable: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  impact: 'minor' | 'moderate' | 'significant' | 'critical';
}

export interface UserOverride {
  decisionId: string;
  overrideType: 'alternative' | 'custom' | 'skip';
  alternativeId?: string;
  customAction?: string;
  reason: string;
  timestamp: number;
}

interface AITransparencyInterfaceProps {
  decisions: AIDecision[];
  onOverride?: (override: UserOverride) => void;
  onExplainMore?: (decisionId: string) => void;
  showConfidenceThreshold?: boolean;
  confidenceThreshold?: number;
  onConfidenceThresholdChange?: (threshold: number) => void;
  autoApproveHighConfidence?: boolean;
  onAutoApproveChange?: (enabled: boolean) => void;
}

const AITransparencyInterface: React.FC<AITransparencyInterfaceProps> = ({
  decisions,
  onOverride,
  onExplainMore,
  showConfidenceThreshold = true,
  confidenceThreshold = 0.8,
  onConfidenceThresholdChange,
  autoApproveHighConfidence = true,
  onAutoApproveChange
}) => {
  const [selectedDecision, setSelectedDecision] = useState<AIDecision | null>(null);
  const [overrideModalVisible, setOverrideModalVisible] = useState(false);
  const [overrideType, setOverrideType] = useState<'alternative' | 'custom' | 'skip'>('alternative');
  const [selectedAlternative, setSelectedAlternative] = useState<string>('');
  const [customAction, setCustomAction] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [expandedDecisions, setExpandedDecisions] = useState<string[]>([]);

  const getRiskColor = (risk: AIDecision['riskLevel']) => {
    switch (risk) {
      case 'low': return '#52c41a';
      case 'medium': return '#faad14';
      case 'high': return '#ff4d4f';
      default: return '#1890ff';
    }
  };

  const getImpactColor = (impact: AIDecision['impact']) => {
    switch (impact) {
      case 'minor': return '#52c41a';
      case 'moderate': return '#faad14';
      case 'significant': return '#ff7a45';
      case 'critical': return '#ff4d4f';
      default: return '#1890ff';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return '#52c41a';
    if (confidence >= 0.6) return '#faad14';
    return '#ff4d4f';
  };

  const getDecisionIcon = (type: AIDecision['type']) => {
    switch (type) {
      case 'element_selection': return <EyeOutlined />;
      case 'action_choice': return <ThunderboltOutlined />;
      case 'strategy_adaptation': return <SettingOutlined />;
      case 'error_recovery': return <WarningOutlined />;
      case 'data_extraction': return <InfoCircleOutlined />;
      default: return <BulbOutlined />;
    }
  };

  const handleOverrideClick = (decision: AIDecision) => {
    setSelectedDecision(decision);
    setOverrideModalVisible(true);
    setOverrideType('alternative');
    setSelectedAlternative('');
    setCustomAction('');
    setOverrideReason('');
  };

  const handleOverrideSubmit = () => {
    if (!selectedDecision || !onOverride) return;

    const override: UserOverride = {
      decisionId: selectedDecision.id,
      overrideType,
      alternativeId: overrideType === 'alternative' ? selectedAlternative : undefined,
      customAction: overrideType === 'custom' ? customAction : undefined,
      reason: overrideReason,
      timestamp: Date.now()
    };

    onOverride(override);
    setOverrideModalVisible(false);
    setSelectedDecision(null);
  };

  const renderDecisionCard = (decision: AIDecision) => (
    <motion.div
      key={decision.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card
        className="glass-card"
        style={{ 
          marginBottom: '16px',
          border: decision.confidence < confidenceThreshold ? '2px solid #faad14' : 'none'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ marginRight: '12px', fontSize: '20px', color: '#1890ff' }}>
                {getDecisionIcon(decision.type)}
              </div>
              
              <div style={{ flex: 1 }}>
                <Title level={5} style={{ color: 'white', margin: 0 }}>
                  {decision.title}
                </Title>
                <Text style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '12px' }}>
                  {new Date(decision.timestamp).toLocaleString()}
                </Text>
              </div>

              <Space>
                <Tag color={getRiskColor(decision.riskLevel)}>
                  {decision.riskLevel.toUpperCase()} RISK
                </Tag>
                <Tag color={getImpactColor(decision.impact)}>
                  {decision.impact.toUpperCase()} IMPACT
                </Tag>
              </Space>
            </div>

            <Paragraph style={{ color: 'rgba(255, 255, 255, 0.8)', marginBottom: '12px' }}>
              {decision.description}
            </Paragraph>

            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
              <Text style={{ color: 'white', marginRight: '12px' }}>
                Confidence:
              </Text>
              <Progress
                percent={decision.confidence * 100}
                size="small"
                strokeColor={getConfidenceColor(decision.confidence)}
                style={{ flex: 1, marginRight: '12px' }}
              />
              <Text style={{ color: getConfidenceColor(decision.confidence) }}>
                {(decision.confidence * 100).toFixed(1)}%
              </Text>
            </div>

            {decision.confidence < confidenceThreshold && (
              <Alert
                message="Low Confidence Decision"
                description="This decision has low confidence and may benefit from review"
                type="warning"
                showIcon
                style={{ marginBottom: '12px' }}
              />
            )}

            <Collapse
              ghost
              size="small"
              activeKey={expandedDecisions}
              onChange={(keys) => setExpandedDecisions(keys as string[])}
            >
              <Panel
                header={
                  <Text style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                    <BulbOutlined style={{ marginRight: '8px' }} />
                    AI Reasoning
                  </Text>
                }
                key={`reasoning-${decision.id}`}
              >
                <div style={{ padding: '8px', backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: '4px' }}>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.9)', fontFamily: 'monospace', fontSize: '12px' }}>
                    {decision.reasoning}
                  </Text>
                </div>
              </Panel>

              {decision.alternatives.length > 0 && (
                <Panel
                  header={
                    <Text style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                      <SettingOutlined style={{ marginRight: '8px' }} />
                      Alternatives ({decision.alternatives.length})
                    </Text>
                  }
                  key={`alternatives-${decision.id}`}
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {decision.alternatives.map((alt, idx) => (
                      <Card
                        key={alt.id}
                        size="small"
                        style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <Text style={{ color: 'white', fontWeight: 'bold' }}>
                            Alternative {idx + 1}
                          </Text>
                          <Progress
                            type="circle"
                            size={24}
                            percent={alt.confidence * 100}
                            format={() => `${Math.round(alt.confidence * 100)}%`}
                            strokeColor={getConfidenceColor(alt.confidence)}
                          />
                        </div>
                        
                        <Text style={{ color: 'rgba(255, 255, 255, 0.8)', display: 'block', marginBottom: '8px' }}>
                          {alt.description}
                        </Text>

                        <Row gutter={16}>
                          <Col span={12}>
                            <Text style={{ color: '#52c41a', fontWeight: 'bold', fontSize: '12px' }}>
                              Pros:
                            </Text>
                            <ul style={{ margin: '4px 0', paddingLeft: '16px' }}>
                              {alt.pros.map((pro, proIdx) => (
                                <li key={proIdx} style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '11px' }}>
                                  {pro}
                                </li>
                              ))}
                            </ul>
                          </Col>
                          <Col span={12}>
                            <Text style={{ color: '#ff4d4f', fontWeight: 'bold', fontSize: '12px' }}>
                              Cons:
                            </Text>
                            <ul style={{ margin: '4px 0', paddingLeft: '16px' }}>
                              {alt.cons.map((con, conIdx) => (
                                <li key={conIdx} style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '11px' }}>
                                  {con}
                                </li>
                              ))}
                            </ul>
                          </Col>
                        </Row>
                      </Card>
                    ))}
                  </Space>
                </Panel>
              )}

              <Panel
                header={
                  <Text style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                    <InfoCircleOutlined style={{ marginRight: '8px' }} />
                    Context
                  </Text>
                }
                key={`context-${decision.id}`}
              >
                <Row gutter={16}>
                  <Col span={12}>
                    <Text style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px' }}>
                      Page: {decision.context.pageTitle}
                    </Text>
                  </Col>
                  <Col span={12}>
                    <Text style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px' }}>
                      Step: {decision.context.currentStep}/{decision.context.totalSteps}
                    </Text>
                  </Col>
                </Row>
                <Text style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '11px', display: 'block', marginTop: '8px' }}>
                  URL: {decision.context.pageUrl}
                </Text>
                {decision.context.previousActions.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    <Text style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px' }}>
                      Previous actions:
                    </Text>
                    <div style={{ marginTop: '4px' }}>
                      {decision.context.previousActions.slice(-3).map((action, idx) => (
                        <Tag key={idx} style={{ margin: '2px', fontSize: '12px' }}>
                          {action}
                        </Tag>
                      ))}
                    </div>
                  </div>
                )}
              </Panel>
            </Collapse>
          </div>

          <div style={{ marginLeft: '16px' }}>
            <Space direction="vertical">
              {onExplainMore && (
                <Tooltip title="Get more detailed explanation">
                  <Button
                    icon={<QuestionCircleOutlined />}
                    size="small"
                    onClick={() => onExplainMore(decision.id)}
                  >
                    Explain
                  </Button>
                </Tooltip>
              )}
              
              {decision.userOverridable && onOverride && (
                <Tooltip title="Override this decision">
                  <Button
                    icon={<EditOutlined />}
                    size="small"
                    type="primary"
                    onClick={() => handleOverrideClick(decision)}
                  >
                    Override
                  </Button>
                </Tooltip>
              )}
            </Space>
          </div>
        </div>
      </Card>
    </motion.div>
  );

  const renderOverrideModal = () => (
    <Modal
      title="Override AI Decision"
      open={overrideModalVisible}
      onOk={handleOverrideSubmit}
      onCancel={() => setOverrideModalVisible(false)}
      okText="Apply Override"
      cancelText="Cancel"
      width={600}
    >
      {selectedDecision && (
        <div>
          <Alert
            message={`Overriding: ${selectedDecision.title}`}
            description={selectedDecision.description}
            type="info"
            style={{ marginBottom: '16px' }}
          />

          <div style={{ marginBottom: '16px' }}>
            <Text strong>Override Type:</Text>
            <Select
              value={overrideType}
              onChange={setOverrideType}
              style={{ width: '100%', marginTop: '8px' }}
            >
              <Option value="alternative">Choose Alternative</Option>
              <Option value="custom">Custom Action</Option>
              <Option value="skip">Skip This Step</Option>
            </Select>
          </div>

          {overrideType === 'alternative' && selectedDecision.alternatives.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <Text strong>Select Alternative:</Text>
              <Select
                value={selectedAlternative}
                onChange={setSelectedAlternative}
                style={{ width: '100%', marginTop: '8px' }}
                placeholder="Choose an alternative"
              >
                {selectedDecision.alternatives.map((alt, idx) => (
                  <Option key={alt.id} value={alt.id}>
                    Alternative {idx + 1}: {alt.description} ({(alt.confidence * 100).toFixed(1)}% confidence)
                  </Option>
                ))}
              </Select>
            </div>
          )}

          {overrideType === 'custom' && (
            <div style={{ marginBottom: '16px' }}>
              <Text strong>Custom Action:</Text>
              <TextArea
                value={customAction}
                onChange={(e) => setCustomAction(e.target.value)}
                placeholder="Describe the custom action you want to take..."
                rows={3}
                style={{ marginTop: '8px' }}
              />
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <Text strong>Reason for Override:</Text>
            <TextArea
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="Explain why you're overriding this decision..."
              rows={2}
              style={{ marginTop: '8px' }}
            />
          </div>

          <Alert
            message="Override Impact"
            description={`This decision has ${selectedDecision.impact} impact and ${selectedDecision.riskLevel} risk. Your override will be applied immediately.`}
            type="warning"
            showIcon
          />
        </div>
      )}
    </Modal>
  );

  const renderSettings = () => (
    <Card className="glass-card" style={{ marginBottom: '16px' }}>
      <Title level={5} style={{ color: 'white', marginBottom: '16px' }}>
        AI Transparency Settings
      </Title>
      
      <Row gutter={16}>
        <Col span={12}>
          <div style={{ marginBottom: '16px' }}>
            <Text style={{ color: 'white', display: 'block', marginBottom: '8px' }}>
              Auto-approve high confidence decisions
            </Text>
            <Switch
              checked={autoApproveHighConfidence}
              onChange={onAutoApproveChange}
              checkedChildren="ON"
              unCheckedChildren="OFF"
            />
          </div>
        </Col>
        
        {showConfidenceThreshold && (
          <Col span={12}>
            <div style={{ marginBottom: '16px' }}>
              <Text style={{ color: 'white', display: 'block', marginBottom: '8px' }}>
                Confidence Threshold: {(confidenceThreshold * 100).toFixed(0)}%
              </Text>
              <Slider
                min={0.5}
                max={1.0}
                step={0.05}
                value={confidenceThreshold}
                onChange={onConfidenceThresholdChange}
                marks={{
                  0.5: '50%',
                  0.7: '70%',
                  0.9: '90%',
                  1.0: '100%'
                }}
              />
            </div>
          </Col>
        )}
      </Row>
    </Card>
  );

  return (
    <div>
      {(showConfidenceThreshold || autoApproveHighConfidence !== undefined) && renderSettings()}
      
      <Card className="glass-card">
        <Title level={4} style={{ color: 'white', marginBottom: '16px' }}>
          <BulbOutlined style={{ marginRight: '8px' }} />
          AI Decision Transparency
        </Title>

        {decisions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <BulbOutlined style={{ fontSize: '48px', color: 'rgba(255, 255, 255, 0.5)' }} />
            <Title level={4} style={{ color: 'rgba(255, 255, 255, 0.7)', marginTop: '16px' }}>
              No AI decisions to review
            </Title>
            <Text style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
              AI decisions will appear here as tasks are executed
            </Text>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <Text style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                Showing {decisions.length} AI decision{decisions.length !== 1 ? 's' : ''}
              </Text>
              <Text style={{ color: 'rgba(255, 255, 255, 0.5)', marginLeft: '16px' }}>
                Low confidence decisions are highlighted
              </Text>
            </div>
            
            {decisions.map(renderDecisionCard)}
          </div>
        )}
      </Card>

      {renderOverrideModal()}
    </div>
  );
};

export default AITransparencyInterface;