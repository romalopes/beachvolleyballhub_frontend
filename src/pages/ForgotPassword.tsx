import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import TurnstileWidget from '../components/TurnstileWidget';
import { turnstileEnabled, TURNSTILE_FORGOT_PASSWORD_ACTION } from '../services/turnstile';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.requestPasswordReset(email, turnstileToken);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed.');
      // Turnstile token is single-use; reset widget for retry.
      setResetKey((k) => k + 1);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page auth-page">
      <div className="auth-card">
        <h2>Forgot your password?</h2>
        <p className="auth-subtitle">
          Enter your email address and we'll send you reset instructions.
        </p>

        {sent ? (
          <>
            <div className="auth-flash auth-flash-notice">
              Password reset instructions sent (if a user with that email address exists).
            </div>
            <div className="auth-links">
              <Link to="/login">Back to sign in</Link>
            </div>
          </>
        ) : (
          <>
            {error && <div className="auth-flash auth-flash-error">{error}</div>}
            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="auth-field">
                <label htmlFor="forgot-email">Email</label>
                <input
                  id="forgot-email"
                  type="email"
                  required
                  autoFocus
                  autoComplete="username"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {turnstileEnabled() && (
                <TurnstileWidget
                  onToken={setTurnstileToken}
                  action={TURNSTILE_FORGOT_PASSWORD_ACTION}
                  resetKey={resetKey}
                />
              )}
              <button type="submit" className="auth-submit" disabled={submitting}>
                {submitting ? 'Sending...' : 'Email reset instructions'}
              </button>
            </form>
            <div className="auth-links">
              <Link to="/login">Back to sign in</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
