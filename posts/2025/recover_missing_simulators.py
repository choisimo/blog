import os
import re

posts_dir = "/home/nodove/workspace/blog/frontend/public/posts/2025"

# Find all markdown files that don't have a corresponding simulator.html
md_files = [f for f in os.listdir(posts_dir) if f.startswith("algo-") and f.endswith(".md")]

for md_file in md_files:
    algo_id_match = re.search(r'algo-(\d+)', md_file)
    if not algo_id_match:
        continue
    
    algo_id = algo_id_match.group(1)
    base_name = md_file[:-3] # remove .md
    html_file = f"{base_name}-simulator.html"
    html_path = os.path.join(posts_dir, html_file)
    
    # If the simulator already exists, skip it
    if os.path.exists(html_path):
        continue
    
    # Extract Title from markdown
    md_path = os.path.join(posts_dir, md_file)
    title = base_name.replace('-', ' ').title()
    try:
        with open(md_path, 'r', encoding='utf-8') as f:
            for line in f:
                if line.startswith('title:'):
                    title = line.split('title:')[1].strip().strip('"').strip("'")
                    break
    except Exception as e:
        print(f"Error reading {md_file}: {e}")

    # Generate a basic template for the missing simulators
    
    html_content = f"""<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <link rel="stylesheet" href="./ide-engine.css">
    <style>
        /* Base styles from the unified template */
        body {{
            background: var(--bg);
            color: var(--text);
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }}
        .card {{
            background: var(--panel);
            border: 1px solid var(--border);
            border-radius: 8px;
            width: 100%;
            max-width: 800px;
            padding: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        }}
        .header {{
            text-align: center;
            margin-bottom: 20px;
        }}
        .header h2 {{ margin: 0; color: #fff; }}
        .header .sub {{ color: #888; font-size: 0.9em; }}
        
        /* Placeholder visualization area */
        .viz {{
            min-height: 200px;
            background: #1e1e1e;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #888;
            font-style: italic;
            margin-bottom: 20px;
        }}
        
        /* Controls placeholder */
        .controls {{
            display: flex;
            justify-content: center;
            gap: 10px;
        }}
        button {{
            background: var(--primary);
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
        }}
        button:hover {{ background: var(--primary-h); }}
        
        .status-log {{
            margin-top: 15px;
            padding: 10px;
            background: #1e1e1e;
            border-left: 3px solid var(--accent);
            color: #ccc;
        }}
    </style>
</head>
<body>

<div class="card">
    <div class="header">
        <h2>{title} Simulator</h2>
        <div class="sub">Custom simulation logic pending restoration</div>
    </div>
    
    <div class="viz" id="viz">
        [Visualization Placeholder] This simulation logic is being recovered.
    </div>
    
    <div class="status-log" id="log">
        Status: Simulator Pending
    </div>
    
    <div class="controls">
        <button disabled>Prev</button>
        <button disabled>Play / Pause</button>
        <button disabled>Next</button>
    </div>
</div>

<!-- Incorporate new IDE Engine -->
<script src="./ide-engine.js"></script>
<script>
    // Initialize IDE engine safely
    document.addEventListener("DOMContentLoaded", () => {{
        if (typeof window.IDEEngine !== 'undefined') {{
            window.IDEEngine.init({{
                sourceCode: `# {title}\\n# Simulation logic is currently pending recovery.\\n\\ndef solve():\\n    pass\\n`,
                liveVariables: {{
                    status: "Pending Recovery"
                }}
            }});
        }}
    }});
</script>

</body>
</html>
"""
    try:
        with open(html_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
        print(f"Recovered generic placeholder: {html_file}")
    except Exception as e:
        print(f"Failed to write {html_file}: {e}")

print("Recovery generation complete.")
