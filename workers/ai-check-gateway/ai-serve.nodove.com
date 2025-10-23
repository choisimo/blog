upstream ai_backend {
    server localhost:7012;
}


server {
  listen 80;
  listen [::]:80;
  server_name ai-serve.nodove.com;
  
  if ($http_SECRET_API_KEY | $http_x_internal_gateway_key != "hUZohg+9x6/7Iaf0B0Bnxx+wVQzCJF0YSly271t3FFU=") {
    return 403;
  }
  # Security headers
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-Frame-Options "SAMEORIGIN" always;
  add_header X-XSS-Protection "1; mode=block" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;
  add_header Content-Security-Policy "default-src 'self'; connect-src 'self' https://api.openai.com ws: wss:; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline';" always;
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;


	location ~ /.well-known/acmne-challenge/ {
	allow all;
	root /var/www/html;
	}
}

server {
	listen 443 ssl http2;
	listen [::]:443 ssl http2;
	server_name ai-serve.nodove.com;

  ssl_certificate /etc/letsencrypt/live/nodove.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nodove.com/privkey.pem;
	
# SSL 보안 강화 설정
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;

    # 기존에 설정한 보안 헤더들 (HSTS 포함)
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; connect-src 'self' https://api.openai.com wss://ai-serve.nodove.com; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline';" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    # 프록시 설정
    location / {
        proxy_pass http://ai_backend; # upstream 이름으로 호출
        proxy_http_version 1.1;

        # 2. WebSocket을 위한 헤더 설정 (중복 제거)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade"; # "upgrade"만 남김

        # 클라이언트 정보 전달을 위한 헤더들
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
