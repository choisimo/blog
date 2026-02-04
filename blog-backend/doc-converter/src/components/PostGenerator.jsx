import React from 'react';
import { Wand2, FileText, AlertCircle } from 'lucide-react';
import { useDocumentStore } from '../stores/documentStore';
import { MarkdownGenerator } from '../utils/markdownGenerator';

const PostGenerator = () => {
  const {
    parsedContent,
    settings,
    generatedPosts,
    setGeneratedPosts,
    setProcessing,
    setError,
    isProcessing,
  } = useDocumentStore();

  const generator = new MarkdownGenerator();

  const handleGenerate = async () => {
    if (!parsedContent) {
      setError('먼저 문서를 업로드하고 파싱해주세요.');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const options = {
        ...settings,
        seriesTitle:
          settings.seriesTitle || generator.extractSeriesTitle(parsedContent),
      };

      const posts = generator.generatePostSeries(parsedContent, options);
      setGeneratedPosts(posts);
    } catch (err) {
      console.error('Post generation error:', err);
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  if (!parsedContent) {
    return (
      <div className='w-full max-w-2xl mx-auto bg-gray-50 rounded-lg p-8 text-center'>
        <FileText className='mx-auto h-12 w-12 text-gray-400 mb-4' />
        <p className='text-gray-600'>
          문서를 업로드하면 포스트 생성이 가능합니다
        </p>
      </div>
    );
  }

  return (
    <div className='w-full max-w-2xl mx-auto'>
      <div className='bg-white rounded-lg shadow-md p-6'>
        <h2 className='text-xl font-bold text-gray-900 mb-4 flex items-center'>
          <Wand2 className='mr-2 h-5 w-5' />
          포스트 생성
        </h2>

        <div className='mb-6 p-4 bg-blue-50 rounded-lg'>
          <h3 className='font-semibold text-blue-900 mb-2'>생성 예상 정보</h3>
          <ul className='text-sm text-blue-800 space-y-1'>
            <li>• 예상 포스트 수: {settings.targetPosts}개</li>
            <li>• 언어: {settings.language === 'ko' ? '한국어' : 'English'}</li>
            <li>
              • 스타일:{' '}
              {settings.narrativeStyle === 'experience'
                ? '개인 경험담'
                : settings.narrativeStyle === 'journey'
                  ? '학습 여정'
                  : settings.narrativeStyle === 'troubleshooting'
                    ? '문제 해결기'
                    : '기술 회고'}
            </li>
            <li>• 총 섹션: {parsedContent.sections.length}개</li>
            <li>• 총 단어 수: {parsedContent.wordCount.toLocaleString()}개</li>
          </ul>
        </div>

        <button
          onClick={handleGenerate}
          disabled={isProcessing}
          className={`
            w-full flex items-center justify-center px-4 py-3 rounded-md text-white font-medium
            ${
              isProcessing
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
            } transition-colors
          `}
        >
          {isProcessing ? (
            <>
              <div className='animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2'></div>
              포스트 생성 중...
            </>
          ) : (
            <>
              <Wand2 className='mr-2 h-5 w-5' />
              {generatedPosts.length > 0
                ? '포스트 다시 생성'
                : '포스트 생성하기'}
            </>
          )}
        </button>

        {generatedPosts.length > 0 && (
          <div className='mt-4 p-4 bg-green-50 rounded-lg'>
            <p className='text-green-800 font-medium'>
              ✅ {generatedPosts.length}개의 포스트가 생성되었습니다!
            </p>
            <p className='text-sm text-green-600 mt-1'>
              아래에서 각 포스트를 미리보기하고 편집할 수 있습니다.
            </p>
          </div>
        )}
      </div>

      <div className='mt-4 text-xs text-gray-500 text-center'>
        <p>• 생성된 포스트는 개인적 경험담 스타일로 자동 변환됩니다</p>
        <p>• 기술적 정확성을 유지하면서 읽기 쉬운 형태로 변환합니다</p>
        <p>• 생성 후 각 포스트를 개별적으로 편집할 수 있습니다</p>
      </div>
    </div>
  );
};

export default PostGenerator;
