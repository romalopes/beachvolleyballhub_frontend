import { beforeEach, describe, expect, it } from "vitest";
import {
  CLAIM_INVITATION_RETURN_PATH_KEY,
  clearClaimInvitationPath,
  rememberClaimInvitationPath,
  safeInternalReturnPath,
} from "./invitationReturnPath";

describe("invitation return paths", () => {
  beforeEach(() => localStorage.clear());

  it("accepts app-local paths and rejects external or malformed values", () => {
    expect(safeInternalReturnPath("/identity#claim_token=abc")).toBe(
      "/identity#claim_token=abc",
    );
    expect(safeInternalReturnPath("//evil.example/path")).toBe("/");
    expect(safeInternalReturnPath("https://evil.example/path")).toBe("/");
    expect(safeInternalReturnPath(null)).toBe("/");
  });

  it("only remembers paths that carry a claim token", () => {
    rememberClaimInvitationPath("/identity");
    expect(localStorage.getItem(CLAIM_INVITATION_RETURN_PATH_KEY)).toBeNull();

    rememberClaimInvitationPath("/identity?claim_token=abc#review");
    expect(localStorage.getItem(CLAIM_INVITATION_RETURN_PATH_KEY)).toBe(
      "/identity?claim_token=abc#review",
    );
  });

  it("clears a remembered invitation path", () => {
    localStorage.setItem(CLAIM_INVITATION_RETURN_PATH_KEY, "/identity?claim_token=abc");
    clearClaimInvitationPath();
    expect(localStorage.getItem(CLAIM_INVITATION_RETURN_PATH_KEY)).toBeNull();
  });
});