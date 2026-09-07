"""Isolated CSS checks, not app E2E. Requires Python Playwright plus an installed Chromium.
Usage: python check_css_browser.py /path/to/evidence-directory
Generate reading-css-fixture.html into that directory first with make-css-fixture.mjs.
"""
import json, os, sys, shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
out = Path(sys.argv[1] if len(sys.argv) > 1 else 'reading-evidence').resolve()
if not (out / 'reading-css-fixture.html').is_file():
    raise SystemExit('Generate reading-css-fixture.html into the evidence directory before running this check.')
results = []
with sync_playwright() as p:
    browser_path = os.environ.get('READING_CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('chromium-browser')
    browser = p.chromium.launch(executable_path=browser_path, headless=True)
    for theme in ['light', 'dark', 'terminal']:
        for width in [320, 390, 768, 1440]:
            page = browser.new_page(viewport={'width': width, 'height': 1000}, device_scale_factor=1)
            page.set_content((out/'reading-css-fixture.html').read_text(), wait_until='load')
            page.evaluate('(theme) => document.documentElement.className = theme === "terminal" ? "dark terminal" : theme === "dark" ? "dark" : ""', theme)
            page.locator('.article-image').first.wait_for()
            page.wait_for_function('document.querySelector(".article-image").naturalWidth > 0')
            metrics = page.evaluate('''() => {
              const q=s=>document.querySelector(s), b=s=>q(s).getBoundingClientRect(), style=s=>getComputedStyle(q(s));
              const article=b('.ui-article'), image=b('.article-image'), code=q('.article-code-region'), table=q('.article-table-scroll');
              return {
                articleFits: article.x >= 0 && article.right <= innerWidth && article.width <= 780,
                tableDisplay: style('.article-table-shell table').display,
                tableOverflow: style('.article-table-shell table').overflowX,
                tableScrolls: table.scrollWidth > table.clientWidth,
                codeScrolls: code.scrollWidth > code.clientWidth,
                codeWrap: style('.article-code-highlighter').whiteSpace,
                headingAlignment: style('.article-flow h2').textAlign,
                imageRatio: image.width/image.height,
                imageMargin: style('.article-image').marginTop,
                readingAxisAligned: Math.abs(b('.article-flow > p').x - b('.article-flow > h2').x) < 1,
                targetSize: b('.article-code-toolbar__actions button').width,
                bodyFont: style('.article-flow').fontFamily,
                bodyWidth: document.body.scrollWidth,
                rootWidth: document.documentElement.clientWidth,
              };
            }''')
            checks = {
                'article_fits': metrics['articleFits'],
                'single_table_scroll_owner': metrics['tableDisplay']=='table' and metrics['tableOverflow']=='visible',
                'table_scrolls_locally': metrics['tableScrolls'],
                'unwrapped_code_scrolls_locally': metrics['codeScrolls'] and metrics['codeWrap']=='pre',
                'heading_starts_at_reading_edge': metrics['headingAlignment']=='start',
                'image_has_natural_ratio': abs(metrics['imageRatio']-2)<0.02,
                'image_no_legacy_margin': metrics['imageMargin']=='0px',
                'reading_axis_aligned': metrics['readingAxisAligned'],
                'code_touch_target_44px': metrics['targetSize']>=44,
            }
            if width in [390, 1440] or theme=='light' and width==320:
                page.screenshot(path=str(out/f'{theme}-{width}.png'), full_page=True)
            page.evaluate("document.querySelector('.article-code-card').dataset.wrapped='true'")
            checks['wrapped_code_uses_pre_wrap'] = page.locator('.article-code-highlighter').evaluate("e=>getComputedStyle(e).whiteSpace") == 'pre-wrap'
            page.evaluate("document.querySelector('.fixture-portrait').style.display='block'")
            portrait = page.locator('.fixture-portrait img').bounding_box()
            checks['portrait_has_natural_ratio'] = abs(portrait['height']/portrait['width']-2)<0.02
            # This is CSS viewport containment, not React/Radix event verification.
            page.evaluate("document.body.dataset.scrollLocked='1'; document.body.style.overflow='hidden'; document.querySelectorAll('#viewer,#overlay').forEach(e=>e.classList.remove('fixture-hidden'))")
            modal=page.locator('#viewer').bounding_box()
            checks['viewer_background_not_overridden'] = page.locator('#viewer').evaluate("e=>getComputedStyle(e).backgroundColor")=='rgb(13, 20, 32)'
            checks['modal_fits_viewport'] = modal['x']>=-1 and modal['y']>=-1 and modal['x']+modal['width']<=width+1 and modal['y']+modal['height']<=1001
            controls=page.locator('.ui-image-viewer__tools button').all()
            checks['viewer_controls_44px_visible'] = all((b:=c.bounding_box())['width']>=44 and b['height']>=44 and b['x']>=0 and b['x']+b['width']<=width+1 for c in controls)
            if width==390 and theme=='light': page.screenshot(path=str(out/'image-viewer-mobile.png'))
            results.append({'theme':theme,'width':width,'checks':checks,'metrics':metrics})
            page.close()
    browser.close()
report={'scope':'Isolated repository CSS fixture. NOT a React app or Radix runtime test. Tailwind @apply is not expanded.', 'cases':len(results),'assertions':sum(len(r['checks']) for r in results),'passed':sum(sum(r['checks'].values()) for r in results),'results':results}
(out/'browser-results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps({k:v for k,v in report.items() if k!='results'},ensure_ascii=False,indent=2))
for r in results:
    failed=[k for k,v in r['checks'].items() if not v]
    if failed: print(r['theme'],r['width'],failed,r['metrics'])

if report['passed'] != report['assertions']:
    raise SystemExit(1)
