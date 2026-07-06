import { describe, expect, it } from "vitest";
import {
  normalizeFabEnabledPreference,
  resolveFabEnabledPreference,
} from "@/utils/aiMemoFabPreference";

describe("aiMemo FAB preference", () => {
  it("normalizes JSON booleans and numeric aliases", () => {
    expect(normalizeFabEnabledPreference("true")).toBe(true);
    expect(normalizeFabEnabledPreference("false")).toBe(false);
    expect(normalizeFabEnabledPreference("1")).toBe(true);
    expect(normalizeFabEnabledPreference("0")).toBe(false);
  });

  it("rejects malformed or non-boolean stored values", () => {
    expect(normalizeFabEnabledPreference('"false"')).toBeUndefined();
    expect(normalizeFabEnabledPreference("null")).toBeUndefined();
    expect(normalizeFabEnabledPreference("{}")).toBeUndefined();
    expect(normalizeFabEnabledPreference("not-json")).toBeUndefined();
  });

  it("prefers valid stored values before falling back to the env flag", () => {
    expect(resolveFabEnabledPreference("false", "1")).toBe(false);
    expect(resolveFabEnabledPreference("true", "0")).toBe(true);
    expect(resolveFabEnabledPreference('"false"', "0")).toBe(false);
    expect(resolveFabEnabledPreference('"false"', undefined)).toBe(true);
  });
});
