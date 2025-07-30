---
title: "Flutter 웹앱을 Firebase에 무료로 배포하기"
date: "2025-01-24"
category: "개발"
tags: ['Flutter', 'Firebase', 'Hosting', '웹배포', '개발']
excerpt: "Flutter 웹앱을 Firebase Hosting에 배포하는 방법을 실제 경험을 바탕으로 단계별 설명"
readTime: "3분"
---

Flutter로 웹앱을 만들고 나서 다른 사람들에게 보여주고 싶은데, 매번 "내 컴퓨터에서 `flutter run -d web` 하고 localhost 보세요" 할 수는 없잖나. Firebase Hosting을 사용하면 무료로 웹에 배포할 수 있다.

몇 번 해보면서 삽질한 경험을 바탕으로 정리해보려고 한다.

## 왜 Firebase Hosting인가?

다른 호스팅 서비스도 많은데 Firebase를 쓰는 이유:

1. **무료**: Spark 플랜으로 웬만한 개인 프로젝트는 충분
2. **빠름**: Google CDN 사용해서 로딩 속도 빠름
3. **간편함**: CLI로 명령어 하나면 배포 완료
4. **HTTPS**: 기본으로 SSL 인증서 제공
5. **커스텀 도메인**: 나중에 내 도메인 연결 가능

## 필요한 것들

배포하기 전에 준비해야 할 것들:

- **Google 계정**: Firebase는 구글 서비스니까
- **Flutter 프로젝트**: 웹 지원하는 프로젝트여야 함
- **Node.js**: Firebase CLI 설치하려면 필요

Node.js 설치되어 있는지 확인하려면:
```bash
node -v
```

없으면 [nodejs.org](https://nodejs.org)에서 다운로드해서 설치하자.

## 단계별 배포 과정

### 1. Firebase 프로젝트 만들기

[Firebase 콘솔](https://console.firebase.google.com)에 들어가서:

1. "프로젝트 추가" 클릭
2. 프로젝트 이름 입력 (예: `my-flutter-app`)
3. Google Analytics는 일단 끄고 넘어가기 (나중에 추가 가능)
4. "프로젝트 만들기" 클릭하고 기다리기

### 2. Firebase CLI 설치

터미널 열고 Firebase CLI 설치:

```bash
npm install -g firebase-tools
```

설치 완료되면 로그인:

```bash
firebase login
```

브라우저가 열리면서 구글 계정으로 로그인하라고 나온다. 아까 프로젝트 만든 계정으로 로그인하면 됨.

### 3. Flutter 프로젝트에 Firebase 설정

Flutter 프로젝트 폴더로 이동:

```bash
cd /path/to/my-flutter-project
```

Firebase 초기화:

```bash
firebase init
```

여러 질문이 나오는데 이렇게 답하면 됨:

- **Are you ready to proceed?** → `Y`
- **Which Firebase features?** → `Hosting` 선택 (스페이스바로 선택, 엔터로 확인)
- **Please select an option** → `Use an existing project`
- **Select a default Firebase project** → 아까 만든 프로젝트 선택
- **What do you want to use as your public directory?** → **중요!** `build/web` 입력
- **Configure as a single-page app?** → `Y` (이거 안 하면 라우팅 안 됨)
- **Set up automatic builds and deploys with GitHub?** → `N` (일단 수동으로)

`build/web`을 꼭 입력해야 한다. Flutter 웹 빌드 결과물이 여기에 생성되기 때문이다.

### 4. Flutter 웹 빌드

```bash
flutter build web
```

이 명령어로 `build/web` 폴더에 배포용 파일들이 생성된다.

### 5. 배포하기

```bash
firebase deploy
```

잠시 기다리면 이런 메시지가 나온다:

```
✔ Deploy complete!

Project Console: https://console.firebase.google.com/project/my-flutter-app/overview
Hosting URL: https://my-flutter-app.web.app
```

**Hosting URL**이 바로 내 앱 주소다! 이 링크 공유하면 누구나 볼 수 있다.

## 업데이트하는 방법  

앱 수정하고 다시 배포하려면:

```bash
flutter build web
firebase deploy
```

이 두 명령어만 다시 실행하면 됨. 간단하다.

## 자주 만나는 문제들

### 1. 라우팅이 안 됨
Firebase 설정할 때 "single-page app" 설정을 `Y`로 안 했을 가능성이 높다. 

`firebase.json` 파일 열어서 이렇게 되어 있는지 확인:
```json
{
  "hosting": {
    "public": "build/web",
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

### 2. 404 에러
`public` 디렉토리를 `build/web`으로 안 설정했거나, 빌드를 안 하고 배포했을 때 발생한다.

### 3. 권한 에러
`firebase login`을 안 했거나, 다른 계정으로 로그인되어 있을 때. `firebase logout` 후 다시 로그인해보자.

### 4. 용량 초과
Spark 플랜은 10GB까지만 무료다. 이미지나 동영상 파일이 너무 크면 최적화하거나 외부 CDN 사용하자.

## 추가 팁들

### 커스텀 도메인 연결
Firebase 콘솔 → Hosting → "커스텀 도메인 추가"에서 내 도메인 연결 가능하다.

### 배포 히스토리 관리
```bash
firebase hosting:disable    # 사이트 비활성화
firebase deploy --only hosting  # hosting만 배포
```

### 로컬에서 미리보기
```bash
firebase serve
```
로컬에서 Firebase 환경과 똑같이 테스트할 수 있다.

### GitHub Actions로 자동 배포
나중에 푸시할 때마다 자동으로 배포되게 하고 싶으면 GitHub Actions 설정할 수도 있다. 하지만 처음엔 수동이 편하다.

## 마무리

Firebase Hosting은 정말 편하다. 설정 한 번만 해두면 나중엔 `flutter build web && firebase deploy` 이 두 명령어로 끝이다.

무료 플랜도 개인 프로젝트엔 충분하고, 속도도 빠르고, HTTPS도 기본 제공이라 부담 없이 쓸 수 있다.

기획자나 디자이너분들께 "이거 한번 봐주세요" 하면서 링크 보내기 정말 편하다. 더 이상 localhost 포트번호 알려드릴 필요 없다는 게 최고다.