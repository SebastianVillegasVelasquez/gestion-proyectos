import { afterEach, describe, expect, it } from "vitest";
import {
  accessForTeamRole,
  applyTeamRolePreview,
  readViewAsTeamRole,
  writeViewAsTeamRole,
} from "./view-as-team-role";
import { isPreviewing } from "./view-as";

const real = { team_role: null, can_view: true, can_deliver: false, can_review: true };

afterEach(() => {
  writeViewAsTeamRole(null);
});

describe("accessForTeamRole", () => {
  it("lets only leaders and supervisors review", () => {
    expect(accessForTeamRole("lider").can_review).toBe(true);
    expect(accessForTeamRole("supervisor").can_review).toBe(true);
    expect(accessForTeamRole("integrante").can_review).toBe(false);
  });
});

describe("applyTeamRolePreview", () => {
  it("keeps the real access without a preview", () => {
    expect(applyTeamRolePreview(real, null)).toBe(real);
  });

  it("replaces the real access with the previewed role", () => {
    expect(applyTeamRolePreview(real, "integrante")).toMatchObject({
      team_role: "integrante",
      can_review: false,
      can_deliver: true,
    });
  });
});

describe("stored preview", () => {
  it("round-trips and counts as a read-only preview", () => {
    expect(isPreviewing()).toBe(false);
    writeViewAsTeamRole("lider");
    expect(readViewAsTeamRole()).toBe("lider");
    expect(isPreviewing()).toBe(true);
  });

  it("ignores unknown stored values", () => {
    sessionStorage.setItem("view_as_team_role", "jefe");
    expect(readViewAsTeamRole()).toBeNull();
  });
});
