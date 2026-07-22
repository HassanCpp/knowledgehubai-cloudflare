import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import ReactMarkdown from 'react-markdown';
import { Send, Plus, MessageSquare, Trash2, FileText, Sparkles, Loader } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_URL } from '../config/api';

export default function ChatPage() {
  const { token, apiFetch } = useAuth();
  // sessions: { [sessionId]: { firstQuery, lastActive } }
  const [sessions, setSessions] = useState({});
  const [currentSessionId, setCurrentSessionId] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streamingMessage, setStreamingMessage] = useState('');
  const [streamingSources, setStreamingSources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSource, setSelectedSource] = useState(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);

  const messagesEndRef = useRef(null);

  // 1. Fetch chat history sessions on mount
  const fetchHistory = async () => {
    try {
      const data = await apiFetch('/query/history');
      // Worker returns: [{ session_id, first_query, last_active }]
      // Reshape to: { [session_id]: { firstQuery, lastActive } }
      const shaped = {};
      if (Array.isArray(data)) {
        data.forEach(({ session_id, first_query, last_active }) => {
          shaped[session_id] = { firstQuery: first_query, lastActive: last_active };
        });
      }
      setSessions(shaped);

      // Auto-select first session
      const ids = Object.keys(shaped);
      if (ids.length > 0 && !currentSessionId) {
        selectSession(ids[0]);
      }
    } catch (err) {
      console.error('Failed to load chat history:', err.message);
    }
  };

  // Load messages for a session
  const selectSession = async (sessionId) => {
    setCurrentSessionId(sessionId);
    try {
      const data = await apiFetch(`/query/history/${sessionId}`);
      // Worker returns: [{ original_query, response_text, sources, created_at }]
      // Reshape to match what the message render block expects
      const msgs = Array.isArray(data) ? data.map(row => ({
        _id: row.created_at,
        originalQuery: row.original_query,
        responseText: row.response_text,
        sources: (() => { try { return JSON.parse(row.sources || '[]'); } catch { return []; } })(),
      })) : [];
      setMessages(msgs);
    } catch (err) {
      console.error('Failed to load session messages:', err.message);
      setMessages([]);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessage]);

  // Start a new chat session
  const startNewSession = () => {
    const newId = `session_${Date.now()}`;
    setCurrentSessionId(newId);
    setMessages([]);
    setStreamingMessage('');
    setStreamingSources([]);
  };

  // Delete chat history session
  const deleteSession = async (sessionId, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this conversation?')) return;

    try {
      await apiFetch(`/query/history/${sessionId}`, { method: 'DELETE' });
      if (currentSessionId === sessionId) {
        setCurrentSessionId('');
        setMessages([]);
      }
      fetchHistory();
    } catch (err) {
      alert(`Failed to delete history: ${err.message}`);
    }
  };

  // Send message and read stream
  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessageText = input.trim();
    setInput('');
    setLoading(true);

    const activeSessionId = currentSessionId || `session_${Date.now()}`;
    if (!currentSessionId) {
      setCurrentSessionId(activeSessionId);
    }

    // Append user message immediately
    const tempUserMsg = { _id: `temp_u_${Date.now()}`, originalQuery: userMessageText, responseText: '', sources: [], role: 'user' };
    setMessages((prev) => [...prev, tempUserMsg]);

    setStreamingMessage('');
    setStreamingSources([]);

    try {
      const response = await fetch(`${API_URL}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: userMessageText,
          sessionId: activeSessionId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start stream response');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let finished = false;
      let accumulatedText = '';

      while (!finished) {
        const { done, value } = await reader.read();
        if (done) {
          finished = true;
          break;
        }

        const chunk = decoder.decode(value);
        // SSE responses might contain multiple lines starting with "data: "
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.trim().startsWith('data: ')) {
            try {
              const payload = JSON.parse(line.trim().substring(6));
              
              if (payload.type === 'metadata') {
                if (payload.sources) {
                  setStreamingSources(payload.sources);
                }
              } else if (payload.type === 'token') {
                accumulatedText += payload.content;
                setStreamingMessage(accumulatedText);
              } else if (payload.type === 'done') {
                finished = true;
              } else if (payload.type === 'error') {
                throw new Error(payload.message || 'Stream processing error');
              }
            } catch (err) {
              console.warn('Parsing SSE line failed:', err.message, line);
            }
          }
        }
      }

      // Commit the completed assistant response into the permanent messages array
      if (accumulatedText.trim().length > 0) {
        setMessages((prev) => [
          ...prev,
          {
            _id: `resp_${Date.now()}`,
            originalQuery: '',
            responseText: accumulatedText,
            sources: streamingSources,
          },
        ]);
      }
      setStreamingMessage('');
      setStreamingSources([]);
      await fetchHistory();
    } catch (err) {
      console.error(err);
      setStreamingMessage((prev) => `${prev}\n\n*[System Error: ${err.message}]*`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flex: 1, height: '100%' }}>
      {/* Session List Sidebar */}
      <div style={{
        width: isHistoryOpen ? '260px' : '0px',
        flexShrink: 0,
        backgroundColor: '#f1f5f9',
        borderRight: isHistoryOpen ? '1px solid var(--border-glass)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        padding: isHistoryOpen ? '16px' : '0px',
        gap: isHistoryOpen ? '16px' : '0px',
        overflow: 'hidden',
        transition: 'all 0.2s ease-in-out'
      }}>
        <button className="btn btn-primary" onClick={startNewSession} style={{ width: '100%' }}>
          <Plus size={18} /> New Chat
        </button>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          overflowY: 'auto',
          flex: 1
        }}>
          <h4 style={{ fontSize: '0.8rem', color: 'var(--text-dark)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Conversations
          </h4>
          {Object.keys(sessions || {}).length === 0 ? (
            <p style={{ color: 'var(--text-dark)', fontSize: '0.9rem', textAlign: 'center', marginTop: '20px' }}>
              No history yet
            </p>
          ) : (
            Object.keys(sessions || {}).map((sid) => {
              const { firstQuery } = (sessions && sessions[sid]) || {};
              const isSelected = sid === currentSessionId;
              return (
                <div
                  key={sid}
                  onClick={() => selectSession(sid)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    background: isSelected ? 'var(--primary-glow)' : 'transparent',
                    border: isSelected ? '1px solid rgba(37, 99, 235, 0.15)' : '1px solid transparent',
                    color: isSelected ? 'var(--primary)' : 'var(--text-muted)',
                    transition: 'var(--transition-smooth)',
                  }}
                  className="session-item"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, overflow: 'hidden' }}>
                    <MessageSquare size={16} />
                    <span style={{ fontSize: '0.9rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {firstQuery || 'New Chat'}
                    </span>
                  </div>
                  <button
                    onClick={(e) => deleteSession(sid, e)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-dark)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--error)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-dark)')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Chat Stream Container */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-glass)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <button
            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            title={isHistoryOpen ? "Hide chat history" : "Show chat history"}
            className="btn btn-secondary"
            style={{
              padding: '8px 10px',
              height: '36px',
              width: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-sm)'
            }}
          >
            <MessageSquare size={16} />
          </button>
          <div>
            <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} color="var(--secondary)" /> AI Knowledge Assistant
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Connected to collections in KnowledgeHubAI
            </span>
          </div>
        </div>

        {/* Messages Stream */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 16px' }}>
          <div style={{
            maxWidth: '850px',
            margin: '0 auto',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            minHeight: '100%'
          }}>
            {(Array.isArray(messages) ? messages : []).length === 0 && !streamingMessage && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '70%',
                  color: 'var(--text-muted)',
                  textAlign: 'center',
                  gap: '12px',
                  marginTop: '40px'
                }}
              >
                <Sparkles size={48} color="var(--primary)" style={{ opacity: 0.6 }} />
                <h3>Ask anything about your documents</h3>
                <p style={{ maxWidth: '400px', fontSize: '0.9rem' }}>
                  Upload PDFs, PPTX slides, Word docs, CSV databases, or scrape sites inside Ingestion Manager. Ask questions and get real-time source citations.
                </p>
              </motion.div>
            )}

            <AnimatePresence initial={false}>
              {(Array.isArray(messages) ? messages : []).map((msg) => (
                <React.Fragment key={msg._id}>
                  {/* User message block */}
                  {msg.originalQuery && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25 }}
                      style={{ alignSelf: 'flex-end', maxWidth: '80%' }}
                    >
                      <div style={{
                        backgroundColor: 'var(--primary)',
                        padding: '12px 16px',
                        borderRadius: '16px 16px 4px 16px',
                        boxShadow: '0 4px 12px rgba(37, 99, 235, 0.15)',
                        color: '#fff',
                        fontSize: '0.95rem'
                      }}>
                        {msg.originalQuery}
                      </div>
                    </motion.div>
                  )}

                  {/* Assistant message block */}
                  {msg.responseText && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25 }}
                      style={{ alignSelf: 'flex-start', maxWidth: '85%', display: 'flex', flexDirection: 'column', gap: '8px' }}
                    >
                      <div className="glass-card" style={{
                        padding: '16px 20px',
                        borderRadius: '16px 16px 16px 4px',
                        fontSize: '0.95rem'
                      }}>
                        <ReactMarkdown>{msg.responseText}</ReactMarkdown>
                      </div>
                      {/* Sources tag list */}
                      {msg.sources && Array.isArray(msg.sources) && msg.sources.length > 0 && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-dark)', display: 'flex', alignItems: 'center' }}>
                            Sources:
                          </span>
                          {msg.sources.map((src, idx) => (
                            <button
                              key={idx}
                              onClick={() => setSelectedSource(src)}
                              className="btn"
                              style={{
                                padding: '4px 8px',
                                fontSize: '0.75rem',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(6, 182, 212, 0.1)',
                                border: '1px solid rgba(6, 182, 212, 0.2)',
                                color: 'var(--secondary)',
                                cursor: 'pointer',
                              }}
                            >
                              <FileText size={12} style={{ marginRight: '4px' }} />
                              {(src.filename || 'Document').substring(0, 15)}... (P{src.page || 1})
                            </button>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </React.Fragment>
              ))}
            </AnimatePresence>

            {/* Active Streaming Answer */}
            {streamingMessage && (
              <div style={{ alignSelf: 'flex-start', maxWidth: '85%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div className="glass-card" style={{
                  padding: '16px 20px',
                  borderRadius: '16px 16px 16px 4px',
                  fontSize: '0.95rem'
                }}>
                  <ReactMarkdown>{streamingMessage}</ReactMarkdown>
                </div>
                
                {/* Streaming sources preview */}
                {streamingSources.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {streamingSources.map((src, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedSource(src)}
                        className="btn"
                        style={{
                          padding: '4px 8px',
                          fontSize: '0.75rem',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(6, 182, 212, 0.1)',
                          border: '1px solid rgba(6, 182, 212, 0.2)',
                          color: 'var(--secondary)',
                          cursor: 'pointer',
                        }}
                      >
                        <FileText size={12} style={{ marginRight: '4px' }} />
                        {(src.filename || 'Document').substring(0, 15)}... (P{src.page || 1})
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Pulsing Skeleton Loader */}
            {loading && !streamingMessage && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ alignSelf: 'flex-start', width: '100%', maxWidth: '600px' }}
              >
                <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontWeight: 500, fontSize: '0.9rem' }}>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                      style={{ display: 'inline-flex' }}
                    >
                      <Sparkles size={16} />
                    </motion.div>
                    <span>Analyzing sources and formulating answer...</span>
                  </div>
                  
                  {/* Shimmering Skeleton Lines */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                    <div className="skeleton-line" style={{ width: '90%' }}></div>
                    <div className="skeleton-line" style={{ width: '75%' }}></div>
                    <div className="skeleton-line" style={{ width: '50%' }}></div>
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Bar */}
        <div style={{
          borderTop: '1px solid var(--border-glass)',
          padding: '20px 24px',
          backgroundColor: 'rgba(255,255,255,0.4)',
          backdropFilter: 'blur(8px)'
        }}>
          <form onSubmit={handleSend} style={{
            maxWidth: '850px',
            margin: '0 auto',
            width: '100%',
            display: 'flex',
            gap: '12px',
            alignItems: 'center'
          }}>
            <input
              type="text"
              className="form-input"
              style={{ borderRadius: 'var(--radius-md)', height: '48px', flex: 1 }}
              placeholder="Ask a question about your knowledge base..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
            />
            <button type="submit" className="btn btn-primary" style={{ borderRadius: '50%', width: '48px', height: '48px', padding: 0 }} disabled={loading}>
              <Send size={18} />
            </button>
          </form>
        </div>

        {/* Source Inspector Modal */}
        {selectedSource && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '24px'
          }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '500px', border: '1px solid var(--border-glass-focus)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--secondary)' }}>
                  <FileText size={18} /> Source Citation Inspector
                </h4>
                <button
                  onClick={() => setSelectedSource(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  X
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Filename:</span>
                  <div style={{ fontWeight: 500, color: '#fff', marginTop: '2px' }}>{selectedSource.filename}</div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Page Reference:</span>
                    <div style={{ fontWeight: 500, color: '#fff' }}>Page {selectedSource.page || 1}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Rank Match Score:</span>
                    <div style={{ fontWeight: 500, color: 'var(--success)' }}>
                      {(selectedSource.similarity * 100).toFixed(1)}% match
                    </div>
                  </div>
                </div>

                {selectedSource.section && (
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Section:</span>
                    <div style={{ fontWeight: 500, color: '#fff' }}>{selectedSource.section}</div>
                  </div>
                )}

                {selectedSource.heading && (
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Heading:</span>
                    <div style={{ fontWeight: 500, color: '#fff' }}>{selectedSource.heading}</div>
                  </div>
                )}
              </div>

              <button className="btn btn-secondary" onClick={() => setSelectedSource(null)} style={{ width: '100%', marginTop: '24px' }}>
                Close Inspector
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
