import React, { useEffect, useState } from 'react';
import { Table, Card, Tag, Button, Space, Typography, Tooltip, message, Modal } from 'antd';
import { 
  CheckCircleOutlined, 
  ExclamationCircleOutlined, 
  EyeOutlined,
  DownloadOutlined,
  HistoryOutlined
} from '@ant-design/icons';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';

const { Title, Text } = Typography;

const History: React.FC = () => {
  const [historyData, setHistoryData] = useState<any[]>([]);
  const navigate = useNavigate();
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        if (window.electronAPI?.database?.getHistory) {
          const rows = await window.electronAPI.database.getHistory();
          setHistoryData(rows || []);
        }
      } catch (e) {
        console.error('Failed to load history:', e);
        message.error('Failed to load history');
      }
    };
    load();
  }, []);

  const columns = [
    {
      title: 'Status',
      dataIndex: ['result', 'success'],
      key: 'status',
      width: 80,
      render: (success: boolean) => (
        success ? (
          <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '16px' }} />
        ) : (
          <ExclamationCircleOutlined style={{ color: '#ff4d4f', fontSize: '16px' }} />
        )
      ),
    },
    {
      title: 'Command',
      dataIndex: 'command',
      key: 'command',
      ellipsis: true,
      render: (command: string) => (
        <Tooltip title={command}>
          <Text style={{ color: 'white' }}>
            {command.length > 60 ? `${command.substring(0, 60)}...` : command}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: 'Type',
      dataIndex: ['result', 'intent', 'type'],
      key: 'type',
      width: 120,
      render: (type: string) => (
        <Tag color="blue">{type}</Tag>
      ),
    },
    {
      title: 'Duration',
      dataIndex: ['result', 'duration'],
      key: 'duration',
      width: 100,
      render: (duration: number) => (
        <Text style={{ color: 'white' }}>
          {Math.round(duration / 1000)}s
        </Text>
      ),
    },
    {
      title: 'Data Items',
      dataIndex: ['result', 'extractedData'],
      key: 'dataItems',
      width: 100,
      render: (extractedData: any[]) => (
        <Text style={{ color: 'white' }}>
          {extractedData?.length || 0}
        </Text>
      ),
    },
    {
      title: 'Timestamp',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (timestamp: Date) => (
        <Text style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
          {new Date(timestamp).toLocaleString()}
        </Text>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_: any, record: any) => (
        <Space>
          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<EyeOutlined />}
              style={{ color: '#1890ff' }}
              onClick={() => handleViewDetails(record)}
            />
          </Tooltip>
          <Tooltip title="Export Results">
            <Button
              type="text"
              icon={<DownloadOutlined />}
              style={{ color: '#52c41a' }}
              onClick={() => handleExport(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const handleViewDetails = (record: any) => {
    setSelectedRecord(record);
    setDetailVisible(true);
  };

  const handleExport = async (record: any, format: 'csv' | 'json' = 'json') => {
    try {
      if (window.electronAPI?.reports?.export) {
        const res = await window.electronAPI.reports.export(record.result, format);
        if (res?.success) {
          message.success(`Exported ${format.toUpperCase()}`);
        } else {
          throw new Error(res?.error || 'Export failed');
        }
      }
    } catch (error) {
      console.error('Export failed:', error);
      message.error(error instanceof Error ? error.message : 'Export failed');
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
          <HistoryOutlined style={{ marginRight: '8px' }} />
          Automation History
        </Title>

        <Card className="glass-card">
          <Table
            columns={columns}
            dataSource={historyData}
            rowKey="id"
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => 
                `${range[0]}-${range[1]} of ${total} items`,
            }}
            scroll={{ x: 800 }}
            locale={{ emptyText: 'No automation history found' }}
          />
          <Modal
            open={detailVisible}
            width={900}
            title={<Text style={{ color: 'white' }}>Automation Result Details</Text>}
            onCancel={() => setDetailVisible(false)}
            footer={[
              <Button key="json" type="primary" onClick={() => selectedRecord && handleExport(selectedRecord, 'json')}>Export JSON</Button>,
              <Button key="csv" onClick={() => selectedRecord && handleExport(selectedRecord, 'csv')}>Export CSV</Button>,
              <Button key="close" onClick={() => setDetailVisible(false)}>Close</Button>
            ]}
          >
            {selectedRecord ? (
              (() => {
                try {
                  const struct = (selectedRecord.result?.extractedData || []).find((d: any) => d?.type === 'structured' && d?.content?.normalizedOptions?.length);
                  const options = struct?.content?.normalizedOptions || [];
                  if (options.length) {
                    const rows = [...options].sort((a: any, b: any) => (a.priceValue ?? 1e12) - (b.priceValue ?? 1e12));
                    return (
                      <Table
                        dataSource={rows}
                        rowKey={(r: any) => r.id}
                        pagination={false}
                        columns={[
                          { title: 'Site', dataIndex: 'sourceSite', key: 'site' },
                          { title: 'Price', dataIndex: 'priceText', key: 'price' },
                          { title: 'Value', dataIndex: 'priceValue', key: 'value' },
                          { title: 'Duration', dataIndex: 'duration', key: 'duration' },
                          { title: 'Stops', dataIndex: 'stops', key: 'stops' },
                          { title: 'Depart', dataIndex: 'departTime', key: 'depart' },
                          { title: 'Arrive', dataIndex: 'arriveTime', key: 'arrive' },
                          { title: 'Airline', dataIndex: 'airline', key: 'airline' },
                          { title: 'Link', dataIndex: 'sourceUrl', key: 'url', render: (url: string) => (<Button type="link" onClick={() => window.open(url, '_blank')}>Open</Button>) }
                        ]}
                      />
                    );
                  }
                } catch {}
                return (
                  <pre style={{ maxHeight: 500, overflow: 'auto', background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 8, color: 'white' }}>
                    {JSON.stringify(selectedRecord.result, null, 2)}
                  </pre>
                );
              })()
            ) : null}
          </Modal>
        </Card>
      </motion.div>
    </div>
  );
};

export default History;
