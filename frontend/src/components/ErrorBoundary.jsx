import React from 'react';
import { Button, Result } from 'antd';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Result
          status="error"
          title="Something went wrong"
          subTitle={this.state.error?.message || 'An unexpected error occurred'}
          extra={
            <Button type="primary" onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}>
              Reload Page
            </Button>
          }
        />
      );
    }
    return this.props.children;
  }
}
