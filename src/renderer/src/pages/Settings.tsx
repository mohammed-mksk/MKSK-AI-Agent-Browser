import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Form, 
  Input, 
  Select, 
  Switch, 
  Button, 
  Typography, 
  Space, 
  Divider,
  Alert,
  Row,
  Col,
  Slider,
  Tag,
  message
} from 'antd';
import { 
  SettingOutlined, 
  SaveOutlined, 
  ExperimentOutlined,
  KeyOutlined,
  RobotOutlined,
  GlobalOutlined
} from '@ant-design/icons';
import { motion } from 'framer-motion';
import { useAppStore } from '../store/appStore';

const { Title, Text } = Typography;
const { Option } = Select;
const { Password } = Input;

interface SettingsForm {
  aiProvider: string;
  openaiApiKey: string;
  anthropicApiKey: string;
  aiModel: string;
  temperature: number;
  maxTokens: number;
  browserEngine: string;
  browserHeadless: boolean;
  maxConcurrentBrowsers: number;
  logLevel: string;
  autoSaveWorkflows: boolean;
  defaultExportFormat: 'json' | 'csv';
}

const Settings: React.FC = () => {
  const { currentAIProvider, availableProviders, setCurrentAIProvider } = useAppStore();
  const [form] = Form.useForm<SettingsForm>();
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [storedKeys, setStoredKeys] = useState<{ openai: boolean; anthropic: boolean }>({ openai: false, anthropic: false });

  useEffect(() => {
    // Debug: Check if electronAPI is available
    console.log('electronAPI available:', !!window.electronAPI);
    console.log('electronAPI.secure available:', !!window.electronAPI?.secure);
    console.log('electronAPI.settings available:', !!window.electronAPI?.settings);
    console.log('electronAPI.ai available:', !!window.electronAPI?.ai);
    
    // Load current settings
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      if (window.electronAPI) {
        const settingKeys = [
          'aiProvider',
          'aiModel',
          'temperature',
          'maxTokens',
          'browserEngine',
          'browserHeadless',
          'maxConcurrentBrowsers',
          'logLevel',
          'autoSaveWorkflows',
          'defaultExportFormat'
        ];

        const settings = await Promise.all(
          settingKeys.map(async (key) => {
            const response = await window.electronAPI.settings.get(key);
            return response?.success ? response.data : null;
          })
        );

        const aiProvider = settings[0] || 'openai';
        
        form.setFieldsValue({
          aiProvider,
          openaiApiKey: '', // Always start empty for security
          anthropicApiKey: '', // Always start empty for security
          aiModel: settings[1] || 'gpt-4',
          temperature: settings[2] || 0.1,
          maxTokens: settings[3] || 4000,
          browserEngine: settings[4] || 'puppeteer',
          browserHeadless: settings[5] !== false,
          maxConcurrentBrowsers: settings[6] || 3,
          logLevel: settings[7] || 'info',
          autoSaveWorkflows: settings[8] !== false,
          defaultExportFormat: settings[9] || 'json'
        });
        
        // Update the store with the current provider
        if (aiProvider !== currentAIProvider) {
          setCurrentAIProvider(aiProvider);
        }
        
        // Check if API keys are stored
        checkStoredAPIKeys();
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const checkStoredAPIKeys = async () => {
    try {
      if (window.electronAPI) {
        const [openaiResult, anthropicResult] = await Promise.all([
          window.electronAPI.secure.getAPIKey('openai'),
          window.electronAPI.secure.getAPIKey('anthropic')
        ]);
        
        setStoredKeys({
          openai: openaiResult.success && openaiResult.data?.hasKey === true,
          anthropic: anthropicResult.success && anthropicResult.data?.hasKey === true
        });
      }
    } catch (error) {
      console.error('Failed to check stored API keys:', error);
    }
  };

  const handleSave = async (values: SettingsForm) => {
    console.log('handleSave called with values:', values);
    setLoading(true);
    try {
      if (!window.electronAPI) {
        throw new Error('electronAPI is not available');
      }
      
      console.log('electronAPI is available, proceeding with save...');
      
      // Store API keys securely (only if provided)
      if (values.openaiApiKey && values.openaiApiKey.trim()) {
        const result = await window.electronAPI.secure.storeAPIKey('openai', values.openaiApiKey);
        if (!result.success) {
          throw new Error(`Failed to store OpenAI API key: ${result.error}`);
        }
      }

      if (values.anthropicApiKey && values.anthropicApiKey.trim()) {
        const result = await window.electronAPI.secure.storeAPIKey('anthropic', values.anthropicApiKey);
        if (!result.success) {
          throw new Error(`Failed to store Anthropic API key: ${result.error}`);
        }
      }

      // Save other settings (not API keys)
      await Promise.all([
        window.electronAPI.settings.set('aiProvider', values.aiProvider),
        window.electronAPI.settings.set('aiModel', values.aiModel),
        window.electronAPI.settings.set('temperature', values.temperature),
        window.electronAPI.settings.set('maxTokens', values.maxTokens),
        window.electronAPI.settings.set('browserEngine', values.browserEngine),
        window.electronAPI.settings.set('browserHeadless', values.browserHeadless),
        window.electronAPI.settings.set('maxConcurrentBrowsers', values.maxConcurrentBrowsers),
        window.electronAPI.settings.set('logLevel', values.logLevel),
        window.electronAPI.settings.set('autoSaveWorkflows', values.autoSaveWorkflows),
        window.electronAPI.settings.set('defaultExportFormat', values.defaultExportFormat),
      ]);

      // Update AI provider if changed or if new API key provided
      const needsProviderUpdate = values.aiProvider !== currentAIProvider || 
                                  (values.openaiApiKey && values.openaiApiKey.trim()) ||
                                  (values.anthropicApiKey && values.anthropicApiKey.trim());
                                  
      if (needsProviderUpdate) {
        const apiKey = values.aiProvider === 'openai' ? values.openaiApiKey : values.anthropicApiKey;
        const config = {
          apiKey: apiKey || undefined, // Let the backend use stored key if no new key provided
          model: values.aiModel,
          temperature: values.temperature,
          maxTokens: values.maxTokens,
        };
        
        const providerResult = await window.electronAPI.ai.setProvider(values.aiProvider, config);
        if (!providerResult.success) {
          throw new Error(`Failed to set AI provider: ${providerResult.error}`);
        }
        
        setCurrentAIProvider(values.aiProvider);
      }

      setTestResult({ success: true, message: 'Settings saved successfully!' });
      
      // Refresh stored key indicators
      await checkStoredAPIKeys();
      
      // Clear API key fields for security
      form.setFieldsValue({
        openaiApiKey: '',
        anthropicApiKey: ''
      });
    } catch (error) {
      setTestResult({ 
        success: false, 
        message: `Failed to save settings: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    const values = form.getFieldsValue();
    console.log('handleTestConnection called with values:', values);
    setLoading(true);
    setTestResult(null);

    try {
      if (!window.electronAPI) {
        throw new Error('electronAPI is not available');
      }
      
      console.log('electronAPI is available, proceeding with test...');
      
      const apiKey = values.aiProvider === 'openai' ? values.openaiApiKey : values.anthropicApiKey;
      
      // Validate that API key is provided and has correct format
      if (!apiKey || apiKey.trim() === '') {
        setTestResult({ 
          success: false, 
          message: 'Please enter an API key before testing the connection.' 
        });
        setLoading(false);
        return;
      }

      // Validate API key format
      const trimmedKey = apiKey.trim();
      if (values.aiProvider === 'openai' && !trimmedKey.startsWith('sk-')) {
        setTestResult({ 
          success: false, 
          message: 'OpenAI API key should start with "sk-"' 
        });
        setLoading(false);
        return;
      }

      if (values.aiProvider === 'anthropic' && !trimmedKey.startsWith('sk-ant-')) {
        setTestResult({ 
          success: false, 
          message: 'Anthropic API key should start with "sk-ant-"' 
        });
        setLoading(false);
        return;
      }

      const config = {
        apiKey: trimmedKey,
        model: values.aiModel,
        temperature: values.temperature,
        maxTokens: values.maxTokens,
      };

      // Test the AI provider
      const providerResult = await window.electronAPI.ai.setProvider(values.aiProvider, config);
      
      if (!providerResult.success) {
        throw new Error(providerResult.error || 'Failed to set AI provider');
      }

      const testCommand = 'Test connection - respond with "OK" if you can understand this.';
      const response = await window.electronAPI.ai.parseCommand(testCommand);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to parse test command');
      }
      
      setTestResult({ 
        success: true, 
        message: 'AI provider connection successful!' 
      });
    } catch (error) {
      setTestResult({ 
        success: false, 
        message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Title level={2} style={{ color: 'white', marginBottom: '24px' }}>
          <SettingOutlined style={{ marginRight: '8px' }} />
          Settings
        </Title>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          style={{ maxWidth: '800px' }}
        >
          <Row gutter={[16, 16]}>
            {/* AI Provider Settings */}
            <Col xs={24} lg={12}>
              <Card className="glass-card">
                <Title level={4} style={{ color: 'white', marginBottom: '16px' }}>
                  <RobotOutlined style={{ marginRight: '8px' }} />
                  AI Provider
                </Title>

                <Form.Item
                  name="aiProvider"
                  label={<Text style={{ color: 'white' }}>Provider</Text>}
                >
                  <Select>
                    <Option value="openai">OpenAI</Option>
                    <Option value="anthropic">Anthropic (Claude)</Option>
                    <Option value="local">Local Model</Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  name="openaiApiKey"
                  label={
                    <Space>
                      <Text style={{ color: 'white' }}>OpenAI API Key</Text>
                      {storedKeys.openai && (
                        <Tag color="green">
                          ✓ Stored
                        </Tag>
                      )}
                    </Space>
                  }
                >
                  <Password
                    placeholder={storedKeys.openai ? "API key is stored (enter new key to update)" : "sk-..."}
                    prefix={<KeyOutlined />}
                  />
                </Form.Item>

                <Form.Item
                  name="anthropicApiKey"
                  label={
                    <Space>
                      <Text style={{ color: 'white' }}>Anthropic API Key</Text>
                      {storedKeys.anthropic && (
                        <Tag color="green">
                          ✓ Stored
                        </Tag>
                      )}
                    </Space>
                  }
                >
                  <Password
                    placeholder={storedKeys.anthropic ? "API key is stored (enter new key to update)" : "sk-ant-..."}
                    prefix={<KeyOutlined />}
                  />
                </Form.Item>

                <Form.Item
                  name="aiModel"
                  label={<Text style={{ color: 'white' }}>Model</Text>}
                >
                  <Select>
                    <Option value="gpt-4">GPT-4</Option>
                    <Option value="gpt-4-turbo-preview">GPT-4 Turbo</Option>
                    <Option value="gpt-3.5-turbo">GPT-3.5 Turbo</Option>
                    <Option value="claude-3-opus-20240229">Claude 3 Opus</Option>
                    <Option value="claude-3-sonnet-20240229">Claude 3 Sonnet</Option>
                    <Option value="claude-3-haiku-20240307">Claude 3 Haiku</Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  name="temperature"
                  label={<Text style={{ color: 'white' }}>Temperature</Text>}
                >
                  <Slider
                    min={0}
                    max={1}
                    step={0.1}
                    marks={{
                      0: '0',
                      0.5: '0.5',
                      1: '1'
                    }}
                  />
                </Form.Item>

                <Form.Item
                  name="maxTokens"
                  label={<Text style={{ color: 'white' }}>Max Tokens</Text>}
                >
                  <Slider
                    min={1000}
                    max={8000}
                    step={500}
                    marks={{
                      1000: '1K',
                      4000: '4K',
                      8000: '8K'
                    }}
                  />
                </Form.Item>

                <Button
                  icon={<ExperimentOutlined />}
                  onClick={handleTestConnection}
                  loading={loading}
                  style={{ width: '100%' }}
                >
                  Test Connection
                </Button>
              </Card>
            </Col>

            {/* Browser Settings */}
            <Col xs={24} lg={12}>
              <Card className="glass-card">
                <Title level={4} style={{ color: 'white', marginBottom: '16px' }}>
                  <GlobalOutlined style={{ marginRight: '8px' }} />
                  Browser Settings
                </Title>

                <Form.Item
                  name="browserEngine"
                  label={<Text style={{ color: 'white' }}>Browser Engine</Text>}
                  tooltip="Choose between traditional Puppeteer, AI-powered BrowserUse, or the advanced AI Browser with full reasoning capabilities"
                >
                  <Select placeholder="Select browser engine">
                    <Option value="ai-browser">
                      <Space>
                        <span>✨</span>
                        <span>AI Browser (Advanced AI-Driven)</span>
                      </Space>
                    </Option>
                    <Option value="browseruse">
                      <Space>
                        <span>🧠</span>
                        <span>BrowserUse (AI-Powered)</span>
                      </Space>
                    </Option>
                    <Option value="puppeteer">
                      <Space>
                        <span>🤖</span>
                        <span>Puppeteer (Traditional)</span>
                      </Space>
                    </Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  name="browserHeadless"
                  label={<Text style={{ color: 'white' }}>Headless Mode</Text>}
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>

                <Form.Item
                  name="maxConcurrentBrowsers"
                  label={<Text style={{ color: 'white' }}>Max Concurrent Browsers</Text>}
                >
                  <Slider
                    min={1}
                    max={10}
                    marks={{
                      1: '1',
                      3: '3',
                      5: '5',
                      10: '10'
                    }}
                  />
                </Form.Item>

                <Divider style={{ borderColor: 'rgba(255, 255, 255, 0.2)' }} />

                <Title level={5} style={{ color: 'white', marginBottom: '16px' }}>
                  Application Settings
                </Title>

                <Form.Item
                  name="logLevel"
                  label={<Text style={{ color: 'white' }}>Log Level</Text>}
                >
                  <Select>
                    <Option value="error">Error</Option>
                    <Option value="warn">Warning</Option>
                    <Option value="info">Info</Option>
                    <Option value="debug">Debug</Option>
                    <Option value="trace">Trace</Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  name="autoSaveWorkflows"
                  label={<Text style={{ color: 'white' }}>Auto-save Workflows</Text>}
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>

                <Form.Item
                  name="defaultExportFormat"
                  label={<Text style={{ color: 'white' }}>Default Export Format</Text>}
                >
                  <Select>
                    <Option value="json">JSON</Option>
                    <Option value="csv">CSV</Option>
                  </Select>
                </Form.Item>

                <Space>
                  <Button
                    onClick={async () => {
                      try {
                        const res = await window.electronAPI?.settings?.resetDefaults();
                        if (res?.success) {
                          message.success('Settings reset to defaults');
                          loadSettings();
                        } else {
                          message.error(res?.error || 'Failed to reset');
                        }
                      } catch (e) {
                        message.error('Failed to reset defaults');
                      }
                    }}
                  >
                    Reset to Defaults
                  </Button>
                </Space>
              </Card>
            </Col>
          </Row>

          {/* Test Result */}
          {testResult && (
            <Alert
              message={testResult.message}
              type={testResult.success ? 'success' : 'error'}
              style={{ marginTop: '16px' }}
              closable
              onClose={() => setTestResult(null)}
            />
          )}

          {/* Save Button */}
          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            <Button
              type="primary"
              htmlType="submit"
              icon={<SaveOutlined />}
              loading={loading}
              size="large"
              className="gradient-button"
            >
              Save Settings
            </Button>
          </div>
        </Form>
      </motion.div>
    </div>
  );
};

export default Settings;
