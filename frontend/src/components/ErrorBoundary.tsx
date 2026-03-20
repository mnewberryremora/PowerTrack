import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-bg p-8">
          <h1 className="text-2xl font-bold text-text mb-4">Something went wrong</h1>
          <p className="text-text-muted mb-4 max-w-md text-center">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: undefined })
              window.location.href = '/'
            }}
            className="bg-primary hover:bg-primary-dark text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
