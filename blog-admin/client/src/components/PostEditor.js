import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import moment from 'moment';
import {
  DocumentTextIcon,
  EyeIcon,
  ArrowUpTrayIcon,
  CloudArrowUpIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

function PostEditor() {
  const { year, slug } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(year && slug);
  
  // Generate session ID for AI configuration
  const [sessionId] = useState(() => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  });

  const [post, setPost] = useState({
    title: '',
    content: '',
    excerpt: '',
    category: '기술',
    tags: [],
    year: moment().format('YYYY'),
    date: moment().format('YYYY-MM-DD'),
    publishTime: moment().format('YYYY-MM-DD HH:mm:ss')
  });
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [activeTab, setActiveTab] = useState('edit');
  const [categories, setCategories] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [autoSave, setAutoSave] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [validationErrors, setValidationErrors] = useState([]);
  const [aiAssistant, setAiAssistant] = useState({
    isOpen: false,
    loading: false,
    prompt: '',
    type: 'content'
  });
  const [aiConfig, setAiConfig] = useState({
    provider: 'template',
    availableProviders: {}
  });
  const [aiSettings, setAiSettings] = useState({
    isOpen: false,
    provider: 'template',
    apiKeys: {
      gemini: '',
      openrouter: ''
    },
    models: {
      openrouter: 'google/gemini-2.5-flash-lite'
    },
    availableModels: {
      openrouter: []
    }
  });
  const [managedCategories, setManagedCategories] = useState([]);
  const [categoryManager, setCategoryManager] = useState({
    isOpen: false,
    newCategory: '',
    editingCategory: null,
    editName: ''
  });

  // Auto-save functionality
  const autoSavePost = useCallback(async () => {
    if (!autoSave || !hasUnsavedChanges || !post.title.trim() || !post.content.trim()) {
      return;
    }

    try {
      const postData = {
        ...post,
        excerpt: post.excerpt || post.content.substring(0, 200) + '...'
      };

      if (isEditing) {
        await axios.put(`/api/posts/${year}/${slug}`, postData);
        setHasUnsavedChanges(false);
        toast.success('자동 저장됨', { duration: 2000 });
      }
    } catch (error) {
      console.error('Auto-save error:', error);
    }
  }, [autoSave, hasUnsavedChanges, post, isEditing, year, slug]);

  // Validation
  const validatePost = useCallback(() => {
    const errors = [];
    
    if (!post.title.trim()) {
      errors.push('제목을 입력해주세요.');
    }
    
    if (post.title.length > 100) {
      errors.push('제목은 100자 이하로 입력해주세요.');
    }
    
    if (!post.content.trim()) {
      errors.push('내용을 입력해주세요.');
    }
    
    if (post.content.length < 50) {
      errors.push('내용은 최소 50자 이상 입력해주세요.');
    }
    
    if (!post.category) {
      errors.push('카테고리를 선택해주세요.');
    }
    
    // Validate publish time for scheduled posts
    if (post.publishTime) {
      const publishMoment = moment(post.publishTime);
      const now = moment();
      
      if (publishMoment.isBefore(now)) {
        // Allow past dates only for existing posts (editing)
        if (!isEditing) {
          errors.push('발행 시간은 현재 시간 이후로 설정해야 합니다.');
        }
      }
      
      // Check if publish time is too far in the future (optional: max 1 year)
      if (publishMoment.isAfter(now.clone().add(1, 'year'))) {
        errors.push('발행 시간은 1년 이내로 설정해주세요.');
      }
    }
    
    setValidationErrors(errors);
    return errors.length === 0;
  }, [post, isEditing]);

  // Word count
  useEffect(() => {
    const words = post.content.trim().split(/\s+/).filter(word => word.length > 0);
    setWordCount(words.length);
  }, [post.content]);

  // Track changes
  useEffect(() => {
    setHasUnsavedChanges(true);
    validatePost();
  }, [post, validatePost]);

  // Auto-save timer
  useEffect(() => {
    if (autoSave && hasUnsavedChanges) {
      const timer = setTimeout(autoSavePost, 30000); // Auto-save after 30 seconds
      return () => clearTimeout(timer);
    }
  }, [autoSave, hasUnsavedChanges, autoSavePost]);

  useEffect(() => {
    fetchMetadata();
    fetchManagedCategories();
    fetchAIConfig();
    if (isEditing) {
      fetchPost();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, slug, isEditing]);

  const fetchPost = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/posts/${year}/${slug}`);
      setPost({
        ...response.data,
        tags: response.data.tags || [],
        date: response.data.date || moment().format('YYYY-MM-DD'),
        publishTime: response.data.publishTime || moment().format('YYYY-MM-DD HH:mm:ss')
      });
      setHasUnsavedChanges(false);
    } catch (error) {
      toast.error('게시글을 불러오는데 실패했습니다.');
      navigate('/posts');
    } finally {
      setLoading(false);
    }
  };

  const fetchMetadata = async () => {
    try {
      const response = await axios.get('/api/metadata');
      setCategories(response.data.categories);
      setAllTags(response.data.tags);
    } catch (error) {
      console.error('Error fetching metadata:', error);
    }
  };

  const fetchManagedCategories = async () => {
    try {
      const response = await axios.get('/api/categories');
      setManagedCategories(response.data.categories);
    } catch (error) {
      console.error('Error fetching managed categories:', error);
    }
  };

  const fetchAIConfig = async () => {
    try {
      const response = await axios.get('/api/ai/config', {
        headers: { 'x-session-id': sessionId }
      });
      setAiConfig(response.data);
    } catch (error) {
      console.error('Error fetching AI config:', error);
    }
  };

  const fetchOpenRouterModels = async (apiKey = null) => {
    try {
      const headers = { 'x-session-id': sessionId };
      const response = await axios.get('/api/ai/openrouter/models', { headers });
      
      setAiSettings(prev => ({
        ...prev,
        availableModels: {
          ...prev.availableModels,
          openrouter: response.data.models || []
        }
      }));
    } catch (error) {
      console.error('Error fetching OpenRouter models:', error);
      toast.error('OpenRouter 모델 목록을 불러오는데 실패했습니다');
    }
  };

  // AI Assistant Functions
  const generateAIContent = async () => {
    if (!aiAssistant.prompt.trim()) {
      toast.error('프롬프트를 입력해주세요.');
      return;
    }
    
    // Get API settings from localStorage
    const getApiSettings = () => {
      try {
        const stored = localStorage.getItem('ai-settings');
        return stored ? JSON.parse(stored) : { apiKeys: {}, models: {} };
      } catch (error) {
        console.error('Error loading API settings:', error);
        return { apiKeys: {}, models: {} };
      }
    };
    
    try {
      setAiAssistant(prev => ({ ...prev, loading: true }));
      
      const apiSettings = getApiSettings();
      
      // Check if AI is configured
      if (!apiSettings.apiKeys?.gemini && !apiSettings.apiKeys?.openrouter) {
        toast.error('AI 설정이 필요합니다. 설정 페이지에서 API 키를 입력해주세요.');
        setAiAssistant(prev => ({ ...prev, loading: false }));
        return;
      }
      
      const response = await axios.post('/api/ai/generate-content', {
        prompt: aiAssistant.prompt,
        type: aiAssistant.type,
        currentContent: post.content,
        title: post.title,
        apiKeys: apiSettings.apiKeys,
        models: apiSettings.models
      }, {
        headers: { 'x-session-id': sessionId },
        timeout: 30000 // 30 second timeout
      });
      
      const { content: generatedContent, provider } = response.data;
      
      if (!generatedContent || generatedContent.trim() === '') {
        toast.error('AI가 빈 응답을 반환했습니다. 다시 시도해주세요.');
        return;
      }
      
      // Store original content for undo functionality
      const originalContent = {
        title: post.title,
        content: post.content,
        excerpt: post.excerpt
      };
      
      switch (aiAssistant.type) {
        case 'title':
          setPost(prev => ({ ...prev, title: generatedContent }));
          break;
        case 'content':
          setPost(prev => ({ ...prev, content: generatedContent }));
          break;
        case 'summary':
          setPost(prev => ({ ...prev, excerpt: generatedContent }));
          break;
        case 'improve':
          setPost(prev => ({ ...prev, content: generatedContent }));
          break;
        case 'outline':
          setPost(prev => ({ ...prev, content: generatedContent }));
          break;
        default:
          setPost(prev => ({ ...prev, content: generatedContent }));
      }
      
      setAiAssistant(prev => ({ ...prev, prompt: '', isOpen: false }));
      setHasUnsavedChanges(true);
      
      // Show success message with provider info
      toast.success(
        <div>
          <div>AI 콘텐츠가 생성되었습니다!</div>
          <div className="text-xs text-gray-600 mt-1">Provider: {provider || 'Unknown'}</div>
        </div>,
        { duration: 4000 }
      );
      
    } catch (error) {
      console.error('AI generation error:', error);
      
      let errorMessage = 'AI 콘텐츠 생성에 실패했습니다.';
      
      if (error.code === 'ECONNABORTED') {
        errorMessage = 'AI 응답 시간이 초과되었습니다. 다시 시도해주세요.';
      } else if (error.response) {
        const status = error.response.status;
        const data = error.response.data;
        
        if (status === 401) {
          errorMessage = 'API 키가 유효하지 않습니다. 설정을 확인해주세요.';
        } else if (status === 429) {
          errorMessage = 'API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.';
        } else if (status === 500) {
          errorMessage = `서버 오류: ${data.details || data.error || '알 수 없는 오류'}`;
        } else if (data.error) {
          errorMessage = data.error;
        }
      } else if (error.request) {
        errorMessage = '네트워크 연결을 확인해주세요.';
      }
      
      toast.error(errorMessage, { duration: 6000 });
      
    } finally {
      setAiAssistant(prev => ({ ...prev, loading: false }));
    }
  };

  // Category Management Functions
  const handleAddCategory = async () => {
    if (!categoryManager.newCategory.trim()) return;
    
    try {
      const response = await axios.post('/api/categories', {
        name: categoryManager.newCategory.trim()
      });
      
      setManagedCategories(response.data.categories);
      setCategoryManager(prev => ({ ...prev, newCategory: '' }));
      toast.success('카테고리가 추가되었습니다.');
      await fetchMetadata(); // Refresh metadata
    } catch (error) {
      if (error.response?.status === 409) {
        toast.error('이미 존재하는 카테고리입니다.');
      } else {
        toast.error('카테고리 추가에 실패했습니다.');
      }
      console.error('Category add error:', error);
    }
  };

  const handleEditCategory = async (oldName) => {
    if (!categoryManager.editName.trim()) return;
    
    try {
      const response = await axios.put(`/api/categories/${encodeURIComponent(oldName)}`, {
        name: categoryManager.editName.trim()
      });
      
      setManagedCategories(response.data.categories);
      setCategoryManager(prev => ({ ...prev, editingCategory: null, editName: '' }));
      toast.success(`카테고리가 수정되었습니다. ${response.data.updatedPosts}개 게시글이 업데이트되었습니다.`);
      await fetchMetadata(); // Refresh metadata
    } catch (error) {
      if (error.response?.status === 409) {
        toast.error('이미 존재하는 카테고리 이름입니다.');
      } else {
        toast.error('카테고리 수정에 실패했습니다.');
      }
      console.error('Category edit error:', error);
    }
  };

  const handleDeleteCategory = async (categoryName) => {
    if (!window.confirm(`'${categoryName}' 카테고리를 삭제하시겠습니까? 해당 카테고리를 사용하는 모든 게시글은 '기술' 카테고리로 변경됩니다.`)) {
      return;
    }
    
    try {
      const response = await axios.delete(`/api/categories/${encodeURIComponent(categoryName)}`, {
        data: { replacementCategory: '기술' }
      });
      
      setManagedCategories(response.data.categories);
      toast.success(`카테고리가 삭제되었습니다. ${response.data.updatedPosts}개 게시글이 '${response.data.replacementCategory}' 카테고리로 변경되었습니다.`);
      await fetchMetadata(); // Refresh metadata
    } catch (error) {
      toast.error('카테고리 삭제에 실패했습니다.');
      console.error('Category delete error:', error);
    }
  };

  const handleSaveAndDeploy = async () => {
    if (!validatePost()) {
      toast.error('게시글을 확인해주세요.');
      return;
    }

    try {
      setDeploying(true);
      
      // First save the post
      await handleSave();
      
      // Then deploy
      await axios.post('/api/deploy', {
        message: `새 게시글 배포: ${post.title}`
      });
      
      toast.success('게시글이 저장되고 배포되었습니다!');
    } catch (error) {
      toast.error('배포에 실패했습니다.');
      console.error('Deploy error:', error);
    } finally {
      setDeploying(false);
    }
  };

  const handleSave = async () => {
    if (!validatePost()) {
      toast.error('게시글을 확인해주세요.');
      return;
    }

    try {
      setSaving(true);
      const postData = {
        ...post,
        excerpt: post.excerpt || post.content.substring(0, 200) + '...'
      };

      if (isEditing) {
        await axios.put(`/api/posts/${year}/${slug}`, postData);
        toast.success('게시글이 수정되었습니다.');
        setHasUnsavedChanges(false);
      } else {
        const response = await axios.post('/api/posts', postData);
        toast.success('게시글이 생성되었습니다.');
        setHasUnsavedChanges(false);
        navigate(`/posts/edit/${response.data.year}/${response.data.slug}`);
      }
    } catch (error) {
      if (error.response?.status === 409) {
        toast.error('같은 제목의 게시글이 이미 존재합니다.');
      } else {
        toast.error('게시글 저장에 실패했습니다.');
      }
      console.error('Error saving post:', error);
    } finally {
      setSaving(false);
    }
  };

  const addTag = () => {
    if (tagInput.trim() && !post.tags.includes(tagInput.trim())) {
      setPost(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }));
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove) => {
    setPost(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {isEditing ? '게시글 편집' : '새 게시글'}
        </h1>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
          <button
            onClick={() => navigate('/posts')}
            className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg"
          >
            목록으로
          </button>
          <button
            onClick={() => setAiAssistant(prev => ({ ...prev, isOpen: true }))}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg flex items-center"
          >
            ✨ AI 도움
          </button>
          <button
            onClick={() => setAiSettings(prev => ({ ...prev, isOpen: true }))}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center"
          >
            ⚙️ AI 설정
          </button>
          <button
            onClick={() => setCategoryManager(prev => ({ ...prev, isOpen: true }))}
            className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-lg flex items-center"
          >
            📁 카테고리 관리
          </button>
          <button
            onClick={handleSave}
            disabled={saving || validationErrors.length > 0}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-2 px-4 rounded-lg flex items-center"
          >
            <ArrowUpTrayIcon className="h-5 w-5 mr-2" />
            {saving ? '저장 중...' : '저장'}
          </button>
          <button
            onClick={handleSaveAndDeploy}
            disabled={deploying || validationErrors.length > 0 || !isEditing}
            className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-bold py-2 px-4 rounded-lg flex items-center"
          >
            <CloudArrowUpIcon className="h-5 w-5 mr-2" />
            {deploying ? '배포 중...' : '저장 & 배포'}
          </button>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={autoSave}
              onChange={(e) => setAutoSave(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-700">자동 저장</span>
          </label>
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              {hasUnsavedChanges ? (
                <ExclamationTriangleIcon className="h-5 w-5 text-orange-500" />
              ) : (
                <CheckCircleIcon className="h-5 w-5 text-green-500" />
              )}
              <span className="text-sm text-gray-700">
                {hasUnsavedChanges ? '저장되지 않은 변경사항' : '모든 변경사항 저장됨'}
              </span>
            </div>
            <div className="text-sm text-gray-600">
              단어 수: {wordCount}개 | 읽기 시간: 약 {Math.ceil(wordCount / 200)}분
            </div>
          </div>
          
          {validationErrors.length > 0 && (
            <div className="flex items-center space-x-2">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
              <span className="text-sm text-red-600">
                {validationErrors.length}개 문제 발견
              </span>
            </div>
          )}
        </div>
        
        {validationErrors.length > 0 && (
          <div className="mt-3 p-3 bg-red-50 rounded-lg">
            <h4 className="text-sm font-medium text-red-800 mb-2">다음 문제를 해결해주세요:</h4>
            <ul className="text-sm text-red-700 space-y-1">
              {validationErrors.map((error, index) => (
                <li key={index}>• {error}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Meta Information */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">게시글 정보</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              제목 *
            </label>
            <input
              type="text"
              id="title"
              value={post.title}
              onChange={(e) => setPost(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="게시글 제목"
            />
          </div>
          
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
              카테고리
            </label>
            <select
              id="category"
              value={post.category}
              onChange={(e) => setPost(prev => ({ ...prev, category: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {managedCategories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
              <option value="기술">기술</option>
              <option value="사고와 인식">사고와 인식</option>
              <option value="개발">개발</option>
              <option value="리뷰">리뷰</option>
            </select>
          </div>

          <div>
            <label htmlFor="year" className="block text-sm font-medium text-gray-700 mb-2">
              년도
            </label>
            <select
              id="year"
              value={post.year}
              onChange={(e) => setPost(prev => ({ ...prev, year: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isEditing}
            >
              <option value="2025">2025</option>
              <option value="2024">2024</option>
              <option value="2023">2023</option>
            </select>
          </div>

          <div>
            <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
              게시 날짜
            </label>
            <input
              type="date"
              id="date"
              value={post.date}
              onChange={(e) => setPost(prev => ({ ...prev, date: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label htmlFor="publishTime" className="block text-sm font-medium text-gray-700 mb-2">
              발행 시간 (예약 게시)
            </label>
            <input
              type="datetime-local"
              id="publishTime"
              value={post.publishTime ? moment(post.publishTime).format('YYYY-MM-DDTHH:mm') : moment().format('YYYY-MM-DDTHH:mm')}
              onChange={(e) => {
                const newDateTime = e.target.value;
                setPost(prev => ({ 
                  ...prev, 
                  publishTime: newDateTime ? moment(newDateTime).format('YYYY-MM-DD HH:mm:ss') : moment().format('YYYY-MM-DD HH:mm:ss')
                }));
              }}
              min={isEditing ? undefined : moment().format('YYYY-MM-DDTHH:mm')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              {isEditing ? '기존 게시글은 과거 시간 설정 가능' : '새 게시글은 현재 시간 이후만 설정 가능 (예약 게시)'}
            </p>
          </div>

          <div>
            <label htmlFor="readTime" className="block text-sm font-medium text-gray-700 mb-2">
              읽기 시간
            </label>
            <input
              type="text"
              id="readTime"
              value={post.readTime || ''}
              onChange={(e) => setPost(prev => ({ ...prev, readTime: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="ex) 5분"
            />
          </div>
        </div>

        {/* Excerpt */}
        <div className="mt-4">
          <label htmlFor="excerpt" className="block text-sm font-medium text-gray-700 mb-2">
            요약 (생략 시 자동 생성)
          </label>
          <textarea
            id="excerpt"
            rows="2"
            value={post.excerpt}
            onChange={(e) => setPost(prev => ({ ...prev, excerpt: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="게시글 요약..."
          />
        </div>

        {/* Tags */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            태그
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {post.tags.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
              >
                #{tag}
                <button
                  onClick={() => removeTag(tag)}
                  className="ml-2 text-blue-600 hover:text-blue-800"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="태그 입력 후 엔터"
            />
            <button
              onClick={addTag}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
            >
              추가
            </button>
          </div>
          {allTags.length > 0 && (
            <div className="mt-2">
              <p className="text-sm text-gray-600 mb-1">기존 태그:</p>
              <div className="flex flex-wrap gap-1">
                {allTags.slice(0, 10).map(tag => (
                  <button
                    key={tag}
                    onClick={() => {
                      if (!post.tags.includes(tag)) {
                        setPost(prev => ({
                          ...prev,
                          tags: [...prev.tags, tag]
                        }));
                      }
                    }}
                    className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded"
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content Editor */}
      <div className="bg-white rounded-lg shadow-md">
        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('edit')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'edit'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <DocumentTextIcon className="h-5 w-5 inline mr-2" />
              편집
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'preview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <EyeIcon className="h-5 w-5 inline mr-2" />
              미리보기
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'edit' ? (
            <div>
              <textarea
                value={post.content}
                onChange={(e) => setPost(prev => ({ ...prev, content: e.target.value }))}
                className="w-full h-[600px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                placeholder="마크다운으로 내용을 작성하세요..."
              />
              <div className="mt-2 text-sm text-gray-500">
                마크다운 문법을 사용할 수 있습니다. (# 제목, **굵게**, *기울임*, ```코드```, {'>'} 인용 등)
              </div>
            </div>
          ) : (
            <div className="h-[600px] overflow-y-auto border border-gray-200 rounded-md p-6 preview-content bg-white">
              {/* Preview Header */}
              <div className="mb-8 pb-6 border-b border-gray-200">
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                  {post.title || '제목을 입력하세요'}
                </h1>
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                  <span>{post.date ? moment(post.date).format('YYYY년 MM월 DD일') : moment().format('YYYY년 MM월 DD일')}</span>
                  <span>•</span>
                  <span>{post.category || '카테고리'}</span>
                  <span>•</span>
                  <span>약 {Math.ceil(wordCount / 200)}분</span>
                </div>
                {post.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {post.tags.map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Preview Content */}
              <div className="prose prose-lg max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => <h1 className="text-2xl font-bold mb-4 mt-8">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-xl font-bold mb-3 mt-6">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-lg font-semibold mb-2 mt-4">{children}</h3>,
                    p: ({ children }) => <p className="mb-4 leading-7 text-gray-700">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc pl-6 mb-4 space-y-1">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 space-y-1">{children}</ol>,
                    li: ({ children }) => <li className="leading-6">{children}</li>,
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-4 border-blue-500 pl-6 py-2 mb-4 bg-blue-50 italic text-gray-700">
                        {children}
                      </blockquote>
                    ),
                    a: ({ href, children }) => (
                      <a href={href} className="text-blue-600 hover:text-blue-800 underline" target="_blank" rel="noopener noreferrer">
                        {children}
                      </a>
                    ),
                    code({ node, inline, className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || '');
                      return !inline && match ? (
                        <div className="rounded-lg overflow-hidden mb-4">
                          <SyntaxHighlighter
                            style={oneDark}
                            language={match[1]}
                            PreTag="div"
                            className="text-sm"
                            {...props}
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        </div>
                      ) : (
                        <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-red-600" {...props}>
                          {children}
                        </code>
                      );
                    },
                    table: ({ children }) => (
                      <div className="overflow-x-auto mb-4">
                        <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
                          {children}
                        </table>
                      </div>
                    ),
                    thead: ({ children }) => <thead className="bg-gray-50">{children}</thead>,
                    th: ({ children }) => <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{children}</th>,
                    td: ({ children }) => <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{children}</td>,
                  }}
                >
                  {post.content || '*내용을 입력하면 여기에 미리보기가 나타납니다.*'}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI Assistant Modal */}
      {aiAssistant.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">✨ AI 작성 도우미</h3>
                <p className="text-sm text-gray-600">
                  현재 제공자: {aiConfig.availableProviders[aiConfig.provider]?.name || aiConfig.provider}
                  {aiConfig.provider === 'openrouter' && aiConfig.availableProviders.openrouter?.model && 
                    ` (${aiConfig.availableProviders.openrouter.model})`
                  }
                </p>
              </div>
              <button
                onClick={() => setAiAssistant(prev => ({ ...prev, isOpen: false, prompt: '' }))}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  생성 타입
                </label>
                <select
                  value={aiAssistant.type}
                  onChange={(e) => setAiAssistant(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="content">전체 콘텐츠</option>
                  <option value="title">제목</option>
                  <option value="summary">요약</option>
                  <option value="outline">개요</option>
                  <option value="improve">내용 개선</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  AI에게 요청사항
                </label>
                <textarea
                  value={aiAssistant.prompt}
                  onChange={(e) => setAiAssistant(prev => ({ ...prev, prompt: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                  placeholder="예: React Hook에 대한 기술 블로그를 작성해줘"
                />
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={generateAIContent}
                  disabled={!aiAssistant.prompt.trim() || aiAssistant.loading}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-bold py-2 px-4 rounded-lg"
                >
                  {aiAssistant.loading ? '생성 중...' : '생성하기'}
                </button>
                <button
                  onClick={() => setAiAssistant(prev => ({ ...prev, isOpen: false, prompt: '' }))}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Management Modal */}
      {categoryManager.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">📁 카테고리 관리</h3>
              <button
                onClick={() => setCategoryManager(prev => ({ ...prev, isOpen: false, newCategory: '', editingCategory: null, editName: '' }))}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Add Category */}
              <div className="border-b pb-4">
                <h4 className="font-medium text-gray-900 mb-2">새 카테고리 추가</h4>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={categoryManager.newCategory}
                    onChange={(e) => setCategoryManager(prev => ({ ...prev, newCategory: e.target.value }))}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="카테고리 이름"
                  />
                  <button
                    onClick={handleAddCategory}
                    disabled={!categoryManager.newCategory.trim()}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-4 py-2 rounded-md"
                  >
                    추가
                  </button>
                </div>
              </div>
              
              {/* Category List */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2">기존 카테고리</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {managedCategories.map(category => (
                    <div key={category} className="flex items-center justify-between p-2 border border-gray-200 rounded">
                      {categoryManager.editingCategory === category ? (
                        <div className="flex space-x-2 flex-1">
                          <input
                            type="text"
                            value={categoryManager.editName}
                            onChange={(e) => setCategoryManager(prev => ({ ...prev, editName: e.target.value }))}
                            className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <button
                            onClick={() => handleEditCategory(category)}
                            className="text-green-600 hover:text-green-800 text-sm"
                          >
                            저장
                          </button>
                          <button
                            onClick={() => setCategoryManager(prev => ({ ...prev, editingCategory: null, editName: '' }))}
                            className="text-gray-600 hover:text-gray-800 text-sm"
                          >
                            취소
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="text-gray-900">{category}</span>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => setCategoryManager(prev => ({ 
                                ...prev, 
                                editingCategory: category, 
                                editName: category 
                              }))}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              수정
                            </button>
                            <button
                              onClick={() => handleDeleteCategory(category)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              삭제
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-end">
                <button
                  onClick={() => setCategoryManager(prev => ({ ...prev, isOpen: false, newCategory: '', editingCategory: null, editName: '' }))}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Settings Modal */}
      {aiSettings.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">⚙️ AI 모델 설정</h3>
              <button
                onClick={() => setAiSettings(prev => ({ ...prev, isOpen: false }))}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Current Configuration */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">현재 설정</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <div>제공자: {aiConfig.availableProviders[aiConfig.provider]?.name || aiConfig.provider}</div>
                  {aiConfig.provider === 'openrouter' && aiConfig.availableProviders.openrouter?.model && (
                    <div>모델: {aiConfig.availableProviders.openrouter.model}</div>
                  )}
                </div>
              </div>

              {/* Provider Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  AI 제공자 선택
                </label>
                <select
                  value={aiSettings.provider}
                  onChange={(e) => setAiSettings(prev => ({ ...prev, provider: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="template">템플릿 기반 (무료)</option>
                  <option value="gemini">Google Gemini 2.0 Flash</option>
                  <option value="openrouter">OpenRouter AI</option>
                </select>
              </div>

              {/* API Key Settings */}
              {aiSettings.provider === 'gemini' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Google AI API Key
                  </label>
                  <input
                    type="password"
                    value={aiSettings.apiKeys.gemini}
                    onChange={(e) => setAiSettings(prev => ({ 
                      ...prev, 
                      apiKeys: { ...prev.apiKeys, gemini: e.target.value }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Google AI API 키를 입력하세요"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Google AI Studio에서 API 키를 발급받으세요
                  </p>
                </div>
              )}

              {aiSettings.provider === 'openrouter' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      OpenRouter API Key
                    </label>
                    <input
                      type="password"
                      value={aiSettings.apiKeys.openrouter}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setAiSettings(prev => ({ 
                          ...prev, 
                          apiKeys: { ...prev.apiKeys, openrouter: newValue }
                        }));
                        // Load models when API key is entered
                        if (newValue.trim()) {
                          setTimeout(() => fetchOpenRouterModels(newValue), 500);
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="OpenRouter API 키를 입력하세요"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      openrouter.ai에서 API 키를 발급받으세요
                    </p>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        모델 선택
                      </label>
                      <button
                        onClick={() => fetchOpenRouterModels()}
                        className="text-xs text-blue-600 hover:text-blue-800"
                        type="button"
                      >
                        모델 목록 새로고침
                      </button>
                    </div>
                    <select
                      value={aiSettings.models.openrouter}
                      onChange={(e) => setAiSettings(prev => ({ 
                        ...prev, 
                        models: { ...prev.models, openrouter: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {aiSettings.availableModels.openrouter.length > 0 ? (
                        aiSettings.availableModels.openrouter.map(model => (
                          <option key={model.id} value={model.id}>
                            {model.name} 
                            {model.pricing && model.pricing.prompt && 
                              ` ($${(model.pricing.prompt * 1000000).toFixed(2)}/1M tokens)`
                            }
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="google/gemini-flash-1.5">Google Gemini Flash 1.5</option>
                          <option value="google/gemini-pro-1.5">Google Gemini Pro 1.5</option>
                          <option value="anthropic/claude-3-sonnet">Claude 3 Sonnet</option>
                          <option value="anthropic/claude-3-haiku">Claude 3 Haiku</option>
                          <option value="openai/gpt-4o">GPT-4o</option>
                          <option value="openai/gpt-4o-mini">GPT-4o Mini</option>
                          <option value="meta-llama/llama-3.1-8b-instruct">Llama 3.1 8B</option>
                          <option value="meta-llama/llama-3.1-70b-instruct">Llama 3.1 70B</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>
              )}

              {/* Warning for Environment Variables */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start space-x-2">
                  <span className="text-yellow-500 text-sm">⚠️</span>
                  <div className="text-sm text-yellow-700">
                    <strong>주의:</strong> 이 설정은 현재 세션에만 적용됩니다. 
                    영구적인 설정을 위해서는 서버의 환경변수(.env 파일)를 수정해야 합니다.
                    <div className="mt-2 font-mono text-xs bg-yellow-100 p-2 rounded">
                      GOOGLE_AI_API_KEY=your_key_here<br />
                      OPENROUTER_API_KEY=your_key_here<br />
                      OPENROUTER_MODEL=your_model_here<br />
                      AI_PROVIDER=gemini|openrouter|template
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={async () => {
                    try {
                      const response = await axios.post('/api/ai/config', {
                        provider: aiSettings.settings.provider,
                        apiKeys: aiSettings.settings.apiKeys,
                        models: aiSettings.settings.models
                      }, {
                        headers: { 'x-session-id': sessionId }
                      });
                      
                      await fetchAIConfig(); // Refresh config
                      toast.success('설정이 현재 세션에 적용되었습니다');
                      setAiSettings(prev => ({ ...prev, isOpen: false }));
                    } catch (error) {
                      console.error('Error saving AI config:', error);
                      toast.error('설정 저장에 실패했습니다');
                    }
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg"
                >
                  적용
                </button>
                <button
                  onClick={() => setAiSettings(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PostEditor;