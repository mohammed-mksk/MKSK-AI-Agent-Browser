import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Input, 
  Button, 
  Progress, 
  Typography, 
  Space, 
  Alert, 
  Divider,
  Row,
  Col,
  Tag,
  Timeline,
  Image
} from 'antd';
import { 
  PlayCircleOutlined, 
  StopOutlined, 
  LoadingOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  RobotOutlined,
  BulbOutlined,
  BugOutlined
} from '@ant-design/icons';
import { motion } from 'framer-motion';
import { useAppStore } from '../store/appStore';
import ResultsDisplay from '../components/ResultsDisplay';
import AIAnalysisDisplay from '../components/AIAnalysisDisplay';
import AIResearchDisplay from '../components/AIResearchDisplay';
import AIReasoningDisplay from '../components/AIReasoningDisplay';
import AIProgressMonitor from '../components/AIProgressMonitor';
import AITransparencyInterface from '../components/AITransparencyInterface';
import FieldDetectionPanel from '../components/FieldDetectionPanel';
import FieldMappingInterface from '../components/FieldMappingInterface';
import EnhancedFieldMappingInterface from '../components/EnhancedFieldMappingInterface';
import FieldDetectionDebugDashboard from '../components/FieldDetectionDebugDashboard';
import { DetectedField } from '../types/fieldDetection.d';

const { TextArea } = Input;
const { Title, Text, Paragraph } = Typography;

const Automation: React.FC = () => {
  const {
    isAutomationRunning,
    automationProgress,
    currentResult,
    setAutomationRunning,
    setAutomationProgress,
    setCurrentResult,
    addToHistory
  } = useAppStore();

  const [command, setCommand] = useState('');
  const [executionLog, setExecutionLog] = useState<string[]>([]);
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [aiReasoningContext, setAiReasoningContext] = useState<any>(null);
  const [taskProgress, setTaskProgress] = useState<any>(null);
  const [aiDecisions, setAiDecisions] = useState<any[]>([]);
  const [showAIInsights, setShowAIInsights] = useState(true);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.8);
  const [autoApproveHighConfidence, setAutoApproveHighConfidence] = useState(true);
  const [detectedFields, setDetectedFields] = useState<DetectedField[]>([]);
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({});
  const [showFieldDetection, setShowFieldDetection] = useState(false);
  const [debugModeEnabled, setDebugModeEnabled] = useState(false);
  const [userData, setUserData] = useState({
    email: 'user@example.com',
    name: 'John Doe',
    phone: '+1234567890',
    departure: 'New York',
    destination: 'London',
    departureDate: '2025-08-15'
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);



  useEffect(() => {
    // Attach real-time progress stream
    if (window.electronAPI?.automation?.onProgress) {
      window.electronAPI.automation.onProgress((evt: any) => {
        try {
          const pct = Math.max(0, Math.min(100, Number(evt?.progress ?? 0)));
          const message = evt?.message || '';
          setAutomationProgress({
            taskId: 'live',
            objective: command,
            status: pct >= 100 ? 'completed' : 'executing',
            overallProgress: pct,
            currentStep: Math.round(pct),
            totalSteps: 100,
            steps: [],
            startTime: Date.now(),
            performance: {
              successRate: 0,
              averageStepTime: 0,
              totalRetries: 0,
              cacheHitRate: 0,
              adaptationCount: 0
            },
            obstacles: [],
            adaptations: []
          } as any);
          setExecutionLog(prev => [...prev, message || `Progress: ${pct}%`]);
        } catch {}
      });
    }
    return () => {
      if (window.electronAPI?.automation?.removeProgressListener) {
        window.electronAPI.automation.removeProgressListener();
      }
    };
  }, [command, setAutomationProgress, setExecutionLog]);

  const handleStartAutomation = async () => {
    if (!command.trim()) return;

    try {
      setAutomationRunning(true);
      setExecutionLog([]);
      setScreenshots([]);
      setCurrentResult(null);
      setErrorMessage(null);
      
      setExecutionLog(['Starting automation...', `Command: ${command}`]);
      
      // Check if Electron API is available
      if (window.electronAPI) {
        try {
          setExecutionLog(prev => [...prev, 'Parsing command with AI...']);
          
          // Call the actual Electron backend
          const response = await window.electronAPI.automation.start(command);
          
          if (response && response.success && response.data) {
            const { parsedCommand, executionPlan, result } = response.data;
            
            setExecutionLog(prev => [...prev, 
              'Command parsed successfully',
              `Intent: ${parsedCommand.intent.type} (${parsedCommand.intent.complexity})`,
              `Confidence: ${Math.round(parsedCommand.confidence * 100)}%`,
              'Creating execution plan...',
              `Plan created with ${executionPlan.steps?.length || 0} steps`,
              'Starting browser automation...'
            ]);
            
            // If we have a result from browser automation, use it directly
            if (result) {
              setAutomationRunning(false);
              setCurrentResult(result);
              setExecutionLog(prev => [...prev, 
                `Browser automation completed in ${Math.round(result.duration / 1000)}s`,
                `Extracted ${result.extractedData.length} data items`,
                `Took ${result.screenshots.length} screenshots`,
                result.success ? 'Automation completed successfully!' : 'Automation completed with errors'
              ]);
              
              // Add to history
              addToHistory({
                id: result.id,
                command: command,
                result: result,
                timestamp: new Date()
              });
            } else {
              // Fallback to simulation if no result (shouldn't happen with real browser automation)
              setExecutionLog(prev => [...prev, 'No browser result received, this should not happen']);
              setAutomationRunning(false);
            }
            
          } else {
            throw new Error(response?.error || 'Failed to start automation');
          }
          
        } catch (apiError) {
          console.error('Electron API error:', apiError);
          setAutomationRunning(false);
          const msg = apiError instanceof Error ? apiError.message : 'Unknown API error';
          setExecutionLog(prev => [...prev, `API Error: ${msg}`]);
          setErrorMessage(msg);
        }
      } else {
        // Fallback to demo mode if Electron API is not available
        console.warn('Electron API not available, running in demo mode');
        setExecutionLog(prev => [...prev, 'Running in demo mode - Electron API not available']);
        
        const simulateAutomation = () => {
          const steps = [
            'Analyzing command...',
            'Planning automation steps...',
            'Opening browser...',
            'Navigating to target website...',
            'Executing automation actions...',
            'Collecting results...',
            'Processing data...',
            'Automation completed!'
          ];

          // Initialize AI context for demo
          setAiReasoningContext({
            taskId: 'demo-task-' + Date.now(),
            objective: command,
            currentStep: 0,
            totalSteps: steps.length,
            startTime: Date.now(),
            reasoning: [],
            adaptations: [],
            errors: [],
            performance: {
              executionTime: 0,
              memoryUsage: 45.2,
              cacheHitRate: 0.75,
              successRate: 0.95
            }
          });

          // Initialize task progress for demo
          setTaskProgress({
            taskId: 'demo-task-' + Date.now(),
            objective: command,
            status: 'executing',
            overallProgress: 0,
            currentStep: 0,
            totalSteps: steps.length,
            steps: steps.map((step, idx) => ({
              id: `step-${idx}`,
              name: step,
              description: `Executing: ${step}`,
              status: 'pending',
              progress: 0,
              aiInsights: {
                confidence: 0.8 + Math.random() * 0.2,
                reasoning: `AI determined that ${step.toLowerCase()} is the optimal approach based on current context`,
                alternatives: [`Alternative approach for ${step}`, `Fallback method for ${step}`],
                adaptations: [],
                obstacles: []
              },
              metadata: {
                retryCount: 0,
                cacheHit: Math.random() > 0.5,
                memoryUsed: Math.random() > 0.7,
                executionTime: 1000 + Math.random() * 2000
              }
            })),
            startTime: Date.now(),
            estimatedCompletion: Date.now() + steps.length * 1000,
            performance: {
              successRate: 0.95,
              averageStepTime: 1500,
              totalRetries: 0,
              cacheHitRate: 0.75,
              adaptationCount: 1
            },
            obstacles: [],
            adaptations: ['Adapted strategy based on page structure']
          });

          // Add some demo AI decisions
          setAiDecisions([
            {
              id: 'decision-1',
              timestamp: Date.now(),
              type: 'element_selection',
              title: 'Select Search Input Field',
              description: 'AI chose the main search input field over alternative form fields',
              reasoning: 'Based on DOM analysis, the element with id="search-input" has the highest semantic relevance for search functionality. It has proper ARIA labels and is positioned prominently on the page.',
              confidence: 0.92,
              alternatives: [
                {
                  id: 'alt-1',
                  description: 'Use secondary search field in header',
                  confidence: 0.65,
                  pros: ['Always visible', 'Faster access'],
                  cons: ['Limited functionality', 'May not support all search types']
                },
                {
                  id: 'alt-2',
                  description: 'Use advanced search form',
                  confidence: 0.78,
                  pros: ['More options', 'Better filtering'],
                  cons: ['More complex', 'Slower to fill']
                }
              ],
              context: {
                pageUrl: 'https://example-flights.com',
                pageTitle: 'Flight Search - Example Airlines',
                currentStep: 2,
                totalSteps: 8,
                previousActions: ['navigate', 'wait_for_load']
              },
              userOverridable: true,
              riskLevel: 'low',
              impact: 'moderate'
            },
            {
              id: 'decision-2',
              timestamp: Date.now() + 1000,
              type: 'strategy_adaptation',
              title: 'Adapt to Dynamic Content Loading',
              description: 'AI detected dynamic content loading and adapted waiting strategy',
              reasoning: 'The page uses lazy loading for flight results. AI switched from fixed timeout to intelligent waiting based on DOM mutations and network activity monitoring.',
              confidence: 0.87,
              alternatives: [
                {
                  id: 'alt-3',
                  description: 'Use fixed 5-second timeout',
                  confidence: 0.45,
                  pros: ['Simple', 'Predictable'],
                  cons: ['May timeout too early', 'Inefficient waiting']
                }
              ],
              context: {
                pageUrl: 'https://example-flights.com/results',
                pageTitle: 'Flight Results - Example Airlines',
                currentStep: 5,
                totalSteps: 8,
                previousActions: ['navigate', 'fill_form', 'click_search']
              },
              userOverridable: false,
              riskLevel: 'medium',
              impact: 'significant'
            }
          ]);

          let currentStep = 0;
          const interval = setInterval(() => {
            if (currentStep < steps.length) {
              setExecutionLog(prev => [...prev, steps[currentStep]]);
              setAutomationProgress({
                completedSteps: currentStep + 1,
                totalSteps: steps.length,
                currentStep: null,
                status: 'executing',
                estimatedTimeRemaining: (steps.length - currentStep - 1) * 1000,
                currentAction: steps[currentStep]
              });

              // Update AI reasoning context
              setAiReasoningContext(prev => ({
                ...prev,
                currentStep: currentStep + 1,
                reasoning: [
                  ...prev.reasoning,
                  {
                    id: `reasoning-${currentStep}`,
                    timestamp: Date.now(),
                    type: currentStep < 2 ? 'analysis' : currentStep < 5 ? 'action' : 'learning',
                    title: steps[currentStep],
                    description: `AI is processing: ${steps[currentStep]}`,
                    thinking: `Analyzing current state and determining optimal approach for ${steps[currentStep].toLowerCase()}. Considering page context, user intent, and available options.`,
                    confidence: 0.8 + Math.random() * 0.2,
                    alternatives: [`Alternative for ${steps[currentStep]}`, `Backup approach`],
                    outcome: 'success',
                    executionTime: 800 + Math.random() * 400,
                    cacheHit: Math.random() > 0.5,
                    memoryUsed: Math.random() > 0.6
                  }
                ],
                performance: {
                  ...prev.performance,
                  executionTime: Date.now() - prev.startTime
                }
              }));

              // Update task progress
              setTaskProgress(prev => ({
                ...prev,
                currentStep: currentStep + 1,
                overallProgress: ((currentStep + 1) / steps.length) * 100,
                steps: prev.steps.map((step, idx) => ({
                  ...step,
                  status: idx < currentStep ? 'completed' : idx === currentStep ? 'running' : 'pending',
                  progress: idx < currentStep ? 100 : idx === currentStep ? 50 : 0,
                  startTime: idx === currentStep ? Date.now() : step.startTime,
                  endTime: idx < currentStep ? Date.now() : undefined
                }))
              }));

              currentStep++;
            } else {
              clearInterval(interval);
              setAutomationRunning(false);
              
              // Complete the AI contexts
              setAiReasoningContext(prev => ({
                ...prev,
                performance: {
                  ...prev.performance,
                  executionTime: Date.now() - prev.startTime,
                  successRate: 1.0
                }
              }));

              setTaskProgress(prev => ({
                ...prev,
                status: 'completed',
                overallProgress: 100,
                actualCompletion: Date.now(),
                steps: prev.steps.map(step => ({
                  ...step,
                  status: 'completed',
                  progress: 100,
                  endTime: Date.now()
                }))
              }));

              setCurrentResult({
                id: Date.now().toString(),
                command: command,
                intent: {
                  type: 'search',
                  description: 'Flight search automation',
                  complexity: 'medium'
                },
                executionPlan: {
                  id: 'plan_' + Date.now(),
                  steps: [],
                  estimatedDuration: 8000,
                  requiredResources: [],
                  fallbackStrategies: []
                },
                extractedData: [
                  {
                    id: 'flight_1',
                    type: 'structured',
                    content: {
                      airline: 'Emirates',
                      price: '£650',
                      departure: '2024-09-01 14:30',
                      arrival: '2024-09-02 02:15',
                      duration: '8h 45m',
                      stops: 'Direct'
                    },
                    source: {
                      url: 'https://flights.example.com/search',
                      selector: '.flight-result:first-child',
                      timestamp: new Date()
                    },
                    confidence: 0.95
                  },
                  {
                    id: 'flight_2',
                    type: 'structured',
                    content: {
                      airline: 'British Airways',
                      price: '£720',
                      departure: '2024-09-01 16:45',
                      arrival: '2024-09-02 05:30',
                      duration: '9h 15m',
                      stops: 'Direct'
                    },
                    source: {
                      url: 'https://flights.example.com/search',
                      selector: '.flight-result:nth-child(2)',
                      timestamp: new Date()
                    },
                    confidence: 0.92
                  },
                  {
                    id: 'flight_3',
                    type: 'structured',
                    content: {
                      airline: 'Virgin Atlantic',
                      price: '£680',
                      departure: '2024-09-01 11:20',
                      arrival: '2024-09-02 01:45',
                      duration: '9h 55m',
                      stops: '1 Stop (Dubai)'
                    },
                    source: {
                      url: 'https://flights.example.com/search',
                      selector: '.flight-result:nth-child(3)',
                      timestamp: new Date()
                    },
                    confidence: 0.88
                  }
                ],
                screenshots: [],
                duration: 8000,
                success: true,
                errors: [],
                timestamp: new Date(),
                metadata: {
                  browserVersion: 'Chrome 120.0.0.0',
                  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                  viewport: { width: 1920, height: 1080 },
                  totalSteps: 8,
                  successfulSteps: 8,
                  failedSteps: 0
                }
              });
            }
          }, 1000);
        };

        setTimeout(simulateAutomation, 500);
      }
      
    } catch (error) {
      setAutomationRunning(false);
      setExecutionLog(prev => [...prev, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`]);
    }
  };

  const handleStopAutomation = async () => {
    try {
      setAutomationRunning(false);
      setExecutionLog(prev => [...prev, 'Automation stopped by user']);
    } catch (error) {
      console.error('Failed to stop automation:', error);
    }
  };

  const handleExport = async (format: 'pdf' | 'excel' | 'csv' | 'json') => {
    if (!currentResult) return;

    try {
      if (window.electronAPI) {
        const response = await window.electronAPI.reports.export(currentResult, format);
        if (response.success) {
          setExecutionLog(prev => [...prev, `Results exported as ${format.toUpperCase()}`]);
        } else {
          throw new Error(response.error || `Failed to export as ${format}`);
        }
      }
    } catch (error) {
      console.error('Export failed:', error);
      setExecutionLog(prev => [...prev, `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`]);
    }
  };

  const getProgressPercent = () => {
    if (!automationProgress || !automationProgress.totalSteps) return 0;
    return Math.round((automationProgress.completedSteps / automationProgress.totalSteps) * 100);
  };

  const getStatusColor = () => {
    if (isAutomationRunning) return 'info';
    if (currentResult?.success) return 'success';
    if (currentResult?.success === false) return 'error';
    return 'info';
  };

  const exampleCommands = [
    "Search for cheapest flights from LHR to Mumbai on September 1st returning September 15th",
    "Fill out this survey with the best responses to get selected for research",
    "Extract all product prices from https://example-store.com",
    "Research the top 10 competitors in AI automation space",
    "Monitor price changes for iPhone 15 Pro on major retail websites"
  ];

  // Field Detection Handlers
  const handleFieldsDetected = (fields: DetectedField[]) => {
    setDetectedFields(fields);
    setExecutionLog(prev => [...prev, `Detected ${fields.length} fields on the page`]);
  };

  const handleFieldSelected = (field: DetectedField) => {
    console.log('Field selected:', field);
    setExecutionLog(prev => [...prev, `Selected field: ${field.semantic} (${field.context.label || 'unlabeled'})`]);
  };

  const handleMappingChanged = (mappings: Record<string, string>) => {
    setFieldMappings(mappings);
    const mappingCount = Object.keys(mappings).length;
    setExecutionLog(prev => [...prev, `Updated field mappings: ${mappingCount} fields mapped`]);
  };

  const handleFieldFill = async (fieldId: string, value: string) => {
    try {
      if (window.electronAPI?.fieldDetection) {
        const response = await window.electronAPI.fieldDetection.fillField(fieldId, value);
        if (response.success) {
          setExecutionLog(prev => [...prev, `Filled field ${fieldId} with value`]);
        }
      }
    } catch (error) {
      console.error('Error filling field:', error);
      setExecutionLog(prev => [...prev, `Error filling field ${fieldId}`]);
    }
  };

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {errorMessage && (
          <Alert
            type="error"
            message="Automation Error"
            description={errorMessage}
            closable
            onClose={() => setErrorMessage(null)}
            style={{ marginBottom: '12px' }}
            showIcon
          />
        )}
        <Title level={2} style={{ color: 'white', marginBottom: '24px' }}>
          <RobotOutlined style={{ marginRight: '8px' }} />
          Automation
        </Title>

        <Row gutter={[16, 16]}>
          {/* Command Input */}
          <Col xs={24} lg={12}>
            <Card className="glass-card">
              <Title level={4} style={{ color: 'white', marginBottom: '16px' }}>
                Command Input
              </Title>
              
              <Space direction="vertical" style={{ width: '100%' }} size="large">
                <TextArea
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="Describe what you want to automate in natural language..."
                  rows={4}
                  disabled={isAutomationRunning}
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    color: 'white'
                  }}
                />

                <div style={{ display: 'flex', gap: '12px' }}>
                  <Button
                    type="primary"
                    icon={isAutomationRunning ? <LoadingOutlined /> : <PlayCircleOutlined />}
                    onClick={handleStartAutomation}
                    disabled={isAutomationRunning || !command.trim()}
                    loading={isAutomationRunning}
                    size="large"
                    className="gradient-button"
                  >
                    {isAutomationRunning ? 'Running...' : 'Start Automation'}
                  </Button>

                  {isAutomationRunning && (
                    <Button
                      danger
                      icon={<StopOutlined />}
                      onClick={handleStopAutomation}
                      size="large"
                    >
                      Stop
                    </Button>
                  )}

                  <Button
                    icon={<BulbOutlined />}
                    onClick={() => setShowAIInsights(!showAIInsights)}
                    size="large"
                    type={showAIInsights ? 'primary' : 'default'}
                  >
                    AI Insights
                  </Button>

                  <Button
                    icon={<BugOutlined />}
                    onClick={() => setDebugModeEnabled(!debugModeEnabled)}
                    size="large"
                    type={debugModeEnabled ? 'primary' : 'default'}
                    title="Toggle Field Detection Debug Mode"
                  >
                    Debug Mode
                  </Button>
                </div>

                {/* Example Commands */}
                <div>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '14px' }}>
                    Example commands:
                  </Text>
                  <div style={{ marginTop: '8px' }}>
                    {exampleCommands.map((example, index) => (
                      <Tag
                        key={index}
                        style={{
                          margin: '4px',
                          cursor: 'pointer',
                          background: 'rgba(255, 255, 255, 0.1)',
                          border: '1px solid rgba(255, 255, 255, 0.3)',
                          color: 'white'
                        }}
                        onClick={() => setCommand(example)}
                      >
                        {example.length > 60 ? `${example.substring(0, 60)}...` : example}
                      </Tag>
                    ))}
                  </div>
                </div>
              </Space>
            </Card>
          </Col>

          {/* Progress and Status */}
          <Col xs={24} lg={12}>
            <Card className="glass-card">
              <Title level={4} style={{ color: 'white', marginBottom: '16px' }}>
                Status & Progress
              </Title>

              <Space direction="vertical" style={{ width: '100%' }} size="large">
                {/* Status Alert */}
                <Alert
                  message={
                    isAutomationRunning 
                      ? 'Automation Running' 
                      : currentResult 
                        ? (currentResult.success ? 'Automation Completed' : 'Automation Failed')
                        : 'Ready to Start'
                  }
                  type={getStatusColor()}
                  showIcon
                  icon={
                    isAutomationRunning ? <LoadingOutlined /> :
                    currentResult?.success ? <CheckCircleOutlined /> :
                    currentResult?.success === false ? <ExclamationCircleOutlined /> :
                    <RobotOutlined />
                  }
                />

                {/* Progress Bar */}
                {automationProgress && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <Text style={{ color: 'white' }}>Progress</Text>
                      <Text style={{ color: 'white' }}>
                        {automationProgress.completedSteps}/{automationProgress.totalSteps}
                      </Text>
                    </div>
                    <Progress
                      percent={getProgressPercent()}
                      status={isAutomationRunning ? 'active' : 'success'}
                      strokeColor={{
                        '0%': '#667eea',
                        '100%': '#764ba2',
                      }}
                    />
                    {automationProgress.currentAction && (
                      <Text style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '12px' }}>
                        Current: {automationProgress.currentAction}
                      </Text>
                    )}
                  </div>
                )}

                {/* Execution Log */}
                <div>
                  <Text style={{ color: 'white', fontWeight: 'bold' }}>Execution Log:</Text>
                  <div 
                    className="code-block"
                    style={{ 
                      maxHeight: '200px', 
                      overflow: 'auto',
                      marginTop: '8px'
                    }}
                  >
                    {executionLog.map((log, index) => (
                      <div key={index} style={{ marginBottom: '4px', fontSize: '12px' }}>
                        <Text style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                          [{new Date().toLocaleTimeString()}]
                        </Text>
                        <Text style={{ color: 'white', marginLeft: '8px' }}>
                          {log}
                        </Text>
                      </div>
                    ))}
                  </div>
                </div>
              </Space>
            </Card>
          </Col>
        </Row>

        {/* AI Insights Section */}
        {showAIInsights && (isAutomationRunning || aiReasoningContext || taskProgress || aiDecisions.length > 0) && (
          <div style={{ marginTop: '16px' }}>
            <Row gutter={[16, 16]}>
              {/* AI Reasoning Display */}
              {aiReasoningContext && (
                <Col xs={24} lg={12}>
                  <AIReasoningDisplay
                    context={aiReasoningContext}
                    isLive={isAutomationRunning}
                    showDetails={true}
                    onStepClick={(step) => {
                      console.log('Reasoning step clicked:', step);
                    }}
                  />
                </Col>
              )}

              {/* Task Progress Monitor */}
              {taskProgress && (
                <Col xs={24} lg={12}>
                  <AIProgressMonitor
                    progress={taskProgress}
                    onPause={() => {
                      console.log('Task paused');
                    }}
                    onResume={() => {
                      console.log('Task resumed');
                    }}
                    onStop={() => {
                      handleStopAutomation();
                    }}
                    onStepClick={(step) => {
                      console.log('Progress step clicked:', step);
                    }}
                    showDetails={true}
                  />
                </Col>
              )}

              {/* AI Decision Transparency */}
              {aiDecisions.length > 0 && (
                <Col xs={24}>
                  <AITransparencyInterface
                    decisions={aiDecisions}
                    onOverride={(override) => {
                      console.log('AI decision overridden:', override);
                      // Handle override logic here
                    }}
                    onExplainMore={(decisionId) => {
                      console.log('Explain more requested for:', decisionId);
                      // Handle explanation request
                    }}
                    showConfidenceThreshold={true}
                    confidenceThreshold={confidenceThreshold}
                    onConfidenceThresholdChange={setConfidenceThreshold}
                    autoApproveHighConfidence={autoApproveHighConfidence}
                    onAutoApproveChange={setAutoApproveHighConfidence}
                  />
                </Col>
              )}
              
              {/* Field Detection Panel */}
              <Col xs={24} lg={12}>
                <FieldDetectionPanel
                  onFieldsDetected={handleFieldsDetected}
                  onFieldSelected={handleFieldSelected}
                  onMappingChanged={handleMappingChanged}
                />
              </Col>

              {/* Enhanced Field Mapping Interface */}
              {detectedFields.length > 0 && (
                <Col xs={24} lg={12}>
                  <EnhancedFieldMappingInterface
                    detectedFields={detectedFields}
                    initialMappings={fieldMappings}
                    userData={userData}
                    onMappingChange={(mappings) => {
                      console.log('Enhanced mappings changed:', mappings);
                      setExecutionLog(prev => [...prev, `Updated ${Object.keys(mappings).length} field mappings`]);
                    }}
                    onFieldValidation={(fieldId, isValid) => {
                      console.log(`Field ${fieldId} validation:`, isValid);
                      setExecutionLog(prev => [...prev, `Field ${fieldId} ${isValid ? 'validated' : 'validation failed'}`]);
                    }}
                  />
                </Col>
              )}

              {/* Debug Dashboard */}
              {debugModeEnabled && (
                <Col xs={24}>
                  <FieldDetectionDebugDashboard
                    detectedFields={detectedFields}
                    isEnabled={debugModeEnabled}
                    onToggle={setDebugModeEnabled}
                  />
                </Col>
              )}
            </Row>
          </div>
        )}

        {/* Results Section */}
        {currentResult && (
          <div style={{ marginTop: '16px' }}>
            {/* Show AI Research Results if available */}
            {currentResult.extractedData?.find((item: any) => item.content?.aiSynthesis) ? (
              <AIResearchDisplay 
                result={currentResult}
                onExport={handleExport}
              />
            ) : currentResult.extractedData?.[0]?.content?.parsedIntent ? (
              <AIAnalysisDisplay 
                parsedCommand={currentResult.extractedData[0].content}
                executionPlan={currentResult.executionPlan}
                onExport={handleExport}
              />
            ) : (
              <ResultsDisplay 
                result={currentResult} 
                onExport={handleExport}
              />
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Automation;
