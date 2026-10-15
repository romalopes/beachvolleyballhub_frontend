export default function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="error-state">
      <p className="error-message">{error}</p>
      <button className="error-retry-button" onClick={onRetry}>
        Try Again
      </button>
    </div>
  );
}