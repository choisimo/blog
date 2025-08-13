import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

const AIConfigModal = ({ isOpen, onClose, onConfigUpdate }) => {
  const [config, setConfig] = useState({
    provider: 'template',
    apiKeys: {
      gemini: '',
      openrouter: ''
    },
    models: {
      openrouter: 'google/gemini-2.5-flash-lite'
    }
  });
  
  const [availableModels, setAvailableModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchConfig();
    }
  }, [isOpen]);

  const fetchConfig = async () => {
    try {
      const response = await axios.get('/api/ai/config');
      setConfig(response.data.config);
    } catch (error) {
      console.error('Error fetching AI config:', error);
      toast.error('AI 설정을 불러오는데 실패했습니다.');
    }
  };

  const fetchModels = async () => {
    if (!config.apiKeys.openrouter) {
      toast.warning('OpenRouter API 키를 먼저 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post('/api/ai/models', {
        apiKey: config.apiKeys.openrouter
      });
      setAvailableModels(response.data.models);
      toast.success('사용 가능한 모델 목록을 불러왔습니다.');
    } catch (error) {
      console.error('Error fetching models:', error);
      toast.error('모델 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    setLoading(true);
    setTestResult('');
    
    try {
      const response = await axios.post('/api/ai/test', config);
      if (response.data.success) {
        setTestResult('✅ AI 연결 테스트 성공!');
        toast.success('AI 연결 테스트에 성공했습니다.');
      } else {
        setTestResult('❌ AI 연결 테스트 실패: ' + response.data.error);
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
      const response = await axios.post('/api/ai/config', config);
      if (response.data.success) {
        toast.success('AI 설정이 저장되었습니다.');
        if (onConfigUpdate) {
          onConfigUpdate(config);
        }
        onClose();
      }
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">🤖 AI API 설정</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
            disabled={loading}
          >
            ×
          </button>
        </div>

        <div className="space-y-6">
          {/* Provider Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              AI 제공자 선택
            </label>
            <select
              value={config.provider}
              onChange={(e) => handleInputChange('provider', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            >
              <option value="template">템플릿 (AI 없음)</option>
              <option value="gemini">Google Gemini</option>
              <option value="openrouter">OpenRouter</option>
            </select>
          </div>

          {/* Google Gemini API Key */}
          {config.provider === 'gemini' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Google Gemini API Key
              </label>
              <input
                type="password"
                value={config.apiKeys.gemini || ''}
                onChange={(e) => handleInputChange('apiKeys.gemini', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="AIza..."
                disabled={loading}
              />
              <p className="mt-1 text-sm text-gray-500">
                <a 
                  href="https://aistudio.google.com/app/apikey" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  OpenRouter API Key
                </label>
                <input
                  type="password"
                  value={config.apiKeys.openrouter || ''}
                  onChange={(e) => handleInputChange('apiKeys.openrouter', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="sk-or-v1-..."
                  disabled={loading}
                />
                <p className="mt-1 text-sm text-gray-500">
                  <a 
                    href="https://openrouter.ai/keys" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    여기서 API 키 발급 →
                  </a>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  사용할 모델
                </label>
                <div className="flex space-x-2">
                  <select
                    value={config.models.openrouter || ''}
                    onChange={(e) => handleInputChange('models.openrouter', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={loading}
                  >
                    <option value="google/gemini-2.5-flash-lite">Google Gemini 2.5 Flash Lite (추천)</option>
                    <option value="openai/gpt-4o-mini">GPT-4o Mini</option>
                    <option value="anthropic/claude-3-haiku">Claude 3 Haiku</option>
                    {availableModels.map(model => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={fetchModels}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
                    disabled={loading || !config.apiKeys.openrouter}
                  >
                    모델 목록 가져오기
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Test Result */}
          {testResult && (
            <div className={`p-4 rounded-md ${testResult.includes('✅') ? 'bg-green-50' : 'bg-red-50'}`}>
              <p className="text-sm">{testResult}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between pt-4 border-t">
            <button
              onClick={testConnection}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              disabled={loading || config.provider === 'template'}
            >
              {loading ? '테스트 중...' : '연결 테스트'}
            </button>
            
            <div className="space-x-2">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 disabled:opacity-50"
                disabled={loading}
              >
                취소
              </button>
              <button
                onClick={saveConfig}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
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
