import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Discipline, type Skill } from "../api";
import { useAuth } from "../auth/AuthContext";
import LibraryHero from "../components/LibraryHero";
import SkillCard from "../components/SkillCard";
import EmptyState from "../components/EmptyState";
import Pagination from "../components/settings/Pagination";
import { LayoutGrid, Link2, Plus, Search, Target, X } from "lucide-react";

const ITEMS_PER_SECTION = 9;
const ITEMS_PER_PAGE = 20;

export default function Skills() {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes("admin");
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Modal state for "Show all"
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDiscipline, setModalDiscipline] = useState<string | null>(null);
  const [modalPage, setModalPage] = useState(1);

  useEffect(() => {
    Promise.all([api.disciplines(), api.skills()])
      .then(([cats, sks]) => {
        setDisciplines(cats);
        setSkills(sks);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filteredSkills = skills.filter((skill) => {
    const matchesDiscipline =
      selectedDiscipline === "all" || skill.discipline?.name === selectedDiscipline;
    const matchesSearch = skill.title
      .toLowerCase()
      .includes(search.toLowerCase());
    return matchesDiscipline && matchesSearch;
  });

  // Group skills by discipline
  const skillsByDiscipline = useMemo(() => {
    const grouped = new Map<string, Skill[]>();
    filteredSkills.forEach((skill) => {
      const disciplineName = skill.discipline?.name ?? "Uncategorized";
      if (!grouped.has(disciplineName)) grouped.set(disciplineName, []);
      grouped.get(disciplineName)!.push(skill);
    });
    // Sort disciplines alphabetically
    return new Map(
      [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    );
  }, [filteredSkills]);

  // Get skills for modal
  const modalSkills = useMemo(() => {
    if (!modalDiscipline) return [];
    return skillsByDiscipline.get(modalDiscipline) ?? [];
  }, [modalDiscipline, skillsByDiscipline]);

  const modalTotalPages = Math.ceil(modalSkills.length / ITEMS_PER_PAGE);
  const modalPaginatedSkills = modalSkills.slice(
    (modalPage - 1) * ITEMS_PER_PAGE,
    modalPage * ITEMS_PER_PAGE,
  );

  const openModal = (discipline: string) => {
    setModalDiscipline(discipline);
    setModalPage(1);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalDiscipline(null);
    setModalPage(1);
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="page">
      <LibraryHero
        eyebrow="Skill library"
        title="Skills"
        description="Browse all beach volleyball skills organised by discipline. Click a skill to see details and related drills."
        highlights={[
          { icon: LayoutGrid, label: "Browse by discipline" },
          { icon: Link2, label: "Connect drills" },
          { icon: Target, label: "Coach the details" },
        ]}
        highlightsLabel="Skill library features"
        theme="library-hero--skills"
        action={
          isAdmin && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => navigate("/settings/skills/new")}
            >
              <Plus size={17} />
              Add Skill
            </button>
          )
        }
      />

      <div className="search-bar">
        <span className="search-bar-icon">
          <Search size={18} />
        </span>
        <input
          type="text"
          placeholder="Search skills..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="filter-bar">
        <button
          className={`filter-btn${selectedDiscipline === "all" ? " active" : ""}`}
          onClick={() => setSelectedDiscipline("all")}
        >
          All
        </button>
        {disciplines.map((cat) => (
          <button
            key={cat.id}
            className={`filter-btn${selectedDiscipline === cat.name ? " active" : ""}`}
            onClick={() => setSelectedDiscipline(cat.name)}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {filteredSkills.length === 0 ? (
        <EmptyState
          title="No skills found"
          description="Try adjusting your search or filter."
        />
      ) : (
        <div className="skills-by-discipline">
          {[...skillsByDiscipline.entries()].map(
            ([disciplineName, disciplineSkills]) => (
              <section key={disciplineName} className="discipline-section">
                <div className="discipline-section-header">
                  <h2 className="discipline-section-title">{disciplineName}</h2>
                  <span className="discipline-section-count">
                    {disciplineSkills.length}{" "}
                    {disciplineSkills.length === 1 ? "skill" : "skills"}
                  </span>
                </div>
                <div className="grid">
                  {disciplineSkills.slice(0, ITEMS_PER_SECTION).map((skill) => (
                    <SkillCard
                      key={skill.id}
                      skill={skill}
                      isAdmin={isAdmin}
                      onClick={() => navigate(`/skills/${skill.slug}`)}
                      onEdit={() => navigate(`/settings/skills/${skill.slug}/edit`)}
                    />
                  ))}
                </div>
                {disciplineSkills.length > ITEMS_PER_SECTION && (
                  <button
                    className="show-all-link"
                    onClick={() => openModal(disciplineName)}
                  >
                    Show all {disciplineSkills.length} skills
                  </button>
                )}
              </section>
            ),
          )}
        </div>
      )}

      {/* Modal for showing all skills in a discipline */}
      {modalOpen && modalDiscipline && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modalDiscipline}</h2>
              <button
                className="modal-close"
                onClick={closeModal}
                aria-label="Close"
              >
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <div className="grid">
                {modalPaginatedSkills.map((skill) => (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    isAdmin={isAdmin}
                    onClick={() => {
                      closeModal();
                      navigate(`/skills/${skill.slug}`);
                    }}
                    onEdit={() => navigate(`/settings/skills/${skill.slug}/edit`)}
                  />
                ))}
              </div>
              {modalTotalPages > 1 && (
                <Pagination
                  currentPage={modalPage}
                  totalPages={modalTotalPages}
                  totalItems={modalSkills.length}
                  itemsPerPage={ITEMS_PER_PAGE}
                  onPageChange={setModalPage}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
