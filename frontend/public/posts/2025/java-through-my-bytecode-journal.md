---
title: "바이트코드 기차를 타고 자바 세계를 일주한 날"
date: "2025-10-20"
category: "Java"
tags: ['Java', 'JVM', '자료형', '연산자', '객체지향']
excerpt: "Write once, run anywhere라는 간판을 붙인 자바의 철도를 따라가며, JDK에서 GC까지 몸소 느꼈던 이야기와 살아 있는 코드 메모"
readTime: "12분"
---

> **이 글은 소설 형식으로 구성된 창작 에세이입니다.**

처음 자바를 만났을 때, 저는 "바이트 코드"라는 단어가 주는 은근한 낭만에 빠졌습니다. 고수준 언어에서 쓴 편지가 바이트코드 기차를 타고 JVM이라는 역을 거쳐 기계어라는 목적지에 도착한다는 상상을 하면, 코드 한 줄도 갑자기 여행 일지처럼 느껴졌거든요. 오늘은 그 여행에서 건져 올린 기록과, 그때그때 썼던 코드 스케치를 공유하려 합니다.

## 1. 바이트코드 기차가 달리는 법: 컴파일과 JVM의 무대 장치

자바는 항상 “Write once, run anywhere”라는 표어를 들고 다닙니다. 종이에 쓴 연애편지가 나라를 건너도 마음을 전하듯, 자바 소스(.java)는 어디서 컴파일되든 **바이트 코드(.class)**로 변환되고, JVM만 있다면 어떤 플랫폼에서도 동일하게 읽을 수 있습니다. 이게 바로 플랫폼 독립성이라는 이름의 마술입니다.

```java
// HelloWaldo.java
public class HelloWaldo {
    public static void main(String[] args) {
        System.out.println("자바야 안녕, 내 이름은 왈도라고 해.");
    }
}
```

이 코드를 `javac HelloWaldo.java`로 컴파일하면 `HelloWaldo.class`라는 바이트 코드가 생기고, 그 파일은 리눅스든 윈도우든 JVM이 설치된 곳이라면 모두 `java HelloWaldo`로 실행됩니다.

### 1.1 바이트코드를 톺아보는 호기심

```bash
$ javac HelloWaldo.java
$ javap -c HelloWaldo
Compiled from "HelloWaldo.java"
public class HelloWaldo {
  public HelloWaldo();
    Code:
       0: aload_0
       1: invokespecial #1                  // Method java/lang/Object."<init>":()V
       4: return

  public static void main(java.lang.String[]);
    Code:
       0: getstatic     #2                  // Field java/lang/System.out:Ljava/io/PrintStream;
       3: ldc           #3                  // String 자바야 안녕, 내 이름은 왈도라고 해.
       5: invokevirtual #4                  // Method java/io/PrintStream.println:(Ljava/lang/String;)V
       8: return
}
```

`getstatic`, `ldc`, `invokevirtual`… 이 바이트코드 목록은 마치 철도차량 운행 시간표처럼 JVM에게 정확한 순서를 알려 줍니다. 이 시간표를 해석하는 기관사가 바로 JVM이죠.

## 2. JDK와 JRE: 역무원과 승객의 차이

자바 세계에는 두 가지 주요 인물이 있습니다.

- **JDK (Java Development Kit)**: 자바 코드를 작성하고, 바이트코드 기차를 만들도록 돕는 역무원. 컴파일러(`javac`), 디버거(`jdb`), 아카이브 도구(`jar`)가 들어 있습니다.
- **JRE (Java Runtime Environment)**: 이미 만들어진 바이트코드 기차를 타고 목적지까지 가고 싶은 승객. JVM과 핵심 라이브러리가 들어 있으며, 개발 관련 도구는 없습니다.

이클립스나 인텔리제이는 이 역무원과 승객을 한꺼번에 관리해 주는 종합 안내소 같은 존재죠.

## 3. 자바 프로젝트를 세우는 다섯 단계와 JVM 메모리 지도

### 3.1 다섯 단계의 공사 과정

1. **프로젝트 생성** – "도시"의 토대를 놓습니다.
2. **패키지 생성** – 행정구역을 나누듯 패키지를 만들어 클래스의 주소를 정리합니다.
3. **소스 파일 생성** – 설계도를 그립니다.
4. **컴파일** – 설계도를 바이트코드 기차로 변환합니다.
5. **실행** – JVM에 기차가 들어와 main()이라는 플랫폼에서 출발합니다.

```java
package mypack;

public class Test {
    public static void main(String[] args) {
        System.out.println("바이트코드 기차 출발!");
    }
}

class SideKick {}
class SecondSideKick {}
class ThirdSideKick {}
```

컴파일 후에는 `Test.class`뿐 아니라 `SideKick.class`, `SecondSideKick.class` 등이 따로 생기니, 하나의 파일에 여러 기차가 동시에 있는 셈입니다.

### 3.2 JVM 메모리의 3구역

| 영역 | 비유 | 저장되는 것 |
| --- | --- | --- |
| 메서드 영역 (Method Area) | 도시의 설계 자료실 | 클래스 구조, static 변수, 상수 |
| 힙 (Heap) | 주거 지역 | 객체와 배열 |
| 스택 (Stack) | 골목길 | 메서드 호출 정보, 지역 변수, 참조값 |

```java
public class MemorySketch {
    static String cityName = "Byteville"; // 메서드 영역

    public static void main(String[] args) {
        int tickets = 3;                 // 스택
        Passenger p = new Passenger();   // 스택에는 참조값, 힙에는 객체
        p.name = "Waldo";
        p.printTicket(tickets);
    }
}

class Passenger {
    String name; // 힙에 저장되는 인스턴스 변수

    void printTicket(int count) {
        System.out.println(name + "님의 티켓은 " + count + "장입니다.");
    }
}
```

## 4. System.out 시리즈: 마이크 3종 세트

```java
System.out.println("한 줄 끝에 자동 개행");
System.out.print("개행 없음");
System.out.print("\n을 붙여야 \n 개행");
System.out.printf("%s: %,d원\n", "승차권", 120000);
System.out.printf("현재 온도는 %4.1f℃입니다.%n", 27.345);
```

- `println`: 발표 후 박수 유도용 자동 개행 마이크.
- `print`: 독백을 이어갈 때 사용하는 마이크.
- `printf`: 형식 지정이 가능한 프로 방송용 마이크.

## 5. 자료형과 변수: 여행객과 짐칸의 규칙

### 5.1 기본형 vs 참조형

| 구분 | 비유 | 메모리 위치 |
| --- | --- | --- |
| 기본 자료형 | 수하물 태그에 직접 적힌 숫자 | 스택 |
| 참조 자료형 | 짐 보관소 번호표 | 스택에 주소, 힙에 실제 데이터 |

```java
int seatNo = 15;                // 스택에 값 15 저장
String passengerName = "Waldo"; // 스택에는 참조값, 힙에는 문자열 객체
```

### 5.2 리터럴과 캐스팅

```java
float f = 3.14F;      // float에는 F 필수
double d = 3.141592;  // 기본 실수 리터럴 타입은 double
char c = 'A';         // 유니코드 문자 (내부적으로 65)

byte small = 10;
int big = small;      // 업캐스팅 (자동)
byte wrap = (byte)128;// 다운캐스팅 (데이터 손실 -> -128)
```

### 5.3 문자열 & 래퍼 클래스

```java
String station1 = "Seoul";
String station2 = "Seoul";
String station3 = new String("Seoul");

System.out.println(station1 == station2); // true (상수 풀 공유)
System.out.println(station1 == station3); // false (새 객체)
System.out.println(station1.equals(station3)); // true (내용 비교)

int tickets = Integer.parseInt("42");
double price = Double.parseDouble("1250.50");
```

## 6. 연산자: 레일 위의 신호 체계

### 6.1 증감과 비트 연산자

```java
int i = 5;
System.out.println(++i); // 6, 전위형
System.out.println(i++); // 6 출력 후 i = 7
System.out.println(i);   // 7

int a = 0b1010, b = 0b1100;
System.out.println(Integer.toBinaryString(a & b)); // 1000
System.out.println(Integer.toBinaryString(a | b)); // 1110
System.out.println(Integer.toBinaryString(a ^ b)); // 0110
System.out.println(Integer.toBinaryString(~a));    // ...11110101
```

### 6.2 쉬프트 연산자

```java
int pos = 0b00000101;
System.out.println(Integer.toBinaryString(pos << 2)); // 10100 (left shift)

int neg = 0b10000101; // -123 (2's complement)
System.out.println(Integer.toBinaryString(neg >> 2));  // 산술 시프트 -> 11100001
System.out.println(Integer.toBinaryString(neg >>> 2)); // 논리 시프트 -> 00100001
```

### 6.3 비교와 논리 연산자

```java
String routeA = "Seoul-Busan";
String routeB = "Seoul-Busan";
String routeC = new String("Seoul-Busan");

System.out.println(routeA == routeB);       // true
System.out.println(routeA == routeC);       // false
System.out.println(routeA.equals(routeC));  // true

int passengers = 50;
boolean trainReady = false;
if (passengers > 0 && trainReady) {
    System.out.println("출발!");
} else {
    System.out.println("대기 중...");
}
```

## 7. 제어문: 신호등과 환승역

### 7.1 if-else & switch

```java
Scanner sc = new Scanner(System.in);
int ticket = sc.nextInt();

if (ticket % 2 == 0) {
    System.out.println("짝수 티켓");
} else {
    System.out.println("홀수 티켓");
}

int station = sc.nextInt();
switch (station) {
    case 1:
        System.out.println("1번 승강장");
        break;
    case 2:
    case 3:
        System.out.println("2번 또는 3번 승강장");
        break;
    default:
        System.out.println("기타 승강장");
}
```

### 7.2 반복문과 레이블

```java
// while + break
while (true) {
    int grade = sc.nextInt();
    if (grade < 0) {
        System.out.println("입력 종료");
        break;
    }
    System.out.println("학점: " + grade);
}

// 레이블을 이용한 다중 루프 탈출
outer:
for (int r = 0; r < 3; r++) {
    for (int c = 0; c < 3; c++) {
        if (r == 1 && c == 1) {
            System.out.println("중앙 좌석 발견!");
            break outer; // 바로 outer 루프 탈출
        }
    }
}
```

## 8. 배열과 참조 복사: 동일 승강장 티켓의 주의점

```java
int[] a = new int[3];  // [0,0,0]
int[] b = a;           // 얕은 복사 -> 같은 힙 객체 가리킴

Arrays.fill(a, 7);
System.out.println(Arrays.toString(a)); // [7,7,7]
System.out.println(Arrays.toString(b)); // [7,7,7]

// 깊은 복사가 필요하다면
int[] c = Arrays.copyOf(a, a.length);
a[0] = 99;
System.out.println(Arrays.toString(a)); // [99,7,7]
System.out.println(Arrays.toString(c)); // [7,7,7]
```

## 9. 클래스와 객체: 열차 설계와 운행의 정석

```java
class Train {
    String name;
    int seats;
    double speed;

    Train(String name, int seats, double speed) {
        this.name = name;
        this.seats = seats;
        this.speed = speed;
    }

    void printInfo() {
        System.out.printf("%s (%d석, 최고 %.1fkm/h)%n", name, seats, speed);
    }
}

public class Station {
    public static void main(String[] args) {
        Train t = new Train("Byte Express", 120, 305.5);
        t.printInfo();
    }
}
```

### 9.1 메서드 오버로딩 & 가변 인자

```java
class MathUtils {
    int square(int i) {
        return i * i;
    }

    double square(double d) {
        return d * d;
    }

    int sum(int... values) { // 가변 길이 매개변수 -> 배열처럼 순회 가능
        int total = 0;
        for (int v : values) {
            total += v;
        }
        return total;
    }
}

MathUtils mu = new MathUtils();
System.out.println(mu.square(5));      // 25
System.out.println(mu.square(2.5));    // 6.25
System.out.println(mu.sum(1,2,3,4,5)); // 15
```

## 10. this와 this(): 동일 열차 내부의 환승

```java
class Journey {
    String traveler;
    String destination;
    int days;

    Journey() {
        this("무명", "알 수 없음", 0);
    }

    Journey(String traveler, String destination) {
        this(traveler, destination, 1);
    }

    Journey(String traveler, String destination, int days) {
        this.traveler = traveler;
        this.destination = destination;
        this.days = days;
    }

    void print() {
        System.out.printf("%s님의 목적지: %s (체류 %d일)%n", traveler, destination, days);
    }
}
```

## 11. Getter & Setter: 탑승객 정보 보호 장치

```java
class PassengerInfo {
    private int age;
    private String phone;

    public boolean setAge(int age) {
        if (age < 0) return false;
        this.age = age;
        return true;
    }

    public int getAge() {
        return age;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getPhone() {
        return phone;
    }
}
```

## 12. 상속과 오버라이딩: 열차 클래스의 계보

```java
class Train {
    protected String name;
    protected double price;

    public Train(String name, double price) {
        this.name = name;
        this.price = price;
    }

    public void printTicket() {
        System.out.printf("%s 티켓 가격: %.0f원%n", name, price);
    }
}

class SleeperTrain extends Train {
    private int cabins;

    public SleeperTrain(String name, double price, int cabins) {
        super(name, price); // 부모 생성자 호출
        this.cabins = cabins;
    }

    @Override
    public void printTicket() {
        super.printTicket();
        System.out.printf("침대칸 수: %d개%n", cabins);
    }
}
```

## 13. super()와 생성자 호출 순서

```java
class BaseStation {
    public BaseStation(String city) {
        System.out.println("기지 역: " + city);
    }
}

class BranchStation extends BaseStation {
    public BranchStation() {
        super("서울");
        System.out.println("분기 역 준비 완료");
    }
}

// 실행
BranchStation bs = new BranchStation();
// 출력:
// 기지 역: 서울
// 분기 역 준비 완료
```

## 14. 멀티스레드와 분산 처리: 여러 기차의 동시 운행

자바는 **멀티스레드**를 통해 하나의 프로그램에서 여러 작업을 동시에 진행하려 합니다. 또한 RMI, gRPC 같은 분산 기술과 함께 쓰이면 여러 역(서버)이 협업하는 장대한 네트워크를 만들 수 있습니다.

```java
class TrainTask implements Runnable {
    private final String name;

    TrainTask(String name) {
        this.name = name;
    }

    @Override
    public void run() {
        for (int i = 1; i <= 3; i++) {
            System.out.printf("[%s] %dkm 이동 중...%n", name, i * 50);
            try { Thread.sleep(500); } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
        System.out.printf("[%s] 종착역 도착!%n", name);
    }
}

public class MultiTrain {
    public static void main(String[] args) {
        Thread t1 = new Thread(new TrainTask("KTX"));
        Thread t2 = new Thread(new TrainTask("SRT"));
        t1.start();
        t2.start();
    }
}
```

자바가 함수형 코딩을 지원하기 시작하면서, 위 코드를 람다로 줄여서 표현할 수도 있습니다.

```java
public class MultiTrainLambda {
    public static void main(String[] args) {
        Runnable task = () -> {
            String name = Thread.currentThread().getName();
            for (int i = 1; i <= 3; i++) {
                System.out.printf("[%s] %dkm 이동 중...%n", name, i * 50);
                try { Thread.sleep(500); } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }
            System.out.printf("[%s] 종착역 도착!%n", name);
        };

        new Thread(task, "EMU").start();
        new Thread(task, "NightExpress").start();
    }
}
```

## 15. 분산 시스템에서의 JVM

JVM은 각 플랫폼에서 설치된 지역 역무원입니다. 각 역무원이 같은 바이트코드 기차를 받아 자신만의 철로에서 달리게 해 줍니다. 이 덕분에, 대규모 시스템에서 서로 다른 운영체제를 사용하는 서버들이 같은 애플리케이션을 협력해서 돌릴 수 있습니다. 스프링 부트 같은 프레임워크는 이 철도를 기반으로 도시 전체에 버스를 돌리듯, 마이크로서비스의 흐름을 관리합니다.

## 16. 마무리: 다시 바이트코드 기차 승강장에서

자바는 고수준 언어의 편안함과 가상 머신의 견고함 위에, 객체지향과 함수형 패러다임, 멀티스레드, 분산 처리를 착실하게 쌓아 올렸습니다. 바이트코드 기차는 지금도 JVM 승강장에서 "다음 역은 GC(가비지 컬렉션)입니다"라고 안내 방송을 하고 있을 겁니다.

앞으로 자바를 또 만난다면 이렇게 말해 줄 거예요. "당신 덕분에 우리는 어디서든 같은 기차를 타고 만나게 되었고, 때로는 깐깐한 타입 캐스팅 검사 덕분에 큰 사고를 막기도 했지." 그리고 제 IDE는 오늘도 초록 불을 깜박이며 새 기차를 만들 준비를 하고 있습니다.
