import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type AnalysisParticipant } from "../../api";
import AnalysisParticipantsSection from "./AnalysisParticipantsSection";

vi.mock("../../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      players: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);

const participants: AnalysisParticipant[] = [
  { id: 1, player_profile_id: 5, name: "Jo Player", notes: null },
];

const renderSection = (
  overrides: Partial<Parameters<typeof AnalysisParticipantsSection>[0]> = {},
) => {
  const onUpdate = vi.fn().mockResolvedValue(undefined);
  render(
    <AnalysisParticipantsSection
      participants={participants}
      canManage
      onUpdate={onUpdate}
      {...overrides}
    />,
  );
  return { onUpdate };
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.players.mockResolvedValue({
    data: [{ id: 7, full_name: "Pedro Search", preferred_position: "Setter" }],
    meta: {},
  } as never);
});

describe("AnalysisParticipantsSection", () => {
  it("lists participants without the search when the viewer cannot manage", () => {
    renderSection({ canManage: false });
    expect(screen.getByText("Jo Player")).toBeInTheDocument();
    expect(screen.queryByLabelText(/search participants/i)).toBeNull();
    expect(
      screen.queryByRole("button", { name: /remove jo player/i }),
    ).toBeNull();
  });

  it("searches players server-side and reports a search failure", async () => {
    const user = userEvent.setup();
    renderSection();

    await user.type(screen.getByLabelText(/search participants/i), "pedro");
    expect(await screen.findByText("Pedro Search")).toBeInTheDocument();
    expect(mockedApi.players).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: "pedro" }),
    );

    mockedApi.players.mockRejectedValueOnce(new Error("network down"));
    await user.type(screen.getByLabelText(/search participants/i), "x");
    expect(await screen.findByRole("alert")).toHaveTextContent("network down");
  });

  it("adds a searched player through onUpdate with the merged roster", async () => {
    const user = userEvent.setup();
    const { onUpdate } = renderSection();

    await user.type(screen.getByLabelText(/search participants/i), "pedro");
    await user.click(await screen.findByText("Pedro Search"));

    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith([5, 7]),
    );
  });

  it("never offers a player who is already on the roster", async () => {
    const user = userEvent.setup();
    mockedApi.players.mockResolvedValue({
      data: [
        { id: 5, full_name: "Jo Player" },
        { id: 7, full_name: "Pedro Search" },
      ],
      meta: {},
    } as never);
    renderSection();

    await user.type(screen.getByLabelText(/search participants/i), "o");
    expect(await screen.findByText("Pedro Search")).toBeInTheDocument();
    const results = document.querySelector<HTMLElement>(
      ".analysis-participant-results",
    );
    expect(results).not.toBeNull();
    expect(within(results as HTMLElement).queryByText("Jo Player")).toBeNull();
    expect(
      within(results as HTMLElement).getByText("Pedro Search"),
    ).toBeInTheDocument();
    expect(screen.getByText("Jo Player")).toBeInTheDocument();
  });

  it("removes a participant through onUpdate with the remaining roster", async () => {
    const user = userEvent.setup();
    const { onUpdate } = renderSection();

    await user.click(screen.getByRole("button", { name: /remove jo player/i }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith([]));
  });

  it("keeps the previous roster when the update fails", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn().mockRejectedValue(new Error("blocked"));
    render(
      <AnalysisParticipantsSection
        participants={participants}
        canManage
        onUpdate={onUpdate}
      />,
    );

    await user.click(screen.getByRole("button", { name: /remove jo player/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("blocked");
    expect(screen.getByText("Jo Player")).toBeInTheDocument();
  });
});
