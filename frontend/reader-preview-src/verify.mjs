import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const folder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../design-previews/reading-page/verification",
);
await fs.mkdir(folder, { recursive: true });
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1080 },
  locale: "ko-KR",
  reducedMotion: "reduce",
});
const errors = [],
  api = [],
  checks = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("response", (response) => {
  const url = new URL(response.url());
  if (url.pathname.startsWith("/api/"))
    api.push({
      path: url.pathname.replace(/sess-[^/]+/g, "SESSION"),
      status: response.status,
    });
});
try {
  await page.goto("http://localhost:4320");
  await page
    .locator("[data-reading-content] .sentio-trigger")
    .first()
    .waitFor({ timeout: 60000 });
  await page.locator("ai-memo-pad").waitFor({ state: "attached" });
  assert.equal(
    await page.locator("ai-memo-pad").evaluate((el) => !!el.shadowRoot),
    true,
    "real memo element must be registered",
  );
  const content = await page.locator("[data-reading-content]").evaluate((el) =>
    [...el.querySelectorAll("[data-spark-inline-wrapper]")].map((node) => {
      const clone = node.cloneNode(true);
      clone.querySelectorAll("button").forEach((b) => b.remove());
      return clone.textContent.trim();
    }),
  );
  assert.equal(content.length, 30);
  const headings = await page
    .locator("[data-reading-content] h3")
    .allTextContents();
  assert.equal(headings.length, 6);
  assert.equal(
    await page
      .locator("[data-reading-content] img")
      .first()
      .evaluate((el) => el.complete && el.naturalWidth > 0),
    true,
  );
  await page.screenshot({
    path: path.join(folder, "article-full-context.png"),
  });
  await page
    .getByRole("button", { name: "문단 AI 살펴보기 ↗", exact: true })
    .click();
  const panel = page.locator(".sentio-panel:not([hidden])");
  await panel.locator(".sentio-thought").first().waitFor({ timeout: 180000 });
  await panel.locator(".rp-question-options button").first().waitFor();
  await panel
    .locator(".sentio-feed-status")
    .filter({ hasText: "모두" })
    .waitFor({ timeout: 180000 });
  const cardTitle = await panel
    .locator(".sentio-thought > h3")
    .first()
    .textContent();
  console.log("Actual thought feed ready:", cardTitle);
  const cardCount = await panel.locator(".sentio-thought").count();
  const field = panel
    .locator(".sentio-thought")
    .first()
    .locator(".sentio-exploration-form input");
  await field.fill("디자인을 바꿔도 이 질문은 남아야 합니다.");
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1080 : 900 });
    for (let design = 0; design <= 10; design++) {
      await page.locator("#reader-design-select").selectOption(String(design));
      await page.waitForTimeout(120);
      assert.equal(
        await field.inputValue(),
        "디자인을 바꿔도 이 질문은 남아야 합니다.",
      );
      assert.equal(await panel.locator(".sentio-thought").count(), cardCount);
      const same = await page.locator("[data-reading-content]").evaluate((el) =>
        [...el.querySelectorAll("[data-spark-inline-wrapper]")].map((node) => {
          const clone = node.cloneNode(true);
          clone.querySelectorAll("button").forEach((b) => b.remove());
          return clone.textContent.trim();
        }),
      );
      assert.deepEqual(same, content, "article content changed across layouts");
      const sizes = await page.evaluate(() => ({
        viewport: innerWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      assert.ok(
        sizes.scroll <= sizes.viewport + 1,
        `Horizontal overflow in ${design}@${width}: ${JSON.stringify(sizes)}`,
      );
      if (![2, 9].includes(design) || width < 1100) {
        if (design !== 9)
          await panel.evaluate((el) =>
            el.scrollIntoView({ block: "start", behavior: "instant" }),
          );
      }
      if (width !== 320)
        await page.screenshot({
          path: path.join(
            folder,
            `${String(design).padStart(2, "0")}-${width}.png`,
          ),
        });
      checks.push({
        design,
        width,
        contentPreserved: true,
        draftPreserved: true,
        noOverflow: true,
      });
    }
  }
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.locator("#reader-design-select").selectOption("8");
  const note = panel.locator(".rp-note textarea");
  await note.fill("원문의 관찰과 해석을 나눠 살펴보자.");
  await page.locator("#reader-design-select").selectOption("3");
  await page.locator("#reader-design-select").selectOption("8");
  assert.equal(await note.inputValue(), "원문의 관찰과 해석을 나눠 살펴보자.");
  await page.locator(".rp-save").click();
  assert.equal(
    await page.locator(".rp-save").getAttribute("aria-pressed"),
    "true",
  );
  await page.locator("#reader-design-select").selectOption("1");
  await panel.locator(".rp-question-options button").nth(1).click();
  assert.equal(
    await panel
      .locator('.sentio-thought[data-reader-selected="true"]')
      .getAttribute("data-card-id"),
    await panel.locator(".sentio-thought").nth(1).getAttribute("data-card-id"),
  );
  await panel.locator(".rp-question-options button").first().click();
  await panel
    .locator(".sentio-thought")
    .first()
    .locator(".sentio-paper-trigger")
    .click();
  await page.locator(".sentio-paper-dialog").waitFor();
  await page.getByRole("button", { name: "큰 화면 닫기", exact: true }).click();
  assert.equal(await page.locator(".sentio-paper-dialog").count(), 0);
  await page.getByRole("button", { name: "10개 보기", exact: true }).click();
  assert.equal(await page.locator(".rp-design-grid > button").count(), 10);
  await page.screenshot({ path: path.join(folder, "design-picker.png") });
  await page.keyboard.press("Escape");
  let streamed = "",
    streamError = 0;
  if (process.env.READER_VERIFY_LAYOUT_ONLY !== "1") {
    // One real streamed follow-up through the existing service and auth flow.
    await field.fill(
      "이 문단에서 직접 관찰한 사실과 글쓴이의 해석을 구분해 주세요.",
    );
    await field.press("Enter");
    await panel
      .locator(".sentio-thought")
      .first()
      .locator(".sentio-exploration-body")
      .waitFor({ timeout: 15000 });
    await page.locator("#reader-design-select").selectOption("2");
    await page.waitForFunction(
      () => {
        const el = document.querySelector(
          ".sentio-thought .sentio-exploration-body",
        );
        return el && el.getAttribute("aria-busy") === "false";
      },
      {},
      { timeout: 150000 },
    );
    streamed = await panel
      .locator(".sentio-thought")
      .first()
      .locator(".sentio-exploration-body")
      .innerText();
    streamError = await panel
      .locator(".sentio-thought")
      .first()
      .locator(".sentio-exploration-error")
      .count();
    console.log("Stream result:", {
      characters: streamed.length,
      error: !!streamError,
    });
    await page.screenshot({
      path: path.join(folder, "real-followup-response.png"),
    });
    assert.equal(streamError, 0, "Live follow-up failed");
    assert.ok(streamed.length > 100);
    await panel
      .locator(".sentio-thought")
      .first()
      .getByRole("button", { name: "처음 카드로 돌아가기", exact: true })
      .click();
    assert.equal(
      await panel
        .locator(".sentio-thought")
        .first()
        .locator(":scope > h3")
        .textContent(),
      cardTitle,
    );
  }
  // Verify native image, TOC and memo controls, then standalone offline reading.
  await panel.locator('.sentio-panel-header button[aria-label="닫기"]').click();
  await page.locator("#reader-design-select").selectOption("0");
  const toc = page.locator(".rd-left .ui-toc-item").last();
  await toc.click();
  await page.waitForTimeout(300);
  assert.ok(
    await page
      .locator("[data-reading-content] h3")
      .last()
      .evaluate((el) => Math.abs(el.getBoundingClientRect().top) < 180),
  );
  const originalHash = new URL(page.url()).hash;
  await page.locator('a[href="#article-discussion"]').click();
  await page.waitForTimeout(300);
  assert.equal(new URL(page.url()).hash, originalHash);
  assert.equal(await page.locator("[data-spark-inline-wrapper]").count(), 30);
  assert.ok(
    await page
      .locator("#article-discussion")
      .evaluate((el) => Math.abs(el.getBoundingClientRect().top) < 180),
  );
  await page.keyboard.press("Alt+a");
  await page.locator('.fn-reading-settings[data-state="open"]').waitFor();
  await page.getByRole("button", { name: "명조", exact: true }).click();
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("fieldnotes.reading.v1")).font,
    ),
    "serif",
  );
  await page.getByRole("button", { name: "고딕", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Alt+z");
  await page
    .getByRole("button", { name: "집중 모드 종료", exact: true })
    .click();
  await page.locator("[data-reading-content] img").first().click();
  await page.getByTestId("lightbox-image").waitFor();
  await page.keyboard.press("Escape");
  await page.getByTestId("lightbox-image").waitFor({ state: "hidden" });
  const memoButton = page
    .getByRole("button", { name: "메모 열기", exact: true })
    .first();
  if (await memoButton.count()) {
    await memoButton.click();
    await page.waitForTimeout(250);
    assert.ok(
      await page.locator("ai-memo-pad").evaluate((el) => !!el.shadowRoot),
    );
  }
  const offline = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    locale: "ko-KR",
  });
  offline.on("pageerror", (error) => errors.push(error.message));
  await offline.route("https://**", (route) => route.abort());
  await offline.goto(
    "file://" + path.resolve(folder, "../reader-all-designs.html"),
  );
  await offline
    .locator("[data-reading-content] .sentio-trigger")
    .first()
    .waitFor({ timeout: 60000 });
  assert.equal(
    await offline.locator("[data-reading-content] .sentio-trigger").count(),
    30,
  );
  assert.equal(
    await offline
      .locator("[data-reading-content] img")
      .first()
      .evaluate((el) => el.complete && el.naturalWidth > 0),
    true,
  );
  await offline.close();
  assert.equal(errors.length, 0, errors.join("\n"));
  await fs.writeFile(
    path.join(folder, "results.json"),
    JSON.stringify(
      {
        checks,
        originalParagraphs: content.length,
        originalHeadings: headings.length,
        actualCardCount: cardCount,
        actualCardTitle: cardTitle,
        realStreamCharacters: streamed.length,
        realStreamSucceeded:
          process.env.READER_VERIFY_LAYOUT_ONLY === "1" ? null : !streamError,
        notePersistence: true,
        selection: true,
        standaloneOfflineReading: true,
        nativeTocAndDiscussionNavigation: true,
        nativeReadingSettingsAndFocus: true,
        api,
        errors,
      },
      null,
      2,
    ),
  );
  console.log("All actual-reader checks passed:", checks.length);
} catch (error) {
  await fs.writeFile(
    path.join(folder, "failure.json"),
    JSON.stringify({ error: String(error), checks, api, errors }, null, 2),
  );
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
