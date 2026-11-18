import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Mail, ShieldCheck } from "lucide-react";
import {
  api,
  ApiValidationError,
  type ContactMessageType,
  type ContactTypeOption,
} from "../api";
import { CONTACT_TYPE_OPTIONS } from "../constants/contactTypes";
import TurnstileWidget from "../components/TurnstileWidget";
import { turnstileEnabled } from "../services/turnstile";
import { useAuth } from "../auth/AuthContext";

/**
 * Public Contact page (IDENTITY-259), reachable at `/contact` without signing in.
 *
 * This is a public communication channel, not a support ticket: it asks only for
 * what is needed to reply. Client-side validation exists for usability and is
 * never authoritative — the API validates the same fields, verifies the Turnstile
 * token server-side and decides what is persisted.
 *
 * Privacy choices reflected here:
 *   * the visitor is told exactly what the information is used for;
 *   * the visitor is discouraged from entering passwords, payment details,
 *     medical information, private details about minors, or player/coach data;
 *   * the form never asks for an account, a profile or an organisation, and the
 *     API never links a message to one.
 */

type ContactField = "name" | "email" | "contact_type" | "subject" | "message";
type FieldErrors = Partial<Record<ContactField, string>>;

const MAX_NAME = 120;
const MAX_EMAIL = 254;
const MAX_SUBJECT = 180;
const MAX_MESSAGE = 10_000;

// Deliberately simple and permissive: the server applies the authoritative
// format check (and rejects header-injection material).
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(values: {
  name: string;
  email: string;
  contactType: string;
  subject: string;
  message: string;
}): FieldErrors {
  const errors: FieldErrors = {};

  if (!values.name.trim()) errors.name = "Please tell us your name.";
  if (!values.email.trim()) {
    errors.email = "Please enter an email address so we can reply.";
  } else if (!EMAIL_PATTERN.test(values.email.trim())) {
    errors.email = "Please enter a valid email address.";
  }
  if (!values.contactType) {
    errors.contact_type = "Please choose what your enquiry is about.";
  }
  if (!values.subject.trim()) errors.subject = "Please add a short subject.";
  if (!values.message.trim()) errors.message = "Please write your message.";

  return errors;
}

/**
 * Maps the API's `{ errors: [...] }` contract onto fields. Rails messages are
 * prefixed with the attribute name ("Name can't be blank"), so the prefix is the
 * routing key; anything unmatched is shown as a general error.
 */
function mapServerErrors(errors: string[]): {
  fieldErrors: FieldErrors;
  general: string | null;
} {
  const fieldErrors: FieldErrors = {};
  const unmatched: string[] = [];

  for (const error of errors) {
    const lower = error.toLowerCase();
    if (lower.startsWith("name ")) fieldErrors.name = error;
    else if (lower.startsWith("email ")) fieldErrors.email = error;
    else if (lower.startsWith("contact type ")) fieldErrors.contact_type = error;
    else if (lower.startsWith("subject ")) fieldErrors.subject = error;
    else if (lower.startsWith("message ")) fieldErrors.message = error;
    else unmatched.push(error);
  }

  return {
    fieldErrors,
    general: unmatched.length > 0 ? unmatched.join(" ") : null,
  };
}

export default function Contact() {
  const { user, loading: authLoading } = useAuth();
  /**
   * A signed-in visitor does not need to retype an address we already hold: the
   * account's e-mail is shown as read-only and used for the submission. Signed
   * out, the field is editable as before. The API validates whatever arrives —
   * this is a convenience, not a trust boundary.
   */
  const accountEmail = user?.email_address?.trim() ?? "";
  const isSignedIn = accountEmail.length > 0;

  const [options, setOptions] = useState<ContactTypeOption[]>(CONTACT_TYPE_OPTIONS);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [contactType, setContactType] = useState<ContactMessageType | "">("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  // Honeypot: real people never see or fill this. A bot that does is quietly
  // discarded by the API.
  const [website, setWebsite] = useState("");

  const [token, setToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  /** The address the message is sent from: the account's, or the typed one. */
  const contactEmail = isSignedIn ? accountEmail : email;

  // The server owns the allowlist; the bundled list keeps the form usable if
  // this request cannot complete.
  useEffect(() => {
    let cancelled = false;

    api
      .contactMessageOptions()
      .then((response) => {
        if (!cancelled && response.contact_types?.length) {
          setOptions(response.contact_types);
        }
      })
      .catch(() => {
        // Keep the bundled options — the API still validates the submission.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const resetForm = () => {
    setName("");
    setEmail("");
    setContactType("");
    setSubject("");
    setMessage("");
    setWebsite("");
    setToken(null);
    setFieldErrors({});
    setResetKey((key) => key + 1);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Guards against a double click or an impatient retry while in flight.
    if (submitting) return;
    // Until the session is known we cannot tell whether the e-mail is editable,
    // so a submission now could validate the wrong field.
    if (authLoading) return;

    setError(null);
    const clientErrors = validate({
      name,
      email: contactEmail,
      contactType,
      subject,
      message,
    });
    setFieldErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) return;

    if (turnstileEnabled() && !token) {
      setError("Please complete the verification check before sending.");
      return;
    }

    setSubmitting(true);
    try {
      await api.submitContactMessage({
        name: name.trim(),
        // A signed-in visitor is contacted at the address on their account.
        email: contactEmail.trim(),
        contact_type: contactType as ContactMessageType,
        subject: subject.trim(),
        message: message.trim(),
        ...(token ? { turnstile_token: token } : {}),
        ...(website ? { website } : {}),
      });

      // Success is shown only after the API confirms the message was stored.
      setSent(true);
      resetForm();
    } catch (caught) {
      if (caught instanceof ApiValidationError) {
        const mapped = mapServerErrors(caught.errors);
        setFieldErrors(mapped.fieldErrors);
        setError(mapped.general);
      } else if (
        caught instanceof Error &&
        (caught as Error & { status?: number }).status === 429
      ) {
        setError(
          "You have sent several messages recently. Please wait a few minutes and try again.",
        );
      } else {
        setError(
          caught instanceof Error
            ? caught.message
            : "We could not send your message. Please try again.",
        );
      }
      // A Turnstile token is single-use: a rejected submission needs a fresh one.
      if (turnstileEnabled()) setResetKey((key) => key + 1);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page auth-page">
      <div className="auth-card contact-card">
        <div className="auth-logo">
          <span className="sidebar-logo-icon">
            <img src="/ball.png" width="28" height="28" alt="" />
          </span>
          BVB Hub
        </div>
        <h2>Contact us</h2>
        <p className="auth-subtitle">
          Ask a question, report a problem or send feedback about
          BeachVolleyballHub. You do not need an account, and we reply by email.
        </p>

        {sent ? (
          <div className="contact-success" role="status">
            <ShieldCheck aria-hidden="true" size={22} />
            <div>
              <p>
                <strong>Thank you — your message has been received.</strong>
              </p>
              <p>
                Our team replies to the email address you provided. If you need to
                add anything, send a new message.
              </p>
              <button
                type="button"
                className="auth-submit"
                onClick={() => {
                  setSent(false);
                  setError(null);
                }}
              >
                Send another message
              </button>
            </div>
          </div>
        ) : (
          <>
            {error && (
              <div className="auth-flash auth-flash-error" role="alert">
                {error}
              </div>
            )}

            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              <div className="auth-field">
                <label htmlFor="contact-name">Name</label>
                <input
                  id="contact-name"
                  type="text"
                  autoComplete="name"
                  maxLength={MAX_NAME}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  aria-invalid={fieldErrors.name ? true : undefined}
                  aria-describedby={fieldErrors.name ? "contact-name-error" : undefined}
                />
                {fieldErrors.name && (
                  <span className="field-error" id="contact-name-error">
                    {fieldErrors.name}
                  </span>
                )}
              </div>

              <div className="auth-field">
                {authLoading ? (
                  <>
                    <span className="contact-field-label">Email</span>
                    <p className="contact-readonly-email" aria-busy="true">
                      Checking your account…
                    </p>
                  </>
                ) : isSignedIn ? (
                  <>
                    <span className="contact-field-label">Email</span>
                    <p className="contact-readonly-email">{accountEmail}</p>
                    <span className="contact-field-hint">
                      We reply to the email address on your account.
                    </span>
                  </>
                ) : (
                  <>
                    <label htmlFor="contact-email">Email</label>
                    <input
                      id="contact-email"
                      type="email"
                      autoComplete="email"
                      maxLength={MAX_EMAIL}
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      aria-invalid={fieldErrors.email ? true : undefined}
                      aria-describedby={
                        fieldErrors.email ? "contact-email-error" : undefined
                      }
                    />
                    {fieldErrors.email && (
                      <span className="field-error" id="contact-email-error">
                        {fieldErrors.email}
                      </span>
                    )}
                  </>
                )}
              </div>

              <div className="auth-field">
                <label htmlFor="contact-type">What is your enquiry about?</label>
                <select
                  id="contact-type"
                  value={contactType}
                  onChange={(event) =>
                    setContactType(event.target.value as ContactMessageType | "")
                  }
                  aria-invalid={fieldErrors.contact_type ? true : undefined}
                  aria-describedby={
                    fieldErrors.contact_type ? "contact-type-error" : undefined
                  }
                >
                  <option value="">Choose a category…</option>
                  {options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {fieldErrors.contact_type && (
                  <span className="field-error" id="contact-type-error">
                    {fieldErrors.contact_type}
                  </span>
                )}
              </div>

              <div className="auth-field">
                <label htmlFor="contact-subject">Subject</label>
                <input
                  id="contact-subject"
                  type="text"
                  maxLength={MAX_SUBJECT}
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  aria-invalid={fieldErrors.subject ? true : undefined}
                  aria-describedby={
                    fieldErrors.subject ? "contact-subject-error" : undefined
                  }
                />
                {fieldErrors.subject && (
                  <span className="field-error" id="contact-subject-error">
                    {fieldErrors.subject}
                  </span>
                )}
              </div>

              <div className="auth-field">
                <label htmlFor="contact-message">Message</label>
                <textarea
                  id="contact-message"
                  rows={7}
                  maxLength={MAX_MESSAGE}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  aria-invalid={fieldErrors.message ? true : undefined}
                  aria-describedby={
                    fieldErrors.message ? "contact-message-error" : undefined
                  }
                />
                {fieldErrors.message && (
                  <span className="field-error" id="contact-message-error">
                    {fieldErrors.message}
                  </span>
                )}
              </div>

              {/* Honeypot. Hidden from sight and from assistive technology, and
                  never focusable, so it cannot trap a keyboard or screen-reader
                  user — but a naive bot filling every input is caught. */}
              <div className="contact-honeypot" aria-hidden="true">
                <label htmlFor="contact-website">Website</label>
                <input
                  id="contact-website"
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                />
              </div>

              {turnstileEnabled() && (
                <TurnstileWidget onToken={setToken} resetKey={resetKey} />
              )}

              <button
                type="submit"
                className="auth-submit"
                disabled={submitting || authLoading}
              >
                {submitting ? "Sending…" : "Send message"}
              </button>
            </form>
          </>
        )}

        <p className="contact-privacy">
          <Mail aria-hidden="true" size={14} /> We use what you send only to answer
          your enquiry. Please do not include passwords, payment details, medical
          information, private information about minors, or player, coach or
          organisation records — sign in and use the relevant page for those.
        </p>

        <div className="auth-links">
          <Link to="/">Back to home</Link>
        </div>
      </div>
    </div>
  );
}
