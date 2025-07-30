---
title: "Git 서브모듈, 진짜 쓸 만한 걸까?"
date: "2025-01-24"
category: "개발"
tags: ['Git', '서브모듈', '버전관리', '개발도구', '프로젝트관리']
excerpt: "Git 서브모듈을 실제 프로젝트에서 써본 후기와 실용적인 사용법 정리"
readTime: "3분"
---

Git 서브모듈에 대해 찾아보면 항상 복잡한 설명들만 나온다. 실제로 써보니 생각보다 유용하기도 하고 골치 아프기도 했다. 실무에서 사용해본 경험을 바탕으로 정리해보려고 한다.

## 서브모듈이 뭐야?

간단히 말하면 **Git 저장소 안에 다른 Git 저장소를 넣는 방법**이다. 

예를 들어 내 웹사이트 프로젝트에서 UI 라이브러리를 서브모듈로 관리한다면:
- 메인 프로젝트: `my-website`
- 서브모듈: `ui-components` 

메인 프로젝트는 UI 라이브러리의 특정 버전(커밋)을 가리키고, 라이브러리가 업데이트되어도 메인 프로젝트는 영향받지 않는다.

## 언제 쓰면 좋을까?

### 쓰면 좋은 경우
1. **외부 라이브러리 관리**: 자주 바뀌지 않는 라이브러리들
2. **공통 컴포넌트**: 여러 프로젝트에서 공통으로 쓰는 코드  
3. **설정 파일**: DB 설정, 시크릿 키 같은 민감한 정보
4. **큰 프로젝트 모듈화**: 각 팀이 담당하는 모듈을 분리

### 안 쓰는 게 나은 경우
- 자주 바뀌는 내부 모듈
- 팀원들이 Git 초보인 경우 (진짜 복잡해진다)
- 간단한 프로젝트

## 기본 사용법

### 서브모듈 추가하기
```bash
# 서브모듈 추가
git submodule add https://github.com/username/ui-components.git components

# 특정 브랜치 추가
git submodule add -b develop https://github.com/username/ui-components.git components
```

이렇게 하면 `.gitmodules` 파일이 생긴다:
```
[submodule "components"]
    path = components
    url = https://github.com/username/ui-components.git
    branch = develop
```

### 서브모듈이 있는 프로젝트 클론하기
```bash
# 처음부터 서브모듈까지 한 번에
git clone --recurse-submodules https://github.com/myproject.git

# 이미 클론했다면
git submodule update --init --recursive
```

### 서브모듈 업데이트하기
```bash
# 서브모듈을 최신 버전으로 업데이트
git submodule update --remote

# 병합하면서 업데이트 (권장)
git submodule update --remote --merge
```

## 실전에서 만난 문제들

### 1. 분리된 HEAD 상태
서브모듈로 들어가서 `git status` 해보면 "HEAD detached" 라고 나온다. 이건 정상이다. 서브모듈은 특정 커밋을 가리키고 있어서 브랜치에 있지 않다.

서브모듈에서 수정 작업을 하려면:
```bash
cd components
git checkout main  # 브랜치로 이동
# 작업 후
git add .
git commit -m "수정사항"
git push

# 메인 프로젝트로 돌아가서
cd ..
git add components  # 서브모듈 업데이트를 스테이징
git commit -m "컴포넌트 업데이트"
```

### 2. 서브모듈이 비어있음
프로젝트를 클론했는데 서브모듈 폴더가 비어있다면:
```bash
git submodule update --init --recursive
```

이거 한 번이면 해결된다.

### 3. URL이 바뀌었을 때
서브모듈의 URL이 바뀌면:
```bash
git submodule sync
git submodule update --init --recursive
```

## 유용한 명령어들

### 모든 서브모듈 상태 확인
```bash
git submodule status
```

### 모든 서브모듈에서 같은 명령 실행
```bash
# 모든 서브모듈에서 상태 확인
git submodule foreach git status

# 모든 서브모듈을 main 브랜치로
git submodule foreach git checkout main
```

### 서브모듈 변경사항 자세히 보기
```bash
git diff --submodule=log
```

이 설정을 기본으로 만들려면:
```bash
git config diff.submodule log
```

## 서브모듈 vs 서브트리

비슷한 기능으로 Git 서브트리도 있다. 간략한 비교:

### 서브모듈
- **장점**: 명확한 버전 관리, 작은 저장소 크기
- **단점**: 사용법이 복잡, 팀원들이 헷갈림

### 서브트리  
- **장점**: 사용법 간단, 일반 폴더처럼 취급
- **단점**: 저장소 크기 커짐, 히스토리 복잡

개인적으로는 외부 라이브러리는 서브모듈, 내부 공통 코드는 서브트리를 선호한다.

## 실무 사용 팁

### 1. .gitmodules 파일 관리
이 파일이 서브모듈 설정의 핵심이다. 변경하면 바로 커밋해야 한다.

### 2. 팀 규칙 정하기
- 서브모듈 업데이트는 누가 언제 할 것인가?
- 서브모듈에서 직접 수정 금지할 것인가?
- 서브모듈 변경 시 팀에 어떻게 알릴 것인가?

### 3. CI/CD 설정
```bash
# CI에서 서브모듈까지 체크아웃
git submodule update --init --recursive
```

### 4. 푸시할 때 주의
```bash
# 서브모듈을 먼저 푸시했는지 확인
git push --recurse-submodules=check

# 서브모듈을 자동으로 푸시
git push --recurse-submodules=on-demand
```

## 서브모듈 제거하기

서브모듈이 필요 없어졌을 때:
```bash
# 최신 Git에서는 이거면 됨
git rm components
git commit -m "컴포넌트 서브모듈 제거"

# 완전히 정리하려면
rm -rf .git/modules/components
```

## 자주 하는 실수들

### 1. 서브모듈 수정 후 메인 프로젝트 커밋 깜빡
```bash
# 서브모듈에서 작업 후
cd components
git add .
git commit -m "컴포넌트 수정"
git push

# 이 부분을 깜빡하면 안 됨!
cd ..
git add components
git commit -m "컴포넌트 업데이트"
```

### 2. 서브모듈 변경사항을 pull 받지 않음
팀원이 서브모듈을 업데이트했는데 내가 pull만 하고 서브모듈은 업데이트 안 하는 경우:
```bash
git pull
git submodule update --recursive  # 이거 꼭 해야 함
```

### 3. 잘못된 브랜치에서 서브모듈 수정
서브모듈은 기본적으로 detached HEAD 상태라서 브랜치 체크아웃을 깜빡하기 쉽다.

## 실제 사용 사례

### 사례 1: UI 컴포넌트 라이브러리
```bash
# 메인 프로젝트 구조
my-website/
├── src/
├── components/          # 서브모듈
│   ├── Button/
│   ├── Modal/
│   └── ...
└── package.json
```

여러 프로젝트에서 공통 UI 컴포넌트를 사용할 때 유용했다. 컴포넌트가 업데이트되어도 각 프로젝트는 원하는 버전을 유지할 수 있다.

### 사례 2: 설정 파일 관리
```bash
# 프로덕션 설정을 별도 저장소로 관리
api-server/
├── src/
├── config/              # 서브모듈 (private repo)
│   ├── database.yml
│   ├── secrets.yml
│   └── ...
└── app.js
```

민감한 설정 파일을 private 저장소로 분리해서 관리했다. 개발자별로 접근 권한을 다르게 줄 수 있어서 좋았다.

## 대안들과의 비교

### npm/yarn 패키지 vs 서브모듈
- **패키지**: 버전 관리 쉬움, 의존성 해결 자동
- **서브모듈**: 소스코드 직접 수정 가능, 더 세밀한 제어

### Git 서브트리 vs 서브모듈
- **서브트리**: 사용법 간단, 히스토리 복잡
- **서브모듈**: 사용법 복잡, 히스토리 깔끔

### 모노레포 vs 서브모듈
- **모노레포**: 통합 관리 쉬움, 저장소 크기 큼
- **서브모듈**: 독립적 관리, 복잡한 워크플로우

## 마무리

서브모듈은 분명 유용하지만 복잡하다. 팀원들이 Git에 익숙하지 않다면 도입하기 전에 충분한 교육이 필요하다.

개인적으로는:
- 작은 프로젝트에서는 굳이 쓰지 않음
- 외부 라이브러리나 공통 컴포넌트 관리할 때 사용
- 자주 바뀌는 코드는 모노레포나 패키지 매니저 활용
- 민감한 설정 파일 분리할 때 유용

서브모듈을 쓰기로 했다면:
1. 팀 내에서 명확한 규칙을 정하고 문서화
2. 간단한 프로젝트에서 먼저 연습
3. CI/CD 파이프라인에 서브모듈 업데이트 포함
4. 정기적인 서브모듈 상태 점검

복잡해 보이지만 한 번 익숙해지면 프로젝트 구조를 깔끔하게 관리할 수 있는 좋은 도구다.