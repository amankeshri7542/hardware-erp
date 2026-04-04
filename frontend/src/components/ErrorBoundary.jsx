import React from 'react';
import { Button, Result, Typography } from 'antd';

const { Text, Paragraph } = Typography;

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      const errMsg = this.state.error?.message || 'Unknown error';
      const errStack = this.state.error?.stack || '';
      return (
        <Result
          status="error"
          title="Something went wrong"
          subTitle={errMsg}
          extra={[
            <Button
              type="primary"
              key="reload"
              onClick={() => window.location.reload()}
            >
              Reload Page
            </Button>,
            <Button
              key="reset"
              onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
            >
              Try Again
            </Button>,
            <div key="details" style={{ marginTop: 16, textAlign: 'left', maxWidth: 600, margin: '16px auto' }}>
              <Paragraph copyable={{ text: `${errMsg}\n${errStack}` }}>
                <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {errStack.split('\n').slice(0, 5).join('\n')}
                </Text>
              </Paragraph>
            </div>,
          ]}
        />
      );
    }
    return this.props.children;
  }
}
