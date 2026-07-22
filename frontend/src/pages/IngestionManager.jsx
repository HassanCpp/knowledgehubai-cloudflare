import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Upload, File, CheckCircle2, AlertCircle, Trash2, RefreshCw, Layers } from 'lucide-react';
import { API_URL } from '../config/api';

export default function IngestionManager() {
  const { apiFetch, token } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isScanned, setIsScanned] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchDocuments = async () => {
    try {
      const data = await apiFetch('/documents');
      setDocuments(data);
    } catch (err) {
      console.error('Failed to fetch documents:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch documents list on mount
  useEffect(() => {
    fetchDocuments();
  }, []);

  // Poll documents list status while any document is in 'Processing' state
  useEffect(() => {
    const hasProcessing = documents.some((d) => d.status === 'Processing');
    if (!hasProcessing) return;

    const timer = setInterval(() => {
      fetchDocuments();
    }, 4000);

    return () => clearInterval(timer);
  }, [documents]);

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    setError('');
    setSuccess('');

    const results = [];
    const errors = [];

    const uploadPromises = files.map(async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('isScanned', isScanned);

      try {
        const response = await fetch(`${API_URL}/documents/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        });

        const data = await response.json();
        if (!response.ok) {
          if (response.status === 409) {
            throw new Error(`"${file.name}": Already indexed (SHA-256 duplicate).`);
          }
          throw new Error(`"${file.name}": ${data.message || 'Ingestion failed'}`);
        }
        results.push(file.name);
      } catch (err) {
        errors.push(err.message || `"${file.name}": Upload failed`);
      }
    });

    try {
      await Promise.all(uploadPromises);

      if (results.length > 0 && errors.length === 0) {
        setSuccess(`Successfully uploaded and queued ${results.length} document(s).`);
      } else if (results.length > 0 && errors.length > 0) {
        setSuccess(`Uploaded ${results.length} document(s) successfully.`);
        setError(`Errors (${errors.length}): ${errors.join(' | ')}`);
      } else if (errors.length > 0) {
        setError(`Failed to upload files: ${errors.join(' | ')}`);
      }

      fetchDocuments();
    } catch (err) {
      setError(err.message || 'Upload process encountered an error');
    } finally {
      setUploading(false);
      // Reset input file target value
      e.target.value = null;
    }
  };

  const handleDelete = async (docId) => {
    if (!window.confirm('Are you sure you want to delete this document and wipe all its vector chunk mappings?')) return;
    
    try {
      await apiFetch(`/documents/${docId}`, { method: 'DELETE' });
      setSuccess('Document and vector embeddings deleted successfully.');
      fetchDocuments();
    } catch (err) {
      setError(err.message || 'Deletion failed');
    }
  };

  const handleReindex = async (docId) => {
    try {
      const data = await apiFetch(`/documents/${docId}/reindex`, { method: 'POST' });
      setSuccess(data.message || 'Re-index triggered');
      fetchDocuments();
    } catch (err) {
      setError(err.message || 'Re-index request failed');
    }
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '32px', width: '100%' }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '2rem' }} className="gradient-text">Knowledge Base Ingestion</h2>
        <p style={{ color: 'var(--text-muted)' }}>Index documents, manage vector stores, and inspect parser metadata</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* File Upload Area */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '40px', borderStyle: 'dashed', borderWidth: '2px' }}>
        <div style={{ padding: '20px', borderRadius: '50%', background: 'rgba(139, 92, 246, 0.05)', color: 'var(--primary)' }}>
          <Upload size={32} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <h3>Drag & Drop or Choose Document</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
            Supported formats: PDF, PPTX, DOCX, TXT, MD, CSV, XLSX, PNG, JPG (Max 20MB)
          </p>
        </div>

        {/* OCR toggle checkbox */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
          <input
            type="checkbox"
            checked={isScanned}
            onChange={(e) => setIsScanned(e.target.checked)}
            style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
          />
          Force Scanned PDF (Uses GPT-4o Vision OCR)
        </label>

        <label className="btn btn-primary" style={{ position: 'relative', overflow: 'hidden', cursor: 'pointer' }}>
          {uploading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="glow-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
              Uploading...
            </div>
          ) : 'Select File(s)'}
          <input
            type="file"
            multiple
            onChange={handleFileUpload}
            disabled={uploading}
            style={{ position: 'absolute', top: 0, left: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
          />
        </label>
      </div>

      {/* Documents Index Table */}
      <div className="glass-card">
        <h4 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={18} color="var(--primary)" /> Document Ingestion Index
        </h4>

        {loading ? (
          <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'center', padding: '40px' }}>
            <div className="glow-spinner" />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px 8px' }}>Filename</th>
                  <th style={{ padding: '12px 8px' }}>Size</th>
                  <th style={{ padding: '12px 8px' }}>Classification</th>
                  <th style={{ padding: '12px 8px' }}>Pages</th>
                  <th style={{ padding: '12px 8px' }}>Status</th>
                  <th style={{ padding: '12px 8px' }}>Processor</th>
                  <th style={{ padding: '12px 8px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-dark)' }}>
                      No knowledge documents indexed yet
                    </td>
                  </tr>
                ) : (
                  documents.map((doc) => {
                    const docId = doc.id || doc._id;
                    const bytes = doc.size_bytes ?? doc.size ?? 0;
                    const isReady = doc.status === 'ready' || doc.status === 'Indexed';
                    const isProcessing = doc.status === 'processing' || doc.status === 'Processing';
                    const isFailed = doc.status === 'failed' || doc.status === 'Failed';
                    const statusText = isReady ? 'Indexed' : isProcessing ? 'Processing' : 'Failed';

                    return (
                      <tr key={docId} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                        <td style={{ padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: '2px', fontWeight: 500 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <File size={16} color="var(--text-muted)" />
                            {doc.filename}
                          </div>
                          {isFailed && doc.error_message && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--error)', paddingLeft: '24px' }}>
                              {doc.error_message}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>{formatSize(bytes)}</td>
                        <td style={{ padding: '12px 8px' }}>
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(99, 102, 241, 0.1)',
                            color: '#a5b4fc',
                            fontSize: '0.75rem'
                          }}>
                            {doc.classification || 'Generic'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 8px' }}>{doc.chunk_count ?? doc.pageCount ?? 1}</td>
                        <td style={{ padding: '12px 8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {isReady && <CheckCircle2 size={16} color="var(--success)" />}
                            {isProcessing && <div className="glow-spinner" style={{ width: '14px', height: '14px', borderWidth: '2px', borderTopColor: 'var(--secondary)' }} />}
                            {isFailed && <AlertCircle size={16} color="var(--error)" />}
                            <span style={{
                              color: isReady ? 'var(--success)' : isProcessing ? 'var(--secondary)' : 'var(--error)',
                              fontWeight: 600,
                              fontSize: '0.85rem'
                            }}>
                              {statusText}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 8px', color: 'var(--text-dark)', fontSize: '0.8rem' }}>
                          {doc.mime_type ? doc.mime_type.split('/')[1]?.toUpperCase() : (doc.processor || 'TXT')}
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '8px' }}>
                            <button
                              onClick={() => handleDelete(docId)}
                              className="btn btn-secondary"
                              style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--error)')}
                              onMouseLeave={(e) => (e.currentTarget.style.color = '')}
                              title="Delete document and vector mappings"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
