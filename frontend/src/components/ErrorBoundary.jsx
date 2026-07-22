import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '100vh', background: '#05070f',
          color: '#fff', gap: '16px', padding: '32px', textAlign: 'center'
        }}>
          <h2 style={{ color: '#ef4444' }}>Something went wrong</h2>
          <pre style={{
            background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px',
            fontSize: '0.8rem', color: '#f87171', maxWidth: '600px',
            textAlign: 'left', whiteSpace: 'pre-wrap', wordBreak: 'break-all'
          }}>
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/chat'; }}
            style={{
              padding: '10px 24px', background: '#2563eb', color: '#fff',
              border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600
            }}
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
