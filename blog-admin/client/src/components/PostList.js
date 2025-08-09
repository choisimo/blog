import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  PencilIcon,
  TrashIcon,
  EyeIcon,
  PlusIcon,
  CloudArrowUpIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

function PostList() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [deployStatus, setDeployStatus] = useState(null);
  const [deploying, setDeploying] = useState(false);

  useEffect(() => {
    fetchPosts();
    fetchMetadata();
    fetchDeployStatus();
  }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/posts');
      setPosts(response.data);
    } catch (error) {
      toast.error('게시글을 불러오는데 실패했습니다.');
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetadata = async () => {
    try {
      const response = await axios.get('/api/metadata');
      setCategories(response.data.categories);
    } catch (error) {
      console.error('Error fetching metadata:', error);
    }
  };

  const fetchDeployStatus = async () => {
    try {
      const response = await axios.get('/api/deploy/status');
      setDeployStatus(response.data);
    } catch (error) {
      console.error('Error fetching deploy status:', error);
    }
  };

  const handleQuickDeploy = async () => {
    if (!deployStatus?.hasChanges) {
      toast.error('배포할 변경 사항이 없습니다.');
      return;
    }

    try {
      setDeploying(true);
      const response = await axios.post('/api/deploy', {
        message: '게시글 관리에서 빠른 배포'
      });
      
      toast.success(response.data.message);
      setTimeout(fetchDeployStatus, 2000);
    } catch (error) {
      toast.error(error.response?.data?.error || '배포에 실패했습니다.');
    } finally {
      setDeploying(false);
    }
  };
  const deletePost = async (year, slug) => {
    if (window.confirm('정말로 이 게시글을 삭제하시겠습니까?')) {
      try {
        await axios.delete(`/api/posts/${year}/${slug}`);
        toast.success('게시글이 삭제되었습니다.');
        fetchPosts();
      } catch (error) {
        toast.error('게시글 삭제에 실패했습니다.');
        console.error('Error deleting post:', error);
      }
    }
  };

  const filteredPosts = posts.filter(post => {
    const matchesSearch = post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         post.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || post.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <h1 className="text-3xl font-bold text-gray-900">게시글 관리</h1>
        <div className="flex flex-col sm:flex-row gap-2">
          {deployStatus?.hasChanges && (
            <button
              onClick={handleQuickDeploy}
              disabled={deploying}
              className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-bold py-2 px-4 rounded-lg flex items-center"
            >
              <CloudArrowUpIcon className="h-5 w-5 mr-2" />
              {deploying ? '배포 중...' : '빠른 배포'}
            </button>
          )}
          <Link
            to="/posts/new"
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg flex items-center"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            새 게시글
          </Link>
        </div>
      </div>

      {/* Deploy Status Banner */}
      {deployStatus && (
        <div className={`rounded-lg p-4 mb-6 ${
          deployStatus.hasChanges 
            ? 'bg-orange-50 border border-orange-200' 
            : 'bg-green-50 border border-green-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {deployStatus.hasChanges ? (
                <ExclamationTriangleIcon className="h-6 w-6 text-orange-600" />
              ) : (
                <CloudArrowUpIcon className="h-6 w-6 text-green-600" />
              )}
              <div>
                <p className={`font-medium ${
                  deployStatus.hasChanges ? 'text-orange-800' : 'text-green-800'
                }`}>
                  {deployStatus.hasChanges 
                    ? `${deployStatus.files.length}개 파일이 변경되어 배포가 필요합니다` 
                    : '모든 변경사항이 배포되었습니다'
                  }
                </p>
                <p className={`text-sm ${
                  deployStatus.hasChanges ? 'text-orange-600' : 'text-green-600'
                }`}>
                  브랜치: {deployStatus.branch}
                </p>
              </div>
            </div>
            <button
              onClick={fetchDeployStatus}
              className="p-2 text-gray-500 hover:text-gray-700 rounded-md"
              title="상태 새로고침"
            >
              <ArrowPathIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Search and Filter */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
              검색
            </label>
            <input
              type="text"
              id="search"
              placeholder="제목 또는 내용으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
              카테고리
            </label>
            <select
              id="category"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">모든 카테고리</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Posts List */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            총 {filteredPosts.length}개의 게시글
          </h2>
        </div>
        
        {filteredPosts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            게시글이 없습니다.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredPosts.map((post) => (
              <div key={post.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {post.title}
                      </h3>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {post.category}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                      {post.excerpt}
                    </p>
                    <div className="mt-2 flex items-center text-sm text-gray-500 space-x-4">
                      <span>{post.date}</span>
                      <span>{post.readTime}</span>
                      <span>{post.year}/{post.slug}</span>
                    </div>
                    {post.tags && post.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {post.tags.map(tag => (
                          <span
                            key={tag}
                            className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    <a
                      href={`http://localhost:3000/blog/${post.year}/${post.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                      title="미리보기"
                    >
                      <EyeIcon className="h-5 w-5" />
                    </a>
                    <Link
                      to={`/posts/edit/${post.year}/${post.slug}`}
                      className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors"
                      title="편집"
                    >
                      <PencilIcon className="h-5 w-5" />
                    </Link>
                    <button
                      onClick={() => deletePost(post.year, post.slug)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      title="삭제"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default PostList;