# GitHub Secrets 설정 가이드

GitHub Actions에서 Cloudflare Workers 배포를 위한 Secret 설정 방법입니다.

## 필요한 Secrets

다음 4개의 Secret을 설정해야 합니다:
1. `CLOUDFLARE_ACCOUNT_ID` - Cloudflare 계정 ID
2. `CLOUDFLARE_API_TOKEN` - Cloudflare API 토큰
3. `GEMINI_API_KEY` - Google Gemini API 키
4. `JWT_SECRET` - JWT 서명용 비밀 키

---

## 1. CLOUDFLARE_ACCOUNT_ID 설정

### 계정 ID 확인 방법
1. https://dash.cloudflare.com 로그인
2. 오른쪽 사이드바에서 **Account ID** 확인
3. 또는 `wrangler.toml`에서 확인:
   ```toml
   account_id = "f6f11e2a4e5178d2f37476785018f761"
   ```

### GitHub Secret 설정
1. GitHub Repository → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret** 클릭
3. Name: `CLOUDFLARE_ACCOUNT_ID`
4. Value: 계정 ID 입력 (예: `f6f11e2a4e5178d2f37476785018f761`)
5. **Add secret** 클릭

---

## 2. CLOUDFLARE_API_TOKEN 설정

### API Token 생성
1. https://dash.cloudflare.com/profile/api-tokens 방문
2. **Create Token** 클릭
3. **Edit Cloudflare Workers** 템플릿 선택
4. 또는 **Custom token**으로 다음 권한 설정:
   - **Account**: 
     - D1: Edit
     - Workers Scripts: Edit
   - **Zone**: 
     - Workers Routes: Edit (선택사항)

5. **Continue to summary** → **Create Token**
6. 생성된 토큰 복사 (다시 볼 수 없으니 주의!)

### 필수 권한 확인
생성한 API Token이 다음 권한을 포함해야 합니다:
- ✅ Account - D1: Edit
- ✅ Account - Workers Scripts: Edit
- ✅ Account - Account Settings: Read

### GitHub Secret 설정
1. GitHub Repository → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret** 클릭
3. Name: `CLOUDFLARE_API_TOKEN`
4. Value: 생성한 API Token 붙여넣기
5. **Add secret** 클릭

---

## 3. GEMINI_API_KEY 설정

### API Key 발급
1. https://aistudio.google.com/app/apikey 방문
2. **Create API Key** 클릭
3. 키 복사 (AIza로 시작하는 문자열)

### GitHub Secret 설정
1. GitHub Repository → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret** 클릭
3. Name: `GEMINI_API_KEY`
4. Value: 발급받은 API Key
5. **Add secret** 클릭

---

## 4. JWT_SECRET 설정

### Secret 생성
로컬에서 안전한 랜덤 문자열 생성:
```bash
openssl rand -base64 32
```

출력 예시:
```
DtRlOC1noMuWlWTZw2e3Ob58zx1j7av5vJuv0RPz3GY=
```

### GitHub Secret 설정
1. GitHub Repository → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret** 클릭
3. Name: `JWT_SECRET`
4. Value: 생성한 랜덤 문자열
5. **Add secret** 클릭

---

## ✅ 설정 확인

### 모든 Secret이 설정되었는지 확인
GitHub Repository → **Settings** → **Secrets and variables** → **Actions**에서:
- [x] CLOUDFLARE_ACCOUNT_ID
- [x] CLOUDFLARE_API_TOKEN
- [x] GEMINI_API_KEY
- [x] JWT_SECRET

### 로컬 테스트
로컬에서 API Token이 올바른지 테스트:
```bash
cd workers
export CLOUDFLARE_API_TOKEN="your-api-token"
export CLOUDFLARE_ACCOUNT_ID="your-account-id"
npx wrangler whoami
```

성공 응답 예시:
```
Getting User settings...
👋 You are logged in with an API Token, associated with the email '***@example.com'!
```

---

## 🚨 트러블슈팅

### 7403 에러: "account is not authorized"
**원인**: API Token 권한 부족 또는 Account ID 불일치

**해결**:
1. Cloudflare Dashboard에서 Account ID 재확인
2. API Token에 D1 Edit 권한이 있는지 확인
3. 필요시 Token 재생성하여 다시 설정

### Secret이 반영되지 않음
**해결**: Secret 변경 후 새 workflow를 트리거해야 합니다
```bash
git commit --allow-empty -m "chore: trigger workflow"
git push
```

### API Token 테스트 실패
**해결**: Token이 만료되었거나 권한이 부족한 경우 재발급
1. https://dash.cloudflare.com/profile/api-tokens
2. 기존 Token 삭제
3. 새 Token 생성
4. GitHub Secret 업데이트

---

## 📚 참고 문서

- [Cloudflare API Tokens](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)
- [Wrangler Authentication](https://developers.cloudflare.com/workers/wrangler/ci-cd/)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
