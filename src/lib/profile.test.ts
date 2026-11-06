import { describe, expect, it } from "vitest";
import { ENABLE_LEAD_VIEW } from "@/lib/features";
import { ALL_NAV_ITEMS } from "@/components/nav-items";
import { normalizeProfile, parseProfile, UI_PROFILES } from "@/lib/profile";

describe("visão de líder", () => {
  it("fica desligada e o cookie de líder vira Dev", () => {
    expect(ENABLE_LEAD_VIEW).toBe(false);
    expect(parseProfile("lead")).toBe("dev");
    expect(parseProfile("dev")).toBe("dev");
    expect(normalizeProfile("lead")).toBe("dev");
    expect(UI_PROFILES).toEqual(["dev"]);
  });

  it("tira o atalho do painel do líder", () => {
    expect(ALL_NAV_ITEMS.some((item) => item.href === "/lideranca")).toBe(false);
  });
});
