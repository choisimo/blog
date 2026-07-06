import { describe, expect, it } from "vitest";

import { extractImageFromMessage } from "@/components/features/chat/widget/constants";

describe("chat widget constants utilities", () => {
  it("extracts and normalizes safe attached image URLs", () => {
    expect(
      extractImageFromMessage(
        [
          "이미지를 봐줘.",
          "",
          "[첨부 이미지]",
          "URL: https://example.com/image.png",
          "파일명: photo.png",
          "크기: 12KB",
        ].join("\n"),
      ),
    ).toEqual({
      imageUrl: "https://example.com/image.png",
      cleanText: "이미지를 봐줘.",
    });
  });

  it("does not extract unsafe attached image URLs", () => {
    const text = [
      "이미지를 봐줘.",
      "",
      "[첨부 이미지]",
      "URL: javascript:alert(1)",
      "파일명: photo.png",
      "크기: 12KB",
    ].join("\n");

    expect(extractImageFromMessage(text)).toEqual({
      imageUrl: null,
      cleanText: text,
    });
  });

  it("keeps unrelated message text unchanged", () => {
    expect(extractImageFromMessage("hello")).toEqual({
      imageUrl: null,
      cleanText: "hello",
    });
  });
});
