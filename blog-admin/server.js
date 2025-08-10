const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const simpleGit = require('simple-git');
const moment = require('moment');
const matter = require('gray-matter');
const slugify = require('slugify');

const app = express();
const PORT = process.env.PORT || 5000;

// Blog directory paths
const BLOG_DIR = path.join(__dirname, '..');
const POSTS_DIR = path.join(__dirname, '..', 'public', 'posts');

// Initialize git with error handling
let git;
try {
  git = simpleGit(BLOG_DIR);
} catch (error) {
  console.error('Error initializing git:', error);
  // Create a dummy git object that throws helpful errors
  git = {
    status: () => Promise.reject(new Error('Git not properly initialized')),
    add: () => Promise.reject(new Error('Git not properly initialized')),
    commit: () => Promise.reject(new Error('Git not properly initialized')),
    push: () => Promise.reject(new Error('Git not properly initialized'))
  };
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'client/build')));

// Helper functions
function generateSlug(title) {
  return slugify(title, {
    lower: true,
    strict: true,
    remove: /[*+~.()'"!:@]/g
  });
}

function generateFrontmatter(data) {
  const frontmatter = {
    title: data.title,
    excerpt: data.excerpt,
    date: data.date || moment().format('YYYY-MM-DD'),
    category: data.category || '기술',
    tags: Array.isArray(data.tags) ? data.tags : [],
    readTime: data.readTime || calculateReadTime(data.content)
  };
  
  return matter.stringify(data.content, frontmatter);
}

function calculateReadTime(content) {
  const wordsPerMinute = 200;
  const words = content.split(/\s+/).length;
  const minutes = Math.ceil(words / wordsPerMinute);
  return `${minutes}분`;
}

async function updateManifest(year) {
  const yearDir = path.join(POSTS_DIR, year);
  const manifestPath = path.join(yearDir, 'manifest.json');
  
  try {
    const files = await fs.readdir(yearDir);
    const mdFiles = files.filter(file => file.endsWith('.md'));
    
    const manifest = {
      files: mdFiles.sort()
    };
    
    await fs.writeJson(manifestPath, manifest, { spaces: 2 });
    console.log(`Updated manifest for ${year}`);
  } catch (error) {
    console.error(`Error updating manifest for ${year}:`, error);
    throw error;
  }
}

// Routes

// Get all posts
app.get('/api/posts', async (req, res) => {
  try {
    console.log('Fetching posts from:', POSTS_DIR);
    const years = await fs.readdir(POSTS_DIR);
    console.log('Found years:', years);
    const allPosts = [];
    
    for (const year of years) {
      if (year.startsWith('.')) continue;
      
      const yearPath = path.join(POSTS_DIR, year);
      console.log('Processing year directory:', yearPath);
      const stat = await fs.stat(yearPath);
      
      if (!stat.isDirectory()) continue;
      
      const files = await fs.readdir(yearPath);
      const mdFiles = files.filter(file => file.endsWith('.md'));
      console.log(`Found ${mdFiles.length} markdown files in ${year}`);
      
      for (const file of mdFiles) {
        try {
          const filePath = path.join(yearPath, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const parsed = matter(content);
          
          allPosts.push({
            id: `${year}-${file.replace('.md', '')}`,
            filename: file,
            year,
            slug: file.replace('.md', ''),
            ...parsed.data,
            content: parsed.content
          });
        } catch (fileError) {
          console.error(`Error processing file ${file}:`, fileError);
        }
      }
    }
    
    console.log(`Successfully processed ${allPosts.length} posts`);
    
    // Sort by date (newest first)
    allPosts.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    res.json(allPosts);
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ error: 'Failed to fetch posts', details: error.message });
  }
});

// Get single post
app.get('/api/posts/:year/:slug', async (req, res) => {
  try {
    const { year, slug } = req.params;
    const filePath = path.join(POSTS_DIR, year, `${slug}.md`);
    
    const content = await fs.readFile(filePath, 'utf-8');
    const parsed = matter(content);
    
    res.json({
      filename: `${slug}.md`,
      year,
      slug,
      ...parsed.data,
      content: parsed.content
    });
  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(404).json({ error: 'Post not found' });
  }
});

// Create new post
app.post('/api/posts', async (req, res) => {
  try {
    const { title, content, excerpt, category, tags, year } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }
    
    const slug = generateSlug(title);
    const postYear = year || moment().format('YYYY');
    const yearDir = path.join(POSTS_DIR, postYear);
    
    // Ensure year directory exists
    await fs.ensureDir(yearDir);
    
    const filename = `${slug}.md`;
    const filePath = path.join(yearDir, filename);
    
    // Check if file already exists
    if (await fs.pathExists(filePath)) {
      return res.status(409).json({ error: 'Post with this title already exists' });
    }
    
    const postData = {
      title,
      excerpt: excerpt || content.substring(0, 200) + '...',
      category: category || '기술',
      tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()) : []),
      content
    };
    
    const markdownContent = generateFrontmatter(postData);
    
    // Write the file
    await fs.writeFile(filePath, markdownContent, 'utf-8');
    
    // Update manifest
    await updateManifest(postYear);
    
    res.json({
      message: 'Post created successfully',
      filename,
      year: postYear,
      slug,
      path: filePath
    });
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// Update existing post
app.put('/api/posts/:year/:slug', async (req, res) => {
  try {
    const { year, slug } = req.params;
    const { title, content, excerpt, category, tags } = req.body;
    
    const filePath = path.join(POSTS_DIR, year, `${slug}.md`);
    
    if (!await fs.pathExists(filePath)) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    const postData = {
      title,
      excerpt: excerpt || content.substring(0, 200) + '...',
      category: category || '기술',
      tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()) : []),
      content
    };
    
    const markdownContent = generateFrontmatter(postData);
    
    await fs.writeFile(filePath, markdownContent, 'utf-8');
    
    res.json({ message: 'Post updated successfully' });
  } catch (error) {
    console.error('Error updating post:', error);
    res.status(500).json({ error: 'Failed to update post' });
  }
});

// Delete post
app.delete('/api/posts/:year/:slug', async (req, res) => {
  try {
    const { year, slug } = req.params;
    const filePath = path.join(POSTS_DIR, year, `${slug}.md`);
    
    if (!await fs.pathExists(filePath)) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    await fs.remove(filePath);
    await updateManifest(year);
    
    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// Git operations
app.get('/api/git/status', async (req, res) => {
  try {
    const status = await git.status();
    res.json(status);
  } catch (error) {
    console.error('Git status error:', error);
    res.status(500).json({ error: 'Failed to get git status' });
  }
});

app.post('/api/git/add', async (req, res) => {
  try {
    await git.add('.');
    const status = await git.status();
    res.json({ message: 'Files added to staging', status });
  } catch (error) {
    console.error('Git add error:', error);
    res.status(500).json({ error: 'Failed to add files' });
  }
});

app.post('/api/git/commit', async (req, res) => {
  try {
    const { message } = req.body;
    const commitMessage = message || `Add new blog post - ${moment().format('YYYY-MM-DD HH:mm')}`;
    
    await git.commit(commitMessage);
    res.json({ message: 'Changes committed successfully', commitMessage });
  } catch (error) {
    console.error('Git commit error:', error);
    res.status(500).json({ error: 'Failed to commit changes' });
  }
});

app.post('/api/git/push', async (req, res) => {
  try {
    const { branch = 'main' } = req.body;
    await git.push('origin', branch);
    res.json({ message: 'Changes pushed successfully' });
  } catch (error) {
    console.error('Git push error:', error);
    res.status(500).json({ error: 'Failed to push changes' });
  }
});

// Auto-deploy post to GitHub Pages
app.post('/api/deploy', async (req, res) => {
  try {
    const { message } = req.body;
    const commitMessage = message || `새 게시글 자동 배포 - ${moment().format('YYYY-MM-DD HH:mm')}`;
    
    // Generate manifests first
    const years = await fs.readdir(POSTS_DIR);
    for (const year of years) {
      if (year.startsWith('.')) continue;
      const yearPath = path.join(POSTS_DIR, year);
      const stat = await fs.stat(yearPath);
      if (stat.isDirectory()) {
        await updateManifest(year);
      }
    }
    
    // Git operations
    await git.add('.');
    await git.commit(commitMessage);
    await git.push('origin', 'main');
    
    res.json({ 
      message: '게시글이 성공적으로 배포되었습니다!',
      commitMessage,
      deployUrl: 'https://github.com/actions' // Will be updated with actual deploy URL
    });
  } catch (error) {
    console.error('Deploy error:', error);
    res.status(500).json({ error: '배포에 실패했습니다: ' + error.message });
  }
});

// Check deployment status
app.get('/api/deploy/status', async (req, res) => {
  try {
    const status = await git.status();
    const hasChanges = status.files.length > 0;
    
    res.json({ 
      hasChanges,
      files: status.files,
      branch: status.current,
      ahead: status.ahead,
      behind: status.behind
    });
  } catch (error) {
    console.error('Deploy status error:', error);
    res.status(500).json({ error: 'Failed to get deploy status' });
  }
});
app.get('/api/metadata', async (req, res) => {
  try {
    const years = await fs.readdir(POSTS_DIR);
    const categories = new Set();
    const tags = new Set();
    
    for (const year of years) {
      if (year.startsWith('.')) continue;
      
      const yearPath = path.join(POSTS_DIR, year);
      const stat = await fs.stat(yearPath);
      
      if (!stat.isDirectory()) continue;
      
      const files = await fs.readdir(yearPath);
      const mdFiles = files.filter(file => file.endsWith('.md'));
      
      for (const file of mdFiles) {
        const filePath = path.join(yearPath, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const parsed = matter(content);
        
        if (parsed.data.category) categories.add(parsed.data.category);
        if (parsed.data.tags) {
          parsed.data.tags.forEach(tag => tags.add(tag));
        }
      }
    }
    
    res.json({
      categories: Array.from(categories).sort(),
      tags: Array.from(tags).sort()
    });
  } catch (error) {
    console.error('Error fetching metadata:', error);
    res.status(500).json({ error: 'Failed to fetch metadata' });
  }
});

// Serve React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build/index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Blog Admin Server running on port ${PORT}`);
  console.log(`Blog directory: ${BLOG_DIR}`);
});