import React, { useState } from 'react';
import {
  Eye,
  Edit,
  Trash2,
  Download,
  FileText,
  Clock,
  Hash,
} from 'lucide-react';
import { useDocumentStore } from '../stores/documentStore';

const PostPreview = () => {
  const { generatedPosts, updatePost, deletePost } = useDocumentStore();
  const [expandedPost, setExpandedPost] = useState(null);
  const [editingPost, setEditingPost] = useState(null);
  const [editContent, setEditContent] = useState('');

  const handleEdit = (index, post) => {
    setEditingPost(index);
    setEditContent(post.content);
  };

  const handleSaveEdit = index => {
    updatePost(index, { content: editContent });
    setEditingPost(null);
    setEditContent('');
  };

  const handleCancelEdit = () => {
    setEditingPost(null);
    setEditContent('');
  };

  const handleDownloadSingle = post => {
    const blob = new Blob([post.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = post.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (generatedPosts.length === 0) {
    return (
      <div className='w-full max-w-4xl mx-auto bg-gray-50 rounded-lg p-8 text-center'>
        <FileText className='mx-auto h-12 w-12 text-gray-400 mb-4' />
        <p className='text-gray-600'>
          포스트를 생성하면 여기서 미리보기할 수 있습니다
        </p>
      </div>
    );
  }

  return (
    <div className='w-full max-w-6xl mx-auto'>
      <div className='bg-white rounded-lg shadow-md p-6'>
        <h2 className='text-xl font-bold text-gray-900 mb-4 flex items-center'>
          <Eye className='mr-2 h-5 w-5' />
          생성된 포스트 ({generatedPosts.length}개)
        </h2>

        <div className='space-y-4'>
          {generatedPosts.map((post, index) => (
            <div key={index} className='border rounded-lg'>
              {/* 포스트 헤더 */}
              <div className='p-4 border-b bg-gray-50 flex items-center justify-between'>
                <div className='flex-1'>
                  <h3 className='font-semibold text-gray-900'>
                    {post.frontmatter.title}
                  </h3>
                  <p className='text-sm text-gray-600 mt-1'>
                    파일명: {post.filename}
                  </p>

                  <div className='flex items-center space-x-4 mt-2 text-xs text-gray-500'>
                    <span className='flex items-center'>
                      <Hash className='h-3 w-3 mr-1' />
                      Part {post.frontmatter.part}/{post.frontmatter.totalParts}
                    </span>
                    <span className='flex items-center'>
                      <FileText className='h-3 w-3 mr-1' />
                      {post.metadata.wordCount}단어
                    </span>
                    <span className='flex items-center'>
                      <Clock className='h-3 w-3 mr-1' />
                      {post.metadata.readingTime}분 읽기
                    </span>
                  </div>
                </div>

                <div className='flex items-center space-x-2'>
                  <button
                    onClick={() =>
                      setExpandedPost(expandedPost === index ? null : index)
                    }
                    className='p-2 text-blue-600 hover:bg-blue-100 rounded'
                    title='미리보기'
                  >
                    <Eye className='h-4 w-4' />
                  </button>
                  <button
                    onClick={() => handleEdit(index, post)}
                    className='p-2 text-green-600 hover:bg-green-100 rounded'
                    title='편집'
                  >
                    <Edit className='h-4 w-4' />
                  </button>
                  <button
                    onClick={() => handleDownloadSingle(post)}
                    className='p-2 text-purple-600 hover:bg-purple-100 rounded'
                    title='다운로드'
                  >
                    <Download className='h-4 w-4' />
                  </button>
                  <button
                    onClick={() => deletePost(index)}
                    className='p-2 text-red-600 hover:bg-red-100 rounded'
                    title='삭제'
                  >
                    <Trash2 className='h-4 w-4' />
                  </button>
                </div>
              </div>

              {/* 태그 및 메타데이터 */}
              <div className='px-4 py-2 bg-gray-50 border-b'>
                <div className='flex flex-wrap gap-2'>
                  {post.frontmatter.tags.map((tag, tagIndex) => (
                    <span
                      key={tagIndex}
                      className='px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full'
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                {post.metadata.sectionsIncluded.length > 0 && (
                  <div className='mt-2 text-xs text-gray-600'>
                    포함된 섹션:{' '}
                    {post.metadata.sectionsIncluded.slice(0, 3).join(', ')}
                    {post.metadata.sectionsIncluded.length > 3 && ' ...'}
                  </div>
                )}
              </div>

              {/* 편집 모드 */}
              {editingPost === index && (
                <div className='p-4'>
                  <div className='mb-3 flex items-center justify-between'>
                    <h4 className='font-medium text-gray-900'>포스트 편집</h4>
                    <div className='space-x-2'>
                      <button
                        onClick={() => handleSaveEdit(index)}
                        className='px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700'
                      >
                        저장
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className='px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700'
                      >
                        취소
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    className='w-full h-96 p-3 border border-gray-300 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                    placeholder='Markdown 내용을 편집하세요...'
                  />
                  <div className='mt-2 text-xs text-gray-500'>
                    Markdown 형식으로 작성하세요. Frontmatter(---로 둘러싸인
                    부분)를 수정할 수 있습니다.
                  </div>
                </div>
              )}

              {/* 미리보기 모드 */}
              {expandedPost === index && editingPost !== index && (
                <div className='p-4'>
                  <div className='mb-3 flex items-center justify-between'>
                    <h4 className='font-medium text-gray-900'>미리보기</h4>
                    <button
                      onClick={() => setExpandedPost(null)}
                      className='text-gray-500 hover:text-gray-700'
                    >
                      접기
                    </button>
                  </div>
                  <div className='bg-gray-50 rounded-md p-4 max-h-96 overflow-y-auto'>
                    <pre className='whitespace-pre-wrap text-sm font-mono text-gray-800'>
                      {post.content}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {generatedPosts.length > 0 && (
          <div className='mt-6 text-center text-sm text-gray-600'>
            <p>각 포스트를 개별적으로 편집하고 다운로드할 수 있습니다.</p>
            <p>
              모든 포스트를 한번에 다운로드하려면 아래의 일괄 다운로드 버튼을
              사용하세요.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PostPreview;
