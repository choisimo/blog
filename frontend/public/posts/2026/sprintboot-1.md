---
title: "[스프링 서버 1부] Servlet Filter와 Spring Security는 어디서 요청을 가로채는가? 1편"
date: "2026-03-13"
category: "기술"
tags:
  ["Spring",
  "Spring Boot",
  "Servlet Filter",
  "Spring Security",
  "SecurityContext",
  "ThreadLocal"]
excerpt: "Servlet Filter의 동작과 상태 유지"
readTime: "18분"
---

![](/images/2026/springboot-1/1.png)

스프링부트 서버에서 보안은 컨트롤러 안에서 갑자기 시작되지 않는다.
요청이 `DispatcherServlet`에 닿기 전에, 더 바깥쪽에서 이미 여러 개의 필터가 요청을 가로채고 검사한다. 즉, REST API 등의 요청에도 컨트롤러가 제일 먼저 손을 내미는 것이 아니라는 것이다. 

컨트롤러의 본질적인 존재 이유는 `핵심 비즈니스 로직의 실행`을 위함이다.
만약 보안 로직이 컨트롤러 안으로 섞여 들어온다면, 비즈니스 로직을 구현하면서 동시에 
토큰 검사, 권한 인증/인가 등을 구현함에 따라 코드 중복 뿐만 아니라 특정 API 에 대한 보안 검사를 빼먹을 위험 또한 존재한다.

그러한 이유로 스프링부트 뿐만 아니라 여러 언어 프레임워크들에서는 보안을 바깥쪽 인프라 레이어로 빼버린다. 즉, 관심사 분리 (SoC)를 적용함으로써 컨트롤러는 보안에 무지한 상태로 오직 순수한 비즈니스 로직에만 집중 할 수 있다. 동시에 보안 규칙은 중앙에서 일관되게 관리함으로써 일관성 관리도 훨씬 쉬워진다. 

---
### 참고) 관심사의 완벽한 분리 (SoC) 의 종류
#### 1. 역할/책임의 분리, 단일 책임 원칙 (SRP)
#### 2. 서비스의 분리/분해 
#### 3. 권한/업무 기반 분리, RBAC 기반 설계
#### 4. 계층형 아키텍처 (예 : service, controller, repository)
#### 5. 도메인 역할 기준 분리, bounded context 분리
---

![](/images/2026/springboot-1/4.png)

또한, DispatcherServlet과 Controller는 철저히 '스프링 MVC'라는 프레임워크 안에서만 동작하기에, 만약 보안이 여기에 구현되어 있다면, 스프링 MVC 컴포넌트를 거치지 않는 요청들은 무방비 상태가 될 수 있다.

하지만 서블릿 필터(Filter)는 스프링 프레임워크보다 더 근원적인 웹 애플리케이션 서버(WAS, 예: Tomcat)의 표준 사양이다. 즉, 이곳에 방어선을 구축하면 REST API뿐만 아니라, 스프링을 거치지 않는 정적 자원(이미지, HTML), 웹소켓 연결 등 서버 애플리케이션으로 들어오는 모든 종류의 HTTP 요청을 예외 없이 통제할 수 있다는 장점이 있다.


## 2. Servlet Filter: 요청의 가장 바깥쪽에서 흐름을 제어하는 장치

![](/images/2026/springboot-1/2.png)


서블릿(Servlet)에서 `Filter`는 "이 요청을 다음 단계로 넘길지, 여기서 끊을지"를 결정하는 컴포넌트이다. `doFilter(request, response, chain)` 안에서 헤더를 검사할 수도 있고, 요청/응답을 감쌀 수도 있고, 로깅을 넣을 수도 있고, 아예 차단할 수도 있다.

여기서 아마 가장 중요한 줄은 다음과 같을 것이다.

```java
chain.doFilter(request, response);
```

이 호출이 있으면 다음 필터 또는 최종 리소스로 진행되고, 만약 이 호출이 없으면 그 자리에서 체인이 끝나게 된다. 필터가 "입구"라고 불리는 이유가 바로 이러한 점 때문이다.

또 하나 중요한 점은, 필터는 대체로 컨테이너가 한 번 만들어 여러 요청에서 재사용한다는 점에 있다. 즉 **요청별 상태를 필드에 저장하면 바로 멀티스레드 문제가 난다**는 뜻이다.
무슨 의미인지 잘 모르겠는게 어찌보면 당연할지도 모른다.

싱글톤 객체와 멀티스레딩 환경이 맞물려 돌아가는 이 지점을 이해하려면
우선 운영체제의 스레드와 메모리 구조를 알아야한다.

### 웹 서버의 동시성 처리 : "1 요청 은 1 스레드"

![](/images/2026/springboot-1/3.png)

웹 서버 (Tomcat 등)은 수 많은 사용자의 요청을 동시에 처리하기 위해 **스레드 풀**을 운영한다. 클라이언트가 A, B, C 를 동시에 API 호출한다면 어떻게 될까?
서버는 미리 만들어둔 스레드 1, 2, 3을 각각의 요청에 할당한다.
즉, 3개가 병렬로 실행된다. 

### 필터의 생명주기 : 목숨 단 "1개"
잎서 언급했듯이 메모리를 효율적으로 사용하기 위해 서블릿 컨테이너는 Filter 클래스를 서버가 켜질 때 Heap 메모리 영역에 단 **1개**만 생성해둔다.
이것이 문제의 원인이 된다. `스레드는 여러 개인데, 필터 객체는 단 1개라는 점`.
여러 스레드가 동시에 하나의 필터 객체에 접근해서 doFilter() 메서드를 실행하게 되는 것이다. 

여기서 헷갈릴 수 있으니, `동시성` 과 `병렬성` 은 다르다는 것을 명심해야한다.

1. 병렬성이란 물리적인 개념, 실제 일꾼이 여러 명 있어서 각자 맡은 작업을 같은 시간대에 나란히 실행하는 것과 유사하다.
2. 동시성이란 논리적인 개념, 물리적인 일꾼이 하나밖에 없더라도, 여러 작업을 아주 빠르게 번갈아 가며 처리해서 마치 동시에 일어나는 것처럼 보이게 만드는 것이다.

즉, 비유컨데 마술이 눈속임을 이용하는 것처럼 동시성은 일종의 병렬로 일어나는 것처럼 보이게 하는 속임수라면, 병렬성은 마법 그 자체라고 생각해보면 된다. 

그래, `동시성`과 `병렬성`은 알겠어. 그래서 뭐가 문제여서 동시성, 병렬성을 언급했냐? 
눈치 빠른 사람들은 이미 답을 알고 있겠지만, 그림을 더 단순화해서 살펴보자.

![](/images/2026/springboot-1/4.png)

독립적인 요청은 각자의 스레드와 스택을 통해 병렬적으로 진행되지만,
3번 구간을 보면 동일한 싱글톤 객체를 필연적으로 교차한다는 것을 알 수 있다. 


```java
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;

public class BadAuditFilter implements Filter {

    // 모든 요청이 공유하는 상태
    private String currentUser;

    @Override
    public void doFilter(ServletRequest request,
                         ServletResponse response,
                         FilterChain chain) throws IOException, ServletException {

        HttpServletRequest http = (HttpServletRequest) request;
        currentUser = http.getHeader("X-User"); // 다른 요청이 덮어쓸 수 있음

        chain.doFilter(request, response);
    }
}
```
이 코드는 겉보기에는 단순하지만, 동시에 여러 요청이 들어오면 `currentUser` 값이 서로 덮어써질 수 있다는 점을 아주 잘 보여준다. 왜냐하면 `currentUser`는 요청마다 새로 생기는 변수가 아니라, 서버가 띄워 둔 필터 객체 안의 필터이기 때문이다.

조금만 상황을 단순화해서 보면 바로 감이 온다.

1. 요청 A가 들어와 X-User: alice를 읽고 currentUser = "alice"를 넣는다.
2. 아직 요청 A가 끝나기 전에 요청 B가 들어와 X-User: bob을 읽고 currentUser = "bob"으로 덮어쓴다.
3. 그 상태에서 다시 요청 A의 실행이 이어지면, A는 원래 자신이 넣었던 "alice" 대신 이미 바뀌어 버린 "bob"을 보게 될 수도 있다.


![](/images/2026/springboot-1/6.png)

즉, 서로 독립적이어야 할 요청 둘이, 하나의 필드를 공유함으로써 서로의 상태를 침범할 수 있다는 것이다. 

![](/images/2026/springboot-1/12.png)

이게 바로 멀티스레드 환경에서 말하는 상태 오염(shared mutable state) 문제이다. 놓치기 쉬운 점은, 필드를 공유한다는 것이 무조건 위험과 등식인 것은 아니다. 여기서 핵심은 `공유 필드 자체` 가 아니라 `요청별 상태를 공유 필드에 담는 것이` 문제라는 점이다. 

그렇다면 여기서 하나의 질문이 떠오른다 :
`요청별 데이터는 어디에 두어야 한다는 것이냐?`


### 상태 다루기
답은 `그 요청만 볼 수 있는 저장소` 에 두어야 한다는 것이다.
나만의 공간, 남들이 건드릴 수 없는 그곳은 어디일까?

![](/images/2026/springboot-1/13.png)

#### 지역 변수
가장 단순한 방법은 지역 변수이다. 해당 필터 메서드 안에서만 잠깐 쓸 값이라면 그냥 지역 변수로 끝내는 것이 가장 안전하다. 
각 스레드의 스택 프레임에서만 요청을 다루면, 다른 요청이 건드릴 수 없다.

하지만, 아마 대게의 경우에는 필터 다음 단계, 예를 들어 컨트롤러나 인터셉터 같은 곳에서도 그 값을 꺼내써야 할 때가 생길 것이다.
그럼 이 요청을 지역변수와 같이 상태의 일관성을 유지하면서도 같은 요청을 처리하는 `인터셉터`나 `컨트롤러`에서 사용하려면 어떻게 해야할까?


## 지역 변수의 한계를 극복하는 방법

### 1. HttpServletRequest 객체의 Attribute 활용
앞서 살펴보았듯이, 서블릿 컨테이너는 클라이언트의 요청이 들어올 때마다 그 요청만을 위한 전용 `HttpServletRequest` 객체를 생성한다.
이 객체는 스레드 풀의 스레드들이 아무리 섞여도 해당 요청의 생명주기와 운명을 함께한다. 즉, 이 객체의 생명주기는 '정확히 하나의 요청'과 일치한다는 것이다.

따라서, 필터에서 검증한 데이터를 이 객체의 내부에 "잠깐 맡겨두면" 된다 : 

```java
public class GoodAuditFilter implements Filter {
    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain) 
            throws IOException, ServletException {
            
        HttpServletRequest http = (HttpServletRequest) request;
        String user = http.getHeader("X-User");

        // 싱글톤 객체(필터)의 필드가 아닌, 현재 '요청 객체'의 주머니에 값을 넣는다.
        http.setAttribute("currentUser", user);

        chain.doFilter(request, response);
    }
}
```
이제 이 요청이 필터를 무사히 통과한 후 인터셉터나 컨트롤러에 도달하면, `request.getAttribute("currentUser")` 를 통해 안전하게 값을 꺼내 쓸 수 있다. 다른 요청의 스레드가 이 값을 덮어쓸 일은 절대 일어나지 않는다. 
라고만 설명하면 찝찝할 것이다. 왜 다른 쓰레드가 침범할 수 없는지 더 자세히 살펴보자.

#### 1. Thread-Per-Request 
서블릿 컨테이너의 작업 할당 방식은 앞서 언급했듯이, 
내부에 미리 만들어둔 스레드풀에서 쉬고 있는 스레드 하나를 꺼내서 할당하는 것의 기반한다.

#### 2. Request 객체의 메타인지
서로 다른 요청에 대해서 각각 스레드를 할당했다가 HttpServletRequest 객체를 생성한다고 살펴보았다.
그럼 이 객체가 해당 스레드에만 국한된다는 보장은 어떻게 하는데..?

이 `Request 객체`의 참조값(메모리 주소)는 오직 할당된 스레드의 콜스택에만 전달된다. 즉 메서드의 인자로 이 객체의 참조값이 릴레이하면서 전달되는 것이다. 

#### 3. 동시성과 데이터 덮어쓰기
동시성이나 데이터 덮어쓰기의 전제 조건은 두 개 이상의 스레드가 
`동일한 객체의 동일한 메모리 주소`에 접근함에 있다.
하지만, 1,2 번에서 확인했듯이 이 조건 자체가 성립되지 않는다.
완전히 물리적으로 분리된 힙 메모리 공간끼리 넘나들려면 어떻게 해야할까? 밝혀내면 노벨상감이 아닐까?

#### 4. 생명의 끝, 소멸

요청 처리가 끝나고 서버가 클라이언트에게 HTTP 응답(Response)을 반환하면, 스레드는 톰캣의 스레드 풀로 반납된다.
동시에 스레드의 콜스택이 비워지면서 Request 객체를 가리키던 참조(Reference)도 모두 사라지면서 이제 메모리 상에 둥둥 떠 있는 Request 객체 (그리고 그 안에 들어있던 "currentUser" 데이터)는 더 이상 접근할 수 없는 상태가 된다. 이후 다음 번 가비지 컬렉터(GC)가 실행될 때 메모리에서 완전히 소멸한다.


### 2. `릴레이`라는 찜찜함

요청 객체에 담는 방법을 살펴보았고, 이제 다 해결되어서 좋아보인다.
근데 값을 꺼내 쓸 때마다 컨트롤러나 서비스 계층의 메서드 파라미터로 `HttpServletRequest` 를 계속 넘겨받아야 한다고?
분명 앞에서 관심사 분리 (Soc)가 중요하다고 하지 않았는가?

#### SpringSecurity가 내놓은 묘책
다행히 자바에는 `ThreadLocal` 이라는 현재 코드를 실행중인 스레드 전용 개인금고가 있다.
예로 들어서 스레드 1번이 ThreadLocal에 "alice"를 넣고, 스레드 2번이 같은 ThreadLocal 변수에 "bob"을 넣어도, 내부적으로 현재 실행 중인 스레드 자체를 키(Key)로 사용하여 값을 완전히 격리해 저장하는 방식이다. 

![](/images/2026/springboot-1/14.png)

바로 이것이 `SpringSecurity`의 `SecurityContextHolder`가 사용하는 인증 정보 저장 방식이다. 

```java
public class UserContextHolder {
    // 스레드별로 독립적인 공간을 보장하는 ThreadLocal 변수
    private static final ThreadLocal<String> currentUser = new ThreadLocal<>();

    public static void set(String user) {
        currentUser.set(user);
    }

    public static String get() {
        return currentUser.get();
    }

    public static void clear() {
        currentUser.remove();
    }
}
```
사용해보면 신기하다. 필터에서 UserContextHolder.set("alice")를 호출한 뒤, 컨트롤러나 서비스 계층 깊은 곳에서 파라미터로 아무것도 넘겨받지 않고도 UserContextHolder.get()만 호출하면 마법처럼 "alice"를 꺼낼 수 있다.

### 하지만 편안함에는 대가가 따르는 법

![](/images/2026/springboot-1/11.png)

WAS 가 스레드를 매번 생성하지 않고 `스레드풀`에 모아두고 재사용한다고 배웠다. 만약 요청 A를 처리하던 스레드 1번이 ThreadLocal에 "alice"를 남겨둔 채 처리를 끝내고 스레드 풀로 돌아갔는데 이 값을 지우지 않았다면 어떻게 될까?

나중에 완전히 다른 사용자의 요청 B를 처리하기 위해 스레드 1번이 다시 배정되었을 때, 요청 B는 엉뚱하게도 이전 사용자인 "alice"의 권한을 그대로 물려받게 된다. 이는 다른 사용자의 계정으로 로그인되어 버리는 치명적인 보안 사고로 이어질 수 있다.

#### `스레드풀`은 닌자와 같다.
따라서 ThreadLocal을 다루는 필터는 반드시 try-finally 블록을 사용해 자신의 흔적을 깔끔하게 지워야 한다.

```java
try {
    UserContextHolder.set(user);
    chain.doFilter(request, response);
} finally {
    // 응답이 나가기 전, 스레드가 스레드 풀로 반환되기 직전에 반드시 초기화!
    UserContextHolder.clear();
}
```

지금까지 서블릿 환경에서 필터가 어떻게 동작하며, 단일 객체로 동작하는 필터 환경에서 각 요청의 상태를 어떻게 안전하게 유지하면서 전달하는지 살펴보았다. 자 이제 다시 처음으로 돌아가서 핵심 질문을 던져보자 :

`"그래서, 서블릿의 표준 스펙인 Filter와 스프링의 빈(Bean)으로 관리되는 Spring Security는 대체 어떻게 서로 연결되어 요청을 가로채는 것일까?"
`
