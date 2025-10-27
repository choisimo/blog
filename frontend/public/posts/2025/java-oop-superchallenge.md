---
title: "JVM 메모리 지도 들고 자바 OOP 최상급 문제를 풀어본 기록"
date: "2025-10-27"
category: "Java"
tags: ['Java', 'JVM 메모리', 'static', '다형성', '상속', 'instanceof']
excerpt: "정적 초기화 블록에서 시작해 super()로 끝나는 여섯 가지 최상급 문제. 그 밤의 디버깅 노트를 그대로 옮겨 붙였습니다."
readTime: "18분"
---

최상급 난이도의 문항을 만들다 보면, 머릿속에 JVM 메모리 구조와 다형성 테이블이 함께 떠다닙니다. "정적 영역과 힙이 만나면 무슨 일이 일어날까?" "정적 메서드는 왜 오버라이딩이 안 될까?" 같은 질문들과 씨름하던 밤, 스스로 던졌던 문제들을 기록해 두기로 했습니다. 모든 문제는 코드 예제와 함께, 메모리 지도와 비유를 동원해 설명했습니다.

---

## 문제 1. 정적 필드와 인스턴스 필드의 초기화 순서 추적

JVM이 정적 필드와 인스턴스 필드를 어떻게 배치하고 초기화하는지 정확히 알고 있어야 풀 수 있는 문제입니다. 제시된 코드는 Product 클래스가 정적/인스턴스 필드, 정적 초기화 블록, 인스턴스 초기화 블록, 생성자를 모두 갖고 있습니다.

```java
package memory;

class Product {
    private static int totalProducts; // [A] 메서드 영역(Static Area)
    private final int id;             // [B] 힙 (각 객체마다 독립)
    private String name;              // [B]

    static {
        System.out.println("(1) [Static Init] 클래스 로딩 시작...");
        totalProducts = 0;
    }

    {
        System.out.println("(2) [Instance Init] 객체 초기화 블록 실행");
    }

    public Product(String name) {
        this.id = ++totalProducts;
        this.name = name;
        System.out.println("(3) [Constructor] " + this.name + " 객체 생성 완료, ID: " + this.id);
    }
}

public class ProductMemoryTest {
    public static void main(String[] args) {
        System.out.println("(4) [Main] 프로그램 시작 직후.");

        Product p1 = new Product("Laptop");
        Product p2 = new Product("Mouse");

        System.out.println("(5) [Main] 두 번째 객체 생성 후.");
    }
}
```

### 예상 출력 및 설명

1. `(1) [Static Init] ...` – 클래스가 처음 로딩될 때, 정적 블록이 실행됩니다. 메서드 영역에 올라가면서 totalProducts가 0으로 초기화됩니다.
2. `(4) [Main] ...` – main이 실행됩니다.
3. p1 생성 시 `(2)` → `(3)` – 객체를 생성하면 먼저 인스턴스 초기화 블록이 실행되고 나서 생성자가 호출됩니다. id가 1이 됩니다.
4. p2 생성 시 `(2)` → `(3)` – 두 번째 객체도 동일한 순서로 초기화되지만 정적 필드 totalProducts는 이미 1이므로 p2의 id는 2가 됩니다.
5. 마지막으로 `(5)`가 출력됩니다.

정리하면, 정적 블록은 클래스 로딩 시 단 한 번, 인스턴스 블록은 객체 생성 때마다, 생성자는 인스턴스 블록 이후에 실행된다는 것을 확인할 수 있습니다.

---

## 문제 2. static 컨텍스트와 this의 거리 두기

정적 메서드 안에서 실수로 인스턴스 멤버를 호출하거나 this를 사용하려 할 때, 컴파일러가 날리는 경고를 메모리 관점에서 분석하는 문제입니다.

```java
package context;

public class ServiceManager {
    private String serviceName = "Global Service"; // 힙에 저장될 인스턴스 필드
    private static int serviceVersion = 1;         // 메서드 영역의 정적 필드

    public void startService() {
        System.out.println(this.serviceName + " is starting.");
    }

    public static void TestService() {
        System.out.println("Current Service Name: " + serviceName); // (1)
        startService();                                             // (2)
        System.out.println("Current Version: " + serviceVersion);    // (3)

        ServiceManager sm = new ServiceManager();
        sm.startService();                                          // (4)

        if (this != null) {                                         // (5)
            System.out.println("This is safe.");
        }
    }

    public static void main(String[] args) {
        ServiceManager.TestService();
    }
}
```

### 에러가 발생하는 라인

- (1) `serviceName`은 인스턴스 필드입니다. 정적 메서드는 객체 없이 실행되므로 힙에 있는 필드에 직접 접근할 수 없습니다.
- (2) `startService()` 역시 인스턴스 메서드입니다. 어떤 객체의 메서드를 호출할지 결정할 수 없으므로 컴파일 에러입니다.
- (5) `this` 키워드는 인스턴스에만 존재합니다. 정적 메서드에는 this가 없습니다.

(3)은 정적 필드에 접근하므로 문제가 없고, (4)는 정적 메서드 안에서 직접 객체를 생성한 뒤 인스턴스 메서드를 호출하므로 허용됩니다.

### 수정 예시

```java
public static void TestService() {
    System.out.println("Current Version: " + serviceVersion);

    ServiceManager sm = new ServiceManager();
    System.out.println("Current Service Name: " + sm.serviceName);
    sm.startService();
}
```

혹은 정적 필드를 통해 서비스 이름을 관리하고 싶다면, serviceName 자체를 static으로 바꾸거나 정적 접근자를 만들어야 합니다.

---

## 문제 3. 참조 복사 vs 값 복사

배열과 기본 자료형의 복사 방식이 어떻게 다른지, 스택과 힙 관점에서 분석하는 문제입니다. 제시된 코드에는 일부러 잘못된 라인을 넣어 두었습니다.

```java
package reference;

public class DeepCopyTest {
    public static void main(String[] args) {
        int[] a = new int[]{10, 20, 30};
        int[] b = new int[]{10, 20, 30};

        int[] c = a;

        int p = a; // 컴파일 에러: int[]를 int에 대입할 수 없음 (예제 교정 필요)

        System.out.println("(1) a == p: " + (a == p));
        System.out.println("(2) a.length == b.length: " + (a.length == b.length));
        System.out.println("(3) a == b: " + (a == b));

        c = 99; // 컴파일 에러: 참조 변수에 정수를 대입할 수 없음

        System.out.println("(4) a: " + a + ", c: " + c);

        p = 100;
        System.out.println("(5) a == p: " + (a == p));
    }
}
```

### 교정 및 설명

원 문제의 의도를 살려 코드를 수정하면 다음과 같습니다.

```java
int[] a = {10, 20, 30};      // 배열 객체 1 (힙)
int[] b = {10, 20, 30};      // 배열 객체 2 (힙)
int[] c = a;                 // a의 참조값을 c에 복사 (얕은 복사)
int[] p = a.clone();         // 별도의 배열 복사 (깊은 복사)

System.out.println("(1) a == c: " + (a == c)); // true (같은 주소)
System.out.println("(2) a == b: " + (a == b)); // false (다른 주소)
System.out.println("(3) Arrays.equals(a, b): " + Arrays.equals(a, b)); // true (값 비교)

c[0] = 99; // c와 a가 같은 객체를 가리키므로, a[0]도 99로 변경됨
System.out.println("(4) a[0]: " + a[0] + ", c[0]: " + c[0]); // 둘 다 99

System.out.println("(5) Arrays.equals(a, p): " + Arrays.equals(a, p)); // false (p는 clone이므로 10,20,30 유지)
```

- 참조 복사는 스택에 저장된 주소값을 그대로 복사합니다. 따라서 c를 통해 값을 변경하면 a도 영향을 받습니다.
- 값 복사(기본 자료형)는 스택에서 스택으로 값을 복사하기 때문에 서로 영향을 미치지 않습니다.

---

## 문제 4. 정적 메서드 숨김 vs 동적 디스패치

메서드 바인딩 시점을 이해해야 풀 수 있는 문제입니다.

```java
package binding;

class Device {
    public static void identify() {
        System.out.println("Device: Static Identity");
    }
    public void process() {
        System.out.println("Device: Instance Process");
    }
}

class Sensor extends Device {
    public static void identify() {
        System.out.println("Sensor: Static Identity");
    }
    @Override
    public void process() {
        System.out.println("Sensor: Instance Process");
    }
}

public class PolymorphismTest {
    public static void main(String[] args) {
        Device d = new Sensor();
        Sensor s = new Sensor();

        System.out.println("--- Call 1 (Up-casted Reference) ---");
        d.identify(); // Device 버전 호출 (정적 바인딩)
        d.process();  // Sensor 버전 호출 (동적 바인딩)

        System.out.println("--- Call 2 (Child Reference) ---");
        s.identify(); // Sensor 버전
        s.process();  // Sensor 버전
    }
}
```

### 실행 결과

```
--- Call 1 (Up-casted Reference) ---
Device: Static Identity
Sensor: Instance Process
--- Call 2 (Child Reference) ---
Sensor: Static Identity
Sensor: Instance Process
```

- `d.identify()`는 정적 메서드 리졸루션이 컴파일 타임에 이루어지기 때문에, 참조 변수 타입(Device)에 따라 부모 버전이 호출됩니다.
- `d.process()`는 런타임에 힙에 있는 실제 객체 타입 Sensor를 보고 오버라이딩된 메서드가 실행됩니다.

정적 메서드는 오버라이딩이 아니라 숨김(hiding)이라는 점을 다시 확인할 수 있습니다.

---

## 문제 5. instanceof와 다운캐스팅의 안전 장치

Vehicle 클래스 계층에서 실제 타입을 판별해 자식 고유 정보를 출력하는 문제입니다.

```java
package casting;

class Vehicle {
    public void move() { System.out.println("Vehicle is moving."); }
}

class Car extends Vehicle {
    private int maxSpeed = 200;
    public int getMaxSpeed() { return maxSpeed; }
}

class Plane extends Vehicle {
    private int maxAltitude = 30000;
    public int getMaxAltitude() { return maxAltitude; }
}

class Analyzer {
    public static void checkType(Vehicle v) {
        if (v instanceof Car c) {
            System.out.println("Car Speed: " + c.getMaxSpeed());
        } else if (v instanceof Plane p) {
            System.out.println("Plane Max Alt: " + p.getMaxAltitude());
        } else {
            v.move();
        }
    }
}

public class InstanceOfTest {
    public static void main(String[] args) {
        Vehicle v1 = new Car();
        Vehicle v2 = new Plane();

        Analyzer.checkType(v1); // Car Speed: 200
        Analyzer.checkType(v2); // Plane Max Alt: 30000
        Analyzer.checkType(new Vehicle()); // Vehicle is moving.

        // Analyzer.checkType(new Object()); // 컴파일 에러: Object는 Vehicle을 상속하지 않으므로
    }
}
```

### 설명

- Java 16 이상의 패턴 매칭 문법을 사용해 instanceof와 캐스팅을 동시에 처리할 수 있습니다.
- `checkType(new Object())`는 컴파일 에러입니다. Object 타입은 Vehicle과 아무런 상속 관계가 없으므로 넘길 수 없습니다.

---

## 문제 6. 생성자 연쇄와 super() 호출 순서

SystemUnit 생성자가 호출될 때, 부모 클래스의 생성자가 어떻게 실행되는지 추적하는 문제입니다.

```java
package inheritance;

class Component {
    String componentName = "Default Component";

    public Component(String name) {
        this.componentName = name;
        System.out.println("(1) [Comp C] Component 생성자 실행: " + this.componentName);
    }
}

class SystemUnit extends Component {
    String unitName;

    public SystemUnit(String name) {
        super("Base Unit for " + name);
        this.unitName = name;
        System.out.println("(3) [Unit C] SystemUnit 생성자 실행: " + this.unitName);
    }

    public SystemUnit() {
        super("Anonymous Unit");
        this.unitName = "Anonymous";
        System.out.println("(4) [Unit C] 기본 생성자 실행: " + this.unitName);
    }
}

public class ConstructorChainTest {
    public static void main(String[] args) {
        SystemUnit su = new SystemUnit("Main Processor");
    }
}
```

### 실행 결과

```
(1) [Comp C] Component 생성자 실행: Base Unit for Main Processor
(3) [Unit C] SystemUnit 생성자 실행: Main Processor
```

- 자식 생성자가 호출되면 먼저 super(...)를 통해 부모 생성자가 실행되고, 그 이후에 자식 생성자의 본문이 실행됩니다.
- 만약 부모 클래스에 매개변수 없는 생성자가 없다면, 자식 기본 생성자에서도 `super(...)`를 명시적으로 호출해 주어야 합니다.

---

## 추가 문제: static, clone, equals, super()가 한꺼번에 등장한다면?

가끔은 static 상태를 유지한 채 clone을 통해 객체를 복제하고, equals로 비교하고, 상속 구조에서 생성자 순서를 확인해야 하는 순간이 찾아옵니다. 아래 문제는 그런 상황을 한 번에 확인해 볼 수 있는 종합 퀴즈입니다.

```java
class Counter implements Cloneable {
    private static int total;
    private int personal;

    static {
        System.out.println("[Static] Counter loaded");
        total = 0;
    }

    {
        System.out.println("[Instance] init block");
    }

    public Counter() {
        total++;
        personal = 1;
        System.out.println("[Constructor] total=" + total + ", personal=" + personal);
    }

    @Override
    protected Counter clone() throws CloneNotSupportedException {
        Counter copy = (Counter) super.clone();
        copy.personal = this.personal; // 얕은 복사 후 필드 조정
        return copy;
    }

    @Override
    public boolean equals(Object obj) {
        if (obj instanceof Counter) {
            Counter other = (Counter) obj;
            return this.personal == other.personal;
        }
        return false;
    }
}

public class CounterTest {
    public static void main(String[] args) throws Exception {
        Counter c1 = new Counter();
        Counter c2 = c1.clone();

        System.out.println("c1 equals c2? " + c1.equals(c2));
        System.out.println("Counter total: " + Counter.total); // 접근 제어자 변경 필요
    }
}
```

이 문제를 통해 다시 한 번 다음을 확인할 수 있습니다.

- 정적 블록 → 인스턴스 블록 → 생성자 순서
- clone()과 equals() 재정의 패턴
- 정적 필드 접근자를 public으로 바꾸거나 getter를 제공해야 하는 이유

---

## 마무리: 메모리 지도와 함께 떠나는 여행

이 모든 문제는 JVM의 메모리 모델, static과 instance의 구분, 다형성의 바인딩 시점, instanceof와 다운캐스팅, super()의 호출 순서 같은 핵심을 이해해야만 풀 수 있습니다. 저는 문제를 만들면서 다시 한 번 메서드 영역과 힙을 오가는 바이트코드의 흐름을 눈으로 그려 보았습니다. 언젠가 또 비슷한 질문을 받게 된다면, 이 기록을 펼쳐 놓고 말해 줄 겁니다.

> "정적 영역은 클래스 전체를 위한 약속이고, 힙은 객체 하나하나의 삶입니다. 다형성은 그 삶이 서로를 이해하는 방법이고, super()는 세대 간의 인사를 잊지 말라는 규칙이죠." 

그리고 아마 다음 회의에서도, 정적 메서드를 오버라이딩할 수 있냐는 질문에 이 코드 묶음을 조용히 내밀겠죠. "정답은 코드가 말해 줍니다."라고요.
