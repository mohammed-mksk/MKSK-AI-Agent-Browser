import React from 'react';
import { Card, List, Button, Space, Typography, Tag, Empty } from 'antd';
import { 
  PlayCircleOutlined, 
  EditOutlined, 
  DeleteOutlined,
  FolderOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { motion } from 'framer-motion';
import { useAppStore } from '../store/appStore';

const { Title, Text } = Typography;

const Workflows: React.FC = () => {
  const { workflows, deleteWorkflow } = useAppStore();

  const handleRunWorkflow = (workflow: any) => {
    // TODO: Navigate to automation page with pre-filled command
    console.log('Run workflow:', workflow);
  };

  const handleEditWorkflow = (workflow: any) => {
    // TODO: Open edit modal
    console.log('Edit workflow:', workflow);
  };

  const handleDeleteWorkflow = (workflowId: string) => {
    deleteWorkflow(workflowId);
  };

  const handleCreateWorkflow = () => {
    // TODO: Open create workflow modal
    console.log('Create new workflow');
  };

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <Title level={2} style={{ color: 'white', margin: 0 }}>
            <FolderOutlined style={{ marginRight: '8px' }} />
            Workflows
          </Title>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreateWorkflow}
            className="gradient-button"
          >
            Create Workflow
          </Button>
        </div>

        <Card className="glass-card">
          {workflows.length === 0 ? (
            <Empty
              description={
                <Text style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                  No workflows created yet
                </Text>
              }
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            <List
              itemLayout="vertical"
              dataSource={workflows}
              renderItem={(workflow) => (
                <List.Item
                  key={workflow.id}
                  style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}
                  actions={[
                    <Button
                      key="run"
                      type="primary"
                      icon={<PlayCircleOutlined />}
                      onClick={() => handleRunWorkflow(workflow)}
                      className="gradient-button"
                    >
                      Run
                    </Button>,
                    <Button
                      key="edit"
                      type="text"
                      icon={<EditOutlined />}
                      onClick={() => handleEditWorkflow(workflow)}
                      style={{ color: '#1890ff' }}
                    >
                      Edit
                    </Button>,
                    <Button
                      key="delete"
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => handleDeleteWorkflow(workflow.id)}
                    >
                      Delete
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Text style={{ color: 'white', fontSize: '16px', fontWeight: 'bold' }}>
                        {workflow.name}
                      </Text>
                    }
                    description={
                      <Space direction="vertical" size="small">
                        <Text style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                          {workflow.description}
                        </Text>
                        <Text style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px' }}>
                          Command: {workflow.command.length > 100 
                            ? `${workflow.command.substring(0, 100)}...` 
                            : workflow.command}
                        </Text>
                        <Space>
                          {workflow.tags.map((tag) => (
                            <Tag key={tag} color="blue">
                              {tag}
                            </Tag>
                          ))}
                        </Space>
                        <Space>
                          <Text style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px' }}>
                            Used {workflow.useCount} times
                          </Text>
                          <Text style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px' }}>
                            Last used: {workflow.lastUsed.toLocaleDateString()}
                          </Text>
                          <Text style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px' }}>
                            Created: {workflow.createdAt.toLocaleDateString()}
                          </Text>
                        </Space>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </Card>
      </motion.div>
    </div>
  );
};

export default Workflows;