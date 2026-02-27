import { quiz } from './src/services/ai';

// Mock fetch
global.fetch = async () => {
  return {
    ok: true,
    json: async () => ({
      ok: true,
      data: {
        data: {
          title: "비트 조작 (Bit Manipulation) 문제와 구현",
          problems: [
            {
              number: 1,
              description: "배열에서 하나만 존재하는 수 찾기 (XOR)",
              python_function: "def single_number(nums: List[int]) -> int\n    result = 0",
            }
          ]
        },
        mode: "custom",
        source: "backend"
      }
    }),
    text: async () => "error"
  } as any;
};

// Also we might need to mock ensureSession and getApiBaseUrl
jest.mock('./src/services/chat', () => ({
  ensureSession: async () => 'mock-session'
}));
jest.mock('./src/utils/apiBase', () => ({
  getApiBaseUrl: () => 'http://localhost'
}));

