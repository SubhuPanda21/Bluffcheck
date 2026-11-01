import { Route, Routes } from 'react-router-dom';
import { SmoothScroll } from './motion';
import Layout from './components/Layout.jsx';
import Landing from './pages/Landing.jsx';
import Audit from './pages/Audit.jsx';
import AuditView from './pages/AuditView.jsx';
import History from './pages/History.jsx';
import { Privacy, Terms, NotFound } from './pages/Legal.jsx';

export default function App() {
  return (
    <SmoothScroll>
      <Layout>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/audit" element={<Audit />} />
          <Route path="/a/:id" element={<AuditView />} />
          <Route path="/history" element={<History />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
    </SmoothScroll>
  );
}
