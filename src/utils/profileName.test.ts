import { describe, expect, it } from "vitest";
import { accountDisplayName, profileDisplayName } from "./profileName";

describe("profileDisplayName", () => {
  it("shows the account name with the profile name in parentheses when they differ", () => {
    expect(profileDisplayName("Roma Lopes", "Coogee 2")).toBe("Roma Lopes (Coogee 2)");
  });

  it("shows the profile name alone when it matches the account name", () => {
    expect(profileDisplayName("Ana Silva", "Ana Silva")).toBe("Ana Silva");
  });

  it("shows the profile name alone when no account is linked", () => {
    expect(profileDisplayName(null, "Pedro Santos")).toBe("Pedro Santos");
    expect(profileDisplayName(undefined, "Pedro Santos")).toBe("Pedro Santos");
  });

  it("falls back to the account name when the profile has no name yet", () => {
    expect(profileDisplayName("Roma Lopes", null)).toBe("Roma Lopes");
  });

  it("returns an empty string when neither name exists", () => {
    expect(profileDisplayName(null, null)).toBe("");
  });
});

describe("accountDisplayName", () => {
  it("prefers the account name for a linked profile", () => {
    expect(accountDisplayName("Roma Lopes", "Coach from Kasia")).toBe("Roma Lopes");
  });

  it("falls back to the profile name when no account is linked", () => {
    expect(accountDisplayName(null, "Coach from Kasia")).toBe("Coach from Kasia");
    expect(accountDisplayName(undefined, "Pedro Santos")).toBe("Pedro Santos");
  });

  it("falls back when the account name is blank or whitespace", () => {
    expect(accountDisplayName("", "Pedro Santos")).toBe("Pedro Santos");
    expect(accountDisplayName("   ", "Coach from Kasia")).toBe("Coach from Kasia");
  });
});
