import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import ReactMarkdown from 'react-markdown';
import { 
  BarChart3, Clock, HelpCircle, AlertTriangle, Cpu, Layers, HardDrive, 
  MessageSquare, User, ArrowLeft, FileText, Calendar, ChevronRight
} from 'lucide-react';

export default function AdminDashboard() {
  const { apiFetch } = useAuth();
  
  // Dashboard Analytics States
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Audit Explorer Tab States
  const [activeTab, setActiveTab] = useState('analytics'); // 'analytics' | 'audit'
  const [userAudits, setUserAudits] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedInspectMsg, setSelectedInspectMsg] = useState(null);
  const [fetchingAudits, setFetchingAudits] = useState(false);

  const fetchAnalytics = async () => {
    try {
      const data = await apiFetch('/admin/analytics');
      setAnalytics(data);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to fetch analytics data');
    } finally {
      setLoading(false);
    }
  };

  const fetchConversations = async () => {
    setFetchingAudits(true);
    try {
      const data = await apiFetch('/admin/conversations');
      setUserAudits(data);
    } catch (err) {
      console.error('Failed to load user conversations:', err.message);
    } finally {
      setFetchingAudits(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchConversations();
    }
  }, [activeTab]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div className="glow-spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '40px' }}>
        <div className="alert alert-error">{error}</div>
      </div>
    );
  }

  const { overview, latencies, documentsByType, duplicateDocumentsCount, topQuestions, failedQueries } = analytics;

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '32px', width: '100%', minWidth: 0 }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '2rem' }} className="gradient-text">Admin Observability Dashboard</h2>
        <p style={{ color: 'var(--text-muted)' }}>Real-time statistics, vector ingestion diagnostics, and user session chat auditing</p>
      </div>

      {/* Primary Tab Selectors */}
      <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
        <button
          onClick={() => {
            setActiveTab('analytics');
            setSelectedUser(null);
            setSelectedSession(null);
          }}
          className="btn btn-secondary"
          style={{
            backgroundColor: activeTab === 'analytics' ? 'var(--primary-glow)' : 'transparent',
            borderColor: activeTab === 'analytics' ? 'rgba(37, 99, 235, 0.15)' : 'transparent',
            color: activeTab === 'analytics' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: 600
          }}
        >
          <BarChart3 size={16} /> Analytics Dashboard
        </button>
        <button
          onClick={() => {
            setActiveTab('audit');
            setSelectedUser(null);
            setSelectedSession(null);
          }}
          className="btn btn-secondary"
          style={{
            backgroundColor: activeTab === 'audit' ? 'var(--primary-glow)' : 'transparent',
            borderColor: activeTab === 'audit' ? 'rgba(37, 99, 235, 0.15)' : 'transparent',
            color: activeTab === 'audit' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: 600
          }}
        >
          <User size={16} /> User & Session Audit Explorer
        </button>
      </div>

      {activeTab === 'analytics' ? (
        <>
          {/* Overview Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
            <div className="glass-card" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary)' }}>
                <HardDrive size={24} />
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Knowledge Documents</span>
                <h3 style={{ fontSize: '1.8rem', marginTop: '4px' }}>{overview.documents}</h3>
              </div>
            </div>

            <div className="glass-card" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(8, 145, 178, 0.1)', color: 'var(--secondary)' }}>
                <Layers size={24} />
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Parsed Chunks</span>
                <h3 style={{ fontSize: '1.8rem', marginTop: '4px' }}>{overview.chunks}</h3>
              </div>
            </div>

            <div className="glass-card" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(22, 163, 74, 0.1)', color: 'var(--success)' }}>
                <Cpu size={24} />
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Vector Embeddings</span>
                <h3 style={{ fontSize: '1.8rem', marginTop: '4px' }}>{overview.embeddings}</h3>
              </div>
            </div>

            <div className="glass-card" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(202, 138, 4, 0.1)', color: 'var(--warning)' }}>
                <Clock size={24} />
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Avg Chunk Size (chars)</span>
                <h3 style={{ fontSize: '1.8rem', marginTop: '4px' }}>{overview.averageChunkSize}</h3>
              </div>
            </div>
          </div>

          {/* Latency & Cache Health */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
            {/* Latency Breakdown Bar */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} color="var(--primary)" /> Average Query Latency Breakdown ({latencies.total}ms)
              </h4>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { label: 'Embedding Generation', value: latencies.embedding, color: 'var(--primary)' },
                  { label: 'Parallel Candidate Retrieval', value: latencies.retrieval, color: 'var(--secondary)' },
                  { label: 'Two-Stage Re-ranking', value: latencies.reranking, color: 'var(--warning)' },
                  { label: 'LLM Stream Answer Formulation', value: latencies.llm, color: 'var(--success)' },
                ].map((lat, idx) => {
                  const percentage = latencies.total > 0 ? (lat.value / latencies.total) * 100 : 0;
                  return (
                    <div key={idx}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{lat.label}</span>
                        <span style={{ fontWeight: 600 }}>{lat.value}ms ({percentage.toFixed(0)}%)</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', borderRadius: '4px', backgroundColor: 'rgba(15, 23, 42, 0.05)', overflow: 'hidden' }}>
                        <div style={{ width: `${percentage}%`, height: '100%', backgroundColor: lat.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cache Hit and Index Duplications */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Cpu size={18} color="var(--secondary)" /> Retrieval Quality & Cache Health
              </h4>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', flex: 1, alignItems: 'center' }}>
                <div style={{ textAlign: 'center', borderRight: '1px solid var(--border-glass)' }}>
                  <div style={{ fontSize: '3rem', fontWeight: 700, color: 'var(--secondary)', lineHeight: 1 }}>
                    {(overview.cacheHitRate * 100).toFixed(0)}%
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginTop: '8px' }}>
                    Cache Hit Rate
                  </span>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '3rem', fontWeight: 700, color: 'var(--success)', lineHeight: 1 }}>
                    {(overview.retrievalAccuracy * 100).toFixed(0)}%
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginTop: '8px' }}>
                    Retrieval Accuracy
                  </span>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '12px', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Duplicate Documents Intercepted:</span>
                <span style={{ fontWeight: 600, color: 'var(--error)' }}>{duplicateDocumentsCount} files</span>
              </div>
            </div>
          </div>

          {/* Documents by type Chart & Top Questions */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart3 size={18} color="var(--success)" /> Ingested Documents by Classification
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '200px' }}>
                {documentsByType.length === 0 ? (
                  <p style={{ color: 'var(--text-dark)', fontSize: '0.9rem', textAlign: 'center' }}>No documents parsed yet</p>
                ) : (
                  documentsByType.map((item, idx) => {
                    const maxCount = Math.max(...documentsByType.map((d) => d.count), 1);
                    const percent = (item.count / maxCount) * 100;
                    return (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ width: '120px', fontSize: '0.85rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                          {item.type}
                        </span>
                        <div style={{ flex: 1, height: '14px', borderRadius: '7px', backgroundColor: 'rgba(15, 23, 42, 0.03)', overflow: 'hidden', display: 'flex' }}>
                          <div style={{ width: `${percent}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary) 0%, var(--secondary) 100%)' }} />
                        </div>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, width: '30px', textAlign: 'right' }}>
                          {item.count}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <HelpCircle size={18} color="var(--warning)" /> Top Knowledge Queries
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '200px' }}>
                {topQuestions.length === 0 ? (
                  <p style={{ color: 'var(--text-dark)', fontSize: '0.9rem', textAlign: 'center' }}>No query histories logged</p>
                ) : (
                  topQuestions.map((q, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(15, 23, 42, 0.02)', borderRadius: '4px', fontSize: '0.85rem' }}>
                      <span style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', flex: 1, marginRight: '16px' }}>
                        {idx + 1}. {q.query}
                      </span>
                      <span style={{ fontWeight: 600, color: 'var(--secondary)' }}>{q.count} hits</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Failed/Fallback Queries Table */}
          <div className="glass-card">
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <AlertTriangle size={18} color="var(--error)" /> Fallback & Insufficient Similarity Logs
            </h4>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '12px 8px' }}>Query Text</th>
                    <th style={{ padding: '12px 8px' }}>Reason</th>
                    <th style={{ padding: '12px 8px' }}>Best Chunk Similarity</th>
                    <th style={{ padding: '12px 8px' }}>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {failedQueries.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-dark)' }}>
                        No failed retrievals or fallback routes logged
                      </td>
                    </tr>
                  ) : (
                    failedQueries.map((log) => (
                      <tr key={log._id} style={{ borderBottom: '1px solid rgba(15, 23, 42, 0.02)' }}>
                        <td style={{ padding: '12px 8px', fontWeight: 500 }}>{log.queryText}</td>
                        <td style={{ padding: '12px 8px' }}>
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(220, 38, 38, 0.1)',
                            color: 'var(--error)',
                            fontSize: '0.75rem',
                          }}>
                            {log.reason}
                          </span>
                        </td>
                        <td style={{ padding: '12px 8px', color: 'var(--warning)', fontWeight: 600 }}>
                          {log.similarityScore ? (log.similarityScore * 100).toFixed(1) + '%' : 'N/A'}
                        </td>
                        <td style={{ padding: '12px 8px', color: 'var(--text-dark)' }}>
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Hierarchical User & Session Audit Explorer */
        <div style={{ width: '100%' }}>
          {/* Breadcrumb Navigation Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', fontSize: '0.9rem' }}>
            <span
              onClick={() => { setSelectedUser(null); setSelectedSession(null); }}
              style={{ cursor: 'pointer', color: !selectedUser ? 'var(--primary)' : 'var(--text-muted)', fontWeight: !selectedUser ? 600 : 400 }}
            >
              Users Directory
            </span>

            {selectedUser && (
              <>
                <ChevronRight size={14} color="var(--text-muted)" />
                <span
                  onClick={() => setSelectedSession(null)}
                  style={{ cursor: 'pointer', color: selectedUser && !selectedSession ? 'var(--primary)' : 'var(--text-muted)', fontWeight: selectedUser && !selectedSession ? 600 : 400 }}
                >
                  {selectedUser.user?.email || 'User'} ({selectedUser.totalSessions} Sessions)
                </span>
              </>
            )}

            {selectedSession && (
              <>
                <ChevronRight size={14} color="var(--text-muted)" />
                <span style={{ color: 'var(--primary)', fontWeight: 600, fontFamily: 'monospace' }}>
                  Session: {selectedSession.sessionId}
                </span>
              </>
            )}
          </div>

          {/* LEVEL 1: User Directory List */}
          {!selectedUser ? (
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <User size={18} color="var(--primary)" /> Registered Users Directory ({userAudits.length})
                </h4>
                <button onClick={fetchConversations} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                  Refresh Users
                </button>
              </div>

              {fetchingAudits ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                  <div className="glow-spinner" />
                </div>
              ) : userAudits.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-dark)', padding: '40px' }}>
                  No active users or sessions recorded in D1 database.
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '12px 8px' }}>User Details</th>
                        <th style={{ padding: '12px 8px' }}>Total Sessions</th>
                        <th style={{ padding: '12px 8px' }}>Total Queries</th>
                        <th style={{ padding: '12px 8px' }}>Last Active</th>
                        <th style={{ padding: '12px 8px', textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userAudits.map((uRec) => (
                        <tr key={uRec.userId} style={{ borderBottom: '1px solid rgba(15, 23, 42, 0.03)' }}>
                          <td style={{ padding: '12px 8px', fontWeight: 500 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ padding: '8px', borderRadius: '50%', backgroundColor: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary)' }}>
                                <User size={16} />
                              </div>
                              <div>
                                <span style={{ display: 'block', fontWeight: 600 }}>{uRec.user?.username || 'User'}</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{uRec.user?.email}</span>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '12px 8px', fontWeight: 600, color: 'var(--secondary)' }}>
                            {uRec.totalSessions} session(s)
                          </td>
                          <td style={{ padding: '12px 8px', fontWeight: 600, color: 'var(--success)' }}>
                            {uRec.totalQueries} query(s)
                          </td>
                          <td style={{ padding: '12px 8px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            {new Date(uRec.lastActive).toLocaleString()}
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                            <button
                              onClick={() => setSelectedUser(uRec)}
                              className="btn btn-secondary"
                              style={{ padding: '6px 12px', fontSize: '0.8rem', gap: '4px' }}
                            >
                              Explore Sessions <ChevronRight size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : !selectedSession ? (
            /* LEVEL 2: User Sessions List */
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MessageSquare size={18} color="var(--secondary)" /> Sessions for {selectedUser.user?.email}
                  </h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Queries: {selectedUser.totalQueries}</span>
                </div>
                <button onClick={() => setSelectedUser(null)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem', gap: '6px' }}>
                  <ArrowLeft size={14} /> Back to Users
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '12px 8px' }}>Session ID</th>
                      <th style={{ padding: '12px 8px' }}>Query Count</th>
                      <th style={{ padding: '12px 8px' }}>Last Updated</th>
                      <th style={{ padding: '12px 8px', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedUser.sessions.map((sess) => (
                      <tr key={sess.sessionId} style={{ borderBottom: '1px solid rgba(15, 23, 42, 0.03)' }}>
                        <td style={{ padding: '12px 8px', fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary)' }}>
                          {sess.sessionId}
                        </td>
                        <td style={{ padding: '12px 8px', fontWeight: 600, color: 'var(--secondary)' }}>
                          {sess.messages?.length || 0} messages
                        </td>
                        <td style={{ padding: '12px 8px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          {new Date(sess.updatedAt).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                          <button
                            onClick={() => setSelectedSession(sess)}
                            className="btn btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '0.8rem', gap: '4px' }}
                          >
                            Inspect Session Logs <ChevronRight size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* LEVEL 3: Session Transcript & Inline Pipeline Diagnostics */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-glass)', paddingBottom: '16px' }}>
                <button
                  onClick={() => setSelectedSession(null)}
                  className="btn btn-secondary"
                  style={{ gap: '6px', fontSize: '0.85rem' }}
                >
                  <ArrowLeft size={16} /> Back to Sessions
                </button>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Auditing Session:</span>
                  <span style={{ display: 'block', fontFamily: 'monospace', fontSize: '0.9rem', fontWeight: 600 }}>{selectedSession.sessionId}</span>
                </div>
              </div>

              {/* Session Chat Feed */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '12px 0' }}>
                {selectedSession.messages.map((msg) => (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* User Query */}
                    <div style={{ alignSelf: 'flex-end', maxWidth: '80%' }}>
                      <div style={{
                        backgroundColor: 'var(--primary)',
                        padding: '12px 16px',
                        borderRadius: '16px 16px 4px 16px',
                        boxShadow: '0 4px 12px rgba(37, 99, 235, 0.12)',
                        color: '#fff',
                        fontSize: '0.92rem'
                      }}>
                        {msg.originalQuery}
                      </div>
                    </div>

                    {/* Assistant Response Card */}
                    <div style={{ alignSelf: 'flex-start', maxWidth: '90%', display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                      <div className="glass-card" style={{ padding: '16px 20px', borderRadius: '16px 16px 16px 4px', fontSize: '0.92rem' }}>
                        <ReactMarkdown>{msg.responseText}</ReactMarkdown>
                      </div>

                      {/* RAG Diagnostics Footer Bar */}
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap', 
                        gap: '12px', 
                        padding: '8px 12px', 
                        border: '1px solid var(--border-glass)', 
                        borderRadius: 'var(--radius-sm)', 
                        fontSize: '0.75rem',
                        backgroundColor: 'rgba(15, 23, 42, 0.01)',
                        color: 'var(--text-muted)'
                      }}>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={12} /> Total Latency: <strong>{msg.totalTimeMs}ms</strong>
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <AlertTriangle size={12} /> Intent: <strong style={{ textTransform: 'uppercase', color: 'var(--secondary)' }}>{msg.intent}</strong>
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <FileText size={12} /> Sources Cited: <strong>{msg.sources?.length || 0} document(s)</strong>
                          </span>
                        </div>

                        <button
                          onClick={() => setSelectedInspectMsg(msg)}
                          className="btn btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '0.75rem', gap: '4px' }}
                        >
                          <Cpu size={12} /> Inspect Pipeline
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Inspect Pipeline Modal */}
          {selectedInspectMsg && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.6)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '24px'
            }}>
              <div className="glass-card" style={{
                width: '100%',
                maxWidth: '720px',
                maxHeight: '90vh',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
                backgroundColor: '#ffffff',
                border: '1px solid var(--border-glass)',
                boxShadow: 'var(--shadow-neon)'
              }}>
                {/* Modal Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', margin: 0 }}>Pipeline Execution Diagnostics</h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Query ID: {selectedInspectMsg.id}</span>
                  </div>
                  <button onClick={() => setSelectedInspectMsg(null)} className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.85rem' }}>
                    ✕ Close
                  </button>
                </div>

                {/* Latency Visualizer Bar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(15, 23, 42, 0.02)', padding: '16px', borderRadius: '8px' }}>
                  <h4 style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={16} color="var(--primary)" /> End-to-End Latency Breakdown ({selectedInspectMsg.totalTimeMs}ms)
                  </h4>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                      { label: 'Embedding Generation', value: selectedInspectMsg.embeddingTimeMs, color: 'var(--primary)' },
                      { label: 'Parallel Candidate Retrieval (Dense + Sparse)', value: selectedInspectMsg.retrievalTimeMs, color: 'var(--secondary)' },
                      { label: 'Two-Stage Re-ranking', value: selectedInspectMsg.rerankingTimeMs, color: 'var(--warning)' },
                      { label: 'LLM Response Streaming', value: selectedInspectMsg.llmTimeMs, color: 'var(--success)' },
                    ].map((stg, i) => {
                      const pct = selectedInspectMsg.totalTimeMs > 0 ? (stg.value / selectedInspectMsg.totalTimeMs) * 100 : 0;
                      return (
                        <div key={i}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '2px' }}>
                            <span style={{ color: 'var(--text-muted)' }}>{stg.label}</span>
                            <span style={{ fontWeight: 600 }}>{stg.value} ms ({pct.toFixed(0)}%)</span>
                          </div>
                          <div style={{ width: '100%', height: '6px', borderRadius: '3px', backgroundColor: 'rgba(15, 23, 42, 0.05)', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', backgroundColor: stg.color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Query Transformation Comparison */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h4 style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={16} color="var(--secondary)" /> Query Pre-Processing & Intent
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ padding: '12px', borderRadius: '6px', background: 'rgba(37, 99, 235, 0.05)', border: '1px solid rgba(37, 99, 235, 0.1)' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Original User Query:</span>
                      <strong style={{ fontSize: '0.875rem' }}>{selectedInspectMsg.originalQuery}</strong>
                    </div>
                    <div style={{ padding: '12px', borderRadius: '6px', background: 'rgba(8, 145, 178, 0.05)', border: '1px solid rgba(8, 145, 178, 0.1)' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Rewritten Search Query:</span>
                      <strong style={{ fontSize: '0.875rem' }}>{selectedInspectMsg.rewrittenQuery}</strong>
                    </div>
                  </div>
                </div>

                {/* Cited Sources & Chunks */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h4 style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Layers size={16} color="var(--success)" /> Sources & Context Chunks Cited ({selectedInspectMsg.sources?.length || 0})
                  </h4>
                  {selectedInspectMsg.sources?.length === 0 ? (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No document chunks cited (Fallback / General Knowledge mode used).</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '160px', overflowY: 'auto' }}>
                      {selectedInspectMsg.sources.map((src, idx) => (
                        <div key={idx} style={{ padding: '8px 12px', borderRadius: '6px', background: 'rgba(15, 23, 42, 0.02)', border: '1px solid var(--border-glass)', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <strong style={{ color: 'var(--primary)' }}>{src.filename || 'Document Chunk'}</strong>
                            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>Chunk ID: {src.chunkId}</span>
                          </div>
                          <span style={{ fontWeight: 600, color: 'var(--secondary)', fontSize: '0.75rem', padding: '2px 6px', background: 'rgba(8, 145, 178, 0.1)', borderRadius: '4px' }}>
                            Score: {(src.score * 100).toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Streamed Response Output */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <h4 style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MessageSquare size={16} color="var(--warning)" /> LLM Streamed Response
                  </h4>
                  <div style={{ padding: '16px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.02)', border: '1px solid var(--border-glass)', fontSize: '0.875rem', maxHeight: '200px', overflowY: 'auto' }}>
                    <ReactMarkdown>{selectedInspectMsg.responseText}</ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
