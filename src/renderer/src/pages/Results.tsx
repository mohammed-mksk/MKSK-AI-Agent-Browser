import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Typography, Space, Spin, Alert } from 'antd';
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';
import { useAppStore } from '../store/appStore';
import ResultsDisplay from '../components/ResultsDisplay';
import type { AutomationResult } from '../../../shared/types';

const { Title } = Typography;

const Results: React.FC = () => {
  const { resultId } = useParams<{ resultId: string }>();
  const navigate = useNavigate();
  const { history } = useAppStore();
  
  const [result, setResult] = useState<AutomationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadResult = async () => {
      if (!resultId) {
        setError('No result ID provided');
        setLoading(false);
        return;
      }

      try {
        // First try to find in current history
        const historyItem = history.find(h => h.id === resultId);
        if (historyItem) {
          setResult(historyItem.result);
          setLoading(false);
          return;
        }

        // If not found in current history, fetch from database
        if (window.electronAPI) {
          const response = await window.electronAPI.database.getAutomationResult(resultId);
          if (response.success && response.data) {
            setResult(response.data);
          } else {
            setError('Result not found');
          }
        } else {
          setError('Database not available');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load result');
      } finally {
        setLoading(false);
      }
    };

    loadResult();
  }, [resultId, history]);

  const handleExport = async (format: 'pdf' | 'excel' | 'csv' | 'json') => {
    if (!result) return;

    try {
      if (window.electronAPI) {
        const response = await window.electronAPI.reports.export(result, format);
        if (!response.success) {
          throw new Error(response.error || `Failed to export as ${format}`);
        }
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    setError(null);
    // Trigger reload by updating a dependency
    window.location.reload();
  };

  if (loading) {
    return (
      <div style={{ 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error || !result) {
    return (
      <div style={{ height: '100%', overflow: 'auto', padding: '24px' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate(-1)}
                style={{ color: 'white' }}
              >
                Back
              </Button>
              <Title level={2} style={{ color: 'white', margin: 0 }}>
                Result Not Found
              </Title>
            </div>
            
            <Alert
              message="Error"
              description={error || 'The requested result could not be found.'}
              type="error"
              showIcon
              action={
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={handleRefresh}
                >
                  Retry
                </Button>
              }
            />
          </Space>
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(-1)}
            style={{ color: 'white' }}
          >
            Back
          </Button>
          <Title level={2} style={{ color: 'white', margin: 0 }}>
            Automation Results
          </Title>
        </div>

        <ResultsDisplay 
          result={result} 
          onExport={handleExport}
        />
      </motion.div>
    </div>
  );
};

export default Results;