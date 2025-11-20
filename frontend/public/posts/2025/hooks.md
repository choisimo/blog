---
title: 리액트 hooks 훑어보기
excerpt: >-
  # React Hooks 완벽 가이드


  ## 개요

  React의 Hooks는 함수형 컴포넌트에서 상태(state)와 생명주기(lifecycle) 기능을 사용할 수 있게 해주는 기능입니다.
  React 16.8에서 처음 도입된 이 기능은 클래스형 컴포넌트를 사용하는 대신, 더 간결하고 이해하기 쉬운 코드를 작성할 수 있도록
  도와줍니다. 이번 글에서는 React ...
date: '2025-08-11'
publishTime: '2025-08-11 13:58:00'
category: 기술
tags: []
readTime: 3분
---
# React Hooks 완벽 가이드

## 개요
React의 Hooks는 함수형 컴포넌트에서 상태(state)와 생명주기(lifecycle) 기능을 사용할 수 있게 해주는 기능입니다. React 16.8에서 처음 도입된 이 기능은 클래스형 컴포넌트를 사용하는 대신, 더 간결하고 이해하기 쉬운 코드를 작성할 수 있도록 도와줍니다. 이번 글에서는 React Hooks의 기본 개념과 사용법, 그리고 실제 개발에서 유용하게 활용할 수 있는 팁들을 알아보겠습니다.

## 주요 내용

### 1. 기본 Hooks
React에서 제공하는 기본 Hooks는 다음과 같습니다:

- `useState`: 컴포넌트의 상태를 관리합니다.
- `useEffect`: 컴포넌트의 생명주기를 관리합니다.
- `useContext`: Context API를 사용하여 전역 상태를 관리합니다.

#### 1.1 useState
`useState`는 상태 변수를 선언하고 업데이트할 수 있게 해줍니다.

```javascript
import React, { useState } from 'react';

function Counter() {
    const [count, setCount] = useState(0);

    return (
        <div>
            <p>현재 카운트: {count}</p>
            <button onClick={() => setCount(count + 1)}>증가</button>
            <button onClick={() => setCount(count - 1)}>감소</button>
        </div>
    );
}
```
- **설명**: `useState`를 사용하여 `count`라는 상태 변수를 만들고, `setCount`를 통해 상태를 업데이트합니다. 버튼을 클릭할 때마다 상태가 변화합니다.

### 2. useEffect
`useEffect`는 컴포넌트가 렌더링될 때 수행해야 할 작업을 정의하는 데 사용됩니다. 주로 API 호출이나 구독과 같은 부수 효과를 다룰 때 유용합니다.

```javascript
import React, { useEffect, useState } from 'react';

function DataFetcher() {
    const [data, setData] = useState([]);

    useEffect(() => {
        fetch('https://jsonplaceholder.typicode.com/posts')
            .then(response => response.json())
            .then(data => setData(data));
    }, []); // 빈 배열을 전달하여 컴포넌트가 처음 렌더링될 때만 실행

    return (
        <ul>
            {data.map(item => (
                <li key={item.id}>{item.title}</li>
            ))}
        </ul>
    );
}
```
- **설명**: 컴포넌트가 처음 렌더링될 때 API를 호출하여 데이터를 가져옵니다. 데이터가 업데이트되면 자동으로 리렌더링됩니다.

### 주의사항 및 베스트 프랙티스
- Hooks는 컴포넌트의 최상위 레벨에서만 호출해야 합니다. 조건문이나 반복문 안에서 호출하면 안 됩니다.
- 여러 개의 상태를 관리할 때는 `useReducer`를 고려해볼 수 있습니다. 단순한 상태 관리에는 `useState`, 복잡한 상태 관리에는 `useReducer`가 더 적합합니다.

### 실무 팁
- Hooks를 사용할 때는 상태와 효과를 독립적으로 분리하여 관리하는 것이 좋습니다.
- Custom Hooks를 만들어 자주 사용하는 로직을 재사용할 수 있습니다.

## 실제 예제

### 1. 간단한 Todo List
```javascript
import React, { useState } from 'react';

function TodoApp() {
    const [todos, setTodos] = useState([]);
    const [inputValue, setInputValue] = useState('');

    const addTodo = () => {
        if (inputValue.trim()) {
            setTodos([...todos, inputValue]);
            setInputValue('');
        }
    };

    return (
        <div>
            <input 
                type="text" 
                value={inputValue} 
                onChange={(e) => setInputValue(e.target.value)} 
                placeholder="할 일을 입력하세요" 
            />
            <button onClick={addTodo}>추가</button>
            <ul>
                {todos.map((todo, index) => <li key={index}>{todo}</li>)}
            </ul>
        </div>
    );
}
```

### 결과 확인 방법
- 위 코드를 실행하면 할 일을 추가할 수 있는 간단한 Todo List 애플리케이션이 생성됩니다. 입력 필드에 텍스트를 입력하고 "추가" 버튼을 클릭하면 리스트에 추가됩니다.

## 트러블슈팅

### 자주 발생하는 문제
- **Hooks 호출 순서 문제**: 컴포넌트가 리렌더링될 때 Hooks의 호출 순서가 바뀌면 오류가 발생합니다. 항상 최상위 레벨에서 호출해야 합니다.
- **의존성 배열 문제**: `useEffect`의 의존성 배열을 올바르게 설정하지 않으면 무한 루프가 발생할 수 있습니다. 필요한 값을 정확히 지정해야 합니다.

### 디버깅 팁
- `console.log`를 사용하여 상태 값과 효과의 실행 시점을 확인하세요.
- React DevTools를 사용하여 상태와 컴포넌트 구조를 시각적으로 확인할 수 있습니다.

## 정리
React Hooks는 함수형 컴포넌트에서 상태와 생명주기를 간편하게 관리할 수 있는 강력한 도구입니다. `useState`와 `useEffect`를 포함한 다양한 Hooks를 활용하여 코드의 가독성과 유지보수성을 높일 수 있습니다. Custom Hooks를 만들어 재사용성을 높이고, Hooks 사용 시 주의사항을 숙지하여 실무에 적용해보세요. 추가적으로, 더 많은 Hooks와 고급 개념을 학습하여 React 개발의 깊이를 더해보시길 권장합니다.
