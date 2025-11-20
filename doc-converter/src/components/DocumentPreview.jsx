import React from 'react';
import { FileText, Hash, Clock, Languages } from 'lucide-react';
import { useDocumentStore } from '../stores/documentStore';

const DocumentPreview = () => {
  const { parsedContent } = useDocumentStore();

  if (!parsedContent) return null;

  const { filename, type, sections, wordCount, metadata } = parsedContent;

  return (
    <div className='w-full max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6'>
      <h2 className='text-xl font-bold text-gray-900 mb-4 flex items-center'>
        <FileText className='mr-2 h-5 w-5' />
        문서 분석 결과
      </h2>

      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6'>
        <div className='bg-blue-50 rounded-lg p-4'>
          <div className='flex items-center'>
            <FileText className='h-5 w-5 text-blue-600 mr-2' />
            <span className='text-sm font-medium text-blue-900'>파일 정보</span>
          </div>
          <p className='text-lg font-bold text-blue-700 mt-1'>
            {type.toUpperCase()}
          </p>
          <p className='text-xs text-blue-600 truncate'>{filename}</p>
        </div>

        <div className='bg-green-50 rounded-lg p-4'>
          <div className='flex items-center'>
            <Hash className='h-5 w-5 text-green-600 mr-2' />
            <span className='text-sm font-medium text-green-900'>섹션 수</span>
          </div>
          <p className='text-lg font-bold text-green-700 mt-1'>
            {sections.length}개
          </p>
          <p className='text-xs text-green-600'>감지된 구역</p>
        </div>

        <div className='bg-purple-50 rounded-lg p-4'>
          <div className='flex items-center'>
            <Languages className='h-5 w-5 text-purple-600 mr-2' />
            <span className='text-sm font-medium text-purple-900'>단어 수</span>
          </div>
          <p className='text-lg font-bold text-purple-700 mt-1'>
            {wordCount.toLocaleString()}
          </p>
          <p className='text-xs text-purple-600'>
            예상 읽기 시간: {Math.ceil(wordCount / 200)}분
          </p>
        </div>

        <div className='bg-orange-50 rounded-lg p-4'>
          <div className='flex items-center'>
            <Clock className='h-5 w-5 text-orange-600 mr-2' />
            <span className='text-sm font-medium text-orange-900'>
              파일 크기
            </span>
          </div>
          <p className='text-lg font-bold text-orange-700 mt-1'>
            {(metadata.size / 1024 / 1024).toFixed(1)}MB
          </p>
          <p className='text-xs text-orange-600'>
            {metadata.pageCount ? `${metadata.pageCount}페이지` : '문서'}
          </p>
        </div>
      </div>

      <div className='border-t pt-4'>
        <h3 className='text-lg font-semibold text-gray-900 mb-3'>
          감지된 섹션
        </h3>
        <div className='space-y-2 max-h-64 overflow-y-auto'>
          {sections.map((section, index) => (
            <div
              key={index}
              className='flex items-start justify-between p-3 bg-gray-50 rounded-md'
            >
              <div className='flex-1'>
                <h4 className='text-sm font-medium text-gray-900'>
                  {section.title}
                </h4>
                <p className='text-xs text-gray-600 mt-1'>
                  {section.wordCount}단어 • Level {section.level || 1}
                </p>
              </div>
              <div className='text-xs text-gray-500 ml-4'>섹션 {index + 1}</div>
            </div>
          ))}
        </div>
      </div>

      {sections.length === 0 && (
        <div className='text-center py-8'>
          <p className='text-gray-500'>섹션을 감지하지 못했습니다.</p>
          <p className='text-sm text-gray-400'>
            문서가 단일 블록으로 처리됩니다.
          </p>
        </div>
      )}
    </div>
  );
};

export default DocumentPreview;
