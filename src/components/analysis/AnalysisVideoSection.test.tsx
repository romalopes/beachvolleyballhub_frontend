import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type AnalysisVideo } from "../../api";
import AnalysisVideoSection from "./AnalysisVideoSection";

vi.mock("../../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      createAnalysisVideo: vi.fn(),
      deleteAnalysisVideo: vi.fn(),
      createAnalysisAnnotation: vi.fn(),
      deleteAnalysisAnnotation: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);
const video: AnalysisVideo = {
  id: 11,
  source_type: "external",
  title: "Set two",
  description: "Side-out clips",
  position: 0,
  playback_url: "https://example.com/embed/1",
  external_url: "https://example.com/watch/1",
  can_embed: true,
  duration_seconds: 90,
  annotations: [
    {
      id: 21,
      timestamp_seconds: 12,
      body: "Watch the approach",
      author: { id: 1, name: "Coach Ana" },
      player_profile: null,
      created_at: "2026-10-20T10:00:00Z",
    },
  ],
};

const renderSection = (overrides: Partial<Parameters<typeof AnalysisVideoSection>[0]> = {}) => {
  const onChanged = vi.fn().mockResolvedValue(undefined);
  render(
    <AnalysisVideoSection
      analysisId={7}
      videos={[video]}
      participants={[{ id: 1, player_profile_id: 5, name: "Jo Player" }]}
      canManage
      onChanged={onChanged}
      {...overrides}
    />,
  );
  return onChanged;
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.createAnalysisVideo.mockResolvedValue({ analysis_video_id: 99 });
  mockedApi.deleteAnalysisVideo.mockResolvedValue(undefined);
  mockedApi.createAnalysisAnnotation.mockResolvedValue({ id: 30 });
  mockedApi.deleteAnalysisAnnotation.mockResolvedValue(undefined);
});

describe("AnalysisVideoSection", () => {
  it("adds an external video and refreshes the analysis", async () => {
    const user = userEvent.setup();
    const onChanged = renderSection();
    await user.click(screen.getByRole("button", { name: /add video/i }));
    await user.type(screen.getByLabelText(/video url/i), "https://youtube.com/watch?v=abc");
    await user.type(screen.getByLabelText(/^title/i), "Serve receive");
    await user.click(screen.getByRole("button", { name: /^add video$/i }));

    expect(mockedApi.createAnalysisVideo).toHaveBeenCalledWith(7, {
      file: undefined,
      source_url: "https://youtube.com/watch?v=abc",
      title: "Serve receive",
      description: undefined,
    });
    expect(onChanged).toHaveBeenCalledOnce();
  });

  it("uploads a valid video file", async () => {
    const user = userEvent.setup();
    renderSection();
    await user.click(screen.getByRole("button", { name: /add video/i }));
    await user.click(screen.getByText(/upload file/i));
    const file = new File(["video"], "training.mp4", { type: "video/mp4" });
    await user.upload(screen.getByLabelText(/video file/i), file);
    await user.click(screen.getByRole("button", { name: /^add video$/i }));

    expect(mockedApi.createAnalysisVideo).toHaveBeenCalledWith(7, expect.objectContaining({ file }));
  });

  it("adds and deletes timestamped annotations", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderSection();
    await user.click(screen.getByRole("button", { name: /add timestamped note/i }));
    await user.type(screen.getByLabelText(/^timestamp$/i), "1:24");
    await user.selectOptions(screen.getByLabelText(/^player/i), "5");
    await user.type(screen.getByLabelText(/^note/i), "Hold the platform angle");
    await user.click(screen.getByRole("button", { name: /save note/i }));

    expect(mockedApi.createAnalysisAnnotation).toHaveBeenCalledWith(11, {
      timestamp_seconds: 84,
      body: "Hold the platform angle",
      player_profile_id: 5,
    });

    await user.click(screen.getByRole("button", { name: /delete timestamped note/i }));
    expect(mockedApi.deleteAnalysisAnnotation).toHaveBeenCalledWith(11, 21);
    confirmSpy.mockRestore();
  });

  it("hides all management controls for viewers", () => {
    renderSection({ canManage: false });
    expect(screen.queryByRole("button", { name: /add video/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /remove set two/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /add timestamped note/i })).toBeNull();
  });
});