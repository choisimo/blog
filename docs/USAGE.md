# AI Memo Inline Expansion (Spark ✨)

This project includes a minimal, inline AI memo expansion UI that shows a ✨ anchor at the end of each paragraph. When enabled, clicking ✨ opens a small inline panel with AI tools:

- Sketch: Summarize the paragraph as mood + bullets
- Prism: Show 2–3 facets with concise points
- Chain: Offer follow-up questions with short reasons

All AI calls are performed in the browser (no server dependency) using your Gemini API key from localStorage.

## Feature flags and localStorage keys

- aiMemo.inline.enabled: boolean. Controls whether ✨ anchors render after paragraphs.
- aiMemo.apiKey: string. Your Gemini API key, stored locally. Set from the AI Memo widget.
- aiMemo.events: array. Local-only telemetry of Spark interactions for future learning features.

## How to enable ✨

1. Open the AI Memo widget (bottom-right of the site).
2. Go to the settings/memo tab and toggle "Inline ✨ anchors".
3. Provide your Gemini API key in the widget if not already set.

The toggle and API key are persisted in localStorage, and the blog automatically picks up changes (no reload required).

## Using the inline panel

- Open any blog post. If the feature is enabled, you’ll see ✨ after each paragraph.
- Click ✨ to expand the panel. Choose Sketch, Prism, or Chain.
- Results render inline with basic, accessible UI.
- If the Gemini call or JSON parsing fails, a safe fallback is shown.

## Privacy and hosting

- Calls go directly from the browser to Gemini’s API using your key.
- No request goes through this blog’s backend for inline AI features.
- Telemetry is stored only in localStorage (aiMemo.events).
- Works on static hosting and client-only environments.

## Clearing data

You can clear localStorage keys at any time:

- aiMemo.apiKey
- aiMemo.inline.enabled
- aiMemo.events

## Troubleshooting

- Missing key error: Set your key via the AI Memo widget (saved to aiMemo.apiKey).
- ✨ not visible: Ensure aiMemo.inline.enabled is true (toggle in the widget).
- Network failures: The UI falls back to simple heuristics when the LLM call fails.
