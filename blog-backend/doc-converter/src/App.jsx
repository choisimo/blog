import React from 'react';
import { FileText, ArrowRight, Github, Zap } from 'lucide-react';
import { useDocumentStore } from './stores/documentStore';
import DocumentUploader from './components/DocumentUploader';
import DocumentPreview from './components/DocumentPreview';
import ConversionSettings from './components/ConversionSettings';
import PostGenerator from './components/PostGenerator';
import PostPreview from './components/PostPreview';
import PostDownloader from './components/PostDownloader';
import './App.css';

function App() {
  const { currentDocument, parsedContent, generatedPosts, error } =
    useDocumentStore();

  const steps = [
    { id: 1, name: '문서 업로드', completed: !!currentDocument },
    { id: 2, name: '파싱 완료', completed: !!parsedContent },
    { id: 3, name: '포스트 생성', completed: generatedPosts.length > 0 },
    { id: 4, name: '다운로드', completed: false },
  ];

  return (
    <div className='min-h-screen bg-gray-100'>
      {/* 헤더 */}
      <header className='bg-white shadow-sm border-b'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center'>
              <FileText className='h-8 w-8 text-blue-600 mr-3' />
              <div>
                <h1 className='text-2xl font-bold text-gray-900'>
                  문서 → 블로그 변환기
                </h1>
                <p className='text-sm text-gray-600'>
                  DOCX, PDF를 GitHub Pages 블로그용 Markdown으로 변환
                </p>
              </div>
            </div>

            <div className='flex items-center space-x-4'>
              <div className='flex items-center space-x-2 text-sm text-gray-600'>
                <Zap className='h-4 w-4' />
                <span>100% 브라우저 처리</span>
              </div>
              <a
                href='https://github.com/nodove/blog'
                target='_blank'
                rel='noopener noreferrer'
                className='flex items-center space-x-2 text-gray-600 hover:text-gray-900'
              >
                <Github className='h-5 w-5' />
                <span>GitHub</span>
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* 진행 단계 표시 */}
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6'>
        <div className='flex items-center justify-between mb-8'>
          {steps.map((step, index) => (
            <div key={step.id} className='flex items-center'>
              <div
                className={`
                flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium
                ${
                  step.completed
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }
              `}
              >
                {step.id}
              </div>
              <span
                className={`
                ml-2 text-sm font-medium
                ${step.completed ? 'text-green-600' : 'text-gray-500'}
              `}
              >
                {step.name}
              </span>
              {index < steps.length - 1 && (
                <ArrowRight className='ml-4 h-5 w-5 text-gray-400' />
              )}
            </div>
          ))}
        </div>

        {/* 오류 표시 */}
        {error && (
          <div className='mb-6 bg-red-50 border border-red-200 rounded-md p-4'>
            <div className='flex'>
              <div className='flex-shrink-0'>
                <svg
                  className='h-5 w-5 text-red-400'
                  viewBox='0 0 20 20'
                  fill='currentColor'
                >
                  <path
                    fillRule='evenodd'
                    d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
                    clipRule='evenodd'
                  />
                </svg>
              </div>
              <div className='ml-3'>
                <h3 className='text-sm font-medium text-red-800'>
                  오류가 발생했습니다
                </h3>
                <div className='mt-2 text-sm text-red-700'>{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* 메인 컨텐츠 */}
        <div className='space-y-8'>
          {/* Step 1: 문서 업로드 */}
          <section>
            <h2 className='text-lg font-semibold text-gray-900 mb-4'>
              1단계: 문서 업로드
            </h2>
            <DocumentUploader />
          </section>

          {/* Step 2: 문서 미리보기 */}
          {parsedContent && (
            <section>
              <h2 className='text-lg font-semibold text-gray-900 mb-4'>
                2단계: 문서 분석 결과
              </h2>
              <DocumentPreview />
            </section>
          )}

          {/* Step 3: 변환 설정 */}
          {parsedContent && (
            <section>
              <h2 className='text-lg font-semibold text-gray-900 mb-4'>
                3단계: 변환 설정
              </h2>
              <ConversionSettings />
            </section>
          )}

          {/* Step 4: 포스트 생성 */}
          {parsedContent && (
            <section>
              <h2 className='text-lg font-semibold text-gray-900 mb-4'>
                4단계: 포스트 생성
              </h2>
              <PostGenerator />
            </section>
          )}

          {/* Step 5: 포스트 미리보기 */}
          {generatedPosts.length > 0 && (
            <section>
              <h2 className='text-lg font-semibold text-gray-900 mb-4'>
                5단계: 생성된 포스트 확인
              </h2>
              <PostPreview />
            </section>
          )}

          {/* Step 6: 다운로드 */}
          {generatedPosts.length > 0 && (
            <section>
              <h2 className='text-lg font-semibold text-gray-900 mb-4'>
                6단계: 다운로드
              </h2>
              <PostDownloader />
            </section>
          )}
        </div>
      </div>

      {/* 푸터 */}
      <footer className='mt-12 bg-white border-t'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
          <div className='text-center text-sm text-gray-600'>
            <p>
              Made with ❤️ for GitHub Pages •
              <a
                href='https://github.com/nodove/blog'
                className='ml-1 text-blue-600 hover:underline'
              >
                Open Source
              </a>
            </p>
            <p className='mt-1'>
              모든 처리는 브라우저에서 실행되며 파일이 서버로 전송되지 않습니다.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
