---
title: "static 키워드와 다형성으로 밤을 지새운 어느 개발자의 기록"
date: "2025-10-27"
category: "Java"
tags: ['Java', 'static', 'Polymorphism', 'OOP 심화', 'JVM 메모리']
excerpt: "정적 영역과 힙 사이에서 헤매던 날, 다형성의 그림자와 씨름한 새벽, 그리고 equals를 다시 쓰며 깨달은 객체지향의 본질"
readTime: "15분"
---

밤새 모니터 앞에서 static과 polymorphism을 동시에 붙잡고 늘어지다 보면, 자바가 왜 여전히 사랑받는지 새삼 실감하게 됩니다. 정적 영역과 힙의 미세한 경계를 넘나들다 보면, JVM이 우리가 만든 클래스 로더와 메서드 테이블을 어떻게 다루는지 그 얼굴이 보이거든요. 오늘은 제가 직접 던졌던 네 가지 난이도 최상급 질문과, 그 질문들을 풀면서 남긴 코드 스케치를 일기처럼 정리해 보았습니다.

## 1. 정적 메서드가 인스턴스 컨텍스트의 문을 두드리는 순간

`Resource.analyzeStatus()`를 작성하다가, "정적 메서드 안에서 인스턴스 필드를 건드리면 무슨 일이 일어날까?"라는 호기심에 빠졌습니다. 결과는 컴파일러의 따끔한 경고였죠. 정적 메서드는 "객체 없이도 호출된다"는 세계관을 가지고 있기 때문입니다.

```java
package advanced;

public class Resource {
    private int instanceCounter = 0;         // 힙에 객체가 생길 때마다 생성
    private static int sharedCount = 0;      // 메서드 영역(Static Area)에 로딩 시점에 생성

    public Resource() {
        instanceCounter++;
        sharedCount++;
    }

    public int getInstanceCount() {
        return instanceCounter;
    }

    public static void analyzeStatus() {
        System.out.println("Instance Counter: " + instanceCounter); // (1) 컴파일 에러
        int current = getInstanceCount();                              // (2) 컴파일 에러
        System.out.println("Shared Total: " + sharedCount);           // (3) OK
        System.out.println(this.sharedCount);                          // (4) 컴파일 에러
    }
}
```

- (1)과 (2)는 인스턴스 필드/메서드를 호출하려 합니다. 하지만 정적 메서드는 아직 객체가 힙에 있다는 보장이 없죠. JVM의 메서드 영역에 로딩된 클래스 정보만 들고 실행되기 때문에, "어느 객체의 instanceCounter를 출력하지?"라는 난감한 상황이 됩니다.
- (4)는 this를 쓰고 있는데, this는 힙에 존재하는 실제 객체를 가리키는 변수가 생성될 때만 사용할 수 있습니다. static 영역에서 this는 존재하지 않습니다.

### 1.1 최소 수정으로 문제 해결

그래도 "어떻게든 힙 객체에 접근하고 싶다"면, 정적 메서드 안에서 직접 객체를 생성하거나 외부에서 인스턴스를 전달받는 방식으로 접근할 수 있습니다. 저는 임시 객체를 만들어서 해결했습니다.

```java
public static void analyzeStatus() {
    Resource temp = new Resource();

    System.out.println("Instance Counter (temp): " + temp.instanceCounter); // (1) 해결: temp를 통해 접근
    System.out.println("Instance Count (via method): " + temp.getInstanceCount()); // (2) 해결
    System.out.println("Shared Total: " + sharedCount); // (3) 그대로 OK
    System.out.println("Shared Total (via class name): " + Resource.sharedCount); // (4) class 이름으로 접근
}
```

물론 이렇게 하면 analyzeStatus()를 호출할 때마다 `sharedCount`가 증가해 버리니, 실제 진단 코드에서는 인스턴스를 주입하거나, 인스턴스 상태를 리턴하도록 설계하는 것이 바람직합니다.

### 1.2 메모리 구조 도식

```
+---------------------+      클래스 로딩 시점
| Method Area         |
|  - Resource.class   |
|  - static sharedCount -> 1
+---------------------+
          |
          | new Resource()
          v
+---------------------+
| Heap                |
|   Resource@0x100 -> instanceCounter = 1
+---------------------+
```

정적 메서드는 객체가 있든 없든 메서드 영역에서 바로 호출되므로, 힙 객체의 상태와는 완전히 별개라는 점을 기억하면 좋습니다.

## 2. 정적 메서드는 오버라이딩되지 않는다? 메서드 숨김의 정체

다형성을 이야기할 때 빠지지 않는 주제가 "정적 메서드도 오버라이딩되나요?"입니다. Machine과 Robot을 만들어, 정적 메서드와 인스턴스 메서드를 섞어 호출해 봤습니다.

```java
abstract class Machine {
    public static void identify() {
        System.out.println("A: Machine Identity (Static)");
    }
    public void process() {
        System.out.println("B: Machine Processing (Instance)");
    }
}

class Robot extends Machine {
    public static void identify() {
        System.out.println("C: Robot Identity (Static)");
    }
    @Override
    public void process() {
        System.out.println("D: Robot Processing (Instance)");
    }
}

public class DynamicBindingTest {
    public static void main(String[] args) {
        Machine m1 = new Robot();
        Robot r1 = new Robot();

        System.out.println("--- 1. Static Method Call ---");
        m1.identify(); // (1)
        r1.identify(); // (2)

        System.out.println("\n--- 2. Instance Method Call ---");
        m1.process();  // (3)
        r1.process();  // (4)
    }
}
```

출력 결과는 이렇게 나옵니다.

```
--- 1. Static Method Call ---
A: Machine Identity (Static)
C: Robot Identity (Static)

--- 2. Instance Method Call ---
D: Robot Processing (Instance)
D: Robot Processing (Instance)
```

- (1)에서 **Machine 타입의 참조 변수**로 `m1.identify()`를 호출하면, 컴파일러가 Machine의 static 메서드를 호출하도록 결정합니다. 런타임에 Robot 객체가 생겨 있어도, 정적 메서드는 **컴파일 타임 바인딩**이기 때문에 부모 버전을 호출합니다.
- (3)에서는 인스턴스 메서드가 호출되므로, 런타임에 힙에 올라가 있는 실제 객체 타입(Robot)을 보고 오버라이딩된 메서드가 실행됩니다. 이때를 **동적 바인딩**이라고 부르죠.

즉, 정적 메서드의 재정의처럼 보이는 것은 사실 "숨김(hiding)" 효과에 지나지 않는다는 걸, 코드가 말해줍니다.

## 3. Object.equals()와 instanceof: 얕은 비교를 넘어서는 법

모든 것이 Object에서 시작됩니다. 커스텀 클래스 `Item`을 만들고 equals를 직접 재정의하지 않으면 어떤 일이 벌어지는지, String과 비교해 보면 확실히 알 수 있습니다.

```java
class Item {
    private String name;
    public Item(String name) { this.name = name; }
    public String getName() { return name; }

    @Override
    public boolean equals(Object obj) {
        if (obj instanceof Item) {
            return name.equals(((Item)obj).name);
        }
        return false;
    }
}

public class ObjectCastingTest {
    public static void printInfo(Object obj) {
        if (obj instanceof Item) {
            Item item = (Item) obj;
            System.out.println("Type: Item, Name: " + item.getName());
        } else if (obj instanceof String) {
            System.out.println("Type: String");
        } else {
            System.out.println("Type: Unknown Object (" + obj.getClass().getName() + ")");
        }
    }

    public static void main(String[] args) {
        String s1 = new String("Sword");
        String s2 = new String("Sword");

        Item i1 = new Item("Staff");
        Item i2 = new Item("Staff");

        printInfo(s1); // Type: String
        printInfo(i1); // Type: Item, Name: Staff

        System.out.println("s1 == s2 : " + (s1 == s2));         // false - 주소 비교
        System.out.println("i1.equals(i2) : " + i1.equals(i2)); // true  - 내용 비교 (equals 재정의 덕분)
    }
}
```

- `==` 연산자는 참조 자료형에 대해서는 힙의 주소값을 비교합니다. `new String()`을 두 번 호출하면 서로 다른 객체를 가리키게 되므로 false입니다.
- `Item.equals()`를 재정의하지 않았다면, 기본적으로 Object.equals()는 `==`와 동일하게 동작합니다. 즉, 내용이 같아도 false였겠죠.
- `instanceof`와 다운캐스팅은 항상 세트로 생각해야 합니다. 타입을 안전하게 확인하지 않고 캐스팅하면 `ClassCastException`에 맞닥뜨리게 됩니다.

### 3.1 equals 재정의 시 체크리스트

1. `== obj`로 동일 객체인지 먼저 확인하면 빠른 탈출이 가능합니다.
2. `instanceof`로 타입을 검증합니다.
3. 핵심 필드(name 등)를 비교합니다.
4. equals를 재정의했으면 반드시 `hashCode()`도 재정의해야 HashMap/HashSet에서 일관성을 유지할 수 있습니다.

```java
@Override
public int hashCode() {
    return Objects.hash(name);
}
```

## 4. 정적 초기화 블록과 생성자: JVM 로딩 순서 추적기

`BaseConfig`와 `DerivedConfig`를 만들어, 정적 초기화 블록과 생성자가 어떤 순서로 실행되는지 눈으로 확인해 봤습니다.

```java
class BaseConfig {
    static int BASE_STATIC_VAL;
    int baseInstanceVal = 10;

    static {
        BASE_STATIC_VAL = 100;
        System.out.println("S1: Base Static Block Executed. BASE_STATIC_VAL: " + BASE_STATIC_VAL);
    }

    public BaseConfig() {
        System.out.println("C1: Base Constructor Executed. baseInstanceVal: " + this.baseInstanceVal);
    }
}

class DerivedConfig extends BaseConfig {
    static int DERIVED_STATIC_VAL;
    int derivedInstanceVal = 20;

    static {
        DERIVED_STATIC_VAL = 200;
        System.out.println("S2: Derived Static Block Executed. DERIVED_STATIC_VAL: " + DERIVED_STATIC_VAL);
    }

    public DerivedConfig() {
        System.out.println("C2: Derived Constructor Executed. derivedInstanceVal: " + this.derivedInstanceVal);
    }
}

public class InitializationTest {
    public static void main(String[] args) {
        System.out.println("M1: Program Start.");
        DerivedConfig d1 = new DerivedConfig();
        System.out.println("M2: Final Static Value (Base): " + BaseConfig.BASE_STATIC_VAL);
    }
}
```

실행 결과는 다음과 같습니다.

```
S1: Base Static Block Executed. BASE_STATIC_VAL: 100
S2: Derived Static Block Executed. DERIVED_STATIC_VAL: 200
M1: Program Start.
C1: Base Constructor Executed. baseInstanceVal: 10
C2: Derived Constructor Executed. derivedInstanceVal: 20
M2: Final Static Value (Base): 100
```

- **정적 블록은 클래스 로딩 시점에 단 한 번** 실행됩니다. 그리고 상속 구조에서는 부모 클래스의 정적 블록이 먼저 실행된 후, 자식 클래스의 정적 블록이 실행됩니다.
- main()이 실행되기 전에 이미 정적 블록은 끝난 상태입니다. 이는 JVM이 클래스 로딩과 초기화를 main보다 먼저 수행하기 때문입니다.
- `new DerivedConfig()`를 호출하면, 먼저 부모 생성자가 실행되고, 이후 자식 생성자가 실행됩니다. 인스턴스 필드 초기화도 이 시점에 이루어집니다.

### 4.1 정적 영역과 힙을 구분하는 감각

정적 블록을 그림으로 표현하면 이렇게 보입니다.

```
[클래스 로딩 시점]
  BaseConfig.class 로딩 -> S1 실행
  DerivedConfig.class 로딩 -> S2 실행

[main 시작]
  M1 출력
  new DerivedConfig()
    super() 호출 -> C1
    자식 생성자 -> C2
  M2 출력
```

정적 멤버는 클래스 전체가 공유하는 자원이고, 인스턴스 멤버는 각 객체가 독립적으로 가지는 자원이라는 것을 객체 생성 순서와 함께 다시금 확인할 수 있었습니다.

## 5. 난이도 최상급 추가 문제: static과 다형성의 결합을 디버깅하라

코드를 디버깅하다 보면, 정적 멤버를 자식 클래스에서 재정의하려다가 발생하는 미묘한 버그를 자주 봅니다. 그래서 아래와 같은 추가 문제를 스스로 만들어 보았습니다.

```java
class Counter {
    static int shared = 0;
    int personal = 0;

    public Counter() {
        shared++;
        personal++;
    }

    public static void resetShared() {
        shared = 0;
    }

    public void resetPersonal() {
        personal = 0;
    }
}

class ChildCounter extends Counter {
    static int shared = 100; // 부모의 static을 숨김 -> 별개의 정적 변수

    public ChildCounter() {
        shared += 10;
    }

    public static void resetShared() {
        shared = 50; // ChildCounter.shared만 초기화됨
    }
}

public class StaticHidingPitfall {
    public static void main(String[] args) {
        Counter c1 = new Counter();
        ChildCounter c2 = new ChildCounter();
        Counter c3 = new ChildCounter();

        System.out.println("Counter.shared = " + Counter.shared);       // ?
        System.out.println("ChildCounter.shared = " + ChildCounter.shared); // ?

        Counter.resetShared(); // 부모 static 메서드 호출 -> Counter.shared 초기화
        ChildCounter.resetShared(); // 자식 static 메서드 호출 -> ChildCounter.shared 초기화

        System.out.println("After reset -> Counter.shared = " + Counter.shared);
        System.out.println("After reset -> ChildCounter.shared = " + ChildCounter.shared);
    }
}
```

예상 출력은 다음과 같습니다.

```
Counter.shared = 3
ChildCounter.shared = 120
After reset -> Counter.shared = 0
After reset -> ChildCounter.shared = 50
```

- `Counter.shared`와 `ChildCounter.shared`는 서로 다른 메모리 위치를 가진 두 개의 정적 변수입니다.
- `ChildCounter.shared`를 바꾸면 부모 클래스의 shared에는 아무런 영향이 없습니다. 그래서 static 멤버를 "재정의"하는 것은 대부분의 경우 혼란만 초래합니다.

## 6. Object 배열과 다형성, 그리고 다운캐스팅 안전장치

모든 객체를 Object 배열에 담아 다형성의 범위를 확장하고 싶을 때가 있습니다. 하지만 다운캐스팅 시 instanceof 체크를 빼먹으면 ClassCastException이 바로 날아옵니다.

```java
Object[] bag = {
    new Item("Potion"),
    "Map",
    Integer.valueOf(42),
    new Item("Elixir")
};

for (Object obj : bag) {
    if (obj instanceof Item item) { // Java 16+ 패턴 매칭
        System.out.println("Item -> " + item.getName());
    } else if (obj instanceof String str) {
        System.out.println("String -> " + str.toUpperCase());
    } else {
        System.out.println("Other -> " + obj);
    }
}
```

이렇게 쓰면, 모든 타입에 대해 안전하게 다운캐스팅할 수 있습니다. Java 16 이상에서는 instanceof 패턴 매칭을 활용하면 캐스팅 문법이 한층 깔끔해집니다.

## 7. 마무리: 정적과 동적이 교차하는 교차로에서

정적 멤버를 올바르게 이해한다는 건, 클래스 로딩과 JVM 메모리 구조를 이해한다는 의미입니다. 다형성을 제대로 이해한다는 건, 오버라이딩과 메서드 디스패치가 실전에서 어떻게 동작하는지 몸으로 체득하는 것이죠. equals를 오버라이딩하며 "동등성"을 고민하다 보면, 결국 객체지향이란 무엇인가에 대한 근본적인 질문으로 되돌아오게 됩니다.

아마 내일 아침에도 저는 디버거를 열고 "이 static은 지금 어디에 올라가 있지?"를 되뇌겠죠. 그리고 누군가가 "정적 메서드를 오버라이딩할 수 있나요?"라고 물으면, 이 긴 밤의 코드를 가만히 보여주며 미소를 지을 겁니다. "자바는 언제나, static과 polymorphism 사이의 거리감을 유지한 채 살아간단다"라고요.
