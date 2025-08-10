import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  CloudArrowUpIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

function DeployPanel() {
  const [deployStatus, setDeployStatus] = useState(null);
  const [deploying, setDeploying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [commitMessage, setCommitMessage] = useState('');

  useEffect(() => {
    fetchDeployStatus();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchDeployStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchDeployStatus = async () => {
    try {
      const response = await axios.get('/api/deploy/status');
      setDeployStatus(response.data);
    } catch (error) {
      console.error('Error fetching deploy status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeploy = async () => {
    if (!deployStatus?.hasChanges) {
      toast.error('배포할 변경 사항이 없습니다.');
      return;
    }

    try {
      setDeploying(true);
      const response = await axios.post('/api/deploy', {
        message: commitMessage || undefined,
        remote: 'blog'
      });
      
      toast.success(response.data.message);
      setCommitMessage('');
      
      // Refresh status after deployment
      setTimeout(fetchDeployStatus, 2000);
    } catch (error) {
      toast.error(error.response?.data?.error || '배포에 실패했습니다.');
      console.error('Deploy error:', error);
    } finally {
      setDeploying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">배포 관리</h1>
        <button
          onClick={fetchDeployStatus}
          className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg flex items-center"
        >
          <ArrowPathIcon className="h-5 w-5 mr-2" />
          새로고침
        </button>
      </div>

      {/* Status Card */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">배포 상태</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center">
              <ClockIcon className="h-6 w-6 text-gray-600 mr-2" />
              <div>
                <p className="text-sm text-gray-600">브랜치</p>
                <p className="font-semibold">{deployStatus?.branch || 'main'}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center">
              {deployStatus?.hasChanges ? (
                <ExclamationCircleIcon className="h-6 w-6 text-orange-600 mr-2" />
              ) : (
                <CheckCircleIcon className="h-6 w-6 text-green-600 mr-2" />
              )}
              <div>
                <p className="text-sm text-gray-600">변경 사항</p>
                <p className="font-semibold">
                  {deployStatus?.hasChanges ? `${deployStatus.files.length}개 파일` : '없음'}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center">
              <CloudArrowUpIcon className="h-6 w-6 text-blue-600 mr-2" />
              <div>
                <p className="text-sm text-gray-600">동기화</p>
                <p className="font-semibold">
                  {deployStatus?.ahead > 0 ? `${deployStatus.ahead}개 커밋 앞섬` : '최신'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Changed Files */}
        {deployStatus?.files && deployStatus.files.length > 0 && (
          <div className="mb-6">
            <h3 className="text-md font-medium text-gray-900 mb-2">변경된 파일</h3>
            <div className="bg-gray-50 rounded-lg p-4 max-h-40 overflow-y-auto">
              {deployStatus.files.map((file, index) => (
                <div key={index} className="flex items-center py-1">
                  <span className={`inline-block w-2 h-2 rounded-full mr-3 ${
                    file.working_dir === 'M' ? 'bg-blue-500' :
                    file.working_dir === 'A' ? 'bg-green-500' :
                    file.working_dir === 'D' ? 'bg-red-500' : 'bg-gray-500'
                  }`}></span>
                  <span className="text-sm font-mono">{file.path}</span>
                  <span className="ml-auto text-xs text-gray-500">
                    {file.working_dir === 'M' ? '수정됨' :
                     file.working_dir === 'A' ? '추가됨' :
                     file.working_dir === 'D' ? '삭제됨' : '변경됨'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Deploy Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">배포하기</h2>
        
        {deployStatus?.hasChanges ? (
          <div>
            <div className="mb-4">
              <label htmlFor="commitMessage" className="block text-sm font-medium text-gray-700 mb-2">
                커밋 메시지 (선택사항)
              </label>
              <input
                type="text"
                id="commitMessage"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="커밋 메시지를 입력하세요 (비어있으면 자동 생성)"
              />
            </div>
            
            <button
              onClick={handleDeploy}
              disabled={deploying}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-3 px-6 rounded-lg flex items-center"
            >
              <CloudArrowUpIcon className="h-5 w-5 mr-2" />
              {deploying ? '배포 중...' : 'GitHub Pages에 배포'}
            </button>
            
            <p className="text-sm text-gray-600 mt-2">
              * 배포가 완료되면 GitHub Actions가 자동으로 사이트를 빌드하고 업데이트합니다.
            </p>
          </div>
        ) : (
          <div className="text-center py-8">
            <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-900 mb-2">모든 변경 사항이 배포되었습니다!</p>
            <p className="text-gray-600">새로운 게시글을 작성하거나 기존 게시글을 수정하면 배포할 수 있습니다.</p>
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="bg-white rounded-lg shadow-md p-6 mt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">빠른 링크</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a
            href="https://github.com/actions"
            target="_blank"
            rel="noopener noreferrer"
            className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <h3 className="font-medium text-gray-900">GitHub Actions</h3>
            <p className="text-sm text-gray-600">배포 상태 확인하기</p>
          </a>
          <a
            href="https://your-blog-url.github.io"
            target="_blank"
            rel="noopener noreferrer"
            className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <h3 className="font-medium text-gray-900">라이브 사이트</h3>
            <p className="text-sm text-gray-600">배포된 블로그 보기</p>
          </a>
        </div>
      </div>
    </div>
  );
}

export default DeployPanel;