---
title: "Rsync 커스텀 SSH 포트 사용법 완벽 가이드"
date: "2024-08-21"
category: "Linux"
tags: ['rsync', 'SSH', '파일 동기화', '백업', 'Linux']
excerpt: "Rsync를 사용할 때 기본 SSH 포트가 아닌 커스텀 포트를 지정하는 올바른 방법을 상세히 설명합니다."
readTime: "3분"
---

## 문제 상황

Rsync를 사용하여 원격 서버로 파일을 전송할 때, 기본 SSH 포트(22번)가 아닌 커스텀 포트(예: 2722번)를 사용해야 하는 경우가 있습니다. 하지만 많은 사용자들이 잘못된 문법을 사용하여 "Connection refused" 에러를 만나게 됩니다.

## 잘못된 명령어 예시

다음과 같은 명령어는 작동하지 않습니다:

```bash
sudo rsync -avz /mnt/nas/backup/* --port 2722 nodove@30.30.30.3:/mnt/nas/files/백업/040825/
```

### 왜 작동하지 않는가?

`--port` 옵션은 rsync의 SSH 연결에서 사용하는 옵션이 아닙니다. 이 명령어는 여전히 기본 SSH 포트(22번)로 연결을 시도하기 때문에 "Connection refused" 에러가 발생합니다.

## 정확한 해결 방법

### 1. -e 옵션 사용 (권장 방법)

커스텀 SSH 포트를 지정하려면 `-e` 옵션을 사용해야 합니다:

```bash
sudo rsync -avz -e "ssh -p 2722" /mnt/nas/backup/* nodove@30.30.30.3:/mnt/nas/files/백업/040825/
```

#### 옵션 설명

- `-a`: 아카이브 모드 (권한, 소유권, 타임스탬프 등 보존)
- `-v`: 상세 출력 (전송 진행 상황 표시)
- `-z`: 전송 중 데이터 압축 (전송 속도 향상)
- `-e "ssh -p 2722"`: SSH를 원격 셸로 사용하되 포트 2722 지정

### 2. SSH 설정 파일 활용

자주 사용하는 서버의 경우, SSH 클라이언트 설정 파일을 수정하여 편의성을 높일 수 있습니다.

`~/.ssh/config` 파일에 다음 내용을 추가합니다:

```
Host 30.30.30.3
    Port 2722
    User nodove
```

이렇게 설정하면 rsync 명령어를 단순화할 수 있습니다:

```bash
sudo rsync -avz /mnt/nas/backup/* nodove@30.30.30.3:/mnt/nas/files/백업/040825/
```

## 고급 사용법

### 추가 SSH 옵션 지정

SSH 연결 시 추가 옵션을 사용해야 하는 경우:

```bash
rsync -avz -e "ssh -p 2722 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null" \
  /source/path/ user@remote-host:/destination/path/
```

### 키 기반 인증 사용

특정 SSH 키를 사용하는 경우:

```bash
rsync -avz -e "ssh -p 2722 -i ~/.ssh/custom_key" \
  /source/path/ user@remote-host:/destination/path/
```

### 대역폭 제한

네트워크 대역폭을 제한하고 싶은 경우:

```bash
rsync -avz --bwlimit=1000 -e "ssh -p 2722" \
  /source/path/ user@remote-host:/destination/path/
```

## 실용적인 활용 예시

### 1. 백업 스크립트

```bash
#!/bin/bash
# backup_script.sh

SOURCE_DIR="/home/user/important_data"
DEST_HOST="backup-server.example.com"
DEST_PATH="/backup/user_data"
SSH_PORT="2722"

rsync -avz --delete -e "ssh -p $SSH_PORT" \
  "$SOURCE_DIR/" "user@$DEST_HOST:$DEST_PATH/"
```

### 2. 진행 상황 표시

대용량 파일 전송 시 진행률을 보고 싶은 경우:

```bash
rsync -avz --progress -e "ssh -p 2722" \
  /large/dataset/ user@remote-host:/destination/
```

### 3. 건조 실행 (Dry Run)

실제 전송 전에 어떤 파일들이 전송될지 미리 확인:

```bash
rsync -avz --dry-run -e "ssh -p 2722" \
  /source/path/ user@remote-host:/destination/
```

## 문제 해결

### 연결 문제 디버깅

SSH 연결 문제를 진단하려면:

```bash
ssh -p 2722 -v user@remote-host
```

### 방화벽 확인

원격 서버에서 해당 포트가 열려있는지 확인:

```bash
# 서버에서 실행
netstat -tlnp | grep :2722
# 또는
ss -tlnp | grep :2722
```

### 권한 문제

sudo를 사용할 때 SSH 키 경로 문제가 발생할 수 있습니다:

```bash
# 현재 사용자의 SSH 키를 사용하도록 지정
sudo rsync -avz -e "ssh -p 2722 -i $HOME/.ssh/id_rsa" \
  /source/ user@remote-host:/destination/
```

## 보안 고려사항

1. **포트 변경**: 기본 SSH 포트를 변경하는 것은 자동화된 공격을 줄이는 데 도움이 됩니다.
2. **키 기반 인증**: 패스워드 대신 SSH 키를 사용하여 보안을 강화하세요.
3. **방화벽 설정**: 필요한 포트만 열어두고 나머지는 차단하세요.

## 결론

Rsync에서 커스텀 SSH 포트를 사용하는 핵심은 `-e` 옵션을 올바르게 활용하는 것입니다. 이 방법을 사용하면 보안이 강화된 환경에서도 안전하고 효율적으로 파일 동기화를 수행할 수 있습니다.

자주 사용하는 서버의 경우 SSH 설정 파일을 구성하여 명령어를 단순화하고, 스크립트를 작성하여 정기적인 백업 작업을 자동화하는 것을 권장합니다.