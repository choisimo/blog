# Blog Writing Guide

## Quick Start

### 1. Install Recommended Extensions

VSCode will prompt you to install recommended extensions when you open the project.
Or manually install:

```bash
code --install-extension mushan.vscode-paste-image
code --install-extension yzhang.markdown-all-in-one
```

### 2. Create a New Post

**Option A: Using the script**
```bash
./scripts/new-post.sh "my-post-title" "DevOps"
```

**Option B: Using VSCode snippets**
1. Create a new `.md` file in `frontend/public/posts/YEAR/`
2. Type `newpost` and press Tab
3. Fill in the template

## Available Snippets

| Prefix | Description |
|--------|-------------|
| `newpost` | Full blog post template |
| `simplepost` | Simple post template |
| `essay` | Essay/creative writing template |
| `tutorial` | Tutorial/guide template |
| `algorithm` | Algorithm post template |
| `img` | Insert image path |
| `imgcap` | Image with caption |
| `code` | Code block |
| `note` | Callout/note block |
| `toc` | Table of contents |
| `h2` | Section header |
| `h3` | Subsection header |
| `series` | Series navigation links |
| `ref` | References section |

## Image Handling

### Drag & Drop / Paste

1. Copy an image to clipboard
2. Press `Ctrl+Alt+V` (or `Cmd+Alt+V` on Mac)
3. Image auto-saves to `frontend/public/images/[post-name]/`
4. Markdown link auto-inserts at cursor

### Manual Insert

Use the `img` snippet:
```markdown
![alt text](/images/post-name/image.png)
```

## File Structure

```
frontend/public/
├── posts/
│   └── 2025/
│       └── my-post.md
└── images/
    └── 2025/
        └── my-post/
            └── screenshot.png
```

## Frontmatter Fields

| Field | Required | Description |
|-------|----------|-------------|
| `title` | Yes | Post title |
| `date` | Yes | YYYY-MM-DD format |
| `category` | Yes | Post category |
| `tags` | Yes | Array of tags |
| `excerpt` | Yes | Short summary |
| `readTime` | No | Estimated read time |
| `author` | No | Author name |
| `published` | No | true/false |

## Categories

- 기술, Java, DevOps, Algorithm, 시스템, 개발
- 철학-and-사유, Network, Linux, Database, AI, Web
