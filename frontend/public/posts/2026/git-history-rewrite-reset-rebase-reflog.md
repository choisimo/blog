---
title: "force push 이후 커밋 해시가 전부 바뀌는 이유: reset, rebase, reflog로 복구까지"
date: "2026-03-16"
category: "Git"
tags: ["Git", "Force Push", "Reset", "Rebase", "Reflog", "Version Control"]
excerpt: "커밋 메시지 수정이나 rebase 뒤에 왜 해시가 연쇄적으로 바뀌는지, reset과 rebase는 무엇이 다른지, hard reset으로 날린 커밋을 reflog로 어떻게 되살리는지 정리한다."
readTime: "14분"
---

처음에는 단순해 보인다. 커밋 메시지 하나만 고쳤을 뿐인데 GitHub에서는 커밋 해시가 전부 새로 생기고, 브랜치 비교 화면도 낯설어지고, 이미 보냈던 커밋 링크는 어느새 "옛 히스토리"가 되어 버린다. 여기서 많은 사람이 "내가 내용은 거의 안 바꿨는데 왜 Git이 이렇게 크게 반응하지?"라는 의문을 갖는다.

하지만 Git 입장에서는 전혀 이상한 일이 아니다. Git은 파일 목록만 저장하는 도구가 아니라, **부모 커밋과 메시지까지 포함한 커밋 객체 전체**를 해시로 식별한다. 그래서 메시지를 바꾸는 순간에도 새로운 커밋이 만들어지고, 그 커밋을 부모로 삼는 다음 커밋들도 연쇄적으로 전부 새 해시를 갖게 된다.

이 글에서는 그 연쇄 변경이 왜 발생하는지, `reset`과 `rebase`는 정확히 무엇이 다른지, 그리고 `git reflog`를 이용해 `hard reset`으로 사라진 커밋까지 어떻게 복구하는지 한 번에 정리해 보려 한다. 특히 GitHub에 이미 올라간 브랜치를 `--force-with-lease`로 강제 갱신할 때 무엇이 실제로 바뀌는지도 함께 다룬다.

## Git에서 커밋 해시는 무엇으로 만들어질까

Git 커밋은 단순히 "이 시점의 파일들"만 가리키지 않는다. 대략 아래 정보가 함께 들어간다.

- 어떤 트리(tree)를 가리키는가
- 부모 커밋이 누구인가
- 작성자(author)와 커미터(committer)가 누구인가
- 작성 시각과 커밋 시각이 언제인가
- 커밋 메시지가 무엇인가

즉, 다음 둘은 파일이 완전히 같아도 다른 커밋이다.

- 부모가 다른 커밋
- 메시지가 다른 커밋

예를 들어 이런 히스토리가 있다고 하자.

```text
A -- B -- C -- D
```

여기서 `C`의 커밋 메시지만 바꿔도 Git은 기존 `C`를 수정하지 않는다. 대신 새로운 `C'`를 만든다. 문제는 `D`가 원래 `C`를 부모로 보고 있었다는 점이다. 이제 `D`도 부모 정보가 달라지므로 그대로 둘 수 없고, 새로운 `D'`가 다시 만들어진다.

```text
A -- B -- C -- D
          \
           C' -- D'
```

사용자 입장에서는 "메시지 한 줄 수정"이지만, Git 객체 모델 기준으로는 **중간 커밋 하나를 새로 만들고 그 뒤의 자식 커밋들을 전부 다시 찍는 작업**이다. 그래서 rebase나 과거 커밋 수정이 들어가면 이후 해시가 연쇄적으로 바뀌는 것이다.

## 왜 GitHub에서는 더 크게 보일까

로컬에서는 "브랜치 포인터가 새 커밋 쪽으로 이동했다" 정도로 끝나지만, GitHub에서는 브랜치라는 공개 참조가 업데이트된다. 그리고 GitHub는 커밋을 해시로 식별하므로, 기존 해시와 새 해시를 완전히 다른 객체로 본다.

그래서 force push 이후에 보이는 현상은 대체로 이렇다.

- 브랜치 최신 커밋 목록이 새 해시로 바뀐다
- 예전 커밋 링크는 여전히 접근될 수 있어도 브랜치 히스토리에서는 사라진다
- PR 비교 화면의 "새 커밋 수"가 다시 계산된다
- 다른 사람이 예전 해시를 기준으로 작업 중이었다면 충돌 가능성이 커진다

중요한 점은 GitHub가 특별히 "더 많이 바꾸는" 것이 아니라는 사실이다. GitHub는 그냥 새로운 DAG를 보여 줄 뿐이다. 해시가 바뀌었다는 것은 곧 **히스토리의 정체성 자체가 바뀌었다**는 뜻이다.

## `reset`과 `rebase`는 무엇이 다를까

이 둘은 모두 히스토리를 건드릴 수 있지만, 동작 방식이 다르다.

### `git reset`

`reset`은 기본적으로 **브랜치 참조를 어디로 옮길지** 결정하는 명령이다. 그리고 옵션에 따라 index, working tree까지 함께 되감는다.

대표적으로 세 가지를 많이 쓴다.

```bash
git reset --soft HEAD~1
git reset --mixed HEAD~1
git reset --hard HEAD~1
```

- `--soft`: 브랜치만 옮기고 staging 상태는 유지
- `--mixed`: 브랜치와 index를 옮기고 working tree는 유지
- `--hard`: 브랜치, index, working tree를 모두 옮김

예를 들어:

```text
A -- B -- C (main)
```

여기서 `git reset --hard B`를 하면 `main`은 `B`를 가리키게 된다.

```text
A -- B (main)
      \
       C
```

`C`가 즉시 디스크에서 영구 삭제되는 것은 아니다. 다만 어떤 브랜치도 가리키지 않는 **dangling commit**이 된다. 이 상태에서는 아직 reflog나 object database를 통해 복구 가능하다.

### `git rebase`

`rebase`는 브랜치 포인터만 옮기는 것이 아니라, **기존 커밋들을 다른 부모 위에서 다시 재생성**한다.

예를 들어:

```text
A -- B -- C (main)
      \
       D -- E (feature)
```

여기서 `feature`를 `main` 위로 rebase하면:

```text
A -- B -- C (main)
            \
             D' -- E' (feature)
```

겉보기에 내용이 같아 보여도 `D`와 `E`는 더 이상 원래 커밋이 아니다. 부모가 바뀌었기 때문에 `D'`, `E'`라는 새 커밋이 생긴 것이다.

정리하면 이렇다.

- `reset`은 주로 **참조를 이동**한다
- `rebase`는 주로 **커밋을 다시 만든다**

둘 다 히스토리를 재작성할 수 있지만, "무엇이 다시 생성되느냐"라는 점에서 차이가 있다.

## `reset`, `rebase`, `revert`를 섞어 생각하면 안 되는 이유

실무에서는 셋을 자주 혼동한다.

- `reset`: 내 브랜치 포인터를 과거로 되돌린다
- `rebase`: 커밋들을 새 부모 위에 다시 쌓는다
- `revert`: 기존 히스토리를 보존한 채, 취소용 새 커밋을 만든다

공개 브랜치에서 협업 중이라면 보통 안전한 순서는 이렇다.

1. 이미 공유된 커밋을 "취소"하고 싶다면 `revert`를 우선 검토한다.
2. 메시지 정리나 squash처럼 히스토리 미관을 다듬고 싶다면, 아직 남과 공유되기 전 `rebase -i`가 좋다.
3. 로컬에서 커밋을 합치거나 지우고 다시 쌓을 때는 `reset`이 단순하고 빠르다.

공개 브랜치에서 `reset --hard`나 `rebase`를 쓴 뒤 force push를 해도 기술적으로는 가능하지만, 그 순간부터는 "내 개인 로컬 정리"가 아니라 "공유 히스토리 재작성"이 된다.

## force push는 정확히 무엇을 하는가

일반 `git push`는 원격 브랜치가 fast-forward 가능한 경우에만 성공한다. 즉 원격이 내 로컬 히스토리의 조상일 때만 허용된다.

하지만 rebase나 reset으로 로컬 히스토리를 다시 만들면 원격과 이런 형태가 된다.

```text
원격: A -- B -- C -- D
로컬: A -- B -- C' -- D'
```

이 경우 원격 브랜치를 단순히 앞으로 전진시키는 것이 불가능하므로 일반 push는 거절된다. 여기서 사용하는 것이 force push다.

```bash
git push --force-with-lease origin main
```

이 명령은 "원격 `main`을 내가 가진 새 히스토리로 덮어쓴다"는 뜻이다. 다만 `--force`보다 `--force-with-lease`가 안전하다. 이유는 간단하다.

- `--force`: 원격 상태를 거의 묻지 않고 밀어버린다
- `--force-with-lease`: 내가 마지막으로 알고 있던 원격 상태와 같을 때만 덮어쓴다

즉 협업 브랜치에서는 거의 항상 `--force-with-lease`가 맞다. 누군가 원격에 먼저 새 커밋을 올렸다면, 이 옵션은 내 강제 갱신을 막아 준다.

## 커밋 메시지 한 줄을 고친 뒤 해시가 전부 바뀌는 실제 이유

예를 들어 최근 두 커밋 메시지만 고치고 싶다고 하자.

```bash
git rebase -i HEAD~2
```

interactive rebase에서 `pick`을 `reword`로 바꾸면, 파일 내용이 안 바뀌더라도 두 커밋은 새 객체로 다시 생성된다. 그리고 그 둘을 가리키는 `HEAD`, `main`도 새 해시 쪽으로 이동한다.

이때 바뀌는 것은 단지 커밋 제목이 아니다.

- 각 커밋의 해시
- 그 커밋을 부모로 삼는 후속 커밋의 해시
- 브랜치가 가리키는 끝점

그래서 GitHub에서는 "전부 갈아엎은 것처럼" 보인다. 실제 파일 diff가 작더라도, 커밋 identity가 새로 생겼기 때문이다.

## `reflog`는 왜 hard reset조차 되돌릴 수 있을까

많은 사람이 Git을 "브랜치 히스토리"만으로 이해하지만, Git에는 로컬 참조 이동 기록이 따로 있다. 그게 `reflog`다.

```bash
git reflog
```

출력은 대략 이런 식이다.

```text
01a25f3 HEAD@{0}: rebase (finish): returning to refs/heads/main
4acda9a HEAD@{1}: rebase (reword): feat(app): improve blog UX...
e2c3a8a HEAD@{2}: checkout: moving from ...
8f571e0 HEAD@{3}: commit: temp work
```

핵심은 reflog가 **브랜치의 공식 히스토리**가 아니라 **내 로컬에서 HEAD와 ref가 어떻게 움직였는지**를 기록한다는 점이다. 그래서 `reset --hard`로 브랜치를 과거로 돌렸더라도, 그 직전 커밋 해시는 reflog에 남아 있을 수 있다.

예를 들어 실수로 이렇게 했다고 하자.

```bash
git reset --hard HEAD~3
```

이후 "방금 날린 커밋을 다시 살리고 싶다"면:

```bash
git reflog
git branch rescue <잃어버린-커밋-해시>
```

또는 브랜치 자체를 되돌리고 싶으면:

```bash
git reset --hard <잃어버린-커밋-해시>
```

즉 `hard reset`이 무섭긴 하지만, **즉시 영구 삭제**와는 다르다. 브랜치 포인터와 working tree를 강하게 옮길 뿐이고, 객체 자체는 한동안 남아 있기 때문이다.

## 복구 실전: hard reset으로 지운 커밋 되살리기

가장 실용적인 복구 순서는 보통 이렇다.

### 1. reflog에서 잃어버린 시점 찾기

```bash
git reflog --date=local
```

여기서 `reset: moving to ...`, `rebase: ...`, `commit: ...` 같은 로그를 보고 복구 시점을 찾는다.

### 2. 바로 reset하지 말고 구조물부터 만든다

처음에는 바로 `reset --hard`보다 rescue branch를 만드는 편이 안전하다.

```bash
git branch rescue-lost-work <sha>
git switch rescue-lost-work
```

이렇게 하면 현재 브랜치는 건드리지 않고 잃어버린 커밋을 안전하게 붙잡아 둘 수 있다.

### 3. 필요한 방식으로 되돌린다

- 통째로 복원: `git reset --hard <sha>`
- 일부만 cherry-pick: `git cherry-pick <sha>`
- 파일만 꺼내기: `git checkout <sha> -- <path>`

복구는 "무조건 예전 상태로 되돌리는 일"이 아니라, **잃어버린 객체에서 무엇을 어떻게 회수할지 고르는 일**에 가깝다.

## reflog로도 안 보인다면 끝일까

꼭 그렇지는 않다. 다만 난이도가 올라간다.

reflog는 로컬 기록이고, 영원히 보존되지 않는다. 시간이 지나 garbage collection이 돌면 도달 불가능한 객체는 정리될 수 있다. reflog가 사라졌다면 다음도 시도할 수 있다.

```bash
git fsck --lost-found
```

이 명령은 끊어진 객체를 찾는 데 도움이 된다. 다만 결과가 깔끔하지 않을 수 있고, commit/tree/blob가 흩어져 나올 수 있다. 그래서 실제 운영에서는 이렇게 생각하는 편이 좋다.

- 사고 직후라면 `reflog`가 최우선
- reflog가 없으면 `fsck`는 마지막 수단
- 정말 중요한 히스토리라면, 사라지기 전에 branch나 tag로 즉시 붙잡는다

## GitHub에서 날아간 커밋도 복구할 수 있을까

조심해야 할 지점이 하나 있다. `reflog`는 **로컬 Git 저장소의 기능**이지 GitHub 웹 UI의 기능이 아니다. GitHub는 사용자의 로컬 reflog를 대신 보관해 주지 않는다.

그래서 이런 차이가 생긴다.

- 내 로컬에서 reset/rebase로 잃어버린 커밋: reflog로 복구 가능
- GitHub에서 force push 후 브랜치에서 사라진 예전 커밋: 내 로컬이나 다른 협업자 로컬에 남아 있으면 복구 가능
- 아무 로컬에도 없고 충분한 시간이 지나 GC 대상이 된 커밋: 복구가 어려움

결국 "원격에서 사라진 커밋"도 실제 복구 출발점은 대개 누군가의 로컬 저장소다. 그래서 force push가 필요한 상황이라면, 최소한 팀 안에서 누가 예전 히스토리를 아직 갖고 있는지부터 확인하는 습관이 중요하다.

## 실무에서 force push를 조금 덜 위험하게 쓰는 방법

개인적으로는 아래 순서를 추천한다.

1. 먼저 `git log --graph --oneline --decorate -20`로 현재 DAG를 눈으로 확인한다.
2. 히스토리 재작성 전 `git branch backup/<name>`으로 백업 브랜치를 하나 판다.
3. `rebase -i`나 `reset`을 수행한다.
4. `git reflog`로 직전 위치가 남았는지 확인한다.
5. push는 `git push --force-with-lease origin <branch>`만 사용한다.

예를 들어:

```bash
git branch backup/main-before-reword
git rebase -i HEAD~2
git reflog -5
git push --force-with-lease origin main
```

이 정도만 해도 "실수했을 때 돌아갈 손잡이"가 훨씬 많아진다.

## 정리

Git에서 해시는 파일 내용만의 요약값이 아니다. 부모, 메시지, 메타데이터를 포함한 **커밋 객체의 정체성**이다. 그래서 과거 커밋을 조금만 손봐도 뒤쪽 커밋 해시까지 연쇄적으로 바뀐다. GitHub에서 force push 이후 히스토리가 크게 달라 보이는 이유도 여기에 있다.

그리고 `reset`과 `rebase`는 비슷해 보여도 역할이 다르다.

- `reset`은 브랜치 포인터를 옮긴다
- `rebase`는 커밋을 새로 만든다
- `revert`는 기존 히스토리를 보존한 채 취소 커밋을 추가한다

마지막으로 정말 중요한 점은 이것이다. `hard reset`은 무섭지만, 대개 그 즉시 끝은 아니다. Git은 한동안 그 흔적을 남기고, 그 흔적을 따라가는 가장 좋은 도구가 `reflog`다. 그러니 실수 직후라면 당황해서 이것저것 덮어쓰기 전에, 먼저 `git reflog`부터 보는 편이 거의 항상 더 낫다.
