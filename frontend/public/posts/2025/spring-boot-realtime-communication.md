---
title: "SSE와 WebSocket 사이에서, 나의 실시간 통신 여정을 적다"
date: "2025-09-17"
category: "Web"
tags: ['SSE', 'WebSocket', 'Redis', 'Kafka', '실시간통신']
excerpt: "JavaScript와 Spring Boot로 SSE와 WebSocket을 번갈아 구현하며 Redis와 Kafka를 저울질한 밤의 기록"
readTime: "8분"
---

오늘 저녁은 IDE보다 네트워크 다이어그램이 먼저 떠올랐다. “실시간 알림을 더 부드럽게 보낼 수 없을까?”라는 질문에 답을 찾고 싶어, 모니터 한쪽에는 MDN의 Server-Sent Events 문서를, 다른 쪽에는 WebSocket 프로토콜 스펙을 띄워 놓았다. 회사 알림 시스템이 Redis Pub/Sub 위에서 간신히 굴러가는 모습을 보면서, SSE와 WebSocket 두 친구와 제대로 대화해 보기로 한 밤이었다.

먼저 문을 두드린 건 SSE였다. `const evtSource = new EventSource('/events')`라는 짧은 한 줄이 브라우저에 상시 연결을 만들고, 서버는 표준 HTTP 연결을 ‘keep-alive’ 상태로 붙잡아 둔다. 내가 공부한 대로라면, 메시지는 `data:`로 시작해 `\n\n`으로 끝나는 단순한 텍스트였다. 그래서 Express로 작은 서버를 띄워 `res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });`라고 선언하고, 2초마다 `res.write("data: ${JSON.stringify({ message: 'Server time: ' + new Date() })}\n\n");`를 흘려보냈다. 브라우저 콘솔에서 “받은 데이터” 로그가 찍히는 순간, 마치 서버가 “먼저 연락할게”라고 손 흔드는 느낌이었다.

SSE의 장점은 명확했다. 서버에서 클라이언트 방향으로만 메시지를 던지면 되니 구조가 단순했고, 연결이 끊어지면 브라우저가 알아서 재연결을 시도했다. 텍스트만 전달하면 되니 JSON 문자열을 바로 보낼 수 있었고, Redis Pub/Sub과 결합하면 여러 서버 인스턴스가 한 채널을 보고 동시에 알림을 뿌릴 수 있었다. Nginx 설정도 비교적 단출했다. `proxy_set_header Connection '';`과 `proxy_buffering off;`, `proxy_read_timeout 1800s;` 정도만 챙기면 안정적으로 흘러갔다. 문제는 방향성. 클라이언트가 말을 붙이고 싶으면 결국 AJAX나 다른 채널을 열어야 했다.

그래서 WebSocket을 띄워 봤다. `const socket = new WebSocket('ws://localhost:3000');` 한 줄로 연결을 만들고, `socket.send(JSON.stringify({ type: 'greeting', message: 'Hello Server!' }));`로 말을 걸었다. 서버에서는 `ws` 라이브러리를 가져와 `const wss = new WebSocket.Server({ server });`로 시작해, `ws.on('message', (message) => { ... })`로 양방향 대화를 열어 두었다. 이 프로토콜은 HTTP로 시작해 “Upgrade: websocket”이라는 악수를 주고 받은 뒤, TCP 위에서 적은 헤더로 빠르게 이야기를 주고받는다. 텍스트뿐 아니라 바이너리 프레임도 후다닥 보낼 수 있고, 채팅이나 게임처럼 양쪽이 동시에 말해야 하는 상황에 제격이다.

하지만 자유에는 책임이 따랐다. WebSocket은 연결이 끊어지면 브라우저가 알아서 돌아오지 않는다. `socket.onclose`에서 직접 재연결 스케줄을 짜야 했고, 인증은 `Sec-WebSocket-Protocol` 헤더나 연결 이후의 첫 메시지로 별도로 처리해야 했다. 프록시도 더 예민했다. Nginx에게 `proxy_set_header Upgrade $http_upgrade;`, `proxy_set_header Connection "upgrade";`를 꼭 전달해야 했고, 타임아웃을 길게 잡지 않으면 예기치 않은 순간에 연결이 닫혔다.

둘을 비교하는 표를 손으로 그려 보니 성격 차이가 확실했다. SSE는 단방향, 텍스트 전용, 자동 재연결, HTTP 기반, 방화벽 친화적이었다. WebSocket은 양방향, 텍스트와 바이너리 지원, 수동 재연결, ws/wss 프로토콜, 낮은 헤더 오버헤드를 강점으로 내세웠다. “알림만 있으면 되는 페이지냐, 아니면 채팅과 협업 기능이 붙어야 하느냐”가 선택의 기준이라는 생각이 들었다.

실제로 우리 팀의 알림 시스템은 Redis Pub/Sub으로 여러 서버가 메시지를 공유한다. SSE와 묶으면 간단한 구조로 빠르게 결과를 얻을 수 있었지만, “혹시라도 메시지가 날아가면 어떡하지?”라는 걱정이 머리를 떠나지 않았다. Redis Pub/Sub은 구독 중인 클라이언트에게만 메시지를 던지고 바로 잊어버린다. 조금 늦게 붙은 클라이언트는 빈손이다. 그래서 Kafka를 꺼내 들었다. Kafka 토픽에 메시지를 영속적으로 남겨 두면, 소비자가 잠시 잠들었다가도 오프셋을 따라 읽어 나갈 수 있다. 기본 보존 기간이 168시간이지만 설정에 따라 더 길게, 혹은 로그 크기 기준으로 조절할 수 있다.

Kafka를 붙이기로 결심했을 때 가장 크게 바뀐 사고방식은 “토픽과 파티션”이었다. 하나의 토픽은 여러 파티션으로 나뉘고, 각 파티션은 순서가 있는 레코드 시퀀스다. 키가 없는 메시지는 라운드 로빈으로 흩어지지만, 키를 지정하면 동일한 키가 항상 같은 파티션으로 들어가 순서가 보장된다. 파티션마다 리더와 팔로워가 있어서 한 노드가 쓰러져도 다른 노드가 리더가 될 수 있다는 것도 안심이 됐다. Redis Pub/Sub이 즉발적인 대화라면, Kafka는 “일단 말을 남겨 두고 천천히 들어도 좋아”라고 말해주는 일기장 같았다.

이제 손에 쥔 도구는 세 가지였다. SSE는 단방향 알림과 로그성 이벤트에, WebSocket은 채팅과 양방향 제어에, Kafka는 놓쳐선 안 되는 메시지에. Redis는 여전히 실시간 브로드캐스트에 유용했지만, 데이터 손실 우려가 있는 경우에는 Kafka를 뒤에 붙여 든든한 안전망을 만들 생각이다. Redis에 메시지를 publish하면서 동시에 Kafka 토픽에도 남겨 두면, 나중에 지연된 소비자가 있어도 문제 없다. Kafka의 파티션 키를 세션 ID나 룸 ID로 잡아두면, 순서도 유지된다.

그렇게 밤을 지새우며 두 개의 다이어그램을 노트에 그렸다. 첫 번째는 SSE 흐름도였다. 클라이언트는 `/api/subscribe/{userId}`로 연결을 열고, Spring Boot는 `SseEmitter`를 만들어 맵에 저장한다. Redis에서 메시지를 받아오면 해당 사용자에게 `emitter.send(SseEmitter.event().name("notification").data(notification))`를 보냈다. 55초마다 하트비트를 보내는 스케줄러도 덧붙였다. 두 번째는 WebSocket 흐름도였다. `WebSocketHandler`가 세션을 관리하고, 메시지는 Redis로 퍼뜨린 뒤 다시 모든 세션으로 broadcast됐다. SockJS를 붙여 소켓이 막힌 환경에서 폴백도 준비했다.

문득 이런 생각이 들었다. “만약 방화벽이 WebSocket을 막아버린다면?” 그래서 WebSocket이 실패하면 SSE로 폴백하는 전략을 모색했다. 클라이언트에서 `new WebSocket(...)`이 실패하면 EventSource를 열어 두고, 서버에서는 동일한 메시지를 SSE 채널로 한 번 더 흘리는 구조다. 다만 프로토콜이 다른 만큼 인증과 세션 동기화를 맞추는 일이 쉽지 않았다. 쿠키 기반 인증을 쓰면 문제 없지만, 토큰을 헤더로 주고받아야 할 땐 EventSource가 커스텀 헤더를 붙이지 못해 URL 파라미터나 초기화 API 호출이 필요했다.

이 모든 실험이 끝난 뒤, 노트를 덮으며 다시 질문을 적었다. “Redis Pub/Sub 말고 Kafka를 쓰면 정보가 날아가지 않겠지?” 답은 분명했다. Kafka는 디스크에 메시지를 영속시키고, 소비자가 오프라인이어도 오프셋에서 다시 읽게 해준다. 반면 Redis Pub/Sub은 구독자가 없으면 메시지를 지워 버린다. Kafka의 토픽을 적절히 파티션 분할하고, replication factor를 3으로 잡으면 하나의 브로커가 쓰러져도 데이터는 그대로 살아 있다. 대신 운영 복잡도가 올라가니, 시스템의 중요도와 팀의 역량을 함께 고려해야 한다는 메모를 남겼다.

마지막으로, 두 기술을 언제 선택할지 스스로에게 요약해 봤다. “딱 서버에서 알림만 뿌리면 된다면 SSE, 사용자도 말을 걸어야 하면 WebSocket, 메시지를 절대 잃어서는 안 되면 Kafka.” 그래도 늘 그렇듯, 실제 서비스에서는 이 셋이 함께 춤을 춘다. 오늘 밤 내가 짠 코드는 단지 초안일 뿐이고, 내일 팀과 함께 더 나은 균형점을 찾아야 한다. 노트북을 닫으며 이렇게 적어 두었다. “혹시 WebSocket이 막히면 SSE로 낮춰서라도 메시지를 보내는, 그런 끈질긴 시스템을 만들자.” 내일의 내가 이 다짐을 기억해 주길 바라면서.