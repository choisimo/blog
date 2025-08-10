import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  PlusIcon,
  DocumentDuplicateIcon,
  CloudArrowUpIcon
} from '@heroicons/react/24/outline';

function GitPanel() {
  const [gitStatus, setGitStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');

  useEffect(() => {
    fetchGitStatus();
  }, []);

  const fetchGitStatus = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/git/status');
      setGitStatus(response.data);
    } catch (error) {
      toast.error('Git 상태를 불러오는데 실패했습니다.');
      console.error('Error fetching git status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    try {
      setLoading(true);
      await axios.post('/api/git/add');
      toast.success('파일이 스테이징되었습니다.');
      fetchGitStatus();
    } catch (error) {
      toast.error('파일 스테이징에 실패했습니다.');
      console.error('Error adding files:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) {
      toast.error('커밋 메시지를 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      await axios.post('/api/git/commit', { message: commitMessage });
      toast.success('변경사항이 커밋되었습니다.');
      setCommitMessage('');
      fetchGitStatus();
    } catch (error) {
      toast.error('커밋에 실패했습니다.');
      console.error('Error committing:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePush = async () => {
    try {
      setLoading(true);
      await axios.post('/api/git/push', { remote: 'blog' });
      toast.success('변경사항이 푸시되었습니다.');
      fetchGitStatus();
    } catch (error) {
      toast.error('푸시에 실패했습니다.');
      console.error('Error pushing:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'M':
      case 'modified':
        return <ExclamationCircleIcon className="h-5 w-5 text-yellow-500" />;
      case 'A':
      case 'added':
        return <PlusIcon className="h-5 w-5 text-green-500" />;
      case 'D':
      case 'deleted':
        return <ExclamationCircleIcon className="h-5 w-5 text-red-500" />;
      default:
        return <CheckCircleIcon className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'M':
      case 'modified':
        return '수정됨';
      case 'A':
      case 'added':
        return '추가됨';
      case 'D':
      case 'deleted':
        return '삭제됨';
      default:
        return '알 수 없음';
    }
  };

  if (loading && !gitStatus) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Git 관리</h1>
        <button
          onClick={fetchGitStatus}
          disabled={loading}
          className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded-lg"
        >
          {loading ? '새로고침 중...' : '새로고침'}
        </button>
      </div>

      {/* Git Actions */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Git 작업</h2>
        
        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <button
            onClick={handleAdd}
            disabled={loading}
            className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50"
          >
            <PlusIcon className="h-8 w-8 text-gray-400 mr-2" />
            <div>
              <div className="font-medium text-gray-900">Add</div>
              <div className="text-sm text-gray-500">변경사항 스테이징</div>
            </div>
          </button>

          <button
            onClick={handleCommit}
            disabled={loading || !commitMessage.trim()}
            className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors disabled:opacity-50"
          >
            <DocumentDuplicateIcon className="h-8 w-8 text-gray-400 mr-2" />
            <div>
              <div className="font-medium text-gray-900">Commit</div>
              <div className="text-sm text-gray-500">변경사항 커밋</div>
            </div>
          </button>

          <button
            onClick={handlePush}
            disabled={loading}
            className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors disabled:opacity-50"
          >
            <CloudArrowUpIcon className="h-8 w-8 text-gray-400 mr-2" />
            <div>
              <div className="font-medium text-gray-900">Push</div>
              <div className="text-sm text-gray-500">원격 저장소 푸시</div>
            </div>
          </button>
        </div>

        {/* Commit Message */}
        <div className="mb-4">
          <label htmlFor="commitMessage" className="block text-sm font-medium text-gray-700 mb-2">
            커밋 메시지
          </label>
          <input
            type="text"
            id="commitMessage"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="예: Add new blog post about React hooks"
          />
        </div>

        {/* One-click deploy */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">원클릭 배포</h3>
          <p className="text-sm text-blue-700 mb-3">
            Add → Commit → Push를 한 번에 실행합니다.
          </p>
          <button
            onClick={async () => {
              const message = commitMessage || `Update blog posts - ${new Date().toLocaleString('ko-KR')}`;
              setCommitMessage(message);
              
              try {
                setLoading(true);
                await handleAdd();
                await new Promise(resolve => setTimeout(resolve, 1000));
                await axios.post('/api/git/commit', { message });
                await new Promise(resolve => setTimeout(resolve, 1000));
                await handlePush();
                toast.success('배포가 완료되었습니다!');
              } catch (error) {
                toast.error('배포 중 오류가 발생했습니다.');
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-2 px-4 rounded-lg"
          >
            {loading ? '배포 중...' : '배포하기'}
          </button>
        </div>
      </div>

      {/* Git Status */}
      {gitStatus && (
        <div className="bg-white rounded-lg shadow-md">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Git 상태</h2>
          </div>
          
          <div className="p-6">
            {/* Current Branch */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-900 mb-2">현재 브랜치</h3>
              <div className="bg-gray-100 rounded-md px-3 py-2">
                <code className="text-sm font-mono">{gitStatus.current}</code>
              </div>
            </div>

            {/* Staged Files */}
            {gitStatus.staged && gitStatus.staged.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-900 mb-2">
                  스테이징된 파일 ({gitStatus.staged.length})
                </h3>
                <div className="space-y-2">
                  {gitStatus.staged.map((file, index) => (
                    <div key={index} className="flex items-center space-x-3 p-2 bg-green-50 rounded-md">
                      {getStatusIcon('added')}
                      <span className="text-sm font-mono">{file}</span>
                      <span className="text-xs text-green-600">스테이징됨</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Modified Files */}
            {gitStatus.modified && gitStatus.modified.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-900 mb-2">
                  수정된 파일 ({gitStatus.modified.length})
                </h3>
                <div className="space-y-2">
                  {gitStatus.modified.map((file, index) => (
                    <div key={index} className="flex items-center space-x-3 p-2 bg-yellow-50 rounded-md">
                      {getStatusIcon('modified')}
                      <span className="text-sm font-mono">{file}</span>
                      <span className="text-xs text-yellow-600">{getStatusText('modified')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Untracked Files */}
            {gitStatus.not_added && gitStatus.not_added.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-900 mb-2">
                  추적되지 않는 파일 ({gitStatus.not_added.length})
                </h3>
                <div className="space-y-2">
                  {gitStatus.not_added.map((file, index) => (
                    <div key={index} className="flex items-center space-x-3 p-2 bg-gray-50 rounded-md">
                      {getStatusIcon('untracked')}
                      <span className="text-sm font-mono">{file}</span>
                      <span className="text-xs text-gray-600">추적되지 않음</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Clean Status */}
            {(!gitStatus.staged || gitStatus.staged.length === 0) &&
             (!gitStatus.modified || gitStatus.modified.length === 0) &&
             (!gitStatus.not_added || gitStatus.not_added.length === 0) && (
              <div className="text-center py-8">
                <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">모든 변경사항이 커밋되었습니다</h3>
                <p className="text-gray-500">워킹 디렉토리가 깨끗합니다.</p>
              </div>
            )}

            {/* Ahead/Behind */}
            {gitStatus.ahead > 0 && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-700">
                  원격 저장소보다 {gitStatus.ahead}개의 커밋이 앞서 있습니다. Push를 실행하세요.
                </p>
              </div>
            )}
            
            {gitStatus.behind > 0 && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-700">
                  원격 저장소보다 {gitStatus.behind}개의 커밋이 뒤처져 있습니다. Pull을 실행해야 합니다.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default GitPanel;