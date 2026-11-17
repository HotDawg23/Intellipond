import { describe, expect, it } from "vitest";
import { profileDisplayName } from "@/lib/profile-name";

describe("profile display name", () => {
  it("uses separate names when reviewed", () => {
    expect(profileDisplayName({ first_name: " Ana ", middle_name: " Maria ", last_name: " Santos ", full_name: "Old Name" }))
      .toBe("Ana Maria Santos");
    expect(profileDisplayName({ first_name: "Alex", middle_name: null, last_name: "Operator" }))
      .toBe("Alex Operator");
  });

  it("keeps the legacy name or email while review is incomplete", () => {
    expect(profileDisplayName({ first_name: "Ana", last_name: null, full_name: "Legacy Name" }))
      .toBe("Legacy Name");
    expect(profileDisplayName({ email: "operator@example.com" })).toBe("operator@example.com");
  });
});
