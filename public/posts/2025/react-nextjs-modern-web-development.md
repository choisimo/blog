---
title: "React와 Next.js로 모던 웹 개발하기"
date: "2024-10-08"
category: "Web Development"
tags: ["React", "Next.js", "JavaScript", "Frontend"]
excerpt: "최신 React 기능과 Next.js의 장점을 활용한 웹 개발 방법론을 소개합니다."
readTime: "5분"
---

# React와 Next.js로 웹 개발 해보니까...

## 왜 React와 Next.js를 선택했을까?

솔직히 처음에는 바닐라 JavaScript로만 해도 되지 않을까 생각했다. 하지만 프로젝트가 점점 커지면서 관리가 힘들어지더라. 그러다가 React를 써보니까 '아, 이래서 다들 쓰는구나' 싶었다.

특히 팀 프로젝트에서 각자 다른 부분을 만들어야 할 때, React의 컴포넌트 방식이 정말 편했다. 내가 만든 버튼 컴포넌트를 팀원이 그대로 갖다 쓸 수 있으니까.

## React Hook, 생각보다 쉽다

처음에 Hook이라는 걸 들었을 때는 '또 새로운 걸 배워야 하나?' 싶었는데, 막상 써보니 훨씬 직관적이었다.

### useState - 상태 관리가 이렇게 간단할 줄이야

```javascript
import { useState } from 'react';

function MyCounter() {
  const [count, setCount] = useState(0);
  
  // 버튼 누를 때마다 숫자가 올라가는 간단한 기능
  const handleClick = () => {
    setCount(count + 1);
    console.log(`현재 카운트: ${count + 1}`); // 디버깅용
  };
  
  return (
    <div>
      <p>지금까지 {count}번 클릭했어요!</p>
      <button onClick={handleClick}>
        클릭해보세요
      </button>
    </div>
  );
}
```

클래스 컴포넌트 쓸 때는 this.state, this.setState 이런 걸로 복잡했는데, Hook은 정말 간단하더라. 함수형으로 쓰니까 코드도 훨씬 읽기 쉽고.

### useEffect - 사이드 이펙트 처리하기

```javascript
import { useState, useEffect } from 'react';

function PageTitle() {
  const [count, setCount] = useState(0);
  
  // count가 바뀔 때마다 브라우저 탭 제목도 바뀜
  useEffect(() => {
    document.title = `${count}번 클릭함`;
  }, [count]); // count가 바뀔 때만 실행
  
  return (
    <div>
      <p>브라우저 탭 제목 확인해보세요!</p>
      <button onClick={() => setCount(count + 1)}>
        클릭 (+1)
      </button>
    </div>
  );
}
```

useEffect가 처음엔 헷갈렸다. 언제 실행되는지, dependency array는 뭔지... 하지만 몇 번 써보니까 패턴이 보이더라. "이 값이 바뀔 때 이걸 해줘"라고 생각하면 된다.

## 컴포넌트 재사용 - 한 번 만들면 계속 쓸 수 있다

프로젝트하면서 가장 편했던 게 이 부분이다. 버튼이나 모달 같은 걸 한 번 만들어놓으면 여기저기서 갖다 쓸 수 있으니까.

```javascript
// 재사용 가능한 버튼 컴포넌트
function CustomButton({ text, color, onClick }) {
  return (
    <button 
      style={{ backgroundColor: color }}
      onClick={onClick}
      className="my-button"
    >
      {text}
    </button>
  );
}

// 여러 곳에서 사용
function App() {
  return (
    <div>
      <CustomButton 
        text="저장" 
        color="blue" 
        onClick={() => alert('저장됐어요!')} 
      />
      <CustomButton 
        text="삭제" 
        color="red" 
        onClick={() => alert('정말 삭제할까요?')} 
      />
    </div>
  );
}
```

처음에는 '이렇게까지 나눠야 하나?' 싶었는데, 나중에 디자인 바꿀 때 한 곳만 수정하면 되니까 정말 편하더라.

## Next.js - React를 더 쉽게 만들어주는 마법

React만 쓰다가 Next.js를 처음 써봤을 때 충격이었다. 설정할 게 거의 없더라.

### 파일 기반 라우팅 - 진짜 직관적이다

기존에는 react-router 써서 라우팅 설정을 별도로 해야 했는데, Next.js는 파일 구조만으로 라우팅이 된다.

```
pages/
  index.js       -> 홈페이지 (/)
  about.js       -> 어바웃 페이지 (/about)
  blog/
    index.js     -> 블로그 메인 (/blog)
    [id].js      -> 개별 블로그 글 (/blog/1, /blog/2, ...)
```

이게 얼마나 편한지 모른다. 새 페이지 만들고 싶으면 그냥 파일 하나 만들면 끝이니까.

### SSR (서버 사이드 렌더링) - SEO에 좋다더라

```javascript
// pages/blog/[id].js
function BlogPost({ post }) {
  return (
    <div>
      <h1>{post.title}</h1>
      <p>{post.content}</p>
    </div>
  );
}

// 서버에서 먼저 데이터를 가져와서 렌더링
export async function getServerSideProps({ params }) {
  // API에서 블로그 글 데이터 가져오기
  const post = await fetch(`/api/posts/${params.id}`).then(res => res.json());
  
  return {
    props: { post }
  };
}

export default BlogPost;
```

SSR이 뭔지 처음엔 잘 몰랐는데, 검색엔진이 내 페이지를 제대로 읽을 수 있게 해준다는 걸 알고 나니까 중요하다는 걸 깨달았다. 특히 블로그나 쇼핑몰 같은 사이트에서는 필수인 것 같다.

### API Routes - 백엔드도 같이 만들 수 있다

```javascript
// pages/api/hello.js
export default function handler(req, res) {
  if (req.method === 'GET') {
    res.status(200).json({ message: '안녕하세요!' });
  } else if (req.method === 'POST') {
    const { name } = req.body;
    res.status(200).json({ message: `안녕하세요, ${name}님!` });
  }
}
```

이게 진짜 편하다. 프론트엔드 프로젝트 안에서 간단한 API도 만들 수 있으니까. 풀스택 개발이 이렇게 쉬울 줄 몰랐다.

## 실제 프로젝트에서 겪은 일들

### 처음엔 이것저것 다 넣고 싶었다

프로젝트 초반에는 '이것도 써보고 저것도 써보자' 하면서 라이브러리를 막 설치했다. 상태 관리는 Redux, 스타일링은 styled-components, UI는 Material-UI... 

그런데 나중에 보니까 너무 복잡해지더라. 간단한 기능도 여러 단계를 거쳐야 하고. 지금은 정말 필요한 것만 쓰려고 한다.

### 성능 최적화에 대해 알게 됐다

처음에는 그냥 작동만 하면 됐는데, 사용자가 늘어나면서 느려지는 게 체감됐다. 그래서 React.memo, useMemo, useCallback 같은 걸 써보기 시작했다.

```javascript
import { memo, useMemo } from 'react';

// 불필요한 리렌더링 방지
const ExpensiveComponent = memo(({ data }) => {
  // 복잡한 계산은 메모이제이션
  const processedData = useMemo(() => {
    return data.map(item => ({
      ...item,
      processed: heavyCalculation(item)
    }));
  }, [data]);
  
  return (
    <div>
      {processedData.map(item => (
        <div key={item.id}>{item.processed}</div>
      ))}
    </div>
  );
});
```

성능 최적화는 정말 끝이 없는 것 같다. 하지만 사용자 경험이 확실히 좋아지는 걸 보면 뿌듯하다.

### 배포할 때 알게 된 것들

Vercel로 배포하니까 Next.js와 찰떡궁합이더라. GitHub에 푸시하면 자동으로 배포되고, preview URL도 만들어주고.

하지만 환경변수 설정이나 도메인 연결 같은 걸 처음 할 때는 헤맸다. 특히 API 키 같은 민감한 정보를 어떻게 관리해야 하는지 고민이 많았다.

## 앞으로의 계획

React와 Next.js에 어느 정도 익숙해졌으니까, 이제 TypeScript도 써보고 싶다. 타입 안정성이 좋다는 얘기를 많이 들어서.

그리고 테스팅도 제대로 배워보고 싶다. 지금까지는 그냥 브라우저에서 수동으로 테스트했는데, Jest나 React Testing Library 같은 걸로 자동화해보면 좋을 것 같다.

무엇보다 더 많은 프로젝트를 해보면서 실전 경험을 쌓고 싶다. 혼자 공부하는 것과 실제로 서비스를 만드는 건 정말 다르더라.

## 마지막으로

React와 Next.js를 배우면서 웹 개발이 정말 재밌다는 걸 깨달았다. 물론 처음엔 어려웠지만, 차근차근 배우다 보니 점점 할 수 있는 게 많아지는 게 보였다.

특히 내가 만든 걸 다른 사람들이 실제로 쓰는 걸 보면 정말 뿌듯하다. 앞으로도 계속 배워가면서 더 좋은 웹사이트를 만들어보고 싶다.