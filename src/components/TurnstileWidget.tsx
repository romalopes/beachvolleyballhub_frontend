import { useEffect, useRef } from "react";
import {
  TURNSTILE_ACTION,
  loadTurnstileScript,
  turnstileSiteKey,
} from "../services/turnstile";

/**
 * Cloudflare Turnstile widget for the public Contact form (IDENTITY-259).
 *
 * The component only renders the widget and reports the token it produces. It
 * never treats a client-side success as verification: the API validates the
 * token server-side (see TurnstileVerifier).
 *
 * Rendered with `render=explicit` and `action: "contact"`, so the API can reject
 * a token minted for a different form. The script is loaded once per page.
 *
 * Tests mock this module rather than loading Cloudflare's script.
 */
interface TurnstileWidgetProps {
  onToken: (token: string | null) => void;
  /**
   * Increment to reset the widget after a failed or successful submit: a
   * Turnstile token is single-use.
   */
  resetKey?: number;
}

export default function TurnstileWidget({
  onToken,
  resetKey = 0,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  // Kept in a ref so a parent re-render never re-creates the widget.
  const onTokenRef = useRef(onToken);

  // Synced after render (never during it): writing a ref while rendering is not
  // safe under concurrent rendering.
  useEffect(() => {
    onTokenRef.current = onToken;
  });

  useEffect(() => {
    const siteKey = turnstileSiteKey();
    if (!siteKey) return;

    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;

        widgetIdRef.current =
          window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            action: TURNSTILE_ACTION,
            theme: "auto",
            callback: (token: string) => onTokenRef.current(token),
            "error-callback": () => onTokenRef.current(null),
            "expired-callback": () => onTokenRef.current(null),
            "timeout-callback": () => onTokenRef.current(null),
          }) ?? null;
      })
      .catch(() => {
        // A blocked script reports "no token": the API fails closed, so the
        // visitor sees an actionable error instead of a silent no-op.
        if (!cancelled) onTokenRef.current(null);
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, []);

  // A Turnstile token is single-use, so a new submission needs a new token.
  useEffect(() => {
    if (resetKey === 0) return;
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
    onTokenRef.current(null);
  }, [resetKey]);

  return <div ref={containerRef} className="contact-turnstile" />;
}
