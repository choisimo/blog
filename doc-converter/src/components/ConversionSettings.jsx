import React from 'react';
import { Settings, Sliders } from 'lucide-react';
import { useDocumentStore } from '../stores/documentStore';

const ConversionSettings = () => {
  const { settings, updateSettings } = useDocumentStore();

  const handleSettingChange = (key, value) => {
    updateSettings({ [key]: value });
  };

  return (
    <div className='w-full max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6'>
      <h2 className='text-xl font-bold text-gray-900 mb-4 flex items-center'>
        <Settings className='mr-2 h-5 w-5' />
        변환 설정
      </h2>

      <div className='space-y-6'>
        {/* 포스트 수 설정 */}
        <div>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            생성할 포스트 수
          </label>
          <div className='flex items-center space-x-4'>
            <input
              type='range'
              min='1'
              max='15'
              value={settings.targetPosts}
              onChange={e =>
                handleSettingChange('targetPosts', parseInt(e.target.value))
              }
              className='flex-1'
            />
            <span className='text-lg font-semibold text-blue-600 w-8 text-center'>
              {settings.targetPosts}
            </span>
          </div>
          <p className='text-xs text-gray-500 mt-1'>
            문서 길이에 따라 자동으로 최적화됩니다
          </p>
        </div>

        {/* 언어 선택 */}
        <div>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            언어
          </label>
          <div className='flex space-x-4'>
            <label className='flex items-center'>
              <input
                type='radio'
                name='language'
                value='ko'
                checked={settings.language === 'ko'}
                onChange={e => handleSettingChange('language', e.target.value)}
                className='mr-2'
              />
              <span className='text-sm'>한국어</span>
            </label>
            <label className='flex items-center'>
              <input
                type='radio'
                name='language'
                value='en'
                checked={settings.language === 'en'}
                onChange={e => handleSettingChange('language', e.target.value)}
                className='mr-2'
              />
              <span className='text-sm'>English</span>
            </label>
          </div>
        </div>

        {/* 스타일 선택 */}
        <div>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            글쓰기 스타일
          </label>
          <select
            value={settings.narrativeStyle}
            onChange={e =>
              handleSettingChange('narrativeStyle', e.target.value)
            }
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
          >
            <option value='experience'>
              개인 경험담 (Personal Experience)
            </option>
            <option value='journey'>학습 여정 (Learning Journey)</option>
            <option value='troubleshooting'>
              문제 해결기 (Problem Solving)
            </option>
            <option value='reflection'>기술 회고 (Tech Reflection)</option>
          </select>
          <p className='text-xs text-gray-500 mt-1'>
            기술 문서를 개인적 경험담으로 변환하는 스타일을 선택하세요
          </p>
        </div>

        {/* 시리즈 제목 */}
        <div>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            시리즈 제목
          </label>
          <input
            type='text'
            value={settings.seriesTitle}
            onChange={e => handleSettingChange('seriesTitle', e.target.value)}
            placeholder='자동으로 생성됩니다'
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
          <p className='text-xs text-gray-500 mt-1'>
            비워두면 파일명에서 자동 생성됩니다
          </p>
        </div>

        {/* 작성자 이름 */}
        <div>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            작성자 이름
          </label>
          <input
            type='text'
            value={settings.authorName}
            onChange={e => handleSettingChange('authorName', e.target.value)}
            placeholder='nodove'
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
        </div>
      </div>

      <div className='mt-6 pt-4 border-t'>
        <div className='flex items-center text-sm text-gray-600'>
          <Sliders className='mr-2 h-4 w-4' />
          <span>설정은 자동으로 저장됩니다</span>
        </div>
      </div>
    </div>
  );
};

export default ConversionSettings;
