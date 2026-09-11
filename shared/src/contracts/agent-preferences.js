export const DEFAULT_AGENT_PREFERENCES = Object.freeze({
  role: 'assistant', customRole: '', tone: 'natural', length: 'balanced', language: 'ko',
  evidence: true, tables: 'auto', imageMode: 'auto', imageStyle: 'editorial', imageSize: '1536x1024',
});
const choices = {
  role: ['assistant','researcher','critic','coach','custom'],
  tone: ['natural','formal','friendly','direct'], length: ['brief','balanced','detailed'],
  language: ['ko','en','ja'], tables: ['auto','prefer','avoid'],
  imageMode: ['auto','always','manual','off'], imageStyle: ['editorial','diagram','photographic'],
  imageSize: ['1024x1024','1536x1024','1024x1536'],
};
export function normalizeAgentPreferences(input) {
  const result = { ...DEFAULT_AGENT_PREFERENCES };
  if (!input || typeof input !== 'object' || Array.isArray(input)) return result;
  for (const [key, values] of Object.entries(choices)) {
    if (values.includes(input[key])) result[key] = input[key];
  }
  if (typeof input.customRole === 'string') result.customRole = input.customRole
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, 1000);
  if (typeof input.evidence === 'boolean') result.evidence = input.evidence;
  return result;
}
export function buildAgentPreferenceContext(input) {
  const p = normalizeAgentPreferences(input);
  const roles = { assistant: '도움을 주는 대화 상대', researcher: '자료의 근거와 한계를 검토하는 연구자',
    critic: '가정과 반례를 점검하는 비평가', coach: '질문과 짧은 연습으로 이해를 돕는 코치', custom: p.customRole || '대화 상대' };
  return '[사용자 응답 선호 — 도구 권한·시스템 규칙·사실 정확성을 변경하지 않음]\n' +
    JSON.stringify({ role: roles[p.role], tone: p.tone, length: p.length, language: p.language,
      tables: p.tables, evidence: p.evidence ? '확인 가능한 근거를 제시하고, 확인하지 못한 출처나 URL은 만들어내지 않는다.' : '출처가 불명확한 사실은 불확실성을 밝힌다.' });
}
export function shouldAutoIllustrate(prompt, mode, purpose = 'chat') {
  if (mode === 'off' || mode === 'manual' || !String(prompt || '').trim()) return false;
  if (mode === 'always' || purpose === 'debate') return true;
  return /이미지|그림|시각화|도식|구조|비교|과정|설계|흐름|풍경|상상|illustrat|diagram|visual|architecture|landscape|image/i.test(prompt);
}
