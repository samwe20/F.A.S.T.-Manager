import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('FAST UI error:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            background: '#0b0f14',
            color: '#e8edf4',
            fontFamily: 'Segoe UI, system-ui, sans-serif',
          }}
        >
          <div style={{ maxWidth: 480 }}>
            <h1 style={{ fontSize: 20, marginBottom: 12, color: '#14b8a6' }}>F.A.S.T Manager — chyba</h1>
            <p style={{ marginBottom: 12, color: '#8b98a8', lineHeight: 1.5 }}>
              Aplikace spadla při startu. Zkuste smazat lokální data v prohlížeči (IndexedDB „fast-manager“) nebo
              restartovat aplikaci.
            </p>
            <pre
              style={{
                background: '#141a22',
                border: '1px solid #2a3444',
                borderRadius: 8,
                padding: 12,
                fontSize: 12,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
              }}
            >
              {this.state.error.message}
            </pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
