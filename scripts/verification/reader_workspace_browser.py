"""Exercise the production memo web component without a Vite dependency install.
Requires: Python playwright and Chromium. Network APIs are blocked; no paid calls.
Run: python scripts/verification/reader_workspace_browser.py [light|dark|terminal]
"""
import json, os, sys
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'verification/reader-experience'
OUT.mkdir(parents=True, exist_ok=True)
TEXT = '''# 지능을 쓰는 방식에 관하여\n\n도구가 일을 대신할 수 있게 되면, 우리가 살펴야 할 것은 결과가 바뀌는 순간이다. 더 빨리 만드는 일과 더 나은 판단을 하는 일은 같지 않다.\n\n## 먼저 확인할 것\n\n- 지금 문서에 어떤 가정이 들어 있는가?\n- 변화 뒤에도 남아야 할 조건은 무엇인가?\n- 확인하지 못한 것은 무엇인가?\n\n## 작은 실험\n\n완성된 답부터 고르지 않는다. 입력을 하나 바꿔 보고, 결과가 어디서 달라지는지 기록한다. 이 문서는 그 차이를 모아 둔 메모다.\n\n```python\n# 코드 안의 제목은 목차가 아니다\nprint("observe, then decide")\n```\n\n## 다음에 이어서\n\n실패한 시도도 지우지 않고 남겨두자. 나중에 돌아왔을 때 같은 질문부터 다시 시작하지 않도록.\n'''
# Render local fixture via set_content: this environment blocks all browser navigation.
# Storage is a deterministic Storage-compatible memory adapter, not a real persistence test.
FIXTURE = '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#eaece9;color:#273532;font:16px/1.8 system-ui,sans-serif}main{max-width:700px;margin:8vh auto;padding:30px}h1{font-size:44px;line-height:1.3;letter-spacing:-.04em}small{font-size:12px}html.dark body,html.terminal body{background:#141a18;color:#aebbb5}</style><main><small>nodove · fieldnotes</small><h1>생각을 이어가는 자리.</h1></main></html>'
SOURCE=(ROOT/'frontend/public/ai-memo/ai-memo.js').read_text()
# Inline unchanged production styles, avoiding network navigation entirely.
for name in ['ai-memo.css','memo-workspace.css']:
 css = (ROOT/'frontend/public/ai-memo'/name).read_text()
 replacement = '<style>${' + json.dumps(css) + '}</style>'
 SOURCE=SOURCE.replace('<link rel="stylesheet" href="/ai-memo/'+name+'?v=${AI_MEMO_ASSET_VERSION}" />', replacement)
STORAGE = """class MemoryStorage { constructor(){this.data=new Map()} get length(){return this.data.size} key(i){return Array.from(this.data.keys())[i]||null} getItem(k){return this.data.has(String(k))?this.data.get(String(k)):null} setItem(k,v){this.data.set(String(k),String(v))} removeItem(k){this.data.delete(String(k))} clear(){this.data.clear()} };Object.defineProperty(window,'Storage',{value:MemoryStorage});for(const k of ['localStorage','sessionStorage'])Object.defineProperty(window,k,{value:new MemoryStorage()});"""
results=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
  for theme in [sys.argv[1]] if len(sys.argv)>1 else ['light','dark','terminal']:
   for width in [320,390,1360]:
    ctx=browser.new_context(viewport={'width':width,'height':900}, reduced_motion='reduce',service_workers='block')
    ctx.route('**/*', lambda route: route.abort())
    page=ctx.new_page(); errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(FIXTURE)
    page.evaluate(STORAGE)
    page.evaluate("""(data)=>{document.documentElement.classList.add(data.theme);localStorage.setItem('aiMemo.isOpen','true');localStorage.setItem('aiMemo.content',JSON.stringify(data.text));localStorage.setItem('aiMemo.title',JSON.stringify('판단을 위한 작은 기록'));localStorage.setItem('aiMemo.fontSize','16');localStorage.setItem('aiMemo.window',JSON.stringify({mode:'floating',bounds:{x:150,y:50,width:1060,height:800},previousBounds:null,snap:null}));}""", {'theme':theme,'text':TEXT})
    page.add_script_tag(content=SOURCE)
    panel=page.locator('ai-memo-pad #panel');memo=page.locator('ai-memo-pad #memo')
    expect(panel).to_be_visible();expect(memo).to_have_value(TEXT)
    # Light/dark/terminal theme belongs to the production component.
    page.evaluate('(theme)=>{document.documentElement.classList.remove("light","dark","terminal");document.documentElement.classList.add(theme);document.querySelector("ai-memo-pad").applyThemeFromPage();}',theme)
    page.locator('ai-memo-pad #memoTitleDisplay').click()
    page.locator('ai-memo-pad #memoQuickTitle').fill('새로운 질문의 기록')
    page.locator('ai-memo-pad #memoQuickTitle').press('Enter')
    expect(page.locator('ai-memo-pad #memoTitleDisplay')).to_have_text('새로운 질문의 기록')
    page.locator('ai-memo-pad #memoOutlineToggle').click()
    expect(page.locator('ai-memo-pad #memoOutlineItems button')).to_have_count(4)
    page.locator('ai-memo-pad #memoOutlineItems button').last.click()
    selected=memo.evaluate('(e)=>e.value.slice(e.selectionStart,e.selectionEnd)')
    assert selected.startswith('## 다음에'),selected
    if width<720: expect(page.locator('ai-memo-pad #memoOutline')).to_be_hidden()
    else: page.locator('ai-memo-pad #memoOutlineClose').click()
    memo.focus();memo.press('Control+f')
    search=page.locator('ai-memo-pad #memoFindInput');search.fill('문서')
    expect(page.locator('ai-memo-pad #memoFindCount')).to_have_text('1/2')
    search.press('Enter');expect(page.locator('ai-memo-pad #memoFindCount')).to_have_text('2/2')
    search.press('Escape');expect(page.locator('ai-memo-pad #memoFindBar')).to_be_hidden();expect(panel).to_be_visible()
    expect(page.locator('ai-memo-pad #memoCodeActions')).to_be_hidden()
    page.locator('ai-memo-pad #memoCodeToggle').click();expect(page.locator('ai-memo-pad #codeModeCopy')).to_be_visible()
    page.locator('ai-memo-pad #memoCodeToggle').click()
    before=memo.bounding_box()['height']
    page.locator('ai-memo-pad #memoFocus').click()
    expect(page.locator('ai-memo-pad .memo-toolbar')).to_be_hidden()
    assert memo.bounding_box()['height']>before+65
    memo.press('Escape');expect(page.locator('ai-memo-pad .memo-toolbar')).to_be_visible()
    page.evaluate('()=>window.agentSettingsOpened=0')
    page.evaluate('()=>window.addEventListener("reader:agent-settings",()=>window.agentSettingsOpened++)')
    page.locator('ai-memo-pad #memoAgentSettings').click();assert page.evaluate('window.agentSettingsOpened')==1
    # Autosave failure must not close or falsely announce success.
    page.evaluate('()=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==="aiMemo.content")throw new DOMException("Full","QuotaExceededError");return window.originalSet.call(this,k,v)}}')
    memo.fill(TEXT+'\n저장 실패 검사');memo.blur();expect(page.locator('ai-memo-pad #memoAutoSave')).to_contain_text('저장 실패')
    page.locator('ai-memo-pad #memoSaveClose').click();expect(panel).to_be_visible()
    page.evaluate('()=>{Storage.prototype.setItem=window.originalSet}')
    memo.fill(TEXT);page.locator('ai-memo-pad #memoDraft').click();expect(page.locator('ai-memo-pad #memoAutoSave')).to_have_text('저장됨')
    assert page.evaluate('JSON.parse(localStorage.getItem("aiMemo.content"))')==TEXT
    # No viewport overflow; new motion is disabled by user preference.
    box=panel.bounding_box();assert box['x']>=-1 and box['x']+box['width']<=width+1,box
    assert panel.evaluate('(e)=>getComputedStyle(e).animationName')=='none'
    if width<640: assert abs(box['y'])<1 and abs(box['height']-900)<1,box
    if width>=720:
      page.locator('ai-memo-pad #memoSplitToggle').click();expect(page.locator('ai-memo-pad .memo-preview-pane')).to_be_visible()
      page.locator('ai-memo-pad #memoOutlineToggle').click()
    memo.evaluate('(e)=>e.scrollTop=0')
    page.wait_for_timeout(2100)
    page.screenshot(path=str(OUT/f'memo-{theme}-{width}.png'))
    # Preview tabs and overflow tools remain reachable.
    page.locator('ai-memo-pad .tab[data-tab="preview"]').click();expect(page.locator('ai-memo-pad #memoPreview')).to_be_visible()
    page.locator('ai-memo-pad .tab[data-tab="memo"]').click()
    page.locator('ai-memo-pad .memo-format-tools summary').click()
    expect(page.locator('ai-memo-pad #memoH2')).to_be_visible()
    page.keyboard.press('Escape');expect(panel).to_be_visible()
    assert not errors,errors
    results.append({'theme':theme,'width':width,'checks':'PASS','consoleErrors':errors,'storage':'memory-adapter','memoHeight':round(before)})
    print(json.dumps(results[-1]),flush=True);ctx.close()
  browser.close()
finally:
 (OUT/f'browser-{sys.argv[1] if len(sys.argv)>1 else "all"}.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
