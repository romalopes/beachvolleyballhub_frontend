import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type AnalysisComment } from "../../api";
import AnalysisDiscussionSection from "./AnalysisDiscussionSection";

vi.mock("../../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      createAnalysisComment: vi.fn(),
      deleteAnalysisComment: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);
const comments: AnalysisComment[] = [
  {
    id: 10,
    body: "Great transition work.",
    parent_id: null,
    author: { id: 1, name: "Coach Ana" },
    created_at: "2026-10-20T10:00:00Z",
    can_delete: true,
  },
  {
    id: 11,
    body: "I will focus on that next session.",
    parent_id: 10,
    author: { id: 2, name: "Jo Player" },
    created_at: "2026-10-20T11:00:00Z",
    can_delete: false,
  },
];

const renderSection = (overrides: Partial<Parameters<typeof AnalysisDiscussionSection>[0]> = {}) => {
  const onChanged = vi.fn().mockResolvedValue(undefined);
  render(<AnalysisDiscussionSection analysisId={7} comments={comments} canComment onChanged={onChanged} {...overrides} />);
  return onChanged;
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.createAnalysisComment.mockResolvedValue({ id: 20 });
  mockedApi.deleteAnalysisComment.mockResolvedValue(undefined);
});

describe("AnalysisDiscussionSection", () => {
  it("posts a top-level comment", async () => {
    const user = userEvent.setup();
    const onChanged = renderSection();
    await user.type(screen.getByLabelText(/add to the discussion/i), "Review the block timing.");
    await user.click(screen.getByRole("button", { name: /post comment/i }));

    expect(mockedApi.createAnalysisComment).toHaveBeenCalledWith(7, {
      body: "Review the block timing.",
      parent_id: undefined,
    });
    expect(onChanged).toHaveBeenCalledOnce();
  });

  it("posts a reply to the selected comment", async () => {
    const user = userEvent.setup();
    renderSection();
    await user.click(screen.getAllByRole("button", { name: /reply/i })[0]);
    await user.type(screen.getByLabelText(/write a reply/i), "Agreed.");
    await user.click(screen.getByRole("button", { name: /post reply/i }));

    expect(mockedApi.createAnalysisComment).toHaveBeenCalledWith(7, {
      body: "Agreed.",
      parent_id: 10,
    });
  });

  it("deletes an authorized comment", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderSection();
    await user.click(screen.getByRole("button", { name: /delete comment by coach ana/i }));
    expect(mockedApi.deleteAnalysisComment).toHaveBeenCalledWith(7, 10);
    confirmSpy.mockRestore();
  });

  it("hides the composer and reply controls without comment permission", () => {
    renderSection({ canComment: false });
    expect(screen.queryByLabelText(/add to the discussion/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /reply/i })).toBeNull();
  });
});