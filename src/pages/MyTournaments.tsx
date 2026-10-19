import PageHeader from "../components/PageHeader";
import TournamentList from "../components/TournamentList";

export default function MyTournaments() {
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