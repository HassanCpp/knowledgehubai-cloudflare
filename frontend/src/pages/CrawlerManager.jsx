import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Globe, Plus, Play, Trash2, Calendar, CheckCircle, AlertTriangle, Layers, Compass, FileText, ChevronRight } from 'lucide-react';

export default function CrawlerManager() {
  const { apiFetch } = useAuth();
  const [sources, setSources] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedLogUrls, setSelectedLogUrls] = useState(null);

  // Form states
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [crawlMode, setCrawlMode] = useState('single'); // 'single', 'domain', 'sitemap'
  const [depth, setDepth] = useState(1);
  const [maxPages, setMaxPages] = useState(25);
  const [scrapeIntervalHours, setScrapeIntervalHours] = useState(24);
  const [selectorText, setSelectorText] = useState('body');

  const fetchData = async () => {
    try {
      const [sourcesData, historyData] = await Promise.all([
        apiFetch('/crawl/sources'),
        apiFetch('/crawl/history'),
      ]);
      setSources(sourcesData || []);
      setHistory(historyData || []);
    } catch (err) {
      console.error('Failed to load crawler details:', err.message);
      setError(err.message || 'Failed to fetch crawler data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddSource = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!name || !url) {
      setError('Seed Name and Target URL are required');
      return;
    }

    try {
      await apiFetch('/crawl/sources', {
        method: 'POST',
        body: JSON.stringify({
          name,
          url,
          crawlMode,
          depth,
          maxPages,
          scrapeIntervalHours,
          selectorText,
        }),
      });

      setSuccess(`Web crawl seed "${name}" added successfully.`);
      setName('');
      setUrl('');
      setCrawlMode('single');
      setDepth(1);
      setMaxPages(25);
      setScrapeIntervalHours(24);
      setSelectorText('body');
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to add web crawl seed');
    }
  };

  const handleTriggerCrawl = async (sourceId, sourceName) => {
    setError('');
    setSuccess('');
    try {
      const data = await apiFetch(`/crawl/sources/${sourceId}/crawl`, { method: 'POST' });
      setSuccess(data.message || `Crawl job triggered for "${sourceName}".`);
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to trigger crawl');
    }
  };

  const handleDeleteSource = async (sourceId) => {
    if (!window.confirm('Delete this web source and all associated crawl logs?')) return;

    setError('');
    setSuccess('');
    try {
      await apiFetch(`/crawl/sources/${sourceId}`, { method: 'DELETE' });
      setSuccess('Web source deleted successfully.');
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to delete source');
    }
  };

  const totalPagesIndexed = history.reduce((sum, h) => sum + (h.pagesIndexedCount || 0), 0);

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '32px', width: '100%', maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* Top Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: 700 }} className="gradient-text">Enterprise Web Ingestion & Crawler</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '4px' }}>
            Multi-depth domain web crawler, sitemap discovery engine, and HTML-to-Markdown transformer
          </p>
        </div>

        {/* Live Metrics Cards */}
        <div style={{ display: 'flex', gap: '16px' }}>
          <div className="glass-card" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(59, 130, 246, 0.05)', borderColor: 'rgba(59, 130, 246, 0.2)' }}>
            <Globe size={24} color="#3b82f6" />
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Active Seeds</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>{sources.length}</div>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(16, 185, 129, 0.05)', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
            <FileText size={24} color="#10b981" />
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Pages Indexed</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>{totalPagesIndexed}</div>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Top Section: Form + Active Seeds (2 Columns) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(380px, 440px) 1fr', gap: '28px', alignItems: 'start' }}>
        
        {/* Add Web Crawl Seed Form */}
        <div className="glass-card">
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', fontSize: '1.1rem' }}>
            <Plus size={20} color="var(--primary)" /> Configure Web Seed
          </h4>

          <form onSubmit={handleAddSource} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Seed Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="Developer Docs Portal"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Seed Target URL</label>
              <input
                type="url"
                className="form-input"
                placeholder="https://docs.company.com/intro"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>

            {/* Crawl Mode Selector */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Crawl Mode</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setCrawlMode('single')}
                  style={{
                    padding: '10px 8px',
                    borderRadius: '8px',
                    border: crawlMode === 'single' ? '2px solid var(--primary)' : '1px solid var(--border-glass)',
                    background: crawlMode === 'single' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.02)',
                    color: crawlMode === 'single' ? '#fff' : 'var(--text-muted)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Globe size={16} /> Single Page
                </button>

                <button
                  type="button"
                  onClick={() => setCrawlMode('domain')}
                  style={{
                    padding: '10px 8px',
                    borderRadius: '8px',
                    border: crawlMode === 'domain' ? '2px solid var(--primary)' : '1px solid var(--border-glass)',
                    background: crawlMode === 'domain' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.02)',
                    color: crawlMode === 'domain' ? '#fff' : 'var(--text-muted)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Compass size={16} /> Domain Crawl
                </button>

                <button
                  type="button"
                  onClick={() => setCrawlMode('sitemap')}
                  style={{
                    padding: '10px 8px',
                    borderRadius: '8px',
                    border: crawlMode === 'sitemap' ? '2px solid var(--primary)' : '1px solid var(--border-glass)',
                    background: crawlMode === 'sitemap' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.02)',
                    color: crawlMode === 'sitemap' ? '#fff' : 'var(--text-muted)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Layers size={16} /> Sitemap.xml
                </button>
              </div>
            </div>

            {/* Dynamic Options for Domain Mode */}
            {crawlMode === 'domain' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Crawl Depth (1-3)</label>
                  <input
                    type="number"
                    min="1"
                    max="3"
                    className="form-input"
                    value={depth}
                    onChange={(e) => setDepth(parseInt(e.target.value) || 1)}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Max Pages Limit</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    className="form-input"
                    value={maxPages}
                    onChange={(e) => setMaxPages(parseInt(e.target.value) || 25)}
                  />
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Recrawl Interval (Hours)</label>
                <input
                  type="number"
                  min="1"
                  className="form-input"
                  value={scrapeIntervalHours}
                  onChange={(e) => setScrapeIntervalHours(parseInt(e.target.value) || 24)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">CSS Content Selector</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="body, main, article"
                  value={selectorText}
                  onChange={(e) => setSelectorText(e.target.value)}
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ marginTop: '8px', padding: '12px' }}>
              Add Crawl Seed
            </button>
          </form>
        </div>

        {/* Active Web Seeds List */}
        <div className="glass-card" style={{ height: '100%', minHeight: '440px', display: 'flex', flexDirection: 'column' }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', fontSize: '1.1rem' }}>
            <Globe size={20} color="var(--secondary)" /> Active Web Seeds ({sources.length})
          </h4>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '30px', margin: 'auto' }}>
              <div className="glow-spinner" />
            </div>
          ) : sources.length === 0 ? (
            <p style={{ color: 'var(--text-dark)', fontSize: '0.9rem', textAlign: 'center', padding: '40px 0', margin: 'auto' }}>
              No active web seeds registered yet.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flex: 1, maxHeight: '380px' }}>
              {sources.map((src) => {
                const srcId = src.id || src._id;
                const mode = src.crawl_mode || src.crawlMode || 'single';
                const interval = src.scrape_interval_hours ?? src.scrapeIntervalHours ?? 24;
                const maxP = src.max_pages ?? src.maxPages ?? 25;
                const lastC = src.last_crawled || src.lastCrawled;

                return (
                  <div
                    key={srcId}
                    style={{
                      padding: '14px 18px',
                      background: 'rgba(255,255,255,0.015)',
                      border: '1px solid var(--border-glass)',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '16px'
                    }}
                  >
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {src.name}
                        <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                          {mode}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', marginTop: '4px' }}>
                        {src.url}
                      </div>
                      <div style={{ display: 'flex', gap: '16px', fontSize: '0.75rem', color: 'var(--text-dark)', marginTop: '6px' }}>
                        <span>Interval: {interval}h</span>
                        {mode === 'domain' && <span>Depth: {src.depth || 1} | Max: {maxP} pages</span>}
                        <span>Last run: {lastC ? new Date(lastC).toLocaleString() : 'Never'}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleTriggerCrawl(srcId, src.name)}
                        className="btn btn-primary"
                        style={{ padding: '6px 12px', fontSize: '0.8rem', height: '34px' }}
                      >
                        <Play size={14} /> Crawl Now
                      </button>
                      <button
                        onClick={() => handleDeleteSource(srcId)}
                        className="btn btn-secondary"
                        style={{ padding: '6px 10px', height: '34px' }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--error)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Bottom Section: Crawl History Logs Table (100% Full Width) */}
      <div className="glass-card" style={{ width: '100%' }}>
        <h4 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', fontSize: '1.15rem' }}>
          <Calendar size={22} color="var(--success)" /> Crawl Log History
        </h4>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <div className="glow-spinner" />
          </div>
        ) : history.length === 0 ? (
          <p style={{ color: 'var(--text-dark)', fontSize: '0.9rem', textAlign: 'center', padding: '32px 0' }}>
            No crawl history records logged yet.
          </p>
        ) : (
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '14px 16px', minWidth: '180px' }}>Source Name</th>
                  <th style={{ padding: '14px 16px', minWidth: '240px' }}>Target URL</th>
                  <th style={{ padding: '14px 16px', minWidth: '120px' }}>Status</th>
                  <th style={{ padding: '14px 16px', minWidth: '160px' }}>Visited / Indexed</th>
                  <th style={{ padding: '14px 16px', minWidth: '150px' }}>Discovered URLs</th>
                  <th style={{ padding: '14px 16px', minWidth: '180px' }}>Run Time</th>
                </tr>
              </thead>
              <tbody>
                {history.map((log) => {
                  const logId = log.id || log._id;
                  const sourceName = log.sourceId && typeof log.sourceId === 'object' && log.sourceId.name 
                    ? log.sourceId.name 
                    : (log.url ? new URL(log.url).hostname : 'Web Source');
                  const visited = log.pages_visited ?? log.pagesVisitedCount ?? 1;
                  const indexed = log.pages_indexed ?? log.pagesIndexedCount ?? 1;
                  const urls = (() => {
                    if (Array.isArray(log.discoveredUrls)) return log.discoveredUrls;
                    if (typeof log.discovered_urls === 'string') {
                      try { return JSON.parse(log.discovered_urls); } catch { return []; }
                    }
                    return [];
                  })();

                  return (
                    <tr key={logId} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '14px 16px', fontWeight: 600, color: '#fff' }}>
                        {sourceName}
                      </td>
                      <td style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '0.82rem', wordBreak: 'break-all' }}>
                        {log.url}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontWeight: 600,
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '0.8rem',
                          background: log.status === 'Success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          color: log.status === 'Success' ? 'var(--success)' : 'var(--error)',
                          border: `1px solid ${log.status === 'Success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
                        }}>
                          {log.status === 'Success' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                          {log.status}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', color: 'var(--text-muted)' }}>
                        <span style={{ color: '#fff', fontWeight: 600 }}>{visited}</span> visited / <span style={{ color: 'var(--secondary)', fontWeight: 600 }}>{indexed}</span> indexed
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        {urls.length > 0 ? (
                          <button
                            onClick={() => setSelectedLogUrls(urls)}
                            style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)', color: '#60a5fa', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}
                          >
                            View {urls.length} URLs <ChevronRight size={14} />
                          </button>
                        ) : (
                          <span style={{ color: 'var(--text-dark)', fontSize: '0.82rem' }}>1 Seed URL</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                        {new Date(log.crawledAt).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Discovered URLs Modal */}
      {selectedLogUrls && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '20px' }}>
          <div className="glass-card" style={{ maxWidth: '650px', width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ fontSize: '1.1rem' }}>Discovered Page URLs ({selectedLogUrls.length})</h4>
            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem' }}>
              {selectedLogUrls.map((u, i) => (
                <div key={i} style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', color: '#60a5fa', wordBreak: 'break-all', border: '1px solid var(--border-glass)' }}>
                  {u}
                </div>
              ))}
            </div>
            <button onClick={() => setSelectedLogUrls(null)} className="btn btn-secondary" style={{ alignSelf: 'flex-end', padding: '8px 16px' }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
