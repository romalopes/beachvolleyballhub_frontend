/**
 * Cloudflare Turnstile browser integration for the public Contact form
 * (IDENTITY-259) and authentication forms (signup, login, forgot password).
 *
 * Only the PUBLIC site key reaches the browser (`VITE_TURNSTILE_SITE_KEY`). The
 * secret key lives exclusively on the API, which performs Siteverify — nothing
 * here decides whether a submission is legitimate. The widget only obtains a
 * token; the API validates it.
 *
 * Kept out of the component file so React Fast Refresh keeps working and the
 * loader can be reused/tested on its own.
 */
export const TURNSTILE_SCRIPT_ID = "cf-turnstile-script";
export const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/**
 * The widget is rendered with this action and the API verifies it, so a token
 * minted for a different form cannot be replayed against the contact endpoint.
 */
export const TURNSTILE_ACTION = "contact";

/** Action for the signup form. */
export const TURNSTILE_SIGNUP_ACTION = "signup";

/** Action for the login form. */
export const TURNSTILE_LOGIN_ACTION = "login";

/** Action for the forgot password form. */
export const TURNSTILE_FORGOT_PASSWORD_ACTION = "forgot_password";

export interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: Record<string, unknown>,
  ) => string | undefined;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function turnstileSiteKey(): string {
  return (import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "").trim();
}

/** Whether this build expects a Turnstile token. */
export function turnstileEnabled(): boolean {
  return turnstileSiteKey().length > 0;
}

let scriptPromise: Promise<void> | null = null;

/** Loads the Turnstile script once; repeated calls share the same promise. */
export function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      // Allow a later attempt (e.g. after a network blip) instead of caching the
      // failure for the life of the page.
      scriptPromise = null;
      reject(new Error("Could not load Turnstile."));
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
}
