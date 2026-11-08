import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// The form loads its lookups on mount; the visual catalog needs no API.
vi.mock("../../../../api", () => {
  class ApiValidationError extends Error {}
  return {
    api: {
      // `vi.fn` so a test can hand the picker specific disciplines/skills.
      skills: vi.fn(() => Promise.resolve([])),
      disciplines: vi.fn(() => Promise.resolve([])),
      adminCreateDrill: vi.fn(() => Promise.resolve({})),
      adminUpdateDrill: vi.fn(() => Promise.resolve({})),
    },
    ApiValidationError,
  };
});

import DrillForm from "./DrillForm";
import { SAMPLE_DRILL_DEFINITION } from "../../../drill/definition";
import type { DrillDefinition } from "../../../drill/definition";
import { api } from "../../../../api";
import type { Discipline, Drill, Skill } from "../../../../api";

/**
 * The visual builder and the JSON textarea are two views of one model. These
 * tests pin the Phase-1 contract: a visual edit re-derives the JSON ("the JSON
 * on time"), a manual JSON edit rehydrates the model, and a malformed JSON draft
 * never destroys the model the builder is working from.
 */

afterEach(() => {
  cleanup();
  // The lookups are overridden per test; put the "nothing loaded" default back.
  vi.mocked(api.skills).mockResolvedValue([]);
  vi.mocked(api.disciplines).mockResolvedValue([]);
});

const renderForm = () =>
  render(<DrillForm initial={null} onSuccess={vi.fn()} onCancel={vi.fn()} />);

const jsonField = () => {
  // In JSON mode, the textarea is visible. Switch to it first.
  const jsonTab = screen.getByRole("button", { name: "JSON editor" });
  if (jsonTab && jsonTab.getAttribute("aria-pressed") !== "true") {
    fireEvent.click(jsonTab);
  }
  return screen.getByLabelText("Definition (JSON)") as HTMLTextAreaElement;
};

/** Wait for the mount effects (skills/disciplines) to flush. */
const ready = () =>
  waitFor(() =>
    expect(screen.getByText(/no participants yet/i)).toBeInTheDocument(),
  );

describe("DrillForm — visual catalog ↔ JSON", () => {
  it("starts a new drill with no definition and an empty catalog", async () => {
    renderForm();
    await ready();

    expect(jsonField().value).toBe("");
    // A brand-new drill is not "missing" a definition — nothing to warn about.
    expect(screen.queryByText(/has no saved definition yet/i)).toBeNull();
  });

  it("writes the JSON as soon as an entity is added visually", async () => {
    renderForm();
    await ready();

    fireEvent.click(screen.getByRole("button", { name: /add participant/i }));

    const parsed = JSON.parse(jsonField().value);
    expect(parsed.participants).toEqual([{ id: "P1", type: "player" }]);
    expect(parsed.side.grid).toEqual({ columns: 5, rows: 4 });
    // The lazy bootstrap gives the builder a valid, saveable definition.
    expect(parsed.steps).toHaveLength(1);
    expect(parsed.steps[0].id).toBe("S1");
    expect(parsed.steps[0].participants).toEqual([]);
  });

  it("hydrates the catalog when the JSON is edited manually", async () => {
    renderForm();
    await ready();

    const definition = {
      version: 1,
      side: { grid: { columns: 5, rows: 4 } },
      participants: [{ id: "P9", type: "coach", role: "feeder" }],
      balls: [],
      objects: [],
      steps: [
        {
          id: "S1",
          participants: [],
          balls: [],
          objects: [],
          actions: [],
          participant_movements: [],
          ball_movements: [],
          object_movements: [],
        },
      ],
    };

    fireEvent.change(jsonField(), {
      target: { value: JSON.stringify(definition, null, 2) },
    });

    // Switching back to visual mode rehydrates the model from the edited JSON.
    fireEvent.click(screen.getByRole("button", { name: "Visual builder" }));

    expect(screen.getByLabelText("Type of P9")).toBeInTheDocument();
    expect(screen.getByLabelText("Role of P9")).toHaveValue("feeder");
  });

  it("keeps the last good model when the JSON draft becomes malformed", async () => {
    renderForm();
    await ready();

    fireEvent.click(screen.getByRole("button", { name: /add participant/i }));
    expect(screen.getByLabelText("Type of P1")).toBeInTheDocument();

    fireEvent.change(jsonField(), { target: { value: "{ nope" } });

    // The textarea keeps exactly what the user typed...
    expect(jsonField().value).toBe("{ nope");
    // ...switch back to visual mode, and the builder still works off the last
    // good model.
    fireEvent.click(screen.getByRole("button", { name: "Visual builder" }));
    expect(screen.getByLabelText("Type of P1")).toBeInTheDocument();
  });
});

/**
 * Existing drills, not just new ones. Rails defaults the `definition` column to
 * `{}` (`null: false`), so the editor receives partial objects from storage and
 * has to render a draft rather than crash indexing `definition.steps`.
 */
const savedDrill = (definition: unknown): Drill =>
  ({
    id: 7,
    title: "Serve receive",
    slug: "serve-receive",
    setup_instructions: "",
    training_stage: "middle",
    difficulty_level: "intermediate",
    min_players: 2,
    max_players: 4,
    ideal_num_players: 4,
    definition,
  }) as Drill;

const renderSaved = (definition: unknown) =>
  render(
    <DrillForm
      initial={savedDrill(definition)}
      onSuccess={vi.fn()}
      onCancel={vi.fn()}
    />,
  );

describe("DrillForm — stored definitions", () => {
  it("renders the Rails `{}` column default as a draft", async () => {
    renderSaved({});
    await ready();

    // The panes get a complete draft: one empty step on the default side...
    expect(screen.getByLabelText("Step S1")).toBeInTheDocument();
    // ...and the textarea shows that same draft, so the JSON stays "on time".
    const draft = JSON.parse(jsonField().value) as DrillDefinition;
    expect(draft.side).toEqual({ grid: { columns: 5, rows: 4 } });
    expect(draft.steps.map((step) => step.id)).toEqual(["S1"]);
    expect(draft.steps[0].participants).toEqual([]);
  });

  it("keeps the entities of a stored definition that has no steps", async () => {
    renderSaved({
      version: 1,
      side: { grid: { columns: 5, rows: 4 } },
      participants: [{ id: "P9", type: "coach", role: "feeder" }],
      balls: [],
      objects: [],
    });
    await waitFor(() =>
      expect(screen.getByLabelText("Type of P9")).toBeInTheDocument(),
    );

    // The missing step is supplied, so the step controls have something to show.
    expect(screen.getByLabelText("Step S1")).toBeInTheDocument();
    // The author's entity survives the normalisation.
    const draft = JSON.parse(jsonField().value) as DrillDefinition;
    expect(draft.participants).toEqual([
      { id: "P9", type: "coach", role: "feeder" },
    ]);
  });

  it("says out loud that the drill has no saved definition yet", async () => {
    renderSaved({});
    await ready();

    // The empty draft is intentional, so it must not look like lost data.
    expect(
      screen.getByText(/has no saved definition yet/i),
    ).toBeInTheDocument();
  });

  it("stays quiet for a drill that does have a definition", async () => {
    renderSaved(SAMPLE_DRILL_DEFINITION);
    // The textarea is filled once the stored definition has been hydrated.
    await waitFor(() => expect(jsonField().value).not.toBe(""));

    expect(screen.queryByText(/has no saved definition yet/i)).toBeNull();
  });
});

describe("DrillForm — optional training attributes", () => {
  it("submits blank training attributes as null", async () => {
    const serve = discipline(10, "Serve");
    vi.mocked(api.disciplines).mockResolvedValue([serve]);
    vi.mocked(api.skills).mockResolvedValue([skill(1, "Float serve", serve)]);
    const create = vi.mocked(api.adminCreateDrill);

    renderForm();
    await screen.findByLabelText("Discipline:");

    // A title and one skill are all the form requires; the five training
    // attributes are left blank (the selects keep their placeholder option).
    fireEvent.change(screen.getByLabelText("Title *"), {
      target: { value: "No Metadata" },
    });
    fireEvent.click(screen.getByLabelText(/Float serve/));
    fireEvent.click(screen.getByRole("button", { name: "Create Drill" }));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create.mock.calls[0][0]).toMatchObject({
      title: "No Metadata",
      training_stage: null,
      difficulty_level: null,
      min_players: null,
      max_players: null,
      ideal_num_players: null,
    });
    // No validation banner: blank is a valid answer for these fields.
    expect(screen.queryByText(/min ≤ ideal ≤ max/)).toBeNull();
  });

  it("still rejects a partial player range that cannot be true", async () => {
    const serve = discipline(10, "Serve");
    vi.mocked(api.disciplines).mockResolvedValue([serve]);
    vi.mocked(api.skills).mockResolvedValue([skill(1, "Float serve", serve)]);
    const create = vi.mocked(api.adminCreateDrill);

    renderForm();
    await screen.findByLabelText("Discipline:");

    fireEvent.change(screen.getByLabelText("Title *"), {
      target: { value: "Bad Range" },
    });
    fireEvent.click(screen.getByLabelText(/Float serve/));
    // Only min and max are supplied, and they contradict each other.
    fireEvent.change(screen.getByLabelText("Min Players"), {
      target: { value: "8" },
    });
    fireEvent.change(screen.getByLabelText("Max Players"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Drill" }));

    expect(await screen.findByText(/min ≤ ideal ≤ max/)).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it("submits a drill with no linked skills", async () => {
    const serve = discipline(10, "Serve");
    vi.mocked(api.disciplines).mockResolvedValue([serve]);
    vi.mocked(api.skills).mockResolvedValue([skill(1, "Float serve", serve)]);
    const create = vi.mocked(api.adminCreateDrill);

    renderForm();
    await screen.findByLabelText("Discipline:");

    // Only a title is required — no skill has to be selected.
    fireEvent.change(screen.getByLabelText("Title *"), {
      target: { value: "Skill-free drill" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Drill" }));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create.mock.calls[0][0]).toMatchObject({
      title: "Skill-free drill",
      skill_ids: [],
    });
    expect(screen.queryByText(/select at least one skill/i)).toBeNull();
  });

  it("publishes new drills by default (no approval step)", async () => {
    const create = vi.mocked(api.adminCreateDrill);

    renderForm();
    await ready();

    fireEvent.change(screen.getByLabelText("Title *"), {
      target: { value: "Directly published" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Drill" }));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create.mock.calls[0][0]).toMatchObject({
      title: "Directly published",
      status: "published",
      visibility: "shared",
    });
  });

  it("lets an admin choose a non-published status and visibility", async () => {
    const create = vi.mocked(api.adminCreateDrill);

    renderForm();
    await ready();

    fireEvent.change(screen.getByLabelText("Title *"), {
      target: { value: "Draft drill" },
    });
    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "draft" },
    });
    fireEvent.change(screen.getByLabelText("Visibility"), {
      target: { value: "private" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Drill" }));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create.mock.calls[0][0]).toMatchObject({
      title: "Draft drill",
      status: "draft",
      visibility: "private",
    });
  });
});

/**
 * The picker shows one discipline at a time — there is no "All Disciplines" escape
 * hatch, so a drill is always authored against a concrete discipline. It opens on
 * the first discipline the API returns and lists only that discipline's skills.
 */
const discipline = (id: number, name: string): Discipline => ({
  id,
  name,
  slug: name.toLowerCase(),
});

const skill = (id: number, title: string, cat: Discipline): Skill => ({
  id,
  title,
  slug: title.toLowerCase().replace(/\s+/g, "-"),
  description: null,
  discipline_id: cat.id,
  discipline: cat,
});

describe("DrillForm — skills picker", () => {
  it("opens on the first discipline and lists only its skills", async () => {
    const serve = discipline(10, "Serve");
    const pass = discipline(20, "Pass");
    vi.mocked(api.disciplines).mockResolvedValue([serve, pass]);
    vi.mocked(api.skills).mockResolvedValue([
      skill(1, "Float serve", serve),
      skill(2, "Bump pass", pass),
    ]);

    renderForm();

    // The first discipline is selected without the user choosing anything.
    const picker = await screen.findByLabelText("Discipline:");
    await waitFor(() => expect(picker).toHaveValue("10"));
    expect(screen.getByText("Float serve")).toBeInTheDocument();
    // The other discipline's skills are not offered, and neither is "All".
    expect(screen.queryByText("Bump pass")).toBeNull();
    expect(screen.queryByText("All Disciplines")).toBeNull();

    // Switching discipline swaps the visible skills.
    fireEvent.change(picker, { target: { value: "20" } });
    await waitFor(() => expect(screen.getByText("Bump pass")).toBeInTheDocument());
    expect(screen.queryByText("Float serve")).toBeNull();
  });
});