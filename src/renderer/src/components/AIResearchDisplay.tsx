import React from 'react';
import {
  Card,
  Typography,
  Space,
  Divider,
  List,
  Tag,
  Progress,
  Alert,
  Collapse,
  Row,
  Col,
  Statistic
} from 'antd';
import {
  BulbOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  StarOutlined,
  TrophyOutlined,
  RobotOutlined
} from '@ant-design/icons';
import { motion } from 'framer-motion';

const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;

interface AIResearchDisplayProps {
  result: any;
  onExport?: (format: 'pdf' | 'excel' | 'csv' | 'json') => void;
}

const AIResearchDisplay: React.FC<AIResearchDisplayProps> = ({ result, onExport }) => {
  // Find the AI synthesis data
  const aiSynthesis = result?.extractedData?.find((item: any) => 
    item.type === 'structured' && item.content?.aiSynthesis
  );

  if (!aiSynthesis) {
    return null; // No AI synthesis available
  }

  const {
    aiSynthesis: summary,
    structuredFindings,
    keyInsights,
    researchQuality,
    sourcesAnalyzed
  } = aiSynthesis.content;

  const renderStructuredFindings = () => {
    if (!structuredFindings || Object.keys(structuredFindings).length === 0) {
      return null;
    }

    // Handle different types of structured data
    if (structuredFindings.competitors) {
      return (
        <Card className="glass-card" style={{ marginTop: '16px' }}>
          <Title level={4} style={{ color: 'white', marginBottom: '16px' }}>
            <TrophyOutlined style={{ marginRight: '8px' }} />
            Competitor Analysis
          </Title>
          <List
            dataSource={structuredFindings.competitors}
            renderItem={(competitor: any, index: number) => (
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
                      color: 'white',
                      fontWeight: 'bold'
                    }}>
                      {index + 1}
                    </div>
                  }
                  title={
                    <Text style={{ color: 'white', fontSize: '16px', fontWeight: 'bold' }}>
                      {competitor.name}
                    </Text>
                  }
                  description={
                    <Text style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                      {competitor.description}
                    </Text>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
      );
    }

    // Handle other structured data types
    return (
      <Card className="glass-card" style={{ marginTop: '16px' }}>
        <Title level={4} style={{ color: 'white', marginBottom: '16px' }}>
          <InfoCircleOutlined style={{ marginRight: '8px' }} />
          Structured Findings
        </Title>
        <pre style={{ 
          color: 'white', 
          background: 'rgba(0,0,0,0.3)', 
          padding: '16px', 
          borderRadius: '8px',
          overflow: 'auto'
        }}>
          {JSON.stringify(structuredFindings, null, 2)}
        </pre>
      </Card>
    );
  };

  return (
    <div className="ai-research-display">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* AI Research Header */}
        <Card className="glass-card" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <RobotOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
              <Title level={3} style={{ color: 'white', margin: 0 }}>
                AI Research Results
              </Title>
              <Tag color="blue">Enhanced by AI</Tag>
            </Space>
            
            <Row gutter={16}>
              <Col>
                <Statistic
                  title={<span style={{ color: 'rgba(255,255,255,0.6)' }}>Quality Score</span>}
                  value={Math.round(researchQuality * 100)}
                  suffix="%"
                  valueStyle={{ color: researchQuality > 0.8 ? '#52c41a' : researchQuality > 0.6 ? '#faad14' : '#ff4d4f' }}
                />
              </Col>
              <Col>
                <Statistic
                  title={<span style={{ color: 'rgba(255,255,255,0.6)' }}>Sources</span>}
                  value={sourcesAnalyzed}
                  valueStyle={{ color: 'white' }}
                />
              </Col>
            </Row>
          </div>
        </Card>

        {/* Research Quality Indicator */}
        <Alert
          message={
            researchQuality > 0.8 ? "High Quality Research" :
            researchQuality > 0.6 ? "Good Quality Research" :
            "Basic Research Results"
          }
          description={
            researchQuality > 0.8 ? "AI has high confidence in these findings based on multiple reliable sources." :
            researchQuality > 0.6 ? "AI has moderate confidence in these findings. Some information may need verification." :
            "AI has limited confidence. Results should be verified with additional sources."
          }
          type={researchQuality > 0.8 ? "success" : researchQuality > 0.6 ? "info" : "warning"}
          showIcon
          style={{ marginBottom: '16px' }}
        />

        {/* AI Summary */}
        <Card className="glass-card" style={{ marginBottom: '16px' }}>
          <Title level={4} style={{ color: 'white', marginBottom: '16px' }}>
            <BulbOutlined style={{ marginRight: '8px' }} />
            AI Research Summary
          </Title>
          <Paragraph style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '16px', lineHeight: '1.6' }}>
            {summary}
          </Paragraph>
        </Card>

        {/* Key Insights */}
        {keyInsights && keyInsights.length > 0 && (
          <Card className="glass-card" style={{ marginBottom: '16px' }}>
            <Title level={4} style={{ color: 'white', marginBottom: '16px' }}>
              <StarOutlined style={{ marginRight: '8px' }} />
              Key Insights
            </Title>
            <List
              dataSource={keyInsights}
              renderItem={(insight: string, index: number) => (
                <List.Item style={{ border: 'none', padding: '8px 0' }}>
                  <Space>
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                    <Text style={{ color: 'white' }}>{insight}</Text>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        )}

        {/* Structured Findings */}
        {renderStructuredFindings()}

        {/* Research Methodology */}
        <Collapse className="glass-card" style={{ marginTop: '16px' }}>
          <Panel 
            header={
              <Space>
                <InfoCircleOutlined />
                <Text style={{ color: 'white', fontWeight: 'bold' }}>Research Methodology</Text>
              </Space>
            } 
            key="methodology"
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                This research was conducted using AI-powered analysis of web sources:
              </Text>
              <ul style={{ color: 'rgba(255, 255, 255, 0.7)', paddingLeft: '20px' }}>
                <li>Automated web search and content extraction</li>
                <li>AI-powered content analysis and relevance scoring</li>
                <li>Cross-source information synthesis</li>
                <li>Structured data extraction and formatting</li>
                <li>Quality assessment and confidence scoring</li>
              </ul>
              <Divider style={{ borderColor: 'rgba(255, 255, 255, 0.2)' }} />
              <Row gutter={16}>
                <Col span={8}>
                  <Statistic
                    title={<span style={{ color: 'rgba(255,255,255,0.6)' }}>Analysis Time</span>}
                    value={Math.round((result?.duration || 0) / 1000)}
                    suffix="seconds"
                    valueStyle={{ color: 'white', fontSize: '14px' }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title={<span style={{ color: 'rgba(255,255,255,0.6)' }}>Data Points</span>}
                    value={result?.extractedData?.length || 0}
                    valueStyle={{ color: 'white', fontSize: '14px' }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title={<span style={{ color: 'rgba(255,255,255,0.6)' }}>Success Rate</span>}
                    value={result?.success ? 100 : 0}
                    suffix="%"
                    valueStyle={{ color: result?.success ? '#52c41a' : '#ff4d4f', fontSize: '14px' }}
                  />
                </Col>
              </Row>
            </Space>
          </Panel>
        </Collapse>
      </motion.div>
    </div>
  );
};

export default AIResearchDisplay;