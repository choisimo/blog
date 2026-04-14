import { defaultSchema } from "rehype-sanitize";

export const blogMarkdownSanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    "*": [
      ...(defaultSchema.attributes?.["*"] ?? []),
      "className",
      "id",
    ],
    img: [
      ...(defaultSchema.attributes?.img ?? []),
      "src",
      "alt",
      "title",
      "width",
      "height",
      "loading",
    ],
    a: [
      ...(defaultSchema.attributes?.a ?? []),
      "href",
      "title",
      "target",
      "rel",
    ],
    video: [
      "src",
      "controls",
      "width",
      "height",
      "poster",
      "preload",
      "muted",
      "autoPlay",
      "loop",
    ],
    source: ["src", "type"],
    div: [
      ...(defaultSchema.attributes?.div ?? []),
      "className",
    ],
    span: [
      ...(defaultSchema.attributes?.span ?? []),
      "className",
    ],
    code: ["className"],
    pre: ["className"],
  },
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "video",
    "source",
    "details",
    "summary",
    "mark",
    "abbr",
    "figure",
    "figcaption",
    "picture",
  ],
};
