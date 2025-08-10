const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const simpleGit = require('simple-git');
const moment = require('moment');
const matter = require('gray-matter');
const slugify = require('slugify');
const axios = require('axios');
require('dotenv').config();

// Google AI SDK
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 5000;

// AI Configuration
const AI_PROVIDER = process.env.AI_PROVIDER || 'template';
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash-lite';

// Session-based configuration storage
let sessionConfigs = new Map();

// Configuration file path
const CONFIG_FILE = path.join(__dirname, 'ai-config.json');

// Default configuration
const DEFAULT_CONFIG = {
  provider: 'template',
  apiKeys: {
    gemini: '',
    openrouter: ''
  },
  models: {
    openrouter: 'google/gemini-2.5-flash-lite'
  },
  lastUpdated: new Date().toISOString()
};

// Configuration management functions
function loadConfigFromFile() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const configData = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const config = JSON.parse(configData);
      console.log('✅ AI configuration loaded from file');
      return { ...DEFAULT_CONFIG, ...config };
    }
  } catch (error) {
    console.error('❌ Error loading config file:', error);
  }
  console.log('📝 Using default AI configuration');
  return DEFAULT_CONFIG;
}

function saveConfigToFile(config) {
  try {
    const configToSave = {
      ...config,
      lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(configToSave, null, 2));
    console.log('✅ AI configuration saved to file');
    return true;
  } catch (error) {
    console.error('❌ Error saving config file:', error);
    return false;
  }
}

// Load configuration on startup
let persistentConfig = loadConfigFromFile();

// Initialize Google AI if API key is provided
let googleAI = null;
if (GOOGLE_AI_API_KEY) {
  try {
    googleAI = new GoogleGenerativeAI(GOOGLE_AI_API_KEY);
  } catch (error) {
    console.error('Error initializing Google AI:', error);
  }
}

// AI Service Classes
class AIService {
  static getSessionConfig(sessionId) {
    const sessionConfig = sessionConfigs.get(sessionId) || {};
    // Merge with persistent config and environment variables
    return {
      provider: sessionConfig.provider || persistentConfig.provider || AI_PROVIDER,
      apiKeys: {
        gemini: sessionConfig.apiKeys?.gemini || persistentConfig.apiKeys?.gemini || GOOGLE_AI_API_KEY || '',
        openrouter: sessionConfig.apiKeys?.openrouter || persistentConfig.apiKeys?.openrouter || OPENROUTER_API_KEY || ''
      },
      models: {
        openrouter: sessionConfig.models?.openrouter || persistentConfig.models?.openrouter || OPENROUTER_MODEL
      }
    };
  }

  static setSessionConfig(sessionId, config) {
    sessionConfigs.set(sessionId, config);
    // Also update persistent config
    persistentConfig = { ...persistentConfig, ...config };
    saveConfigToFile(persistentConfig);
  }

  static getEffectiveConfig(sessionId = 'default') {
    return this.getSessionConfig(sessionId);
  }

  static async generateContent(prompt, type, currentContent, title, sessionId = 'default') {
    const sessionConfig = this.getSessionConfig(sessionId);
    const provider = sessionConfig.provider || AI_PROVIDER;
    
    switch (provider) {
      case 'gemini':
        return await this.generateWithGemini(prompt, type, currentContent, title, sessionConfig);
      case 'openrouter':
        return await this.generateWithOpenRouter(prompt, type, currentContent, title, sessionConfig);
      default:
        return this.generateWithTemplate(prompt, type, currentContent, title);
    }
  }

  static async generateWithGemini(prompt, type, currentContent, title, sessionConfig = {}) {
    const apiKey = sessionConfig.apiKeys?.gemini || GOOGLE_AI_API_KEY;
    
    if (!apiKey) {
      throw new Error('Google AI API key not configured');
    }

    try {
      let geminiAI = googleAI;
      if (sessionConfig.apiKeys?.gemini && sessionConfig.apiKeys.gemini !== GOOGLE_AI_API_KEY) {
        geminiAI = new GoogleGenerativeAI(sessionConfig.apiKeys.gemini);
      }

      const model = geminiAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
      
      const systemPrompt = this.getSystemPrompt(type, currentContent, title);
      const fullPrompt = `${systemPrompt}\n\n사용자 요청: ${prompt}`;

      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Gemini API error:', error);
      throw new Error('Google Gemini API 호출에 실패했습니다');
    }
  }

  static async generateWithOpenRouter(prompt, type, currentContent, title, sessionConfig = {}) {
    const apiKey = sessionConfig.apiKeys?.openrouter || OPENROUTER_API_KEY;
    const model = sessionConfig.models?.openrouter || OPENROUTER_MODEL;
    
    if (!apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    try {
      const systemPrompt = this.getSystemPrompt(type, currentContent, title);
      
      const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:5000',
          'X-Title': 'Blog Admin AI Assistant'
        }
      });

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('OpenRouter API error:', error.response?.data || error.message);
      
      // 404 오류 시 구체적인 오류 메시지 제공
      if (error.response?.status === 404) {
        throw new Error(`Model '${model}' not found on OpenRouter. Please check if the model exists and is accessible.`);
      }
      
      // 401 오류 시 API 키 문제
      if (error.response?.status === 401) {
        throw new Error('Invalid OpenRouter API key. Please check your API key configuration.');
      }
      
      // 기타 오류
      throw new Error(`OpenRouter API 호출에 실패했습니다: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  static generateWithTemplate(prompt, type, currentContent, title) {
    // 기존 템플릿 기반 생성 (fallback)
    switch (type) {
      case 'title':
        return generateTitle(prompt);
      case 'content':
        return generateContent(prompt, currentContent);
      case 'summary':
        return generateSummary(prompt, currentContent);
      case 'improve':
        return improveContent(prompt, currentContent);
      case 'outline':
        return generateOutline(prompt);
      default:
        return generateContent(prompt, currentContent);
    }
  }

  static getSystemPrompt(type, currentContent, title) {
    const basePrompt = `당신은 한국어 기술 블로그 작성 전문가입니다. 명확하고 이해하기 쉬운 한국어로 답변해주세요.`;
    
    switch (type) {
      case 'title':
        return `${basePrompt} 
        
주어진 내용에 대한 매력적이고 SEO 친화적인 블로그 제목을 생성해주세요. 
제목은:
- 50자 이내로 작성
- 클릭하고 싶게 만드는 매력적인 표현 사용
- 기술적 정확성 유지
- 검색 최적화 고려

제목만 답변해주세요.`;

      case 'content':
        return `${basePrompt}

당신은 한국의 실무 개발자를 위한 기술 블로그를 작성하는 전문가입니다.

**작성 규칙:**
1. 요청받은 주제에 정확히 맞는 내용만 작성하세요
2. 실무에서 바로 적용할 수 있는 구체적이고 실용적인 내용을 포함하세요
3. 코드 예시는 실제 동작하는 코드로 작성하세요
4. 한국어로 명확하고 이해하기 쉽게 작성하세요
5. 마크다운 형식을 사용하세요

**콘텐츠 구조:**
# 제목 (요청 주제와 정확히 일치)

## 개요
- 주제의 핵심 개념 설명
- 왜 중요한지, 언제 사용하는지
- 이 글에서 다룰 내용 간략 소개

## 주요 내용
- 단계별 상세 설명
- 실제 코드 예시와 설명
- 주의사항 및 베스트 프랙티스
- 실무 팁

## 실제 예제
- 완전한 예제 코드
- 단계별 구현 과정
- 결과 확인 방법

## 트러블슈팅
- 자주 발생하는 문제와 해결법
- 디버깅 팁

## 정리
- 핵심 포인트 요약
- 추가 학습 방향 제시

${currentContent ? `\n현재 기존 내용: ${currentContent}\n기존 내용을 참고하되, 요청된 새로운 내용에 집중하여 작성하세요.` : ''}
${title ? `\n글 제목: ${title}` : ''}

**중요:** 요청받은 주제와 다른 내용으로 벗어나지 마세요. 정확히 요청된 내용에 대해서만 작성하세요.`;

      case 'summary':
        return `${basePrompt}

다음 콘텐츠의 핵심을 요약해주세요:

기존 콘텐츠: ${currentContent}

요약 요구사항:
- 150-200자 이내로 간결하게
- 핵심 내용과 가치를 포함
- 기술 블로그 소개글에 적합한 톤앤매너
- 독자가 읽고 싶어지는 매력적인 문구

요약문만 답변해주세요.`;

      case 'improve':
        return `${basePrompt}

다음 콘텐츠를 개선해주세요:

기존 콘텐츠: ${currentContent}

개선 방향:
1. 가독성과 이해도 향상
2. 더 구체적이고 실용적인 정보 추가
3. 코드 예시 개선 (있다면)
4. 문장 구조와 흐름 개선
5. 실무 관점의 팁 추가

**중요:** 기존 내용의 핵심 주제와 의도는 유지하면서 품질만 향상시키세요.
전체 개선된 콘텐츠를 마크다운 형식으로 답변해주세요.`;

      case 'outline':
        return `${basePrompt}

주어진 주제에 대한 상세한 블로그 포스트 개요를 작성해주세요.

개요 구조:
# 제목
## 1. 개요 (예상 분량: 200-300자)
   - 주제 소개
   - 중요성 및 활용도
   
## 2. 기본 개념 (예상 분량: 400-500자)
   - 핵심 개념 설명
   - 관련 용어 정리
   
## 3. 실습/구현 (예상 분량: 800-1000자)
   - 단계별 구현 과정
   - 코드 예시
   
## 4. 응용 사례 (예상 분량: 400-500자)
   - 실무 적용 사례
   - 베스트 프랙티스
   
## 5. 트러블슈팅 (예상 분량: 300-400자)
   - 자주 발생하는 문제
   - 해결 방법
   
## 6. 정리 (예상 분량: 200-300자)
   - 핵심 요약
   - 다음 단계

각 섹션별로 구체적인 내용 방향을 제시해주세요.`;

      default:
        return basePrompt;
    }
  }

  static async fetchOpenRouterModels(apiKey = null) {
    try {
      const key = apiKey || OPENROUTER_API_KEY;
      if (!key) {
        return [];
      }

      const response = await axios.get('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data.data.map(model => ({
        id: model.id,
        name: model.name || model.id,
        description: model.description,
        pricing: model.pricing,
        context_length: model.context_length,
        architecture: model.architecture,
        top_provider: model.top_provider
      }));
    } catch (error) {
      console.error('Error fetching OpenRouter models:', error);
      return [];
    }
  }
}

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
    publishTime: data.publishTime || moment().format('YYYY-MM-DD HH:mm:ss'),
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
    const { title, content, excerpt, category, tags, year, publishTime } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }
    
    // Validate publishTime for new posts
    if (publishTime) {
      const publishMoment = moment(publishTime);
      const now = moment();
      
      if (publishMoment.isBefore(now)) {
        return res.status(400).json({ 
          error: '새 게시글의 발행 시간은 현재 시간 이후로 설정해야 합니다 (예약 게시).' 
        });
      }
      
      if (publishMoment.isAfter(now.clone().add(1, 'year'))) {
        return res.status(400).json({ 
          error: '발행 시간은 1년 이내로 설정해주세요.' 
        });
      }
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
      publishTime: publishTime || moment().format('YYYY-MM-DD HH:mm:ss'),
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
    const { title, content, excerpt, category, tags, publishTime } = req.body;
    
    const filePath = path.join(POSTS_DIR, year, `${slug}.md`);
    
    if (!await fs.pathExists(filePath)) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    const postData = {
      title,
      excerpt: excerpt || content.substring(0, 200) + '...',
      category: category || '기술',
      tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()) : []),
      publishTime: publishTime || moment().format('YYYY-MM-DD HH:mm:ss'),
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
    const { branch = 'main', remote = 'blog' } = req.body;
    await git.push(remote, branch);
    res.json({ message: 'Changes pushed successfully' });
  } catch (error) {
    console.error('Git push error:', error);
    res.status(500).json({ error: 'Failed to push changes' });
  }
});

// Auto-deploy post to GitHub Pages
app.post('/api/deploy', async (req, res) => {
  try {
    const { message, remote = 'blog' } = req.body;
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
    await git.push(remote, 'main');
    
    res.json({ 
      message: '게시글이 성공적으로 배포되었습니다!',
      commitMessage,
      deployUrl: 'https://github.com/choisimo/blog/actions'
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

// Category management API
app.get('/api/categories', async (req, res) => {
  try {
    const configPath = path.join(__dirname, 'config', 'categories.json');
    
    let categories = ['기술', '사고와 인식', '개발', '리뷰']; // default categories
    
    if (await fs.pathExists(configPath)) {
      const config = await fs.readJson(configPath);
      categories = config.categories || categories;
    }
    
    res.json({ categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

app.post('/api/categories', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    
    const configDir = path.join(__dirname, 'config');
    const configPath = path.join(configDir, 'categories.json');
    
    await fs.ensureDir(configDir);
    
    let categories = ['기술', '사고와 인식', '개발', '리뷰']; // default categories
    
    if (await fs.pathExists(configPath)) {
      const config = await fs.readJson(configPath);
      categories = config.categories || categories;
    }
    
    const newCategory = name.trim();
    if (categories.includes(newCategory)) {
      return res.status(409).json({ error: 'Category already exists' });
    }
    
    categories.push(newCategory);
    await fs.writeJson(configPath, { categories }, { spaces: 2 });
    
    res.json({ message: 'Category added successfully', categories });
  } catch (error) {
    console.error('Error adding category:', error);
    res.status(500).json({ error: 'Failed to add category' });
  }
});

app.put('/api/categories/:oldName', async (req, res) => {
  try {
    const { oldName } = req.params;
    const { name } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    
    const configDir = path.join(__dirname, 'config');
    const configPath = path.join(configDir, 'categories.json');
    
    await fs.ensureDir(configDir);
    
    let categories = ['기술', '사고와 인식', '개발', '리뷰']; // default categories
    
    if (await fs.pathExists(configPath)) {
      const config = await fs.readJson(configPath);
      categories = config.categories || categories;
    }
    
    const newName = name.trim();
    const oldIndex = categories.indexOf(oldName);
    
    if (oldIndex === -1) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    if (categories.includes(newName) && newName !== oldName) {
      return res.status(409).json({ error: 'Category with new name already exists' });
    }
    
    categories[oldIndex] = newName;
    await fs.writeJson(configPath, { categories }, { spaces: 2 });
    
    // Update all posts that use this category
    const years = await fs.readdir(POSTS_DIR);
    let updatedCount = 0;
    
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
        
        if (parsed.data.category === oldName) {
          parsed.data.category = newName;
          const updatedContent = matter.stringify(parsed.content, parsed.data);
          await fs.writeFile(filePath, updatedContent, 'utf-8');
          updatedCount++;
        }
      }
    }
    
    res.json({ 
      message: 'Category updated successfully', 
      categories,
      updatedPosts: updatedCount
    });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

app.delete('/api/categories/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const { replacementCategory = '기술' } = req.body;
    
    const configDir = path.join(__dirname, 'config');
    const configPath = path.join(configDir, 'categories.json');
    
    await fs.ensureDir(configDir);
    
    let categories = ['기술', '사고와 인식', '개발', '리뷰']; // default categories
    
    if (await fs.pathExists(configPath)) {
      const config = await fs.readJson(configPath);
      categories = config.categories || categories;
    }
    
    const categoryIndex = categories.indexOf(name);
    
    if (categoryIndex === -1) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    // Don't allow deleting if it's the last category
    if (categories.length <= 1) {
      return res.status(400).json({ error: 'Cannot delete the last category' });
    }
    
    categories.splice(categoryIndex, 1);
    await fs.writeJson(configPath, { categories }, { spaces: 2 });
    
    // Update all posts that use this category to use replacement category
    const years = await fs.readdir(POSTS_DIR);
    let updatedCount = 0;
    
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
        
        if (parsed.data.category === name) {
          parsed.data.category = replacementCategory;
          const updatedContent = matter.stringify(parsed.content, parsed.data);
          await fs.writeFile(filePath, updatedContent, 'utf-8');
          updatedCount++;
        }
      }
    }
    
    res.json({ 
      message: 'Category deleted successfully', 
      categories,
      updatedPosts: updatedCount,
      replacementCategory
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// AI Writing Assistant API
app.post('/api/ai/generate-content', async (req, res) => {
  try {
    const { prompt, type = 'content', currentContent = '', title = '', apiKeys = {}, models = {} } = req.body;
    const sessionId = req.headers['x-session-id'] || 'default';
    
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Update session config with client-provided API keys
    if (Object.keys(apiKeys).length > 0 || Object.keys(models).length > 0) {
      AIService.setSessionConfig(sessionId, { apiKeys, models });
    }

    let generatedContent;
    
    try {
      generatedContent = await AIService.generateContent(prompt, type, currentContent, title, sessionId);
    } catch (aiError) {
      console.error('AI generation error:', aiError);
      // Fallback to template-based generation
      generatedContent = AIService.generateWithTemplate(prompt, type, currentContent, title);
    }
    
    const sessionConfig = AIService.getSessionConfig(sessionId);
    const provider = sessionConfig.provider || AI_PROVIDER;
    
    res.json({ 
      content: generatedContent,
      type,
      provider: provider,
      timestamp: moment().toISOString()
    });
  } catch (error) {
    console.error('Error generating AI content:', error);
    res.status(500).json({ 
      error: 'Failed to generate content', 
      details: error.message,
      provider: AI_PROVIDER 
    });
  }
});

// AI Configuration endpoint
app.get('/api/ai/config', async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'] || 'default';
    const effectiveConfig = AIService.getEffectiveConfig(sessionId);
    
    const config = {
      provider: effectiveConfig.provider,
      availableProviders: {
        template: {
          available: true,
          name: 'Template Generator',
          description: 'Simple template-based content generation',
          status: 'ready'
        },
        gemini: {
          available: Boolean(effectiveConfig.apiKeys?.gemini),
          name: 'Google Gemini',
          description: 'Google\'s advanced AI model',
          status: effectiveConfig.apiKeys?.gemini ? 'configured' : 'needs-key'
        },
        openrouter: {
          available: Boolean(effectiveConfig.apiKeys?.openrouter),
          name: 'OpenRouter',
          description: 'Access to multiple AI models via OpenRouter',
          status: effectiveConfig.apiKeys?.openrouter ? 'configured' : 'needs-key'
        }
      },
      models: {
        openrouter: effectiveConfig.models?.openrouter
      },
      currentSettings: {
        provider: effectiveConfig.provider,
        hasGeminiKey: Boolean(effectiveConfig.apiKeys?.gemini),
        hasOpenRouterKey: Boolean(effectiveConfig.apiKeys?.openrouter)
      },
      configSource: {
        persistent: Boolean(fs.existsSync(CONFIG_FILE)),
        environment: Boolean(GOOGLE_AI_API_KEY || OPENROUTER_API_KEY)
      }
    };
    
    res.json(config);
  } catch (error) {
    console.error('Error fetching AI config:', error);
    res.status(500).json({ error: 'Failed to fetch AI configuration', details: error.message });
  }
});

// Get OpenRouter models
app.get('/api/ai/openrouter/models', async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'] || 'default';
    const effectiveConfig = AIService.getEffectiveConfig(sessionId);
    const apiKey = effectiveConfig.apiKeys?.openrouter;
    
    if (!apiKey) {
      return res.status(400).json({ error: 'OpenRouter API key not configured' });
    }
    
    const models = await AIService.fetchOpenRouterModels(apiKey);
    res.json({ models });
  } catch (error) {
    console.error('Error fetching OpenRouter models:', error);
    res.status(500).json({ error: 'Failed to fetch models', details: error.message });
  }
});

// Update AI configuration (persistent)
app.post('/api/ai/config', async (req, res) => {
  try {
    const { provider, apiKeys, models, persistent = true } = req.body;
    const sessionId = req.headers['x-session-id'] || 'default';
    
    // Validate input
    const validProviders = ['template', 'gemini', 'openrouter'];
    if (provider && !validProviders.includes(provider)) {
      return res.status(400).json({ error: 'Invalid provider specified' });
    }
    
    // Prepare configuration
    const newConfig = {
      provider: provider || 'template',
      apiKeys: {
        gemini: apiKeys?.gemini || '',
        openrouter: apiKeys?.openrouter || ''
      },
      models: {
        openrouter: models?.openrouter || 'google/gemini-2.5-flash-lite'
      }
    };
    
    // Store configuration
    AIService.setSessionConfig(sessionId, newConfig);
    
    // Test API keys if provided
    const testResults = {};
    if (newConfig.apiKeys.gemini) {
      try {
        const testAI = new GoogleGenerativeAI(newConfig.apiKeys.gemini);
        const model = testAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
        await model.generateContent('Test');
        testResults.gemini = { status: 'success', message: 'API key validated' };
      } catch (error) {
        testResults.gemini = { status: 'error', message: 'Invalid API key' };
      }
    }
    
    if (newConfig.apiKeys.openrouter) {
      try {
        await axios.get('https://openrouter.ai/api/v1/models', {
          headers: { 'Authorization': `Bearer ${newConfig.apiKeys.openrouter}` }
        });
        testResults.openrouter = { status: 'success', message: 'API key validated' };
      } catch (error) {
        testResults.openrouter = { status: 'error', message: 'Invalid API key' };
      }
    }
    
    // Get updated effective config
    const effectiveConfig = AIService.getEffectiveConfig(sessionId);
    
    res.json({
      message: persistent ? '설정이 영구적으로 저장되었습니다' : '설정이 현재 세션에 적용되었습니다',
      config: {
        provider: effectiveConfig.provider,
        availableProviders: {
          template: {
            available: true,
            name: 'Template Generator',
            status: 'ready'
          },
          gemini: {
            available: Boolean(effectiveConfig.apiKeys?.gemini),
            name: 'Google Gemini',
            status: effectiveConfig.apiKeys?.gemini ? 'configured' : 'needs-key'
          },
          openrouter: {
            available: Boolean(effectiveConfig.apiKeys?.openrouter),
            name: 'OpenRouter',
            status: effectiveConfig.apiKeys?.openrouter ? 'configured' : 'needs-key'
          }
        },
        models: effectiveConfig.models
      },
      testResults,
      saved: persistent
    });
  } catch (error) {
    console.error('Error updating AI config:', error);
    res.status(500).json({ error: 'Failed to update AI configuration', details: error.message });
  }
});

// AI Helper Functions (Template-based generation)
function generateTitle(prompt) {
  const titles = [
    `${prompt}에 대한 완벽 가이드`,
    `${prompt}: 실무에서 배운 것들`,
    `${prompt} 마스터하기`,
    `${prompt}의 이해와 활용`,
    `${prompt} 깊이 파보기`,
    `실전 ${prompt} 경험담`,
    `${prompt} 트러블슈팅 가이드`,
    `${prompt}로 개발 생산성 높이기`
  ];
  
  return titles[Math.floor(Math.random() * titles.length)];
}

function generateContent(prompt, currentContent) {
  const templates = {
    tech: `# ${prompt}

## 개요
${prompt}에 대해 다루어보겠습니다.

## 주요 특징
- 특징 1
- 특징 2
- 특징 3

## 사용법

\`\`\`javascript
// 코드 예시
console.log('Hello World');
\`\`\`

## 장단점

### 장점
- 장점 1
- 장점 2

### 단점
- 단점 1
- 단점 2

## 결론
${prompt}에 대한 정리...`,

    tutorial: `# ${prompt} 튜토리얼

## 시작하기 전에
이 튜토리얼을 통해 ${prompt}을 배워보겠습니다.

## 단계별 가이드

### 1단계: 준비
필요한 도구들을 준비합니다.

### 2단계: 설치
\`\`\`bash
npm install example
\`\`\`

### 3단계: 설정
기본 설정을 진행합니다.

### 4단계: 실행
실제로 실행해보겠습니다.

## 마무리
${prompt}에 대해 배웠습니다.`,

    review: `# ${prompt} 리뷰

## 사용 배경
${prompt}을 사용하게 된 배경을 설명합니다.

## 실제 사용 경험

### 좋았던 점
- 좋은 점 1
- 좋은 점 2

### 아쉬웠던 점
- 아쉬운 점 1
- 아쉬운 점 2

## 추천도
전반적인 추천도: ⭐⭐⭐⭐⭐

## 마무리
${prompt}에 대한 최종 의견...`
  };
  
  // Simple keyword matching for template selection
  if (prompt.includes('튜토리얼') || prompt.includes('가이드') || prompt.includes('방법')) {
    return templates.tutorial;
  } else if (prompt.includes('리뷰') || prompt.includes('사용기') || prompt.includes('경험')) {
    return templates.review;
  } else {
    return templates.tech;
  }
}

function generateSummary(prompt, content) {
  if (!content) {
    return `${prompt}에 대한 요약을 작성해주세요.`;
  }
  
  // Extract first few sentences as summary
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const summary = sentences.slice(0, 3).join('. ') + '.';
  
  return summary.length > 200 ? summary.substring(0, 200) + '...' : summary;
}

function improveContent(prompt, content) {
  if (!content) {
    return `개선할 내용을 입력해주세요.`;
  }
  
  // Simple content improvement suggestions
  return `${content}

## 개선 제안
- 더 구체적인 예시 추가
- 코드 샘플 보완
- 실용적인 팁 추가
- 관련 리소스 링크 제공

## 추가 고려사항
${prompt}에 대한 추가적인 내용을 고려해보세요.`;
}

function generateOutline(prompt) {
  return `# ${prompt} 개요

## 1. 서론
- ${prompt} 소개
- 필요성 및 배경

## 2. 본론
### 2.1 기본 개념
- 핵심 개념 설명
- 주요 특징

### 2.2 실무 적용
- 구체적인 사용법
- 실제 예시

### 2.3 심화 내용
- 고급 기능
- 최적화 방법

## 3. 결론
- 핵심 내용 정리
- 향후 계획

## 참고 자료
- 관련 문서
- 유용한 링크`;
}

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