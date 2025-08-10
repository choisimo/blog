import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  CogIcon,
  KeyIcon,
  CpuChipIcon,
  DocumentTextIcon,
  InformationCircleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

function Settings() {
  const [categories, setCategories] = useState([]);
  const [aiConfig, setAiConfig] = useState({
    provider: 'template',
    availableProviders: {},
    currentSettings: {},
    configSource: {}
  });
  
  // Generate session ID for AI configuration
  const [sessionId] = useState(() => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  });
  
  const [settings, setSettings] = useState({
    provider: 'template',
    apiKeys: {
      gemini: '',
      openrouter: ''
    },
    models: {
      openrouter: 'google/gemini-2.5-flash-lite'
    },
    availableModels: {
      openrouter: []
    }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testResults, setTestResults] = useState({});
  const [connectionStatus, setConnectionStatus] = useState({});
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    loadSettingsFromStorage();
    fetchAIConfig();
  }, []);

  const loadSettingsFromStorage = () => {
    try {
      const stored = localStorage.getItem('ai-settings');
      if (stored) {
        const parsedSettings = JSON.parse(stored);
        setSettings(prev => ({
          ...prev,
          ...parsedSettings
        }));
      }
    } catch (error) {
      console.error('Error loading settings from storage:', error);
    }
  };

  const saveSettingsToStorage = (newSettings) => {
    try {
      localStorage.setItem('ai-settings', JSON.stringify(newSettings));
    } catch (error) {
      console.error('Error saving settings to storage:', error);
    }
  };

  const fetchAIConfig = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/ai/config', {
        headers: { 'x-session-id': sessionId }
      });
      setAiConfig(response.data);
      
      // Auto-detect and set provider based on available API keys
      const updatedSettings = detectAndSetProvider(response.data);
      setSettings(updatedSettings);
      
    } catch (error) {
      console.error('Error fetching AI config:', error);
      toast.error('AI 설정을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const detectAndSetProvider = (aiConfig) => {
    const stored = localStorage.getItem('ai-settings');
    let storedSettings = {};
    
    if (stored) {
      try {
        storedSettings = JSON.parse(stored);
      } catch (error) {
        console.error('Error parsing stored settings:', error);
      }
    }

    // Check if we have API keys in localStorage
    const hasGeminiKey = storedSettings.apiKeys?.gemini;
    const hasOpenRouterKey = storedSettings.apiKeys?.openrouter;
    
    // Auto-select provider based on available keys
    let selectedProvider = 'template'; // default fallback
    
    if (hasGeminiKey && aiConfig.availableProviders?.gemini?.available) {
      selectedProvider = 'gemini';
    } else if (hasOpenRouterKey && aiConfig.availableProviders?.openrouter?.available) {
      selectedProvider = 'openrouter';
    } else if (aiConfig.availableProviders?.gemini?.available) {
      selectedProvider = 'gemini';
    } else if (aiConfig.availableProviders?.openrouter?.available) {
      selectedProvider = 'openrouter';
    }

    const updatedSettings = {
      ...settings,
      ...storedSettings,
      provider: selectedProvider
    };

    // Save the auto-detected settings
    saveSettingsToStorage(updatedSettings);
    
    return updatedSettings;
  };

  const syncSettingsToServer = async (settingsToSync, persistent = true) => {
    try {
      setSaving(true);
      const response = await axios.post('/api/ai/config', {
        provider: settingsToSync.provider,
        apiKeys: settingsToSync.apiKeys,
        models: settingsToSync.models,
        persistent
      }, {
        headers: { 'x-session-id': sessionId }
      });
      
      // Update aiConfig with the response
      if (response.data.config) {
        setAiConfig(prev => ({ ...prev, ...response.data.config }));
      }
      
      // Update test results
      if (response.data.testResults) {
        setTestResults(response.data.testResults);
        
        // Update connection status based on test results
        const newStatus = {};
        Object.entries(response.data.testResults).forEach(([provider, result]) => {
          newStatus[provider] = result.status === 'success' ? 'connected' : 'error';
        });
        setConnectionStatus(newStatus);
      }
      
      toast.success(response.data.message || '설정이 저장되었습니다');
      return response.data;
    } catch (error) {
      console.error('Error syncing settings to server:', error);
      const errorMessage = error.response?.data?.details || error.response?.data?.error || 'Failed to save settings';
      toast.error(`설정 저장 실패: ${errorMessage}`);
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const handleApiKeyChange = async (provider, value) => {
    try {
      const newSettings = {
        ...settings,
        apiKeys: {
          ...settings.apiKeys,
          [provider]: value
        }
      };
      setSettings(newSettings);
      // Auto-save to localStorage on change
      saveSettingsToStorage(newSettings);
      // Auto-sync to server
      await syncSettingsToServer(newSettings);
    } catch (error) {
      console.error('Error updating API key:', error);
      toast.error('API 키 업데이트에 실패했습니다.');
    }
  };

  const handleModelChange = async (provider, value) => {
    try {
      const newSettings = {
        ...settings,
        models: {
          ...settings.models,
          [provider]: value
        }
      };
      setSettings(newSettings);
      // Auto-save to localStorage on change
      saveSettingsToStorage(newSettings);
      // Auto-sync to server
      await syncSettingsToServer(newSettings);
    } catch (error) {
      console.error('Error updating model:', error);
      toast.error('모델 업데이트에 실패했습니다.');
    }
  };

  const fetchOpenRouterModels = async () => {
    try {
      const headers = { 'x-session-id': sessionId };
      const response = await axios.get('/api/ai/openrouter/models', { headers });
      
      setSettings(prev => ({
        ...prev,
        availableModels: {
          ...prev.availableModels,
          openrouter: response.data.models || []
        }
      }));
    } catch (error) {
      console.error('Error fetching OpenRouter models:', error);
      toast.error('OpenRouter 모델 목록을 불러오는데 실패했습니다');
    }
  };

  const handleProviderChange = async (newProvider) => {
    try {
      const newSettings = { ...settings, provider: newProvider };
      setSettings(newSettings);
      saveSettingsToStorage(newSettings);
      
      // Sync to server and wait for completion
      await syncSettingsToServer(newSettings);
      
      // Fetch updated config to ensure consistency
      await fetchAIConfig();
      
      toast.success(`AI 제공자가 ${newProvider}로 변경되었습니다.`);
    } catch (error) {
      console.error('Error changing provider:', error);
      toast.error('제공자 변경에 실패했습니다.');
      // Revert on error
      setSettings(prev => ({ ...prev, provider: prev.provider }));
    }
  };

  const testConnection = async (provider) => {
    try {
      setConnectionStatus(prev => ({ ...prev, [provider.toLowerCase()]: 'testing' }));
      
      const currentSettings = {
        provider: settings.provider,
        apiKeys: settings.apiKeys,
        models: settings.models
      };
      
      // Test by attempting to sync settings (this will validate API keys)
      const response = await syncSettingsToServer(currentSettings, false);
      
      if (response.testResults && response.testResults[provider.toLowerCase()]) {
        const result = response.testResults[provider.toLowerCase()];
        if (result.status === 'success') {
          setConnectionStatus(prev => ({ ...prev, [provider.toLowerCase()]: 'connected' }));
          toast.success(`${provider} 연결 테스트 성공`);
        } else {
          setConnectionStatus(prev => ({ ...prev, [provider.toLowerCase()]: 'error' }));
          toast.error(`${provider} 연결 테스트 실패: ${result.message}`);
        }
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      setConnectionStatus(prev => ({ ...prev, [provider.toLowerCase()]: 'error' }));
      toast.error(`${provider} 연결 테스트 실패`);
    }
  };
  
  const getStatusIcon = (provider) => {
    const status = connectionStatus[provider];
    switch (status) {
      case 'connected':
        return <span className="text-green-500">✓</span>;
      case 'error':
        return <span className="text-red-500">✗</span>;
      case 'testing':
        return <span className="text-yellow-500 animate-spin">⧖</span>;
      default:
        return <span className="text-gray-400">○</span>;
    }
  };
  
  const getStatusText = (provider) => {
    const status = connectionStatus[provider];
    switch (status) {
      case 'connected':
        return '연결됨';
      case 'error':
        return '오류';
      case 'testing':
        return '테스트 중...';
      default:
        return '미연결';
    }
  };
  
  const saveSettings = async () => {
    try {
      const settingsToSave = {
        provider: settings.provider,
        apiKeys: settings.apiKeys,
        models: settings.models
      };
      
      await syncSettingsToServer(settingsToSave, true);
      saveSettingsToStorage(settingsToSave);
      
    } catch (error) {
      console.error('Error saving settings:', error);
      // Error handling is done in syncSettingsToServer
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center mb-8">
        <CogIcon className="h-8 w-8 text-gray-600 mr-3" />
        <h1 className="text-3xl font-bold text-gray-900">설정</h1>
      </div>

      {/* AI Settings */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center mb-4">
          <CpuChipIcon className="h-6 w-6 text-purple-600 mr-2" />
          <h2 className="text-xl font-semibold text-gray-900">AI 모델 설정</h2>
        </div>

          {/* Current Status */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-lg mb-6 border border-blue-100">
          <div className="flex items-center mb-4">
            <InformationCircleIcon className="h-5 w-5 text-blue-600 mr-2" />
            <h3 className="font-semibold text-gray-900">현재 AI 설정 상태</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-3 rounded-lg shadow-sm">
              <span className="text-gray-600 text-sm block mb-1">현재 제공자</span>
              <div className="font-semibold text-gray-900">
                {aiConfig.availableProviders[settings.provider]?.name || settings.provider}
              </div>
              <div className="flex items-center mt-1">
                {getStatusIcon(settings.provider)}
                <span className="text-xs ml-1 text-gray-600">{getStatusText(settings.provider)}</span>
              </div>
            </div>
            
            {settings.provider === 'openrouter' && settings.models?.openrouter && (
              <div className="bg-white p-3 rounded-lg shadow-sm">
                <span className="text-gray-600 text-sm block mb-1">선택된 모델</span>
                <div className="font-semibold text-gray-900 text-sm">{settings.models.openrouter}</div>
              </div>
            )}
            
            <div className="bg-white p-3 rounded-lg shadow-sm">
              <span className="text-gray-600 text-sm block mb-1">설정 소스</span>
              <div className="text-sm">
                {aiConfig.configSource?.persistent && (
                  <span className="text-green-600 font-medium">파일 저장됨</span>
                )}
                {aiConfig.configSource?.environment && (
                  <span className="text-blue-600 font-medium">환경변수</span>
                )}
                {!aiConfig.configSource?.persistent && !aiConfig.configSource?.environment && (
                  <span className="text-gray-500">기본값</span>
                )}
              </div>
            </div>
            
            <div className="bg-white p-3 rounded-lg shadow-sm">
              <span className="text-gray-600 text-sm block mb-1">API 키 상태</span>
              <div className="space-y-1 text-xs">
                {settings.apiKeys.gemini && (
                  <div className="flex items-center">
                    {getStatusIcon('gemini')}
                    <span className="ml-1">Gemini</span>
                  </div>
                )}
                {settings.apiKeys.openrouter && (
                  <div className="flex items-center">
                    {getStatusIcon('openrouter')}
                    <span className="ml-1">OpenRouter</span>
                  </div>
                )}
                {!settings.apiKeys.gemini && !settings.apiKeys.openrouter && (
                  <span className="text-gray-500">API 키 없음</span>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-6">
          {/* Provider Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              AI 제공자 선택
            </label>
            <select
              value={settings.provider}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="template">템플릿 기반 (무료, 기본 기능만 제공)</option>
              <option value="gemini">Google Gemini 2.0 Flash (추천)</option>
              <option value="openrouter">OpenRouter AI (다양한 모델 지원)</option>
            </select>
          </div>

          {/* Template Provider Info */}
          {settings.provider === 'template' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <InformationCircleIcon className="h-5 w-5 text-blue-500 mt-0.5" />
                <div className="text-sm text-blue-700">
                  <strong>템플릿 기반 모드:</strong> API 키 없이 사용 가능한 기본 모드입니다. 
                  간단한 템플릿 기반 콘텐츠 생성만 제공됩니다.
                </div>
              </div>
            </div>
          )}

          {/* Gemini Settings */}
          {settings.provider === 'gemini' && (
            <div className="space-y-4">
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <KeyIcon className="h-4 w-4 text-gray-500" />
                    <label className="block text-sm font-medium text-gray-700">
                      Google AI API Key
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon('gemini')}
                    <span className="text-xs text-gray-600">{getStatusText('gemini')}</span>
                  </div>
                </div>
                <div className="relative">
                  <input
                    type="password"
                    value={settings.apiKeys.gemini}
                    onChange={(e) => handleApiKeyChange('gemini', e.target.value)}
                    className={`w-full px-3 py-2 pr-12 border rounded-md focus:outline-none focus:ring-2 ${
                      connectionStatus.gemini === 'connected' ? 'border-green-300 focus:ring-green-500' :
                      connectionStatus.gemini === 'error' ? 'border-red-300 focus:ring-red-500' :
                      'border-gray-300 focus:ring-purple-500'
                    }`}
                    placeholder="Google AI API 키를 입력하세요"
                  />
                  <button
                    onClick={() => testConnection('gemini')}
                    disabled={!settings.apiKeys.gemini || connectionStatus.gemini === 'testing'}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-2 py-1 rounded text-xs"
                  >
                    {connectionStatus.gemini === 'testing' ? '테스트 중...' : '테스트'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    Google AI Studio
                  </a>에서 무료 API 키를 발급받으세요
                </p>
                {testResults.gemini && (
                  <div className={`text-xs mt-2 p-2 rounded ${
                    testResults.gemini.status === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  }`}>
                    {testResults.gemini.message}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* OpenRouter Settings */}
          {settings.provider === 'openrouter' && (
            <div className="space-y-4">
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <KeyIcon className="h-4 w-4 text-gray-500" />
                    <label className="block text-sm font-medium text-gray-700">
                      OpenRouter API Key
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon('openrouter')}
                    <span className="text-xs text-gray-600">{getStatusText('openrouter')}</span>
                  </div>
                </div>
                <div className="relative">
                  <input
                    type="password"
                    value={settings.apiKeys.openrouter}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      handleApiKeyChange('openrouter', newValue);
                      // Load models when API key is entered
                      if (newValue.trim()) {
                        setTimeout(() => fetchOpenRouterModels(), 500);
                      }
                    }}
                    className={`w-full px-3 py-2 pr-12 border rounded-md focus:outline-none focus:ring-2 ${
                      connectionStatus.openrouter === 'connected' ? 'border-green-300 focus:ring-green-500' :
                      connectionStatus.openrouter === 'error' ? 'border-red-300 focus:ring-red-500' :
                      'border-gray-300 focus:ring-purple-500'
                    }`}
                    placeholder="OpenRouter API 키를 입력하세요"
                  />
                  <button
                    onClick={() => testConnection('openrouter')}
                    disabled={!settings.apiKeys.openrouter || connectionStatus.openrouter === 'testing'}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-2 py-1 rounded text-xs"
                  >
                    {connectionStatus.openrouter === 'testing' ? '테스트 중...' : '테스트'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    openrouter.ai
                  </a>에서 API 키를 발급받으세요 (결제 필요)
                </p>
                {testResults.openrouter && (
                  <div className={`text-xs mt-2 p-2 rounded ${
                    testResults.openrouter.status === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  }`}>
                    {testResults.openrouter.message}
                  </div>
                )}
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    모델 선택
                  </label>
                  <button
                    onClick={fetchOpenRouterModels}
                    className="text-xs text-blue-600 hover:text-blue-800"
                    type="button"
                  >
                    모델 목록 새로고침
                  </button>
                </div>
                <select
                  value={settings.models.openrouter}
                  onChange={(e) => handleModelChange('openrouter', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {settings.availableModels.openrouter.length > 0 ? (
                    settings.availableModels.openrouter.map(model => (
                      <option key={model.id} value={model.id}>
                        {model.name} 
                        {model.pricing && model.pricing.prompt && 
                          ` ($${(model.pricing.prompt * 1000000).toFixed(2)}/1M tokens)`
                        }
                      </option>
                    ))
                  ) : (
                    <>
                      <optgroup label="Google Models">
                        <option value="google/gemini-flash-1.5">Gemini Flash 1.5</option>
                        <option value="google/gemini-pro-1.5">Gemini Pro 1.5</option>
                      </optgroup>
                      <optgroup label="OpenAI Models">
                        <option value="openai/gpt-4o">GPT-4o</option>
                        <option value="openai/gpt-4o-mini">GPT-4o Mini</option>
                      </optgroup>
                      <optgroup label="Anthropic Models">
                        <option value="anthropic/claude-3-sonnet">Claude 3 Sonnet</option>
                        <option value="anthropic/claude-3-haiku">Claude 3 Haiku</option>
                      </optgroup>
                      <optgroup label="Meta Models">
                        <option value="meta-llama/llama-3.1-8b-instruct">Llama 3.1 8B</option>
                        <option value="meta-llama/llama-3.1-70b-instruct">Llama 3.1 70B</option>
                      </optgroup>
                    </>
                  )}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Info Panel */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
          <div className="flex items-start space-x-2">
            <InformationCircleIcon className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-700">
              <strong>설정 저장 방식:</strong> 
              <div className="mt-2 space-y-1">
                <div>• <strong>웹 UI 설정:</strong> 영구적으로 저장되며 서버 재시작 후에도 유지됩니다</div>
                <div>• <strong>환경변수:</strong> .env 파일에 설정하면 기본값으로 사용됩니다</div>
                <div>• <strong>우선순위:</strong> 웹 UI 설정 {'>'} 환경변수 {'>'} 기본값</div>
              </div>
              {aiConfig.configSource?.persistent && (
                <div className="mt-3 p-2 bg-green-100 rounded text-green-800 text-xs">
                  ✓ 현재 설정이 영구적으로 저장되어 있습니다
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-between mt-6 p-4 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600">
            {Object.keys(testResults).length > 0 && (
              <div className="flex items-center space-x-4">
                <span>연결 테스트 결과:</span>
                {Object.entries(testResults).map(([provider, result]) => (
                  <div key={provider} className="flex items-center space-x-1">
                    <span className="capitalize">{provider}:</span>
                    {result.status === 'success' ? (
                      <span className="text-green-600">✓ 성공</span>
                    ) : (
                      <span className="text-red-600">✗ 실패</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                setSettings({
                  provider: 'template',
                  apiKeys: { gemini: '', openrouter: '' },
                  models: { openrouter: 'google/gemini-2.5-flash-lite' },
                  availableModels: { openrouter: [] }
                });
                setTestResults({});
                setConnectionStatus({});
                toast.success('설정이 초기화되었습니다');
              }}
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm"
            >
              초기화
            </button>
            <button
              onClick={saveSettings}
              disabled={saving}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-2 px-6 rounded-lg shadow-md transition-all duration-200 flex items-center space-x-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>저장 중...</span>
                </>
              ) : (
                <>
                  <CheckCircleIcon className="h-4 w-4" />
                  <span>설정 저장</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Blog Settings Placeholder */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center mb-4">
          <DocumentTextIcon className="h-6 w-6 text-blue-600 mr-2" />
          <h2 className="text-xl font-semibold text-gray-900">블로그 설정</h2>
        </div>
        <div className="text-gray-600">
          블로그 관련 설정 기능은 추후 추가될 예정입니다.
        </div>
      </div>
    </div>
  );
}

export default Settings;