import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type User } from "../api";
import {
  archiveCoach,
  archivePlayer,
  canCreateCoachProfile,
  canCreatePlayerProfile,
  canEditProfile,
  canManageProfiles,
  deleteCoachProfile,
  deletePlayerProfile,
  isArchived,
  profileDeletionErrorMessage,
  restoreCoach,
  restorePlayer,
} from "./people";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      updatePlayer: vi.fn(),
      updateCoach: vi.fn(),
      deletePlayer: vi.fn(),
      deleteCoach: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);
const user = (roles: string[], id = 7): User => ({
  id,
  name: "Test User",
  email_address: "test@example.com",
  roles,
});

describe("people permissions", () => {
  it("matches profile management and creation role rules", () => {
    expect(canManageProfiles(user(["coach"]))).toBe(true);
    expect(canManageProfiles(user(["admin"]))).toBe(true);
    expect(canManageProfiles(user(["player"]))).toBe(false);
    expect(canCreatePlayerProfile(user(["player"]))).toBe(true);
    expect(canCreatePlayerProfile(user(["curator"]))).toBe(true);
    expect(canCreatePlayerProfile(user([]))).toBe(false);
    expect(canCreateCoachProfile(user(["coach"]))).toBe(true);
    expect(canCreateCoachProfile(user(["curator"]))).toBe(true);
    expect(canCreateCoachProfile(user(["player"]))).toBe(false);
  });

  it("allows curators/admins and the recording user to edit a profile", () => {
    expect(canEditProfile(user(["curator"]), { created_by: null })).toBe(true);
    expect(canEditProfile(user(["player"], 7), { created_by: { id: 7 } })).toBe(true);
    expect(canEditProfile(user(["player"], 8), { created_by: { id: 7 } })).toBe(false);
    expect(canEditProfile(null, { created_by: { id: 7 } })).toBe(false);
  });

  it("recognises archived payloads safely", () => {
    expect(isArchived({ status: "archived" })).toBe(true);
    expect(isArchived({ status: "active" })).toBe(false);
    expect(isArchived(undefined)).toBe(false);
  });
});

describe("people API helpers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends the expected archive and restore payloads", async () => {
    await archivePlayer(1);
    await restorePlayer(2);
    await archiveCoach(3);
    await restoreCoach(4);

    expect(mockedApi.updatePlayer).toHaveBeenNthCalledWith(1, 1, {
      player_profile: { status: "archived" },
    });
    expect(mockedApi.updatePlayer).toHaveBeenNthCalledWith(2, 2, {
      player_profile: { status: "active" },
    });
    expect(mockedApi.updateCoach).toHaveBeenNthCalledWith(1, 3, {
      coach_profile: { status: "archived" },
    });
    expect(mockedApi.updateCoach).toHaveBeenNthCalledWith(2, 4, {
      coach_profile: { status: "active" },
    });
  });

  it("delegates hard deletes to the profile endpoints", async () => {
    await deletePlayerProfile(5);
    await deleteCoachProfile(6);
    expect(mockedApi.deletePlayer).toHaveBeenCalledWith(5);
    expect(mockedApi.deleteCoach).toHaveBeenCalledWith(6);
  });
});

describe("profileDeletionErrorMessage", () => {
  it("uses a fallback for non-errors and the message for ordinary errors", () => {
    expect(profileDeletionErrorMessage("bad", "Fallback")).toBe("Fallback");
    expect(profileDeletionErrorMessage(new Error("Refused"), "Fallback")).toBe("Refused");
  });

  it("deduplicates and humanises protected-history blockers", () => {
    const error = Object.assign(new Error("Cannot delete profile"), {
      blockers: [
        "training_session_participants",
        "training_session_participants",
        "unknown_reference",
      ],
    });

    expect(profileDeletionErrorMessage(error, "Fallback")).toBe(
      "Cannot delete profile: the profile has training history; unknown reference.",
    );
  });
});