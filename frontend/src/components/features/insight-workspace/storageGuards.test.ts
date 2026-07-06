import { describe, expect, it } from "vitest";
import {
  normalizeInsightWorkspaceItem,
  normalizePinnedStackIds,
} from "./storageGuards";

describe("insight workspace storage guards", () => {
  it("sanitizes persisted stack items before page state uses them", () => {
    expect(
      normalizeInsightWorkspaceItem({
        id: "post:2026/demo\u0000\r\n",
        nodeId: "node\u0000\r\nid",
        kind: "thought\u0000",
        title: "Title\u0000\r\nInjected\u007F",
        subtitle: "Subtitle\r\nInjected",
        postKey: "2026/demo\u0000",
        createdAt: 123.5,
      }),
    ).toMatchObject({
      id: "post:2026/demo",
      nodeId: "nodeid",
      kind: "thought",
      title: "Title Injected",
      subtitle: "Subtitle Injected",
      postKey: "2026/demo",
      createdAt: 123.5,
    });
  });

  it("drops invalid pinned stack ids and strips controls from valid ids", () => {
    expect(normalizePinnedStackIds(["post:1\u0000", "", 42])).toEqual(["post:1"]);
  });
});
