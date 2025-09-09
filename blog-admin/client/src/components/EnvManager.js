import { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  KeyIcon,
  WrenchScrewdriverIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowPathIcon,
  InformationCircleIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

function EnvManager() {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({}); // { [sectionId]: boolean }
  const [showSecrets, setShowSecrets] = useState({}); // { [sectionId]: boolean }

  useEffect(() => {
    fetchEnv();
  }, []);

  const fetchEnv = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get('/api/env');
      const normalized = (data.sections || []).map(sec => ({
        ...sec,
        items: (sec.items || []).map(it => ({ ...it, _original: it.value })),
      }));
      setSections(normalized);
    } catch (e) {
      console.error(e);
      toast.error('환경설정을 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  };

  const onChange = (sectionId, key, value) => {
    setSections(prev =>
      prev.map(sec =>
        sec.id !== sectionId
          ? sec
          : {
              ...sec,
              items: sec.items.map(it =>
                it.key === key ? { ...it, value } : it
              ),
            }
      )
    );
  };

  const saveSection = async sectionId => {
    try {
      setSaving(s => ({ ...s, [sectionId]: true }));
      const section = sections.find(s => s.id === sectionId);
      if (!section) return;
      const values = {};
      section.items.forEach(it => {
        values[it.key] = it.value ?? '';
      });
      await axios.post('/api/env', { sectionId, values });
      toast.success('저장되었습니다 (.env)');
      await fetchEnv();
    } catch (e) {
      const msg =
        e.response?.data?.details || e.response?.data?.error || '저장 실패';
      toast.error(msg);
    } finally {
      setSaving(s => ({ ...s, [sectionId]: false }));
    }
  };

  const toggleShowSecrets = sectionId => {
    setShowSecrets(s => ({ ...s, [sectionId]: !s[sectionId] }));
  };

  const resetChanges = sectionId => {
    setSections(prev =>
      prev.map(sec =>
        sec.id !== sectionId
          ? sec
          : {
              ...sec,
              items: sec.items.map(it => ({ ...it, value: it._original })),
            }
      )
    );
  };

  if (loading) {
    return (
      <div className='flex justify-center items-center h-64'>
        <div className='animate-spin rounded-full h-16 w-16 border-b-2 border-gray-900'></div>
      </div>
    );
  }

  return (
    <div className='container mx-auto px-4 py-8 max-w-5xl'>
      <div className='flex items-center mb-8'>
        <WrenchScrewdriverIcon className='h-8 w-8 text-gray-600 mr-3' />
        <h1 className='text-3xl font-bold text-gray-900'>환경변수 관리자</h1>
      </div>

      <div className='bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6'>
        <div className='flex items-start space-x-2'>
          <InformationCircleIcon className='h-5 w-5 text-blue-600 mt-0.5' />
          <div className='text-sm text-blue-800'>
            <div>
              • 이 페이지에서 루트 프로젝트와 Blog Admin의 .env 파일을 관리할 수
              있습니다.
            </div>
            <div>
              • 서버 환경변수는 저장 후 서버 재시작이 필요할 수 있습니다.
            </div>
            <div>• 비밀값은 기본적으로 숨김 처리됩니다.</div>
          </div>
        </div>
      </div>

      <div className='space-y-8'>
        {sections.map(section => {
          const hasMissing = section.items.some(
            it => (it.example ?? '') !== '' && !String(it.value || '').trim()
          );
          return (
            <div key={section.id} className='bg-white rounded-lg shadow-md'>
              <div className='flex items-center justify-between p-4 border-b'>
                <div>
                  <div className='text-lg font-semibold text-gray-900'>
                    {section.name}
                  </div>
                  <div className='text-xs text-gray-500 mt-1'>
                    {section.envPath}
                    {section.exampleExists && (
                      <span className='ml-2 text-gray-400'>
                        (예시: {section.examplePath})
                      </span>
                    )}
                  </div>
                </div>
                <div className='flex items-center space-x-2'>
                  <button
                    type='button'
                    onClick={() => toggleShowSecrets(section.id)}
                    className='inline-flex items-center px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 rounded'
                  >
                    {showSecrets[section.id] ? (
                      <>
                        <EyeSlashIcon className='h-4 w-4 mr-1' /> 숨기기
                      </>
                    ) : (
                      <>
                        <EyeIcon className='h-4 w-4 mr-1' /> 보이기
                      </>
                    )}
                  </button>
                  <button
                    type='button'
                    onClick={() => resetChanges(section.id)}
                    className='inline-flex items-center px-3 py-1.5 text-xs bg-white border hover:bg-gray-50 text-gray-800 rounded'
                  >
                    <ArrowPathIcon className='h-4 w-4 mr-1' /> 변경 취소
                  </button>
                  <button
                    type='button'
                    onClick={() => saveSection(section.id)}
                    disabled={!!saving[section.id]}
                    className='inline-flex items-center px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded'
                  >
                    {saving[section.id] ? (
                      <>
                        <div className='animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2'></div>
                        저장 중...
                      </>
                    ) : (
                      <>
                        <CheckCircleIcon className='h-4 w-4 mr-1' /> 저장
                      </>
                    )}
                  </button>
                </div>
              </div>

              {hasMissing && (
                <div className='px-4 py-3 bg-yellow-50 border-b border-yellow-200 text-yellow-800 text-sm flex items-center'>
                  <ExclamationTriangleIcon className='h-5 w-5 mr-2' />
                  예시(.env.example)에 있는 필수값 중 비어있는 항목이 있습니다.
                </div>
              )}

              <div className='p-4'>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  {section.items.map(item => {
                    const show = showSecrets[section.id] || !item.secret;
                    const isMissing =
                      (item.example ?? '') !== '' &&
                      !String(item.value || '').trim();
                    return (
                      <div
                        key={`${section.id}-${item.key}`}
                        className='border rounded-md p-3'
                      >
                        <div className='flex items-center justify-between mb-2'>
                          <div className='text-sm font-medium text-gray-900 flex items-center'>
                            {item.secret && (
                              <KeyIcon className='h-4 w-4 text-gray-500 mr-1' />
                            )}{' '}
                            {item.key}
                          </div>
                          {item.secret && (
                            <span className='inline-flex items-center text-[10px] text-gray-500'>
                              <ShieldCheckIcon className='h-3 w-3 mr-1' />{' '}
                              비밀값
                            </span>
                          )}
                        </div>
                        <input
                          type={show ? 'text' : 'password'}
                          value={item.value || ''}
                          onChange={e =>
                            onChange(section.id, item.key, e.target.value)
                          }
                          className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 ${
                            isMissing
                              ? 'border-yellow-300 focus:ring-yellow-400'
                              : 'border-gray-300 focus:ring-blue-500'
                          }`}
                          placeholder={
                            item.example ? `예시: ${item.example}` : ''
                          }
                        />
                        {item.example && (
                          <div className='mt-1 text-[11px] text-gray-500'>
                            예시: {item.example}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default EnvManager;
