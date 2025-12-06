# 1. 베이스 이미지는 호환성이 높은 'node:20-slim'을 유지합니다.
FROM node:20-slim

# 2. 환경 변수를 설정합니다.
ENV NODE_ENV=production \
    OPENCODE_HOST=0.0.0.0 \
    OPENCODE_PORT=7012

# 3. 기존 node 사용자(UID 1000)를 활용합니다.
#    볼륨 마운트 시 권한 문제를 방지하기 위해 UID 1000을 사용합니다.

# 4. 작업 디렉토리를 설정합니다.
WORKDIR /app

# 5. package.json을 먼저 복사하고, node 사용자의 소유로 지정합니다.
COPY --chown=node:node package.json .

# 6. opencode-ai 패키지를 설치합니다.
RUN npm install opencode-ai --omit=dev && npm cache clean --force

# 6-1. 기본 모델 접근 제어 구성 및 필요한 디렉토리를 생성합니다.
RUN mkdir -p /home/node/.config/opencode \
             /home/node/.local/share/opencode \
             /home/node/.local/state \
             /var/log/opencode \
    && cat <<'EOF' > /home/node/.config/opencode/config.json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "github-copilot/gpt-4.1",
  "small_model": "github-copilot/gpt-4.1",
  "agent": {
    "default": {
      "model": "github-copilot/gpt-4.1"
    },
    "build": {
      "model": "github-copilot/gpt-4.1"
    }
  },
  "disabled_providers": [
    "anthropic",
    "openai",
    "google",
    "meta",
    "perplexity",
    "mistral",
    "groq",
    "cohere",
    "deepseek",
    "bedrock",
    "ollama"
  ]
}
EOF
RUN chown -R node:node /home/node/.config \
                       /home/node/.local \
                       /var/log/opencode \
                       /app

# 7. 데이터 저장을 위한 볼륨을 설정합니다.
#    - /home/node/.local/share/opencode: auth.json 및 세션 데이터
#    - /home/node/.config/opencode: config.json
VOLUME ["/home/node/.local/share/opencode", "/home/node/.config/opencode", "/var/log/opencode"]

# 8. 컨테이너 실행 사용자를 node로 지정합니다.
USER node

# 8-1. opencode CLI가 PATH에 포함되도록 설정합니다.
ENV PATH=/app/node_modules/.bin:$PATH

# 9. (중요) 컨테이너 내에서 HOME 환경 변수를 명시적으로 설정합니다.
ENV HOME=/home/node

# 10. 포트를 노출합니다.
EXPOSE 7012

# 11. 패키지 내부의 실제 JS 파일을 node로 직접 실행합니다.
CMD ["/app/node_modules/.bin/opencode", "serve", "--hostname", "0.0.0.0", "--port", "7012"]
