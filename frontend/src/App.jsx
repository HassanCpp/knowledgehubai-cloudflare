import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import ChatPage from './pages/ChatPage';
import AdminDashboard from './pages/AdminDashboard';
import IngestionManager from './pages/IngestionManager';
import CrawlerManager from './pages/CrawlerManager';
import { MessageSquare, Layers, Globe, BarChart3, LogOut, Shield, User } from 'lucide-react';

// Wrapper Layout to show sidebar for all authenticated pages
function AuthenticatedLayout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <div className="app-container">
      {/* Sidebar Nav */}
      <div className="sidebar">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Logo brand */}
          <div className="brand-text">
            <Shield size={22} color="var(--primary)" />
            <span>KnowledgeHub</span>
          </div>

          {/* User profile capsule */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px',
            backgroundColor: 'rgba(255,255,255,0.02)',
            border: '1px solid var(--border-glass)',
            borderRadius: 'var(--radius-sm)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: user.role === 'admin' ? 'rgba(8, 145, 178, 0.1)' : 'rgba(37, 99, 235, 0.1)',
              color: user.role === 'admin' ? 'var(--secondary)' : 'var(--primary)'
            }}>
              <User size={16} />
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {user.email}
              </div>
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                color: user.role === 'admin' ? 'var(--secondary)' : 'var(--primary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                {user.role}
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Link
              to="/chat"
              className="btn btn-secondary"
              style={{
                justifyContent: 'flex-start',
                backgroundColor: isActive('/chat') ? 'var(--primary-glow)' : 'transparent',
                borderColor: isActive('/chat') ? 'rgba(37, 99, 235, 0.15)' : 'transparent',
                color: isActive('/chat') ? 'var(--primary)' : 'var(--text-muted)',
                textDecoration: 'none'
              }}
            >
              <MessageSquare size={16} /> Chat Workspace
            </Link>

            {user.role === 'admin' && (
              <>
                <Link
                  to="/admin/ingestion"
                  className="btn btn-secondary"
                  style={{
                    justifyContent: 'flex-start',
                    backgroundColor: isActive('/admin/ingestion') ? 'var(--primary-glow)' : 'transparent',
                    borderColor: isActive('/admin/ingestion') ? 'rgba(37, 99, 235, 0.15)' : 'transparent',
                    color: isActive('/admin/ingestion') ? 'var(--primary)' : 'var(--text-muted)',
                    textDecoration: 'none'
                  }}
                >
                  <Layers size={16} /> Ingestion Manager
                </Link>

                <Link
                  to="/admin/crawler"
                  className="btn btn-secondary"
                  style={{
                    justifyContent: 'flex-start',
                    backgroundColor: isActive('/admin/crawler') ? 'var(--primary-glow)' : 'transparent',
                    borderColor: isActive('/admin/crawler') ? 'rgba(37, 99, 235, 0.15)' : 'transparent',
                    color: isActive('/admin/crawler') ? 'var(--primary)' : 'var(--text-muted)',
                    textDecoration: 'none'
                  }}
                >
                  <Globe size={16} /> Web Crawler
                </Link>

                <Link
                  to="/admin/dashboard"
                  className="btn btn-secondary"
                  style={{
                    justifyContent: 'flex-start',
                    backgroundColor: isActive('/admin/dashboard') ? 'var(--primary-glow)' : 'transparent',
                    borderColor: isActive('/admin/dashboard') ? 'rgba(37, 99, 235, 0.15)' : 'transparent',
                    color: isActive('/admin/dashboard') ? 'var(--primary)' : 'var(--text-muted)',
                    textDecoration: 'none'
                  }}
                >
                  <BarChart3 size={16} /> Admin Observability
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Logout Section */}
        <button
          onClick={handleLogout}
          className="btn btn-secondary"
          style={{ justifyContent: 'flex-start', color: '#dc2626' }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(220,38,38,0.05)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <LogOut size={16} /> Log Out
        </button>
      </div>

      {/* Main Panel Viewport */}
      <div className="main-content">
        {children}
      </div>
    </div>
  );
}

// Route Guard to protect admin-only pages
function AdminGuard({ children }) {
  const { user } = useAuth();
  if (user.role !== 'admin') {
    return <Navigate to="/chat" replace />;
  }
  return children;
}

// Route Guard to protect authenticated pages
function AuthGuard({ children }) {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <AuthenticatedLayout>{children}</AuthenticatedLayout>;
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#05070f',
        color: '#fff'
      }}>
        <div className="glow-spinner" />
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Public auth route */}
        <Route path="/login" element={user ? <Navigate to="/chat" replace /> : <LoginPage />} />

        {/* Private user routes */}
        <Route path="/chat" element={<AuthGuard><ChatPage /></AuthGuard>} />

        {/* Private admin routes */}
        <Route path="/admin/ingestion" element={<AuthGuard><AdminGuard><IngestionManager /></AdminGuard></AuthGuard>} />
        <Route path="/admin/crawler" element={<AuthGuard><AdminGuard><CrawlerManager /></AdminGuard></AuthGuard>} />
        <Route path="/admin/dashboard" element={<AuthGuard><AdminGuard><AdminDashboard /></AdminGuard></AuthGuard>} />

        {/* Fallbacks */}
        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Routes>
    </Router>
  );
}
