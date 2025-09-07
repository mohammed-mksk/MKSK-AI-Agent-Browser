import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout } from 'antd';
import { motion } from 'framer-motion';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import Automation from './pages/Automation';
import History from './pages/History';
import Workflows from './pages/Workflows';
import Settings from './pages/Settings';
import { useAppStore } from './store/appStore';

const { Content } = Layout;

const App: React.FC = () => {
  const { sidebarCollapsed } = useAppStore();

  return (
    <Layout style={{ height: '100vh' }}>
      <Sidebar />
      <Layout>
        <Header />
        <Content
          style={{
            margin: '16px',
            padding: '24px',
            overflow: 'auto',
            background: 'transparent'
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            style={{ height: '100%' }}
          >
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/automation" element={<Automation />} />
              <Route path="/history" element={<History />} />
              <Route path="/workflows" element={<Workflows />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </motion.div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default App;