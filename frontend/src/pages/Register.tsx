import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Dumbbell } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Register() {
  const { register } = useAuth()
  const [searchParams] = useSearchParams()
  const inviteToken = searchParams.get('invite') ?? undefined
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    try {
      const result = await register(email, password, displayName || undefined, inviteToken)
      setSuccess(result.message)
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
            <Dumbbell size={28} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-text">PowerTrack</h1>
          <p className="text-text-muted text-sm">Create your account</p>
        </div>

        {success ? (
          <div className="bg-surface border border-surface-light rounded-xl p-6 space-y-4">
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-green-400 text-sm">
              {success}
            </div>
            <Link
              to="/login"
              className="block w-full text-center bg-primary hover:bg-primary-dark text-white font-medium py-2.5 rounded-lg transition-colors"
            >
              Go to Login
            </Link>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="bg-surface border border-surface-light rounded-xl p-6 space-y-4">
          {error && (
            <div className="bg-danger/10 border border-danger/30 rounded-lg p-3 text-danger text-sm">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text">Display Name <span className="text-text-muted">(optional)</span></label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2.5 text-text placeholder-text-muted focus:outline-none focus:border-primary transition-colors"
              placeholder="e.g. John"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text">Email</label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2.5 text-text placeholder-text-muted focus:outline-none focus:border-primary transition-colors"
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2.5 text-text placeholder-text-muted focus:outline-none focus:border-primary transition-colors"
              placeholder="Min. 8 characters"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary-dark text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60"
          >
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>
        )}

        <p className="text-center text-sm text-text-muted">
          Already have an account?{' '}
          <Link to="/login" className="text-primary hover:text-primary-dark font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
