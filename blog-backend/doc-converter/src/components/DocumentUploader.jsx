import React, { useCallback } from 'react';
import { Upload, File, AlertCircle } from 'lucide-react';
import { useDocumentStore } from '../stores/documentStore';
import { BrowserDocumentParser } from '../utils/browserDocumentParser';

const DocumentUploader = () => {
  const {
    setDocument,
    setParsedContent,
    setProcessing,
    setError,
    clearAll,
    isProcessing,
    error,
  } = useDocumentStore();
  const parser = new BrowserDocumentParser();

  const handleFileUpload = useCallback(
    async file => {
      if (!file) return;

      clearAll();
      setProcessing(true);
      setError(null);

      try {
        // 파일 유효성 검사
        parser.validateFile(file);

        // 파일 파싱
        const parsed = await parser.parseFile(file);

        setDocument(file);
        setParsedContent(parsed);
      } catch (err) {
        console.error('File parsing error:', err);
        setError(err.message);
      } finally {
        setProcessing(false);
      }
    },
    [parser, setDocument, setParsedContent, setProcessing, setError, clearAll]
  );

  const handleDrop = useCallback(
    e => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      handleFileUpload(file);
    },
    [handleFileUpload]
  );

  const handleDragOver = useCallback(e => {
    e.preventDefault();
  }, []);

  const handleInputChange = useCallback(
    e => {
      const file = e.target.files[0];
      handleFileUpload(file);
    },
    [handleFileUpload]
  );

  return (
    <div className='w-full max-w-2xl mx-auto'>
      <div
        className={`
          border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${isProcessing ? 'border-blue-300 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${error ? 'border-red-300 bg-red-50' : ''}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        {isProcessing ? (
          <div className='space-y-4'>
            <div className='inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full'>
              <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
            </div>
            <div>
              <p className='text-lg font-medium text-blue-900'>
                문서 처리 중...
              </p>
              <p className='text-sm text-blue-600'>파일을 파싱하고 있습니다.</p>
            </div>
          </div>
        ) : error ? (
          <div className='space-y-4'>
            <AlertCircle className='mx-auto h-16 w-16 text-red-500' />
            <div>
              <p className='text-lg font-medium text-red-900'>오류 발생</p>
              <p className='text-sm text-red-600'>{error}</p>
              <button
                onClick={() => setError(null)}
                className='mt-2 text-sm text-red-600 hover:text-red-800 underline'
              >
                다시 시도
              </button>
            </div>
          </div>
        ) : (
          <div className='space-y-4'>
            <Upload className='mx-auto h-16 w-16 text-gray-400' />
            <div>
              <p className='text-lg font-medium text-gray-900'>
                문서를 업로드하세요
              </p>
              <p className='text-sm text-gray-600'>
                DOCX 또는 PDF 파일을 드래그하거나 클릭해서 선택하세요
              </p>
              <p className='text-xs text-gray-500 mt-2'>최대 파일 크기: 50MB</p>
            </div>
            <input
              type='file'
              accept='.docx,.pdf'
              onChange={handleInputChange}
              className='hidden'
              id='file-input'
              disabled={isProcessing}
            />
            <label
              htmlFor='file-input'
              className='inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer transition-colors'
            >
              <File className='mr-2 h-4 w-4' />
              파일 선택
            </label>
          </div>
        )}
      </div>

      <div className='mt-4 text-xs text-gray-500'>
        <p>지원되는 형식: DOCX, PDF</p>
        <p>처리 방식: 100% 브라우저 내에서 처리 (서버 전송 없음)</p>
      </div>
    </div>
  );
};

export default DocumentUploader;
