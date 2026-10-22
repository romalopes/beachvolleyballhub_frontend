import { Clock } from "lucide-react";
import PageHeader from "../components/PageHeader";

export default function HireAnalysisPage() {
  return (
    <div className="page">
      <PageHeader
        title="Hire Analysis"
        description="Professional video analysis services for beach volleyball athletes and teams."
      >
        <span className="coming-soon-badge">Coming Soon</span>
      </PageHeader>

      <div className="coming-soon">
        <div className="coming-soon-icon">
          <Clock size={48} />
        </div>
        <h2>Coming Soon</h2>
        <p>
          Hire Analysis will let you request professional video analysis from
          certified coaches. Submit your match or training footage, receive a
          detailed breakdown with timestamps, annotations, and actionable
          feedback.
        </p>
        <p className="coming-soon-note">
          This is a placeholder page. No submission form or booking flow is
          available yet. Check back soon for the full launch.
        </p>
      </div>
    </div>
  );
}