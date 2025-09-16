---
title: "Vim 분할 창 사용법과 파일 간 전환 방법"
date: "2024-07-17"
category: "Editor"
tags: ['Vim', '편집기', '분할 창', 'Linux', '단축키']
excerpt: "Vim에서 vertical split view를 사용하여 여러 파일을 동시에 편집하고 파일 간 전환하는 방법을 소개합니다."
readTime: "3분"
---

## Vim 분할 창 기본 개념

Vim에서는 화면을 여러 개의 창으로 분할하여 동시에 여러 파일을 편집하거나 같은 파일의 다른 부분을 볼 수 있습니다. 이는 코드 편집 시 매우 유용한 기능입니다.

## 분할 창 생성하기

### Vertical Split (세로 분할)

```vim
:vsplit [파일명]
:vs [파일명]
```

파일명을 지정하지 않으면 현재 파일이 두 개의 창에 표시됩니다.

### Horizontal Split (가로 분할)

```vim
:split [파일명]
:sp [파일명]
```

## 창 간 이동 방법

### 1. 순차적 창 전환

- `Ctrl + w, w`: 다음 창으로 이동
- `Ctrl + w, W`: 이전 창으로 이동

### 2. 방향키를 이용한 전환

더 직관적이고 편리한 방법입니다:

- `Ctrl + w, h`: 왼쪽 창으로 이동
- `Ctrl + w, l`: 오른쪽 창으로 이동
- `Ctrl + w, j`: 아래쪽 창으로 이동
- `Ctrl + w, k`: 위쪽 창으로 이동

### 3. 창 번호를 이용한 전환

- `Ctrl + w, [숫자]`: 해당 번호의 창으로 이동

## 창 크기 조절

### 세로 크기 조절

- `Ctrl + w, +`: 현재 창 높이 증가
- `Ctrl + w, -`: 현재 창 높이 감소
- `Ctrl + w, =`: 모든 창을 같은 크기로 조절

### 가로 크기 조절

- `Ctrl + w, >`: 현재 창 너비 증가
- `Ctrl + w, <`: 현재 창 너비 감소

### 최대/최소화

- `Ctrl + w, _`: 현재 창을 세로로 최대화
- `Ctrl + w, |`: 현재 창을 가로로 최대화

## 창 관리

### 창 닫기

- `Ctrl + w, c`: 현재 창 닫기
- `Ctrl + w, o`: 현재 창만 남기고 모든 창 닫기
- `:q`: 현재 창 종료

### 창 이동

- `Ctrl + w, r`: 창들을 시계방향으로 회전
- `Ctrl + w, R`: 창들을 반시계방향으로 회전
- `Ctrl + w, x`: 현재 창과 다음 창의 위치 교환

### 창 배치 변경

- `Ctrl + w, H`: 현재 창을 화면 맨 왼쪽으로 이동 (full height)
- `Ctrl + w, J`: 현재 창을 화면 맨 아래로 이동 (full width)
- `Ctrl + w, K`: 현재 창을 화면 맨 위로 이동 (full width)
- `Ctrl + w, L`: 현재 창을 화면 맨 오른쪽으로 이동 (full height)

## 실용적인 사용 예시

### 1. 두 파일 비교하기

```vim
:vs file2.txt
```

현재 파일과 file2.txt를 나란히 놓고 비교할 수 있습니다.

### 2. 함수 정의와 사용처 동시 보기

```vim
:vs
Ctrl + w, l
/function_name
```

같은 파일을 두 창에 열고, 한 창에서는 함수 정의를, 다른 창에서는 함수 사용처를 볼 수 있습니다.

### 3. 설정 파일과 소스 코드 동시 편집

```vim
:vs ~/.vimrc
```

설정 파일을 참조하면서 코드를 편집할 때 유용합니다.

## 편의성을 위한 설정

`~/.vimrc` 파일에 다음 설정을 추가하면 더 편리하게 사용할 수 있습니다:

```vim
" 창 이동을 더 쉽게 하기
nnoremap <C-h> <C-w>h
nnoremap <C-j> <C-w>j
nnoremap <C-k> <C-w>k
nnoremap <C-l> <C-w>l

" 새 창을 오른쪽/아래에 열기
set splitright
set splitbelow

" 창 크기 조절을 더 쉽게 하기
nnoremap <silent> <C-w>+ :resize +5<CR>
nnoremap <silent> <C-w>- :resize -5<CR>
nnoremap <silent> <C-w>> :vertical resize +5<CR>
nnoremap <silent> <C-w>< :vertical resize -5<CR>
```

## 탭과 분할 창의 조합

Vim은 탭 기능도 제공하므로 탭과 분할 창을 조합하여 사용할 수 있습니다:

```vim
:tabnew file.txt    " 새 탭에서 파일 열기
:tabn              " 다음 탭으로 이동
:tabp              " 이전 탭으로 이동
```

## 결론

Vim의 분할 창 기능을 마스터하면 훨씬 더 효율적으로 파일을 편집할 수 있습니다. 특히 `Ctrl + w` 조합 키들을 익숙하게 사용할 수 있게 되면, 여러 파일을 동시에 작업하는 것이 매우 자연스러워집니다.

처음에는 단축키가 복잡해 보일 수 있지만, 자주 사용하다 보면 손에 익게 되어 마우스 없이도 빠르고 정확하게 창 간 이동과 파일 편집이 가능해집니다.