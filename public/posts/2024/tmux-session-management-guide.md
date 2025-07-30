---
title: "tmux 세션 관리 완벽 가이드"
date: "2024-01-30"
category: "Linux"
tags: ['tmux', '터미널', '세션 관리', 'Linux', '멀티플렉서']
excerpt: "tmux 터미널 멀티플렉서의 기본 사용법과 세션이 사라지는 문제 해결 방법을 자세히 설명합니다."
readTime: "3분"
---

## tmux란?

tmux는 터미널 세션을 유지하고 관리할 수 있게 해주는 강력한 터미널 멀티플렉서입니다. SSH 연결이 끊어져도 작업을 계속할 수 있고, 하나의 터미널에서 여러 세션을 동시에 관리할 수 있습니다.

## tmux 기본 사용법

### 세션 생성 및 관리

```bash
# 새 세션 생성
tmux

# 이름 지정하여 세션 생성
tmux new-session -s 세션이름
tmux new -s 세션이름
```

### 세션 분리 및 재연결

```bash
# 세션 분리 (세션은 백그라운드에서 계속 실행)
Ctrl+b 누른 후 d 키 입력

# 세션 목록 확인
tmux ls
tmux list-sessions

# 세션에 재연결
tmux attach
tmux a
tmux attach -t 세션이름
```

## 세션이 사라지는 문제 원인

tmux를 사용하다 보면 세션이 예기치 않게 사라지는 경우가 있습니다. 주요 원인들을 살펴보겠습니다.

### 1. 터미널을 올바르게 분리하지 않고 닫음

tmux 세션을 활성화한 상태에서 터미널 창을 그냥 닫으면 세션이 종료될 수 있습니다. 이는 가장 흔한 실수 중 하나입니다.

### 2. 세션 내에서 exit 명령 사용

세션을 분리(detach)하지 않고 세션 내에서 `exit` 명령을 실행하면 해당 세션이 완전히 종료됩니다.

### 3. 터미널 에뮬레이터 설정

일부 터미널 에뮬레이터(예: kitty)는 기본적으로 tmux 세션을 종료시키도록 설정되어 있을 수 있습니다.

## 세션 사라짐 문제 해결 방법

### 1. 올바른 세션 분리 사용하기

터미널을 종료하기 전에 반드시 `Ctrl+b d`를 사용하여 세션을 분리하세요. 이렇게 하면 세션이 백그라운드에서 계속 실행됩니다.

### 2. tmux 세션 자동 저장 설정

tmux 설정 파일(`~/.tmux.conf`)에 다음을 추가하여 세션을 자동으로 저장하고 복구할 수 있습니다:

```bash
# 자동 세션 저장 관련 플러그인 설치 (tmux plugin manager 필요)
set -g @plugin 'tmux-plugins/tmux-resurrect'
set -g @plugin 'tmux-plugins/tmux-continuum'

# 자동 저장 활성화
set -g @continuum-restore 'on'
```

### 3. 세션 종료 방지 설정

tmux 설정 파일에 다음 설정을 추가하여 창이 닫힐 때 세션이 종료되는 것을 방지할 수 있습니다:

```bash
set -g detach-on-destroy on
```

### 4. 추가 해결 팁

#### 다른 사용자로 실행된 세션 확인

세션이 보이지 않는다면 다른 사용자 계정으로 실행되었을 수 있습니다. 다른 사용자로 로그인하여 세션을 확인해보세요.

#### tmux 서버 재시작

간혹 tmux 서버에 문제가 생겨 세션이 보이지 않을 수 있습니다. 다음 명령을 실행해보세요:

```bash
pkill -USR1 tmux
```

#### 세션 자동 종료 방지

모든 클라이언트가 분리되었을 때 서버가 자동으로 종료되지 않도록 설정:

```bash
tmux set-option -g exit-empty off
```

#### 마지막 창이 닫힐 때 세션 유지

마지막 창이 닫혀도 세션이 유지되도록 설정:

```bash
tmux set-option -g exit-unattached off
```

## 유용한 tmux 단축키

### 기본 조작

- `Ctrl+b c`: 새 창 생성
- `Ctrl+b n`: 다음 창으로 이동
- `Ctrl+b p`: 이전 창으로 이동
- `Ctrl+b [창번호]`: 특정 창으로 이동
- `Ctrl+b &`: 현재 창 종료

### 패널 조작

- `Ctrl+b %`: 세로로 패널 분할
- `Ctrl+b "`: 가로로 패널 분할
- `Ctrl+b 방향키`: 패널 간 이동
- `Ctrl+b x`: 현재 패널 종료

## 권장 설정

다음은 tmux를 더 편리하게 사용하기 위한 권장 설정입니다:

```bash
# ~/.tmux.conf 파일에 추가

# 마우스 지원 활성화
set -g mouse on

# 창 번호를 1부터 시작
set -g base-index 1
set -g pane-base-index 1

# 키 응답 시간 단축
set -sg escape-time 1

# 히스토리 버퍼 크기 설정
set -g history-limit 10000

# 상태바 새로고침 간격
set -g status-interval 60
```

## 요약

tmux 세션 관리의 핵심은 세션을 올바르게 분리(detach)하는 것입니다. 터미널을 닫기 전에 항상 `Ctrl+b d`를 사용하여 세션을 분리하고, 나중에 `tmux attach`를 사용하여 다시 연결하세요. 

추가적인 보호를 위해 tmux 설정 파일에 적절한 설정을 추가하고, 필요한 경우 세션 자동 저장 플러그인을 사용하면 더욱 안정적으로 tmux를 활용할 수 있습니다.