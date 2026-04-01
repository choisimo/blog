import os
import re
from bs4 import BeautifulSoup

TARGET_DIR = "/home/nodove/workspace/blog/frontend/public/posts/2025"

files_to_process = [
    "algo-006-valid-anagram-simulator.html",
    "algo-007-lcp-simulator.html",
    "algo-008-merge-sorted-simulator.html",
    "algo-009-compression-simulator.html",
    "algo-010-pascals-triangle-simulator.html",
    "algo-011-reverse-ll-simulator.html",
    "algo-012-cycle-detection-simulator.html"
]

common_css = """
        :root {
            --bg-color: #1e1e1e;
            --panel-bg: #252526;
            --text-color: #d4d4d4;
            --border-color: #3e3e42;
            --primary: #007acc;
            --primary-hover: #005999;
            --accent: #4CAF50;
            --danger: #f44336;
            --highlight: #264f78;
            --swap: #ce9178;
            --success: #22c55e;
            --code-bg: #1e1e1e;
            --code-text: #d4d4d4;
            
            --slow-color: #f59e0b;
            --fast-color: #8b5cf6;
            --prev-color: #ef4444;
            --curr-color: #f59e0b;
            --next-color: #3b82f6;
            
            --p1-color: #f59e0b;
            --p2-color: #8b5cf6;
            --write-color: #10b981;
            --read-color: #3b82f6;
        }

        body {
            font-family: 'Pretendard', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: var(--bg-color);
            color: var(--text-color);
            margin: 0;
            padding: 20px;
            line-height: 1.6;
            display: flex;
            flex-direction: column;
            height: 100vh;
            box-sizing: border-box;
            overflow: hidden;
        }

        .header {
            text-align: center;
            margin-bottom: 20px;
        }

        .header h2 { margin: 0; color: #fff; font-size: 1.5rem; border: none; padding-bottom: 5px; }
        .header p { margin: 5px 0 0 0; color: #aaa; font-size: 0.95rem; }

        .layout {
            display: flex;
            gap: 20px;
            flex: 1;
            min-height: 0;
        }

        .panel {
            background-color: var(--panel-bg);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 20px;
            display: flex;
            flex-direction: column;
            overflow-y: auto;
        }

        .canvas-panel { flex: 2; }
        .code-panel { flex: 1; font-family: 'Consolas', 'Courier New', monospace; font-size: 14px; line-height: 1.5; }

        .badges { margin-bottom: 10px; }
        .badges span { background: #3730a3; color: #e0e7ff; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; margin-right: 5px; display: inline-block;}

        /* Workspace */
        .workspace { background-color: #2d2d30; padding: 15px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid var(--primary); }
        .workspace select { padding: 8px; border-radius: 6px; border: 1px solid var(--border-color); font-size: 0.95rem; background: #1e1e1e; color: #d4d4d4; flex: 1; margin-left:10px; }
        .scenario-bar { display: flex; align-items: center; margin-bottom: 15px; }

        .code-fill-box { background: var(--code-bg); color: var(--code-text); padding: 15px; border-radius: 8px; font-family: monospace; font-size: 0.95rem; line-height: 1.8; margin-top: 10px; }
        .code-fill-box input[type="text"] { background-color: #333; color: #4CAF50; border: 1px solid var(--border-color); padding: 4px 0; font-family: monospace; font-size: 14px; border-radius: 4px; text-align: center; width: 140px; }
        .code-fill-box input.correct { border-color: var(--success); background: rgba(34, 197, 94, 0.2); }
        .code-fill-box input.error { border-color: var(--danger); background: rgba(239, 68, 68, 0.2); }

        .status-msg { margin-top: 10px; font-size: 0.95rem; font-weight: bold; padding: 10px; border-radius: 6px; background: #333337; color: #e2c08d; transition: all 0.3s; text-align: center; }
        .status-msg.success { color: #166534; background: #dcfce7; }
        .status-msg.error { color: #991b1b; background: #fee2e2; }

        /* Visualizer */
        .visualization { display: flex; flex-direction: column; align-items: center; gap: 30px; flex: 1; justify-content: center; padding: 20px; background: #1e1e1e; border-radius: 8px; position: relative; overflow-x: auto; min-height: 250px;}
        
        /* Node & Array Styles for Dark Mode */
        .node { width: 50px; height: 50px; display: flex; flex-direction: column; justify-content: center; align-items: center; background: #333337; border: 2px solid var(--border-color); border-radius: 50%; font-weight: bold; font-size: 1.2rem; transition: all 0.4s; position: relative; z-index: 2; color: #fff;}
        .node.null-node { background: #252526; border-style: dashed; color: #888; font-size: 0.8rem; border-color: #555;}
        .node.active { transform: translateY(-5px); box-shadow: 0 8px 15px rgba(0,0,0,0.3); border-color: var(--curr-color); }
        .node.reversed { background: rgba(34, 197, 94, 0.2); border-color: var(--success); }
        
        .array-container { display: flex; gap: 15px; align-items: center; position: relative; padding: 20px 0;}
        .array-item { width: 45px; height: 45px; background-color: #333337; border: 2px solid var(--border-color); border-radius: 8px; display: flex; justify-content: center; align-items: center; font-size: 1.2rem; font-weight: bold; position: relative; transition: all 0.3s ease; color: #fff;}
        .array-item .index { position: absolute; bottom: -25px; font-size: 0.8rem; color: #888; }
        .array-item .count, .array-item .val { position: absolute; bottom: -25px; font-size: 0.8rem; color: #888; }
        
        .array-item.active { border-color: var(--primary); transform: translateY(-3px); box-shadow: 0 0 10px rgba(0,122,204,0.5); }
        .array-item.read { border-color: var(--read-color); background: rgba(59, 130, 246, 0.2); }
        .array-item.write { border-color: var(--write-color); background: rgba(16, 185, 129, 0.2); }
        
        .pointer-tag { position: absolute; padding: 3px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; color: white; display: flex; flex-direction: column; align-items: center; z-index: 10; transition: all 0.3s; left: 50%; transform: translateX(-50%); white-space: nowrap; }
        .pointer-tag::after { content: ''; position: absolute; border-width: 4px; border-style: solid; }
        .tag-slow { background: var(--slow-color); bottom: -30px; }
        .tag-slow::after { border-color: transparent transparent var(--slow-color) transparent; top: -8px; left: 50%; transform: translateX(-50%); }
        .tag-fast { background: var(--fast-color); top: -30px; }
        .tag-fast::after { border-color: var(--fast-color) transparent transparent transparent; bottom: -8px; left: 50%; transform: translateX(-50%); }
        .tag-prev { background: var(--prev-color); top: -30px; }
        .tag-prev::after { border-color: var(--prev-color) transparent transparent transparent; bottom: -8px; }
        .tag-curr { background: var(--curr-color); bottom: -30px; }
        .tag-curr::after { border-color: transparent transparent var(--curr-color) transparent; top: -8px; }
        .tag-nxt { background: var(--next-color); top: -30px; }
        .tag-nxt::after { border-color: var(--next-color) transparent transparent transparent; bottom: -8px; }

        .ll-container { display: flex; align-items: center; justify-content: flex-start; gap: 20px; width: 100%; max-width: 800px; padding: 20px 0; position: relative; }
        .node-wrapper { display: flex; align-items: center; gap: 10px; position: relative; }
        .arrow-container { width: 30px; height: 20px; position: relative; display: flex; align-items: center; justify-content: center; z-index: 1; }
        .arrow-right { width: 100%; height: 2px; background: #888; position: relative; transition: all 0.3s;}
        .arrow-right::after { content: ''; position: absolute; right: -2px; top: -5px; border-width: 6px; border-style: solid; border-color: transparent transparent transparent #888; }
        .arrow-left { width: 100%; height: 2px; background: var(--success); position: relative; transition: all 0.3s;}
        .arrow-left::after { content: ''; position: absolute; left: -2px; top: -5px; border-width: 6px; border-style: solid; border-color: transparent var(--success) transparent transparent; }
        .arrow-hidden { opacity: 0; }

        /* Controls */
        .controls { display: flex; gap: 10px; justify-content: center; align-items: center; margin-top: 20px; padding: 15px; background-color: #2d2d30; border-radius: 8px; }
        .btn { background-color: var(--primary); color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: bold; transition: background 0.2s; }
        .btn:hover:not(:disabled) { background-color: var(--primary-hover); }
        .btn:disabled { background-color: #555; color: #888; cursor: not-allowed; opacity:1; }
        .btn-outline { background: transparent; border: 1px solid var(--primary); color: var(--primary); }
        .btn-outline:hover:not(:disabled) { background: rgba(0, 122, 204, 0.2); }
        .slider-box { display: flex; align-items: center; gap: 10px; font-size: 0.9rem; color: #aaa; margin-left: 20px; }

        /* Code tracking Tracker Wrapper (Right Panel) */
        .code-display { background: var(--code-bg); color: var(--code-text); padding: 15px; border-radius: 8px; font-family: monospace; font-size: 0.95rem; overflow-x: auto; white-space: pre-wrap; margin: 0; line-height: 1.5; }
        .code-line { padding: 2px 8px; border-left: 3px solid transparent; display: block; border-radius: 0 4px 4px 0;}
        .code-line.active { background-color: var(--highlight); border-left-color: var(--primary); color: #9cdcfe;}
        .watcher { width: 100%; border-collapse: collapse; font-size: 0.85rem; margin-top: 20px;}
        .watcher th, .watcher td { padding: 8px; border: 1px solid var(--border-color); text-align: left; }
        .watcher th { background: #333337; color: #d4d4d4; font-weight: bold; }
        .watcher td { color: #d4d4d4; }
        .tracker-wrapper { display: flex; flex-direction: column; gap: 15px; height: 100%;}
"""

for filename in files_to_process:
    filepath = os.path.join(TARGET_DIR, filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        html = f.read()

    soup = BeautifulSoup(html, 'html.parser')

    # Replace style
    style_tag = soup.find('style')
    if style_tag:
        style_tag.string = common_css

    # Extract original panels
    overview_panel = soup.find('div', class_=lambda x: x and 'panel' in x and 'full-width' in x) # Mostly the first one
    body_container = soup.find('div', class_='container')
    panels = soup.find_all('div', class_='panel')
    
    if len(panels) < 3:
        continue # Not exactly the format

    overview = panels[0] if len(panels) >= 1 else None
    workspace = panels[1] if len(panels) >= 2 else None
    visualizer = panels[2] if len(panels) >= 3 else None
    tracker = panels[3] if len(panels) >= 4 else None
    
    controls = soup.find('div', class_='controls-wrapper') or soup.find('div', class_='controls')
    
    if controls and 'controls-wrapper' in controls['class']:
        inner_controls = controls.find('div', class_='controls')
        if inner_controls:
            controls = inner_controls

    # Start constructing new body
    new_body = soup.new_tag('body')
    
    # Header
    header = soup.new_tag('div', attrs={'class': 'header'})
    title = overview.find('h2') if overview else None
    if title:
        new_title = soup.new_tag('h2')
        new_title.string = title.text.replace('🧠 아키텍처 & 작동 원리: ', '')
        title.extract()
        header.append(new_title)
        
    # Append overview content to header paragraphs
    if overview:
        for p in overview.find_all(['p', 'div']):
            if p.name == 'div' and 'badges' in p.get('class', []):
                header.append(p)
            elif p.name == 'p':
                p_new = soup.new_tag('p')
                # get inner text
                p_new.append(BeautifulSoup(str(p.encode_contents().decode('utf-8')), 'html.parser'))
                header.append(p_new)

    new_body.append(header)
    
    # Layout
    layout = soup.new_tag('div', attrs={'class': 'layout'})
    
    canvas_panel = soup.new_tag('div', attrs={'class': 'panel canvas-panel'})
    
    # Add workspace
    if workspace:
        workspace['class'] = ['workspace']
        ws_title = workspace.find('h2')
        if ws_title:
            ws_div = soup.new_tag('div', attrs={'style': 'margin-bottom: 10px; font-weight: bold; color: #e2c08d;'})
            ws_div.string = ws_title.text
            ws_title.replace_with(ws_div)
        canvas_panel.append(workspace)

    # Add Visualizer
    if visualizer:
        viz_title = visualizer.find('h2')
        if viz_title: viz_title.extract()
        
        # In current design, there is a class "canvas". We just rename it to "visualization"
        canvas_content = visualizer.find('div', class_='canvas')
        if canvas_content:
            canvas_content['class'] = ['visualization']
            canvas_content['id'] = 'visualization'
            
            # Status Box
            status_box = soup.new_tag('div', attrs={'class': 'status-box', 'id': 'status-text'})
            status_box.string = "Initializing simulation..."
            canvas_panel.append(status_box)
            
            canvas_panel.append(canvas_content)

    # Add Controls
    if controls:
        controls['class'] = ['controls']
        canvas_panel.append(controls)
        
    layout.append(canvas_panel)
    
    # Add Tracker
    code_panel = soup.new_tag('div', attrs={'class': 'panel code-panel'})
    if tracker:
        tracker_title = tracker.find('h2')
        if tracker_title: tracker_title.extract()
        tracker['class'] = ['tracker-wrapper']
        code_panel.append(tracker)

    layout.append(code_panel)
    new_body.append(layout)
    
    # Append scripts
    script_tags = soup.find_all('script')
    for script in script_tags:
        new_body.append(script)

    # Replace body in original soup
    old_body = soup.find('body')
    old_body.replace_with(new_body)

    # Overwrite file
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(str(soup))
    print(f"Refactored: {filename}")
