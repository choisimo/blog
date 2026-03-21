---
title: "[파이썬 1부] 파이썬의 변수 조회는 단순한 딕셔너리 검색일까?"
date: "2026-03-15"
category: "기술"
tags:
  [
    "Python",
    "CPython",
    "Bytecode",
    "Interpreter",
    "Performance",
    "Memory",
  ]
excerpt: "소스 코드가 어떻게 토큰·AST·바이트코드로 변환되고, 런타임에 적응형 최적화가 일어나는지 CPython 내부를 직접 따라가보기"
readTime: "20분"
---

## 1. 시스템 아키텍처 개요

![](/images/2026/python-1/2.png)
CPython을 한 문장으로 요약하면, **"소스를 `CodeObject`로 만드는 컴파일러 + 그 `CodeObject`를 실행하는 적응형 스택 기반 가상 머신"** 이라 할 수 있습니다. 
Python 이랑 CPython 이 무엇인지부터 간략히 소개 해보겠습니다.

1. Python (파이썬) : 설계도이자 명세서

    정의: 파이썬 소프트웨어 재단(PSF)에서 정의한 **프로그래밍 언어의 문법과 동작 규칙(Specification)**입니다. 건축물로 치면 '설계도', 언어로 치면 '문법 책'에 해당합니다.

    def로 함수를 정의하고, 들여쓰기로 블록을 구분하며, 동적 타이핑을 지원한다는 등의 '규칙' 그 자체를 의미합니다. 여기에는 코드를 어떻게 메모리에 올리고 실행할지에 대한 구체적인 C 레벨의 구현 코드는 없습니다.

2. CPython (씨파이썬) : 공식 엔진 (구현체)

    정의: Python이라는 언어의 규칙을 **C언어(와 Python)로 직접 짜서 만든 공식 실행 프로그램(Reference Implementation)**입니다. 설계도를 보고 실제로 건물을 짓고 전기를 돌리는 '건설사'이자 '엔진'입니다.

    우리가 흔히 python.org에서 다운로드하여 설치하고, 터미널에서 python script.py라고 칠 때 실행되는 그 프로그램이 바로 CPython입니다. AST 변환, 바이트코드 컴파일, PyObject 메모리 모델, GIL, 가상 머신(VM) 루프 등은 모두 파이썬이라는 '언어'의 특징이 아니라 CPython이라는 '구현체'의 특징입니다.

물론 구현체 종류는 Jython, PyPy 등 다른 엔진들도 존재하지만, 흔하게 파이썬 설치했다고 할 때의 엔진 기준인 CPython 으로 분석하고자 합니다.

![](/images/2026/python-1/3.png)
```text
source text
→ tokenizer
→ PEG parser
→ AST
→ symbol table
→ instruction sequence 생성
→ CFG 구성 및 최적화
→ assembler
→ CodeObject(bytecode, consts, names, stacksize, exception table...)
→ Frame + ThreadState
→ eval loop(Python VM)
```

공식 내부 문서는 이 순서를 이용하여 설명합니다. 소스는 먼저 토큰화되고, PEG parser가 AST를 만들고, 컴파일러는 AST를 instruction sequence로 바꾸고, CFG 최적화를 거쳐 바이트코드를 방출합니다. 심볼 테이블은 AST에서 생성되어 이름이 local/free/global인지 결정하고, 그 결정이 나중에 어떤 opcode가 나갈지를 좌우합니다. ([GitHub][2])

여기서 중요한 포인트는 **"이름 해석의 일부는 이미 컴파일 타임에 굳어진다"**는 점입니다. 우린 흔히 생각하기를 "파이썬 변수 조회 = 매번 딕셔너리 문자열 검색"이라고 하는데, 그건 일부만 맞는 표현일지 모릅니다. 

함수 로컬은 컴파일러가 local로 확정하면 `LOAD_FAST` 계열 opcode로 바뀌고, 클로저면 `LOAD_DEREF`, 모듈/빌트인이면 `LOAD_GLOBAL`이 나갑니다. 즉, CPython은 스코프를 먼저 분류하고 그 결과를 바이트코드에 반영합니다. ([GitHub][2]) 네, 무슨 소리인지 모르겠는게 정상입니다. 풀어서 설명해보겠습니다. 

---

1. LOAD_FAST (함수 로컬 변수)

    함수 내부에서 정의되고 사용되는 변수 (예: 함수 안의 x = 10)

    컴파일러는 이 변수가 함수 안에서만 쓰인다는 것을 알고, 딕셔너리(Hash Table) 대신 **C 언어 배열의 고정된 인덱스(슬롯)**에 변수 자리를 만듭니다. 

    LOAD_FAST 0이라는 바이트코드가 실행되면, 인터프리터는 이름(문자열)을 검색할 필요 없이 "배열의 0번째 칸에서 값을 가져와라"라고 즉시 포인터로 접근합니다. C 언어 배열을 사용하여 가장 압도적으로 빠른 변수 조회 방식입니다.

2. LOAD_DEREF (클로저 / Free 변수)

    바깥쪽 함수에서 정의되었는데, 안쪽 중첩 함수에서 가져다 쓰는 변수.

    이 변수는 안쪽 함수가 언제 실행될지 모르기 때문에 단순한 로컬 배열이나 글로벌 딕셔너리에 둘 수 없습니다. 그래서 CPython은 'Cell'이라는 특수한 컨테이너 객체를 만들어 변수를 담아둡니다.

    LOAD_DEREF는 "Cell 객체를 찾아가서, 그 안에 들어있는 실제 값을 꺼내와라(Dereference)"라는 뜻입니다. 배열 접근(LOAD_FAST)보다는 한 단계 더 거치지만, 여전히 딕셔너리 검색보다는 빠릅니다.

3. LOAD_GLOBAL (전역 변수 및 빌트인)

    모듈 최상단에 정의된 전역 변수나 print, len 같은 내장(built-in) 함수.

    컴파일러가 코드를 분석했을 때 함수 안에서 할당된 적이 없으면 전역 변수로 취급합니다. 이 변수들은 실제로 모듈의 딕셔너리(globals())나 빌트인 딕셔너리(builtins)에 저장됩니다.

    실행될 때마다 딕셔너리에서 해시(Hash) 키를 통해 문자열을 검색해야 하므로, 위 세 가지 방식 중 가장 무겁고 느린 조회 방식입니다. (단, 최신 CPython은 인라인 캐시를 통해 이를 보완합니다.)

백문이 불여일견입니다.
실제로 전역 변수(LOAD_GLOBAL)를 쓸 때와 그것을 함수 내부의 로컬 변수(LOAD_FAST)로 캐싱해서 쓸 때, 바이트코드와 실제 실행 속도가 어떻게 달라지는지 확인해보겠습니다.

```python
import dis
import timeit

# 테스트를 위한 전역 변수
GLOBAL_VALUE = 10

# 1. 전역 변수를 매번 그대로 참조하는 함수
def use_global():
    total = 0
    for i in range(10000):
        total += GLOBAL_VALUE  # 루프 안에서 계속 전역 변수 조회
    return total

# 2. 전역 변수를 로컬 변수로 한 번 가져온 뒤 참조하는 함수
def use_local():
    total = 0
    local_value = GLOBAL_VALUE  # 로컬 변수로 캐싱 (1회만 전역 조회)
    for i in range(10000):
        total += local_value    # 루프 안에서는 로컬 변수 조회
    return total
```

### 2. 바이트코드(Bytecode) 비교

먼저 `dis` 모듈을 사용해 두 함수의 핵심 연산 부분 바이트코드를 확인해보겠습니다.

```python
print("=== use_global 바이트코드 ===")
dis.dis(use_global)

print("\n=== use_local 바이트코드 ===")
dis.dis(use_local)
```

**출력 결과 (핵심 루프 부분 요약):**

**`use_global`의 루프 내부:**
```text
  4          ...
             LOAD_FAST                0 (total)
             LOAD_GLOBAL              0 (GLOBAL_VALUE)  <-- 매 반복마다 딕셔너리 검색!
             BINARY_OP               13 (+=)
             STORE_FAST               0 (total)
             ...
```

**`use_local`의 루프 내부:**
```text
 19          ...
             LOAD_FAST                0 (total)
             LOAD_FAST                1 (local_value)   <-- 매 반복마다 C 배열 슬롯에서 바로 꺼냄!
             BINARY_OP               13 (+=)
             STORE_FAST               0 (total)
             ...
```

`use_global`은 루프를 10,000번 돌 때마다 전역 네임스페이스(딕셔너리)에서 `"GLOBAL_VALUE"`라는 문자열 키를 해싱하여 값을 찾아오는 `LOAD_GLOBAL` 명령을 수행합니다. 반면, `use_local`은 `LOAD_FAST`를 사용하여 이미 위치가 정해진 로컬 변수 배열의 슬롯에서 값을 즉시 뽑아옵니다.

### 3. 실제 실행 속도(Performance) 비교

이 바이트코드의 차이가 실제 속도에 얼마나 영향을 미치는지 `timeit`으로 측정해 보겠습니다.

```python
# 각각 10,000번씩 실행하여 시간 측정
time_global = timeit.timeit(use_global, number=10000)
time_local = timeit.timeit(use_local, number=10000)

print(f"전역 변수 사용(LOAD_GLOBAL): {time_global:.4f} 초")
print(f"로컬 변수 사용(LOAD_FAST)  : {time_local:.4f} 초")
print(f"성능 차이: 로컬 변수가 약 {time_global / time_local:.2f}배 더 빠름")
```

### 실행 결과
```text
전역 변수 사용(LOAD_GLOBAL): 2.4512 초
로컬 변수 사용(LOAD_FAST)  : 1.8321 초
성능 차이: 로컬 변수가 약 1.34배 더 빠름
```

즉, 컴파일러가 변수의 스코프를 `local`로 확정 지을 수 있도록 코드를 작성하면, CPython 가상 머신은 딕셔너리 검색을 우회하고 가장 빠른 경로(`LOAD_FAST`)를 타게 됩니다.

특히 연산이 수백만 번 일어나는 Hot Loop(자주 반복되는 구간)에서는, 글로벌 변수나 외부 모듈의 함수(예: `math.sin`, `sys.stdout.write` 등)를 로컬 변수로 한 번 빼둔 뒤 사용하는 것이 매우 유효한 최적화 방안이 될 수 있습니다.
---
`CodeObject`와 `Frame`도 분리해서 봐야 합니다. `CodeObject`는 정적인 설계도이고, 여기엔 바이트코드, 상수 목록, 변수 이름, 예외 테이블, `co_stacksize` 같은 실행 메타데이터가 들어 있습니다. 실제 호출이 일어나면 인터프리터는 `CodeObject`로부터 `Frame`을 만들고, 그 안에 instruction pointer, operand stack, globals/builtins 같은 **동적 상태**를 붙입니다.

> "CodeObject는 변하지 않는 설계도이고, Frame은 그 설계도를 바탕으로 돌아가는 실제 공장(동적 상태)이다."

CPython 인터프리터는 이 프레임을 스택 머신으로 실행합니다. 바이트코드는 16비트 code unit 배열로 저장되고, `co_stacksize` 덕분에 operand stack도 미리 contiguous array로 잡을 수 있습니다. 


![](/images/2026/python-1/4.png)
### 1. CodeObject
함수를 하나 만들면, 파이썬은 내부적으로 이 함수를 어떻게 실행할지에 대한 모든 메타데이터를 계산하여 __code__ 객체에 욱여넣습니다. (이 객체는 Immutable 이므로 프로그램이 종료될 때까지 이상한 짓 하는 것 아니면 안 바뀝니다.)

```python
def calculate(a, b):
    factor = 2
    return a + b * factor

# calculate 함수의 CodeObject를 꺼내봅니다.
code_obj = calculate.__code__

print("=== CodeObject (정적 메타데이터) ===")
print(f"1. 변수 이름들 (co_varnames): {code_obj.co_varnames}")
print(f"2. 상수 목록 (co_consts): {code_obj.co_consts}")
print(f"3. 바이트코드 원시 배열 (co_code): {code_obj.co_code}")
print(f"4. 필요 스택 크기 (co_stacksize): {code_obj.co_stacksize}")
```

핵심 포인트 (co_stacksize): 컴파일러는 소스를 분석해 보니 "이 함수는 값을 더하고 곱할 때 임시 메모리(Operand Stack)를 최대 3칸까지만 쓴다"는 것을 미리 알아냅니다. 덕분에 실행 시점에 스택을 동적으로 늘렸다 줄였다 할 필요 없이, 딱 3칸짜리 연속된 배열(Contiguous Array)만 메모리에 할당하면 되므로 실행 속도가 매우 빠릅니다.

### 2. Frame
CodeObject 는 앞서 언급했듯이 설계도라면, 인터프리터는 이 설계도를 바탕으로 Frame 을 생성합니다. 몇 번째 라인에서 실행 중인가, a와 b 에 입력된 실제 값은 무엇인가와 같은 동적인 상태가 담깁니다.

```python
import sys

def calculate_with_frame(a, b):
    factor = 2
    
    # 현재 실행 중인 함수의 동적 Frame 객체를 가져옵니다.
    frame = sys._getframe()
    
    print("\n=== Frame (동적 실행 상태) ===")
    print(f"1. 현재 로컬 변수 상태 (f_locals): {frame.f_locals}")
    print(f"2. 현재 실행 중인 명령어 위치 (f_lasti): {frame.f_lasti}")
    print(f"3. 이 프레임이 참조하는 설계도 (f_code): {frame.f_code.co_name}")
    
    return a + b * factor

# 함수를 '실제로 호출'해야 프레임이 생깁니다.
calculate_with_frame(10, 5)
```

과거에는 함수를 부를 때마다 Frame 객체를 메모리에 만들었지만, 파이썬 3.11 버전 부터는 성능을 위해 가벼운 C 언어 레벨의 구조체만으로 스택을 실행합니다. 
그럼 여기서 질문이 하나 떠오를 겁니다.
"그럼 Exception이 발생하거나 디버깅하고 싶을 때는 어떻게 실체화되어/해야 보이는거냐?"
- 이에 대한 답변은 Lazy creation 방식을 사용하여 처리합니다. 즉, 필요할 때나 명시적으로 호출할 때만 작동되는 것이죠. 

![](/images/2026/python-1/1.png)
그런데, 실체화도 실패할 정도로 메모리가 바닥난다면 어떻게 하죠? CPython은 이런 극단 상황을 위해 최소한의 비상 메모리와 사전 준비된 에러 경로를 남겨두고, 가능한 한 `MemoryError`를 전달합니다. 그마저도 불가능한 경우에는 더 이상 안전하게 복구할 수 없으므로 치명적 오류(fatal error)로 종료됩니다. 즉, "프레임을 만들 메모리조차 없다"는 상황에서는 디버깅용 실체화보다 프로세스 안전 종료가 우선입니다.

[2]: https://github.com/python/cpython/tree/main/Python
