import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const AIConfigModal = ({ isOpen, onClose, onConfigUpdate }) => {
  const [config, setConfig] = useState({
    provider: 'template',
    apiKeys: {
      gemini: '',
      openrouter: '',
    },
    models: {
      openrouter: 'google/gemini-2.5-flash-lite',
    },
  });

  // Generate session ID for AI configuration
  const [sessionId] = useState(() => {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  });

  // Info from server config (available providers, config source, etc.)
  const [aiInfo, setAiInfo] = useState({
    availableProviders: {},
    configSource: {},
    currentSettings: {},
  });

  // Whether to persist settings to server or just session
  const [persistent, setPersistent] = useState(true);

  const [availableModels, setAvailableModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchConfig();
    }
  }, [isOpen]);

  const loadSettingsFromStorage = () => {
    try {
      const stored = localStorage.getItem('ai-settings');
      return stored
        ? JSON.parse(stored)
        : { provider: 'template', apiKeys: {}, models: {} };
    } catch (error) {
      console.error('Error loading settings from storage:', error);
      return { provider: 'template', apiKeys: {}, models: {} };
    }
  };

  const saveSettingsToStorage = settings => {
    try {
      localStorage.setItem('ai-settings', JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving settings to storage:', error);
    }
  };

  const fetchConfig = async () => {
    try {
      const response = await axios.get('/api/ai/config', {
        headers: { 'x-session-id': sessionId },
      });
      // Server returns top-level config info, not nested under "config"
      const server = response.data || {};
      setAiInfo(server);

      const stored = loadSettingsFromStorage();
      setConfig(prev => ({
        provider: stored.provider || server.provider || 'template',
        apiKeys: {
          gemini: stored.apiKeys?.gemini || '',
          openrouter: stored.apiKeys?.openrouter || '',
        },
        models: {
          openrouter:
            stored.models?.openrouter ||
            server.models?.openrouter ||
            'google/gemini-2.5-flash-lite',
        },
      }));
    } catch (error) {
      console.error('Error fetching AI config:', error);
      toast.error('AI 설정을 불러오는데 실패했습니다.');
    }
  };

  const fetchModels = async () => {
    setLoading(true);
    try {
      // Prefer GET using session-configured key
      const headers = { 'x-session-id': sessionId };
      let models = [];
      try {
        const getRes = await axios.get('/api/ai/openrouter/models', {
          headers,
        });
        models = getRes.data.models || [];
      } catch (getErr) {
        const status = getErr?.response?.status;
        const noKeyConfigured = status === 400;
        if (noKeyConfigured && config.apiKeys.openrouter) {
          // Fallback: explicit key via POST
          const postRes = await axios.post(
            '/api/ai/models',
            { apiKey: config.apiKeys.openrouter },
            { headers }
          );
          models = postRes.data.models || [];
        } else {
          throw getErr;
        }
      }
      setAvailableModels(models);
      toast.success('사용 가능한 모델 목록을 불러왔습니다.');
    } catch (error) {
      console.error('Error fetching models:', error);
      const msg =
        error?.response?.data?.error || '모델 목록을 불러오는데 실패했습니다.';
      toast.error(msg);
      if (!config.apiKeys.openrouter) {
        toast('OpenRouter API 키를 입력하거나 서버에 저장하세요.', {
          icon: '⚠️',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    setLoading(true);
    setTestResult('');

    try {
      const response = await axios.post(
        '/api/ai/test',
        {
          provider: config.provider,
          apiKeys: config.apiKeys,
        },
        {
          headers: { 'x-session-id': sessionId },
        }
      );
      if (response.data.success) {
        setTestResult('✅ AI 연결 테스트 성공!');
        toast.success('AI 연결 테스트에 성공했습니다.');
      } else {
        setTestResult(`❌ AI 연결 테스트 실패: ${response.data.error}`);
        toast.error('AI 연결 테스트에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error testing AI connection:', error);
      setTestResult('❌ 테스트 중 오류 발생');
      toast.error('테스트 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setLoading(true);

    try {
      const payload = {
        provider: config.provider,
        apiKeys: config.apiKeys,
        models: config.models,
        persistent,
      };
      const response = await axios.post('/api/ai/config', payload, {
        headers: { 'x-session-id': sessionId },
      });

      // Update local storage to keep client and server consistent
      saveSettingsToStorage({
        provider: config.provider,
        apiKeys: config.apiKeys,
        models: config.models,
      });

      // Update info from server response if provided
      if (response.data?.config) {
        setAiInfo(prev => ({ ...prev, ...response.data.config }));
      }

      toast.success(response.data?.message || 'AI 설정이 저장되었습니다.');
      if (onConfigUpdate) {
        onConfigUpdate(config);
      }
      onClose();
    } catch (error) {
      console.error('Error saving AI config:', error);
      toast.error('설정 저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (path, value) => {
    const keys = path.split('.');
    setConfig(prev => {
      const newConfig = { ...prev };
      let current = newConfig;

      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = value;
      return newConfig;
    });
  };

  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
      <div className='bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto'>
        <div className='flex justify-between items-center mb-6'>
          <h2 className='text-2xl font-bold text-gray-900'>🤖 AI API 설정</h2>
          <button
            onClick={onClose}
            className='text-gray-400 hover:text-gray-600 text-2xl'
            disabled={loading}
          >
            ×
          </button>
        </div>

        <div className='space-y-6'>
          {/* Provider Selection */}
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>
              AI 제공자 선택
            </label>
            <select
              value={config.provider}
              onChange={e => handleInputChange('provider', e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
              disabled={loading}
            >
              <option value='template'>템플릿 (AI 없음)</option>
              <option value='gemini'>Google Gemini</option>
              <option value='openrouter'>OpenRouter</option>
            </select>
          </div>

          {/* Google Gemini API Key */}
          {config.provider === 'gemini' && (
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>
                Google Gemini API Key
              </label>
              <input
                type='password'
                value={config.apiKeys.gemini || ''}
                onChange={e =>
                  handleInputChange('apiKeys.gemini', e.target.value)
                }
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                placeholder='AIza...'
                disabled={loading}
              />
              <p className='mt-1 text-sm text-gray-500'>
                <a
                  href='https://aistudio.google.com/app/apikey'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-blue-600 hover:underline'
                >
                  여기서 API 키 발급 →
                </a>
              </p>
            </div>
          )}

          {/* OpenRouter Configuration */}
          {config.provider === 'openrouter' && (
            <>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-2'>
                  OpenRouter API Key
                </label>
                <input
                  type='password'
                  value={config.apiKeys.openrouter || ''}
                  onChange={e =>
                    handleInputChange('apiKeys.openrouter', e.target.value)
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder='sk-or-v1-...'
                  disabled={loading}
                />
                <p className='mt-1 text-sm text-gray-500'>
                  <a
                    href='https://openrouter.ai/keys'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='text-blue-600 hover:underline'
                  >
                    여기서 API 키 발급 →
                  </a>
                </p>
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 mb-2'>
                  사용할 모델
                </label>
                <div className='flex space-x-2'>
                  <select
                    value={config.models.openrouter || ''}
                    onChange={e =>
                      handleInputChange('models.openrouter', e.target.value)
                    }
                    className='flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                    disabled={loading}
                  >
                    <option value='google/gemini-2.5-flash-lite'>
                      Google Gemini 2.5 Flash Lite (추천)
                    </option>
                    <option value='openai/gpt-4o-mini'>GPT-4o Mini</option>
                    <option value='anthropic/claude-3-haiku'>
                      Claude 3 Haiku
                    </option>
                    {availableModels.map(model => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={fetchModels}
                    className='px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50'
                    disabled={loading || !config.apiKeys.openrouter}
                  >
                    모델 목록 가져오기
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Config Info and Persistence */}
          <div className='space-y-3'>
            {aiInfo?.configSource && (
              <div className='bg-blue-50 border border-blue-200 rounded-lg p-3'>
                <div className='text-sm text-gray-700 font-medium mb-1'>
                  현재 설정 소스
                </div>
                <div className='text-xs text-gray-600'>
                  {aiInfo.configSource.persistent && (
                    <span className='text-green-700 font-semibold mr-2'>
                      파일 저장됨
                    </span>
                  )}
                  {aiInfo.configSource.environment && (
                    <span className='text-blue-700 font-semibold mr-2'>
                      환경변수
                    </span>
                  )}
                  {!aiInfo.configSource.persistent &&
                    !aiInfo.configSource.environment && (
                      <span className='text-gray-500'>기본값</span>
                    )}
                </div>
              </div>
            )}

            <div className='flex items-center justify-between'>
              <label className='text-sm text-gray-700 flex items-center space-x-2'>
                <input
                  type='checkbox'
                  checked={persistent}
                  onChange={e => setPersistent(e.target.checked)}
                  className='rounded'
                  disabled={loading}
                />
                <span>서버에 영구 저장</span>
              </label>
              <span className='text-xs text-gray-500'>
                해제 시 현재 세션에만 적용
              </span>
            </div>
          </div>

          {/* Test Result */}
          {testResult && (
            <div
              className={`p-4 rounded-md ${testResult.includes('✅') ? 'bg-green-50' : 'bg-red-50'}`}
            >
              <p className='text-sm'>{testResult}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className='flex justify-between pt-4 border-t'>
            <button
              onClick={testConnection}
              className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50'
              disabled={loading || config.provider === 'template'}
            >
              {loading ? '테스트 중...' : '연결 테스트'}
            </button>

            <div className='space-x-2'>
              <button
                onClick={onClose}
                className='px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 disabled:opacity-50'
                disabled={loading}
              >
                취소
              </button>
              <button
                onClick={saveConfig}
                className='px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50'
                disabled={loading}
              >
                {loading ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIConfigModal;
