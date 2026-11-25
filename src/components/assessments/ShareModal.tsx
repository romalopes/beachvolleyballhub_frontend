import { useState } from "react";
import { api } from "../../api";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: number;
  sessionName: string;
  currentShareUrl?: string | null;
  onShareLinkGenerated?: (url: string) => void;
}

export function ShareModal(props: ShareModalProps) {
  const [shareUrl, setShareUrl] = useState(props.currentShareUrl || "");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const response = await api.regenerateAssessmentSessionShareLink(props.sessionId);
      const newUrl = response.share_url;
      setShareUrl(newUrl);
      props.onShareLinkGenerated?.(newUrl);
      setCopied(false);
    } catch (err: any) {
      setError(err.message || "Failed to generate share link");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      const textarea = document.createElement("textarea");
      textarea.value = shareUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleWhatsAppShare = () => {
    if (!shareUrl) return;
    const message = encodeURIComponent(`Check out this assessment session: ${props.sessionName}`);
    const whatsappUrl = `https://wa.me/?text=${message}%20${encodeURIComponent(shareUrl)}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  if (!props.isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="share-modal-title">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={props.onClose} aria-hidden="true" />
        <div className="relative w-full max-w-md bg-white rounded-lg shadow-xl">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 id="share-modal-title" className="text-lg font-semibold text-gray-900">
              Share "{props.sessionName}"
            </h2>
            <button type="button" onClick={props.onClose} className="text-gray-400 hover:text-gray-500" aria-label="Close">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-4 space-y-4">
            {shareUrl ? renderShareContent() : renderGenerateForm()}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}
            <div className="pt-4 border-t">
              <p className="text-xs text-gray-500 text-center">
                This session is <strong>unlisted</strong>. Anyone with the link can view it
                without logging in. The link can be regenerated at any time, which will
                invalidate the previous link.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  function renderGenerateForm() {
    return (
      <div className="text-center py-8">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6.632l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        <p className="mt-4 text-lg font-medium text-gray-900">No share link yet</p>
        <p className="mt-2 text-gray-500">
          Generate a share link to allow anyone with the link to view this unlisted session.
        </p>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating}
          className="mt-6 mx-auto px-6 py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {isGenerating ? "Generating..." : "Generate Share Link"}
        </button>
      </div>
    );
  }

  function renderShareContent() {
    return (
      <>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Share Link</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={shareUrl}
              readOnly
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm font-mono"
            />
            <button
              type="button"
              onClick={handleCopy}
              className={"px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors " + (copied ? "bg-green-600" : "")}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={handleWhatsAppShare}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20.52 3.48A11.93 11.93 0 0 1 12 22.5c-3.2 0-6.15-1.05-8.47-2.85-.36-.28-.69-.35-1.05-.19-1.13.5-3.22 1.78-4.12 3.65-.56.56-1.03 1.29-1.14 1.99-.07.53.12 1.28.55 1.84.24.32.57.64.95.95.57.43 1.32.76 1.84.55.7.07 1.43-.4 1.99-1.14 1.87-1.87 3.15-4.15 3.65-4.12-.16-.36-.09-.69.19-1.05 1.8-2.32 4.85-5.27 8.47-8.47a12.04 12.04 0 0 1 1.5-6.53 12.04 12.04 0 0 1 6.53-1.5z" />
          </svg>
          Share via WhatsApp
        </button>
      </>
    );
  }
}