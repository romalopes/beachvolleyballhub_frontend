import { Loader2 } from 'lucide-react';

export default function LoadingState() {
  return (
    <div className="loading-state">
      <Loader2 className="loader" />
      <p>Loading...</p>
    </div>
  );
}