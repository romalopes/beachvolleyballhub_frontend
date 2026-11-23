import { useEffect, useState } from "react";
import { Video, ArrowRight, Loader2, CheckCircle, Check, Sparkles } from "lucide-react";
import { api } from "../api";
import PageHeader from "../components/PageHeader";

interface AnalysisPackage {
  key: string;
  name: string;
  description: string;
  price_cents: number;
  price_aud: string;
  max_videos: number;
  max_duration_minutes: number;
  includes_annotated_video: boolean;
  includes_written_report: boolean;
  includes_consultation: boolean;
  turnaround_days: number;
}

interface VideoInput {
  source_type: "external" | "upload";
  video_id?: number;
  file?: File;
  url?: string;
  title?: string;
}

export default function HireAnalysisPage() {
  const [step, setStep] = useState<"packages" | "form" | "review" | "success">("packages");
  const [selectedPackage, setSelectedPackage] = useState<AnalysisPackage | null>(null);
  const [packages, setPackages] = useState<AnalysisPackage[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    guest_name: "",
    guest_email: "",
    videos: [] as VideoInput[],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [videoUrl, setVideoUrl] = useState("");

  // Mirrors Subscribe.tsx: state is only touched from async callbacks, never
  // synchronously in the effect body.
  useEffect(() => {
    let active = true;
    api
      .getAnalysisPackages()
      .then(({ data }) => {
        if (active) setPackages(data);
      })
      .catch(() => {
        console.error("Failed to load packages");
      })
      .finally(() => {
        if (active) setLoadingPackages(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) newErrors.title = "Title is required";
    if (!formData.description.trim()) newErrors.description = "Description is required";

    const isAuthenticated = Boolean(localStorage.getItem("bvb_api_token"));
    if (!isAuthenticated) {
      if (!formData.guest_name.trim()) newErrors.guest_name = "Your name is required";
      if (!formData.guest_email.trim()) newErrors.guest_email = "Your email is required";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.guest_email.trim())) {
        newErrors.guest_email = "Enter a valid email address";
      }
    }

    if (formData.videos.length === 0) newErrors.videos = "Add at least one video";
    else if (formData.videos.length > (selectedPackage?.max_videos ?? 1)) {
      newErrors.videos = `This package allows ${selectedPackage?.max_videos} video(s)`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSelectPackage = (pkg: AnalysisPackage) => {
    setSelectedPackage(pkg);
    setStep("form");
  };

  // Deliberately not a nested <form>: forms cannot nest, and a nested one makes
  // the browser route "Add URL" clicks to the outer submit handler.
  const addVideoUrl = () => {
    const url = videoUrl.trim();
    if (!url) return;

    try {
      new URL(url);
    } catch {
      alert("Enter a valid video URL (YouTube, Vimeo, …).");
      return;
    }

    const video: VideoInput = { source_type: "external", url };
    setFormData(prev => ({ ...prev, videos: [...prev.videos, video] }));
    setVideoUrl("");
  };

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      alert("File must be a video");
      return;
    }
    const maxSize = 500 * 1024 * 1024;
    if (file.size > maxSize) {
      alert("Video file too large (max 500MB)");
      return;
    }
    const video: VideoInput = { source_type: "upload", file, title: file.name };
    setFormData(prev => ({ ...prev, videos: [...prev.videos, video] }));
    e.target.value = "";
  };

  const removeVideo = (index: number) => {
    setFormData(prev => ({ ...prev, videos: prev.videos.filter((_, i) => i !== index) }));
  };

  // The form validates first and then opens the Review step; nothing is sent to
  // the API until the submitter confirms on that screen.
  const goToReview = () => {
    if (validateForm()) setStep("review");
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setErrors({});

    try {
      const formDataToSend = new FormData();
      formDataToSend.append("analysis_request[title]", formData.title);
      formDataToSend.append("analysis_request[description]", formData.description);
      if (selectedPackage) {
        formDataToSend.append("analysis_request[package_key]", selectedPackage.key);
      }

      const isAuthenticated = localStorage.getItem("bvb_api_token");
      if (!isAuthenticated) {
        formDataToSend.append("analysis_request[guest_name]", formData.guest_name);
        formDataToSend.append("analysis_request[guest_email]", formData.guest_email);
      }

      for (let i = 0; i < formData.videos.length; i++) {
        const video = formData.videos[i];
        formDataToSend.append(`analysis_request[analysis_request_videos_attributes][${i}][source_type]`, video.source_type);
        if (video.source_type === "external" && video.url) {
          // External videos carry the provider URL itself; video_id is an FK to
          // the catalogue and is never sent from this form.
          formDataToSend.append(`analysis_request[analysis_request_videos_attributes][${i}][external_url]`, video.url);
        } else if (video.source_type === "upload" && video.file) {
          formDataToSend.append(`analysis_request[analysis_request_videos_attributes][${i}][file]`, video.file);
        }
      }

      await api.postFormData("/analysis_requests", formDataToSend);
      setStep("success");
      alert("Analysis request submitted successfully!");
    } catch (error: unknown) {
      // Both ApiValidationError (`errors: string[]`) and generic Error shapes
      // arrive here, so narrow rather than trust the throw type.
      const failure = error as { message?: string; errors?: string[] };
      if (Array.isArray(failure.errors)) {
        const newErrors: Record<string, string> = {};
        failure.errors.forEach((msg: string) => {
          if (msg.toLowerCase().includes("guest name")) newErrors.guest_name = msg;
          else if (msg.toLowerCase().includes("guest email")) newErrors.guest_email = msg;
          else if (msg.toLowerCase().includes("title")) newErrors.title = msg;
          else if (msg.toLowerCase().includes("description")) newErrors.description = msg;
          else if (msg.toLowerCase().includes("video")) newErrors.videos = msg;
          else newErrors.form = msg;
        });
        setErrors(newErrors);
        setStep("form");
      }
      alert(failure.message || "Failed to submit request");
    } finally {
      setLoading(false);
    }
  };

  const packageBadge = (pkg: AnalysisPackage) => {
    if (pkg.price_cents === 0) return { label: "Complimentary", className: "plan-badge" };
    if (pkg.key === "single_match") return { label: "Most popular", className: "plan-badge" };
    return null;
  };

  const renderPackageCard = (pkg: AnalysisPackage) => {
    const badge = packageBadge(pkg);
    const features = [
      { label: `${pkg.max_videos} video(s)`, included: true },
      { label: `Up to ${pkg.max_duration_minutes} minutes`, included: true },
      { label: "Written report", included: pkg.includes_written_report },
      { label: "Annotated video", included: pkg.includes_annotated_video },
      { label: "Consultation call", included: pkg.includes_consultation },
      { label: `${pkg.turnaround_days}-day turnaround`, included: true },
    ];

    return (
      <section
        key={pkg.key}
        className={`plan-card ${pkg.key === "single_match" ? "plan-card--popular" : ""}`}
      >
        <header className="plan-card-header">
          <h2>{pkg.name}</h2>
          {badge && <span className={badge.className}>{badge.label}</span>}
        </header>

        <p className="plan-price">{pkg.price_aud}</p>
        {pkg.description && <p className="plan-description">{pkg.description}</p>}

        <ul className="plan-features">
          {features.map((feature) => (
            <li key={feature.label} className={feature.included ? "" : "plan-feature-muted"}>
              {feature.included && <Check size={16} aria-hidden="true" />}
              <span>{feature.label}</span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="auth-submit plan-cta"
          onClick={() => handleSelectPackage(pkg)}
        >
          Select {pkg.name}
        </button>
      </section>
    );
  };

  // Steps 1 and 2 are reachable by clicking; later steps only become reachable
  // once their data exists (a package chosen, then the form completed).
  const canOpenStep = (target: "packages" | "form" | "review" | "success") => {
    if (target === "packages") return true;
    if (target === "form") return selectedPackage !== null;
    // Review only makes sense from a filled form; the success step is terminal
    // and never re-openable.
    if (target === "review") return step === "form";
    return false;
  };

  const goToStep = (target: "packages" | "form" | "review" | "success") => {
    if (!canOpenStep(target)) return;
    setStep(target);
  };

  const renderStepIndicator = () => {
    const steps = [
      { key: "packages" as const, label: "Choose Package" },
      { key: "form" as const, label: "Submit Request" },
      { key: "review" as const, label: "Review" },
      { key: "success" as const, label: "Submitted" },
    ];
    const order = ["packages", "form", "review", "success"];
    const currentIndex = order.indexOf(step);

    return (
      <nav className="step-indicator" aria-label="Submission progress">
        {steps.map((item, index) => {
          const isActive = step === item.key;
          const isCompleted = currentIndex > index;
          const clickable = canOpenStep(item.key) && !isActive;
          return (
            <div key={item.key} className="step-indicator-segment">
              <button
                type="button"
                className={`step ${isActive ? "active" : ""} ${isCompleted ? "completed" : ""}`}
                onClick={() => goToStep(item.key)}
                disabled={!clickable}
                aria-current={isActive ? "step" : undefined}
                aria-label={`Step ${index + 1}: ${item.label}`}
              >
                <span className="step-number">
                  {isCompleted ? <Check size={16} aria-hidden="true" /> : index + 1}
                </span>
                <span className="step-label">{item.label}</span>
              </button>
              {index < steps.length - 1 && (
                <div className={`step-connector ${isCompleted ? "step-connector--done" : ""}`} />
              )}
            </div>
          );
        })}
      </nav>
    );
  };

  if (step === "packages") {
    return (
      <div className="page">
        <PageHeader
          title="Hire Analysis"
          description="Professional video analysis services for beach volleyball athletes and teams."
        />
        {renderStepIndicator()}
        <section className="packages-section" aria-labelledby="packages-heading">
          <h2 id="packages-heading" className="section-title">Choose Your Package</h2>
          {loadingPackages ? (
            <div className="loading-state" role="status">
              <Loader2 size={20} className="spin" aria-hidden="true" />
              <span>Loading packages…</span>
            </div>
          ) : packages.length === 0 ? (
            <p className="hint">No packages are available right now. Please check back soon.</p>
          ) : (
            <div className="packages-grid">
              {packages.map(renderPackageCard)}
            </div>
          )}
        </section>

        <p className="pricing-footnote">
          <Sparkles size={16} aria-hidden="true" />
          <span>
            Every package includes secure video upload, a dedicated coach, and delivery through
            your private request page. Questions? <a href="/contact">Contact us</a>.
          </span>
        </p>
      </div>
    );
  }

  if (step === "form") {
    return (
      <div className="page">
        <PageHeader
          title="Submit Analysis Request"
          description={`Package: ${selectedPackage?.name} — ${selectedPackage?.price_aud}`}
        />
        {renderStepIndicator()}

        <form onSubmit={e => { e.preventDefault(); goToReview(); }} className="submit-form" noValidate>
          <section className="form-section">
            <h3>Request Details</h3>
            <div className="form-group">
              <label htmlFor="title">Title *</label>
              <input
                id="title"
                type="text"
                value={formData.title}
                onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., Jump Serve Analysis"
                required
              />
              {errors.title && <span className="error">{errors.title}</span>}
            </div>
            <div className="form-group">
              <label htmlFor="description">Description / Analysis Goals *</label>
              <textarea
                id="description"
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe what you'd like the coach to focus on..."
                rows={4}
                required
              />
              {errors.description && <span className="error">{errors.description}</span>}
            </div>
          </section>

          {(!localStorage.getItem("bvb_api_token")) && (
            <section className="form-section">
              <h3>Your Information (Guest Submission)</h3>
              <p className="hint">Logged in users will have their name/email pre-filled automatically.</p>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="guest_name">Name *</label>
                  <input
                    id="guest_name"
                    type="text"
                    value={formData.guest_name}
                    onChange={e => setFormData(prev => ({ ...prev, guest_name: e.target.value }))}
                    placeholder="Jane Smith"
                    required
                  />
                  {errors.guest_name && <span className="error">{errors.guest_name}</span>}
                </div>
                <div className="form-group">
                  <label htmlFor="guest_email">Email *</label>
                  <input
                    id="guest_email"
                    type="email"
                    value={formData.guest_email}
                    onChange={e => setFormData(prev => ({ ...prev, guest_email: e.target.value }))}
                    placeholder="jane@example.com"
                    required
                  />
                  {errors.guest_email && <span className="error">{errors.guest_email}</span>}
                </div>
              </div>
            </section>
          )}

          <section className="form-section">
            <h3>Videos *</h3>
            <p className="hint">
              Maximum {selectedPackage?.max_videos} video(s), up to {selectedPackage?.max_duration_minutes} minutes each.
              {selectedPackage?.includes_annotated_video && " Includes annotated video delivery."}
            </p>

            <div className="video-inputs">
              <div className="video-input-method">
                <h4>Video URL (YouTube, Vimeo, etc.)</h4>
                <div className="input-with-button">
                  <input
                    type="url"
                    value={videoUrl}
                    onChange={e => setVideoUrl(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addVideoUrl();
                      }
                    }}
                    placeholder="https://youtube.com/watch?v=… or https://vimeo.com/…"
                    aria-label="Video URL"
                  />
                  <button type="button" className="secondary-button" onClick={addVideoUrl}>
                    Add URL
                  </button>
                </div>
              </div>

              <div className="video-input-method">
                <h4>Upload Video File</h4>
                <label className="file-upload">
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleVideoFileChange}
                    style={{ display: "none" }}
                  />
                  <span className="file-upload-text">
                    <Video size={20} />
                    Click or drag to upload video file (max 500MB)
                  </span>
                </label>
              </div>
            </div>

            {formData.videos.length > 0 && (
              <div className="selected-videos">
                <h4>Selected Videos ({formData.videos.length}/{selectedPackage?.max_videos})</h4>
                <ul>
                  {formData.videos.map((video, index) => (
                    <li key={index} className="video-item">
                      <span>{video.source_type === "external" ? "🔗" : "📁"} {video.url || video.title || video.file?.name || "Video"}</span>
                      <button
                        type="button"
                        onClick={() => removeVideo(index)}
                        className="btn-remove"
                        aria-label="Remove video"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {errors.videos && <span className="error">{errors.videos}</span>}
          </section>

          {errors.form && <div className="error-banner">{errors.form}</div>}

          <div className="form-actions">
            <button type="button" className="secondary-button" onClick={() => setStep("packages")}>
              <ArrowRight size={16} className="reverse" /> Back
            </button>
            <button type="submit" className="auth-submit form-actions-primary" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 size={16} className="spin" />
                  Submitting...
                </>
              ) : (
                <>
                  Submit Request
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (step === "review") {
    return (
      <div className="page">
        <PageHeader title="Review Your Request" />
        {renderStepIndicator()}
        <div className="review-content">
          <h3>Request Summary</h3>
          <dl>
            <dt>Package</dt>
            <dd>{selectedPackage?.name} ({selectedPackage?.price_aud})</dd>
            <dt>Title</dt>
            <dd>{formData.title}</dd>
            <dt>Description</dt>
            <dd>{formData.description}</dd>
            <dt>Videos</dt>
            <dd>{formData.videos.length} video(s)</dd>
            {formData.guest_name && <><dt>Name</dt><dd>{formData.guest_name}</dd></>}
            {formData.guest_email && <><dt>Email</dt><dd>{formData.guest_email}</dd></>}
          </dl>
          <div className="form-actions">
            <button type="button" className="secondary-button" onClick={() => setStep("form")}>
              <ArrowRight size={16} className="reverse" /> Back
            </button>
            <button type="button" className="auth-submit form-actions-primary" onClick={handleSubmit}>
              Confirm & Submit
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="page">
        <PageHeader title="Request Submitted!" />
        {renderStepIndicator()}
        <div className="success-content">
          <CheckCircle size={64} className="success-icon" />
          <h2>Your analysis request has been submitted</h2>
          <p>You'll receive a confirmation email with your secure access link shortly.</p>
          <p className="reference">Reference: <strong>{formData.title}</strong></p>
          <button
            type="button"
            className="auth-submit"
            onClick={() => {
              setStep("packages");
              setSelectedPackage(null);
              setFormData({ title: "", description: "", guest_name: "", guest_email: "", videos: [] });
            }}
          >
            Submit Another Request
          </button>
        </div>
      </div>
    );
  }

  return null;
}
