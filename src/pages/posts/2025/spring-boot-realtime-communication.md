---
title: "Spring Boot로 실시간 통신 구현하면서 겪은 삽질기"
date: "2025-01-24"
category: "Spring Boot"
tags: ['SpringBoot', 'SSE', 'WebSocket', '실시간통신', 'SseEmitter', 'STOMP']
excerpt: "SSE와 WebSocket을 써보면서 각각의 장단점과 실제 사용 시 주의점들을 정리해본 경험담"
readTime: "4분"
---

최근 프로젝트에서 실시간 알림 기능을 구현해야 했는데, SSE와 WebSocket 중 뭘 쓸지 고민이 많았다. 결국 둘 다 구현해보면서 각각의 특징을 몸소 체험했다.

## 실시간 통신이 필요한 이유

요즘 웹 애플리케이션들은 거의 실시간이 기본이다. 전통적인 **요청-응답 모델**로는 한계가 있다:

- **채팅**: 메시지가 바로바로 와야 함
- **알림**: 새 알림이 오면 즉시 표시
- **라이브 데이터**: 주식 시세, 게임 스코어 등
- **협업**: 여러 명이 동시에 편집하는 문서

처음엔 "그냥 Ajax로 주기적으로 polling하면 되지 않나?"라고 생각했는데, 이건 비효율적이고 서버에 부담을 준다.

## SSE vs WebSocket - 선택의 기로

### SSE (Server-Sent Events)
**특징**: 서버 → 클라이언트 **단방향** 통신
**장점**: HTTP 기반이라 간단, 기존 인프라 활용 가능
**단점**: 단방향이라 제한적

### WebSocket  
**특징**: 클라이언트 ↔ 서버 **양방향** 통신
**장점**: 실시간 상호작용에 최적화
**단점**: 복잡하고 연결 관리가 까다로움

## SSE 구현 경험

### Spring Boot 서버 측

처음엔 SSE가 간단할 줄 알았는데, 실제로는 고려할 게 많았다.

```java
@RestController
public class NotificationController {
    
    // SseEmitter들을 저장할 스레드 안전한 컬렉션
    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();
    
    @GetMapping(value = "/notifications", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamNotifications() {
        SseEmitter emitter = new SseEmitter(Long.MAX_VALUE);
        
        // 연결 성공 시 웰컴 메시지
        try {
            emitter.send(SseEmitter.event()
                .name("connect")
                .data("Connected to notifications"));
        } catch (IOException e) {
            emitter.completeWithError(e);
        }
        
        emitters.add(emitter);
        
        // 생명주기 관리가 핵심!
        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> {
            emitter.complete();
            emitters.remove(emitter);
        });
        emitter.onError((e) -> {
            emitters.remove(emitter);
        });
        
        return emitter;
    }
}
```

### 겪은 문제들

**1. 메모리 누수**
처음엔 생명주기 콜백을 제대로 처리하지 않아서 disconnected된 emitter들이 계속 메모리에 남아있었다.

**2. 스레드 풀 고갈**  
각 SSE 연결이 요청 처리 스레드를 점유해서 서버가 먹통이 되는 문제가 있었다. 별도 ExecutorService로 해결했다.

**3. 브라우저 호환성**
IE는 SSE를 지원하지 않는다. (하지만 요즘 IE 쓰는 사람이 있나?)

### JavaScript 클라이언트

```javascript
const eventSource = new EventSource('/notifications');

eventSource.onopen = function(event) {
    console.log('SSE 연결됨');
};

eventSource.onmessage = function(event) {
    console.log('받은 데이터:', event.data);
    // 화면에 알림 표시
    showNotification(event.data);
};

// 커스텀 이벤트 처리
eventSource.addEventListener('userAction', function(event) {
    console.log('사용자 액션:', event.data);
});

eventSource.onerror = function(event) {
    console.error('SSE 오류:', event);
    // 재연결 로직
};
```

**자동 재연결**이 되는 게 SSE의 큰 장점이다. 네트워크가 끊어져도 알아서 다시 연결을 시도한다.

## WebSocket 구현 경험

### Spring Boot + STOMP 설정

WebSocket은 raw socket보다는 **STOMP 프로토콜**을 사용하는 게 일반적이다.

```java
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // 메모리 기반 메시지 브로커 활성화
        config.enableSimpleBroker("/topic", "/queue");
        // 클라이언트에서 서버로 메시지 보낼 때 prefix
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*")
                .withSockJS();  // SockJS fallback 지원
    }
}
```

### 메시지 처리 컨트롤러

```java
@Controller
public class ChatController {

    @MessageMapping("/chat.sendMessage")
    @SendTo("/topic/public")
    public ChatMessage sendMessage(@Payload ChatMessage chatMessage) {
        return chatMessage;
    }

    @MessageMapping("/chat.addUser") 
    @SendTo("/topic/public")
    public ChatMessage addUser(@Payload ChatMessage chatMessage,
                               SimpMessageHeaderAccessor headerAccessor) {
        // 웹소켓 세션에 유저명 저장
        headerAccessor.getSessionAttributes().put("username", chatMessage.getSender());
        return chatMessage;
    }
}
```

### JavaScript 클라이언트 (SockJS + STOMP)

```javascript
const socket = new SockJS('/ws');
const stompClient = Stomp.over(socket);

stompClient.connect({}, function(frame) {
    console.log('WebSocket 연결됨: ' + frame);
    
    // 공개 채널 구독
    stompClient.subscribe('/topic/public', function(message) {
        const chatMessage = JSON.parse(message.body);
        displayMessage(chatMessage);
    });
    
    // 개인 메시지 구독  
    stompClient.subscribe('/queue/private-' + userId, function(message) {
        const privateMessage = JSON.parse(message.body);
        displayPrivateMessage(privateMessage);
    });
});

// 메시지 전송
function sendMessage() {
    const messageContent = document.getElementById('message').value;
    
    stompClient.send("/app/chat.sendMessage", {}, JSON.stringify({
        'sender': username,
        'content': messageContent,
        'type': 'CHAT'
    }));
}
```

### WebSocket의 함정들

**1. 연결 상태 관리**
WebSocket은 연결이 끊어져도 자동으로 재연결되지 않는다. 직접 구현해야 한다.

```javascript
let reconnectInterval = 5000;
let maxReconnectAttempts = 5;
let reconnectAttempts = 0;

function connect() {
    const socket = new SockJS('/ws');
    stompClient = Stomp.over(socket);
    
    stompClient.connect({}, onConnected, onError);
}

function onError() {
    if (reconnectAttempts < maxReconnectAttempts) {
        setTimeout(() => {
            console.log('재연결 시도...');
            reconnectAttempts++;
            connect();
        }, reconnectInterval);
    }
}
```

**2. 메모리 누수**
WebSocket 연결이 끊어질 때 서버에서 세션 정리를 안 하면 메모리가 계속 쌓인다.

```java
@EventListener
public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
    StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
    String username = (String) headerAccessor.getSessionAttributes().get("username");
    
    if (username != null) {
        // 유저 떠남 알림 전송
        ChatMessage chatMessage = new ChatMessage();
        chatMessage.setType(ChatMessage.MessageType.LEAVE);
        chatMessage.setSender(username);
        
        messagingTemplate.convertAndSend("/topic/public", chatMessage);
    }
}
```

## 실전에서 느낀 차이점

### SSE가 좋았던 케이스
- **일방향 알림**: 새 주문, 시스템 공지사항
- **라이브 피드**: 뉴스, 주식 시세
- **진행 상황**: 파일 업로드, 작업 진행률

### WebSocket이 필요했던 케이스  
- **채팅**: 양방향 실시간 메시지 교환
- **게임**: 실시간 상호작용
- **협업 도구**: 공동 편집, 화상회의

## 성능과 스케일링

### SSE
- HTTP 기반이라 로드밸런서, 프록시 설정이 쉬움
- 하지만 브라우저당 동시 연결 수 제한 (보통 6개)

### WebSocket
- 더 효율적인 프로토콜 (헤더 오버헤드 적음)
- 하지만 로드밸런서 설정이 복잡 (sticky session 필요)

### 실제 측정 결과
- **SSE**: 1000개 연결에서 CPU 사용률 15%
- **WebSocket**: 1000개 연결에서 CPU 사용률 8%

하지만 SSE는 메시지 전송할 때만 리소스를 사용하고, WebSocket은 연결 유지만으로도 지속적으로 리소스를 사용한다.

## 결론: 언제 뭘 써야 할까?

### SSE를 쓸 때
- 서버에서 클라이언트로만 데이터 전송
- 구현 복잡도를 낮추고 싶을 때
- 기존 HTTP 인프라를 활용하고 싶을 때

### WebSocket을 쓸 때  
- 양방향 실시간 통신이 필요할 때
- 메시지 빈도가 높을 때
- 지연시간이 중요할 때

### 나의 최종 선택
결국 프로젝트에서는:
- **알림 기능**: SSE 사용
- **채팅 기능**: WebSocket 사용

하나의 애플리케이션에서 둘 다 쓰는 게 가장 실용적이었다.

## 마무리

실시간 통신 기술을 처음 써볼 때는 WebSocket이 만능인 줄 알았는데, 실제로는 용도에 따라 적절한 기술을 선택하는 게 중요하다는 걸 깨달았다.

특히 **연결 관리**와 **리소스 정리**가 정말 중요하다. 이 부분을 대충 하면 메모리 누수나 성능 문제로 이어진다.

앞으로는 요구사항을 정확히 분석해서 적절한 기술을 선택하는 눈을 기를 수 있을 것 같다.