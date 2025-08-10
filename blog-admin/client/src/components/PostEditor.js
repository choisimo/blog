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

  const [post, setPost] = useState({
    title: '',
    content: '',
    excerpt: '',
    category: '기술',
    tags: [],
    year: moment().format('YYYY'),
    date: moment().format('YYYY-MM-DD')
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
    
    setValidationErrors(errors);
    return errors.length === 0;
  }, [post]);

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
        date: response.data.date || moment().format('YYYY-MM-DD')
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

        <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-1 gap-4 mt-4">
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
    </div>
  );
}

export default PostEditor;