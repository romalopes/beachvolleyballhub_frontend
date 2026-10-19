import { useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import TournamentList from "../components/TournamentList";

export default function MyTournaments() {
  const navigate = useNavigate();
  return (
    <div className="page">
      <PageHeader
        title="My Tournaments"
        description="Tournaments you have marked as personal interest or attendance."
      />
      <TournamentList filter="my" baseFilters={{}} />
    </div>
  );
}