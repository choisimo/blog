---
title: "베스트 프랙티스가 병목으로 바뀌는 순간: 싱글톤, Nginx, SAGA를 다시 보는 일"

date: "2026-03-10" 

category: "Architecture"

tags: ["System Design", "Distributed Systems", "Singleton", "Nginx", "SAGA", "Design for Failure"]

excerpt: "싱글톤, 단일 Nginx 리버스 프록시, SAGA 패턴이 과연 좋은 방법일까?" 

readTime: "16분"
---

# 세상에 좋고, 나쁜 것은 없다. 우리가 그렇게 바라볼 뿐이지.

![saga](/images/2026/limitation_of_bestcases/MessageBrokerLimit.png)

어느 날 문득 생각해보았다. 처음에는 우리를 구해 주던 구조가, 트래픽이 늘고 조직이 커지고 예외가 쌓이면서 어느 순간 가장 먼저 흔들리는 부분이 되어 버린다는 것 말이다. 

싱글톤도 그렇고, Nginx도 그렇고, SAGA도 그렇다. 이름만 들으면 익숙하고, 문서도 많고, 어디서나 "보편적 패턴"처럼 소개되지만, 막상 시스템 한복판에 넣어 보면 그 패턴이 해결한 문제만큼 새로운 문제를 데리고 오곤 한다.

![베스트 프랙티스가 병목으로 바뀌는 흐름](/images/2026/limitation_of_bestcases/cascading_failures.png)

이 글에서 하고 싶은 말은 단순하다. 패턴은 죄가 없지만, 맥락을 잃은 패턴은 꽤 비싼 대가를 가질 수 있다는 것이다. 설계는 유행어를 수집하는 일이 아니라, 실패를 어디에 가두고 어떤 비용을 감수할지 미리 고르는 일에 더 가깝다. 네트워크는 비유가 아니라 물리이기도 하다. 대역폭은 무한하지 않고, 지연 시간은 사라지지 않으며, WAN 구간은 지금도 LAN처럼 행동하지 않는다. 그래서 생각 정리도 할 겸, 왜 이들이 때로는 좋은 도구이고 또 때로는 재앙의 입구가 되는지 차분하게 살펴보려 한다.

## 싱글톤은 왜 이렇게 자꾸 편해 보일까

의존성을 하나씩 주입하는 일이 유난히 번거롭게 느껴지는 날이 있다. 객체를 이곳저곳 전달하는 대신 `getInstance()` 한 번으로 끝내고 싶어지는 순간이 분명 있다. 작은 프로그램에서는 실제로 일이 빨라진다. 설정 캐시, 로거, 메트릭 수집기처럼 "프로세스 전체에서 하나여도 괜찮은가?"라는 질문에 얼추 예라고 답할 수 있는 대상이라면 더욱 그렇다.

문제는 싱글톤이 종종 "편리한 접근 방식"을 넘어 "전역 상태의 은신처"가 된다는 데 있다. 읽기 전용이어야 할 객체 안에 캐시가 붙고, 캐시 옆에 뮤텍스가 붙고, 그 뮤텍스 뒤에 I/O가 붙는 순간, 어느새 모든 요청이 한 점으로 몰리는 구조를 만들어 버린다. 처음에는 코드가 단정해 보이지만, 시간이 지나면 테스트가 어려워지고, 경합이 생기고, 특정 객체 하나가 사실상의 SPOF에 가까운 병목이 된다. 마치 집 안 열쇠를 한 군데에만 두면 처음에는 찾기 쉽지만, 바쁜 아침마다 모두가 그 서랍 앞에 몰려드는 것과 비슷하다.

```go
package pricing

import "sync"

type Quote struct {
    SKU   string
    Price int
}

type Engine struct {
    mu    sync.Mutex
    cache map[string]Quote
}

var singleton = &Engine{
    cache: map[string]Quote{},
}

func GetQuote(sku string) Quote {
    singleton.mu.Lock()
    defer singleton.mu.Unlock()

    if quote, ok := singleton.cache[sku]; ok {
        return quote
    }

    quote := fetchFromRemote(sku) // 느린 I/O
    singleton.cache[sku] = quote
    return quote
}
```

이 코드는 보기엔 단순하지만, 요청 수가 늘수록 `singleton.mu`가 모든 것을 세워 둔다. 캐시 적중률이 낮거나 원격 호출이 느려지는 순간, 처리량은 애플리케이션 전체에서 함께 떨어진다. 더 곤란한 점은 테스트다. 한 테스트가 남긴 캐시 상태가 다음 테스트에 스며들기 시작하면, 실패는 재현되지 않고 신뢰만 조금씩 깎여 나간다.

그래서 가능하면 "하나의 객체"보다 "명시적인 수명 주기"를 먼저 보는 편으로 보편적 사고를 바꾸었다. 즉, 꼭 공유해야 하는 상태는 인터페이스 뒤로 숨기고, 읽기 전용이라면 불변으로 만들고, 요청마다 달라지는 값은 컨텍스트나 의존성 주입으로 넘기는 편이 낫다. 특히 쓰기 가능한 전역 캐시는, 성능 최적화처럼 보이지만 사실상 운영 정책을 코드 안에 던져두는 것과 같다.

```typescript
type Quote = { sku: string; price: number };

interface QuoteStore {
  get(sku: string): Promise<Quote | null>;
  set(quote: Quote): Promise<void>;
}

interface QuoteClient {
  fetch(sku: string): Promise<Quote>;
}

export function createPricingService(deps: {
  store: QuoteStore;
  client: QuoteClient;
}) {
  return {
    async getQuote(sku: string): Promise<Quote> {
      const cached = await deps.store.get(sku);
      if (cached) return cached;

      const fresh = await deps.client.fetch(sku);
      await deps.store.set(fresh);
      return fresh;
    },
  };
}
```

이 방식은 코드가 조금 더 길어 보이지만, 대신 어떤 저장소를 쓰는지, 어떤 클라이언트를 붙이는지, 어디까지가 공유 상태인지가 훨씬 또렷해진다. 운영에서는 샤딩된 캐시, 프로세스별 로컬 캐시, 요청 범위 객체 같은 선택지도 열리기 쉽다. 결국 트레이드오프는 명확하다. 싱글톤은 배선이 짧아지는 대신 경계가 흐려지고, DI는 코드가 조금 늘어나는 대신 실험과 교체가 쉬워진다.

그렇다고 싱글톤을 무조건 죄악 취급할 필요는 없다. 정말로 상태가 불변이고, 프로세스 단위로 하나만 있어도 되며, 테스트에서 쉽게 교체할 수 있다면 괜찮은 선택일 수 있다. 예를 들어 정적 설정 로더, 읽기 전용 룰셋, 프로세스 전체에 하나만 있어도 되는 메트릭 레지스트리는 비교적 안전한 편이다. 결국 중요한 것은 "하나만 존재하는가"가 아니라 "그 하나가 변경 가능한가, 경합을 만드는가, 장애 도메인을 키우는가"다. 편의와 명확성 사이의 줄다리기에서, 주관적 짧은 견해로는 후자의 값을 먼저 확인하는 편이 나을 것 같긴하다. 

## 문 앞에 Nginx 한 대를 세우는 순간

리버스 프록시는 정말 많은 문제를 예쁘게 정리해 준다. TLS 종료, 정적 캐시, 헤더 정리, 압축, 라우팅, 레이트 리밋까지, 문 앞에 서 있는 유능한 현관지기처럼 보인다. 그래서 작은 서비스에서는 거의 자동으로 Nginx를 앞단에 두게 된다. 그런데 그 현관지기가 "한 명뿐"이라면 이야기가 조금 달라진다. 내부 서비스가 멀쩡해도, 모든 요청이 반드시 한 지점을 지나야 한다는 사실 자체가 이미 설계의 모양을 결정한다.

![단일 Nginx 관문에서 발생하는 연쇄 장애](/images/2026/limitation_of_bestcases/traffic_spof.git)

실제로 홈서버 관리를 하다 보면 가장 답답한 순간이 있다. 애플리케이션 인스턴스는 살아 있고, 데이터베이스도 살아 있고, 내부 헬스체크도 통과하는데, 바깥에서는 전체 장애처럼 보이는 순간이다. 물리적 스타 토폴로지에서 중앙 허브가 멈췄을 때 세그먼트 전체가 끊긴 것처럼 느껴지는 장면과 닮아 있다. 관문이 포화 상태에 들어가면 사용자 입장에서는 뒤에 몇 대의 서버가 건강한지는 아무 의미가 없다. 그들은 결과만을 보기 때문이다. 예로 들어서, 터널이 막힌 고속도로에서 터널 앞의 모든 차가 줄을 서는 것과 같다.


```nginx
upstream app_backend {
    server 10.0.0.11:5080;
    server 10.0.0.12:5080;
}

server {
    listen 443 ssl http2;
    server_name api.example.com;

    location / {
        proxy_pass http://app_backend;
        proxy_read_timeout 60s;
        proxy_connect_timeout 5s;
    }
}
```

이 구성이 틀린 것은 아니다. 다만 이 Nginx가 단일 VM, 단일 컨테이너, 단일 장애 도메인에 놓여 있다면, `app_backend`가 몇 대이든 외부 진입점은 여전히 하나다. 트래픽이 몰릴 때는 연결 큐가 쌓이고, 타임아웃이 늘고, 재시도가 또 다른 재시도를 부르면서 앞단이 오히려 증폭기가 된다. 물리적 collision domain과 완전히 같은 개념은 아니더라도, L7 앞단 큐가 포화될 때 체감은 꽤 비슷하다. 좁은 한 점의 혼잡이 전체 시스템의 인상을 결정한다.

그래서 "Nginx를 쓰느냐 마느냐"보다 "Nginx를 어디까지의 책임으로 제한하느냐"를 먼저 고려해보는 것이 좋을 것 같다. 한 대의 프록시에 TLS 종료, 캐시, WAF 흉내, 인증 우회, 대용량 업로드, 장기 연결, 내부 라우팅까지 다 몰아주면, 그 순간 관문은 단순한 라우터가 아니라 가장 무거운 서비스가 되기 때문이다. 반대로 게이트웨이를 복수 인스턴스로 두고, 앞단에 L4 로드밸런서나 CDN을 두며, 타임아웃과 백프레셔 정책을 분리하면 이야기가 많이 달라진다.

```nginx
upstream app_backend {
    least_conn;
    server 10.0.0.11:5080 max_fails=3 fail_timeout=10s;
    server 10.0.0.12:5080 max_fails=3 fail_timeout=10s;
    keepalive 64;
}

server {
    listen 443 ssl http2;
    server_name api.example.com;

    location / {
        proxy_pass http://app_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_connect_timeout 2s;
        proxy_read_timeout 15s;
        proxy_next_upstream error timeout http_502 http_503 http_504;
    }
}
```

물론 이것만으로 고가용성이 완성되지는 않는다. 위 설정도 여전히 "Nginx 한 대"라면 근본 문제는 남기 때문이다. 그래서 현실적인 해법은 보통 한 단계 더 간다. CDN 또는 L4 LB 뒤에 게이트웨이 인스턴스를 둘 이상 두고, 각 인스턴스는 가볍고 무상태에 가깝게 유지하며, 장기 연결이나 무거운 업로드는 별도 경로로 분리한다. 운영 복잡도는 분명 늘어난다. 대신 장애가 한 번에 전체 서비스처럼 번질 확률은 크게 줄어든다. 결국 트레이드오프는 한 줄로 정리된다. 운영 표면적을 감수하고 장애 도메인을 쪼갤 것인가, 아니면 단순함을 유지하되 관문 하나에 더 큰 책임을 실을 것인가.

그렇다고 처음부터 다중 게이트웨이를 가져가는 것은 올바르지 않을수도 있다. 개인용 서비스, 낮은 트래픽, 단순한 API, 짧은 장애 허용 범위를 가진 서비스라면 Nginx 한 대가 가장 실용적인 선택일 수 있다. 다만 그때도 "지금은 괜찮다"와 "영원히 괜찮다"를 헷갈리면 안 된다. 프록시는 편리하지만, 편리함은 종종 가장 좁은 병목에서 나온다라는 것을 항상 기억해야한다.

## SAGA는 왜 멋져 보이는데 자꾸 불안할까

분산 시스템 이야기를 하다 보면 SAGA는 늘 근사하게 들린다. 여러 서비스를 거치는 긴 비즈니스 트랜잭션을 잘게 쪼개고, 실패하면 보상 트랜잭션으로 되돌린다는 발상은 얼핏 정교한 시계 장치처럼 보인다. 그런데 실제 운영에서는 그 시계가 부품 수만큼 고장날 수 있다는 사실이 더 자주 눈에 들어온다. 서비스가 늘고 메시지 브로커가 끼고 네트워크가 흔들리기 시작하면, "되돌린다"는 말은 생각보다 훨씬 무거운(무서운) 약속이 된다.

![SAGA 성공 경로와 보상 실패의 갈림길](/images/2026/limitation_of_bestcases/saga_cascade.git)

오래된 교과서에서 100Mbps LAN과 56kbps WAN의 차이를 들며 네트워크 지연을 설명하던 장면을 떠올리면, 요지는 지금도 크게 달라지지 않는다. 멀리 떨어진 구간은 로컬 메모리처럼 행동하지 않는다. 지연이 있고, 손실이 있고, 순서가 바뀌고, 때로는 같은 메시지가 두 번 온다. 예를 들어 주문, 재고, 결제, 배송이 나뉜 시스템을 떠올려 보자. 주문 서비스가 주문을 만들고, 재고를 예약하고, 결제를 승인하고, 마지막으로 배송을 생성한다고 하자. 문서로 읽으면 순서는 매끈하지만, 중간 어디에서든 메시지 중복, 지연, 부분 실패, 타임아웃, 보상 실패가 생길 수 있다. 여기서 한 번쯤은 멈칫하게 된다. 정말 우리는 "과거 상태로 되돌아간다"는 말을 자신 있게 할 수 있을까.

```typescript
type SagaState =
  | "PENDING"
  | "INVENTORY_RESERVED"
  | "PAYMENT_AUTHORIZED"
  | "SHIPPING_CREATED"
  | "COMPENSATING"
  | "MANUAL_REVIEW"
  | "DONE";

export async function runOrderSaga(input: {
  orderId: string;
  paymentId: string;
  items: Array<{ sku: string; qty: number }>;
}) {
  await sagaStore.mark(input.orderId, "PENDING");

  try {
    await inventory.reserve(input.orderId, input.items);
    await sagaStore.mark(input.orderId, "INVENTORY_RESERVED");

    await payments.authorize(input.paymentId);
    await sagaStore.mark(input.orderId, "PAYMENT_AUTHORIZED");

    await shipping.create(input.orderId);
    await sagaStore.mark(input.orderId, "SHIPPING_CREATED");

    await sagaStore.mark(input.orderId, "DONE");
  } catch (error) {
    await sagaStore.mark(input.orderId, "COMPENSATING");

    await safeCompensate(async () => payments.cancel(input.paymentId));
    await safeCompensate(async () => inventory.release(input.orderId));

    await sagaStore.mark(input.orderId, "MANUAL_REVIEW");
    throw error;
  }
}
```

이 코드에서 핵심은 성공 경로가 아니라 실패 경로다. 보상 트랜잭션이 모두 성공한다는 보장은 없다. 결제 취소 API가 이미 타임아웃을 냈을 수도 있고, 재고 해제 이벤트가 중복 소비될 수도 있고, 배송 서비스는 이미 운송장을 발급했을 수도 있다. 이미 데이터와 이벤트가 여러 노드로 복제되어 흩어진 뒤라면, 보상은 시간을 되감는 일보다 반대 방향의 새 이벤트를 쏘는 일에 더 가깝다. 이 지점에서 꼭 짚고 넘어가야 할 부분은, SAGA가 "자동 롤백"을 보장하는 패턴이 아니라는 사실이다. 더 정확히 말하면, SAGA는 자동 조정과 수동 정산이 함께 있는 운영 패턴에 가깝다.

그래서 안전하게 가져가려면 몇 가지 전제가 꼭 붙는다. 각 단계는 반드시 멱등해야 하고, 이벤트 발행은 아웃박스 패턴처럼 로컬 트랜잭션과 함께 묶여야 하며, 실패한 보상은 조용히 묻지 말고 `MANUAL_REVIEW` 같은 명시적 상태로 끌어올려야 한다. 그리고 정산 배치나 재구성 작업이 있어야 한다. 상태가 여러 저장소와 큐로 흩어지는 순간 보안, 감사, 장애 분석의 표면도 함께 넓어진다는 점도 잊기 어렵다. 즉, SAGA를 도입하는 것은 코드 몇 줄이 아니라 운영 절차 전체를 추가하는 셈이다.

```typescript
export async function handlePaymentAuthorized(event: {
  eventId: string;
  orderId: string;
  paymentId: string;
}) {
  if (await processedEvents.exists(event.eventId)) {
    return;
  }

  await shipping.create(event.orderId);
  await processedEvents.save(event.eventId);

  await outbox.append({
    type: "ShippingCreated",
    orderId: event.orderId,
  });
}
```

이런 식으로 멱등성 저장소와 아웃박스를 곁들이면 적어도 "중복 실행 때문에 더 망가지는" 일은 줄일 수 있다. 하지만 그만큼 저장소, 상태 전이, 재처리 정책, 경보 체계까지 관리해야 할 표면적이 넓어진다. 결국 SAGA는 무료 점심이 아니라는 것을 알 수 있다.

그렇다고 SAGA를 피해야만 하는 것도 아니다. 여러 서비스가 독립적으로 소유한 데이터를 가진 채 장기 비즈니스 프로세스를 이어 가야 한다면, 그리고 즉시 일관성보다 업무 연속성이 더 중요하다면 SAGA는 여전히 현실적인 선택이다. 다만 주문 한 건을 처리하려고 다섯 개 서비스와 여섯 개 보상 이벤트를 오간다면, 그전에 먼저 질문해 볼 필요가 있다. 정말 서비스 경계를 이렇게 잘라야 하는가. 어떤 단계는 같은 저장소에서 처리할 수 없는가. 굳이 실시간 보상이 아니라 비동기 정산으로도 충분하지 않은가. 종종 가장 좋은 분산 트랜잭션 설계는, 분산 트랜잭션 자체를 덜 만드는 쪽에 있다.

## 결국 패턴보다 먼저 물어야 할 것들

돌아보면 싱글톤, Nginx, SAGA는 모두 같은 질문으로 모인다. 무엇을 한 점에 모아 두었는가, 그 점이 실패하면 어디까지 같이 멈추는가, 그리고 실패 이후를 자동으로 수습할 자신이 정말 있는가 하는 질문이다. 설계는 늘 멋진 패턴 이름으로 시작하지만, 운영은 늘 타임아웃과 재시도와 중복 이벤트 같은 지루한 현실로 끝난다. 나는 이 간극을 자주 잊는다. 그리고 잊을 때마다 시스템은 꼭 한 번씩 가르쳐 준다. 지도가 영토가 아니라는 사실을 말이다.

그래서 요즘은 새로운 패턴을 들여오기 전에 이 컴포넌트가 죽으면 전체 요청 경로는 어떻게 보이는가. 재시도가 몰리면 앞단이 먼저 잠기지 않는가. 보상 로직이 실패했을 때 사람이 볼 수 있는 상태가 남는가. 읽기 전용 전역 객체와 쓰기 가능한 전역 상태를 구분했는가. 그리고 무엇보다, 지금의 편의가 다음 분기의 운영 비용으로 이미 청구되고 있지는 않은가. 를 생각해본다.

정말 간단한 결론은 이것뿐이다. 무결한 설계는 없고, 다만 실패를 어디에 가두고 얼마나 투명하게 드러낼지 선택하는 설계만 있다. 변화만이 상수라는 말은 이런 글을 다시 쓸 때마다 더 실감난다. 베스트 프랙티스는 출발점으로는 훌륭하지만, 끝까지 대신 생각해 주지는 않는다.
