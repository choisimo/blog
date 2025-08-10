require('dotenv').config();
const axios = require('axios');

async function testAI() {
  try {
    console.log('AI 설정 테스트 시작...');
    console.log('현재 AI_PROVIDER:', process.env.AI_PROVIDER || 'template');
    
    if (process.env.GOOGLE_AI_API_KEY) {
      console.log('✅ Google AI API 키 발견');
    } else {
      console.log('❌ Google AI API 키 없음');
    }
    
    if (process.env.OPENROUTER_API_KEY) {
      console.log('✅ OpenRouter API 키 발견');
    } else {
      console.log('❌ OpenRouter API 키 없음');
    }
    
    // 템플릿 기반 테스트
    console.log('\n템플릿 기반 AI 테스트...');
    const { AIService } = require('./ai-test-helper');
    
    const result = await AIService.generateWithTemplate(
      'React Hook 사용법',
      'title',
      '',
      ''
    );
    
    console.log('템플릿 결과:', result);
    console.log('✅ AI 시스템 준비 완료!');
    
  } catch (error) {
    console.error('❌ AI 테스트 실패:', error.message);
  }
}

testAI();
