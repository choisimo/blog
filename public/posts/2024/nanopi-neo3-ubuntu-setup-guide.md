---
title: "NanoPi Neo3 우분투 설정 및 네트워크 구성 완벽 가이드"
date: "2024-03-05"
category: "Linux"
tags: ['NanoPi Neo3', 'Ubuntu', 'NetworkManager', 'ARM SBC', 'IoT', '고정 IP']
excerpt: "NanoPi Neo3에 우분투 설치 후 로그인부터 고정 IP 설정까지 완벽한 설정 가이드를 제공합니다."
readTime: "5분"
---

## 개요

NanoPi Neo3는 ARM 기반의 소형 단일 보드 컴퓨터로, IoT 프로젝트나 서버 구축에 널리 사용됩니다. 본 가이드에서는 우분투 설치 후 로그인 문제 해결부터 고정 IP 설정까지 체계적으로 다룹니다.

## 1. 기본 로그인 정보

NanoPi Neo3에 사용되는 OS별 기본 로그인 정보는 다음과 같습니다:

### 우분투 이미지 (FriendlyElec 공식)
- **사용자명**: root
- **비밀번호**: fa

### Armbian 이미지
- **사용자명**: root
- **비밀번호**: 1234

### DietPi 이미지
- **사용자명**: root
- **비밀번호**: dietpi

### 일반 우분투 이미지
- **사용자명**: ubuntu
- **비밀번호**: ubuntu

## 2. 로그인 문제 해결 방법

### 2.1 초기 부팅 대기

첫 부팅 시에는 시스템 초기화(cloud-init + SSH 키 생성) 작업이 완료될 때까지 기다려야 합니다. NanoPi Neo3의 사양에 따라 몇 분 정도 소요될 수 있습니다.

### 2.2 네트워크 연결 확인

SSH로 접속을 시도하는 경우, 장치가 네트워크에 제대로 연결되어 있는지 확인해야 합니다. 라우터의 DHCP 클라이언트 목록에서 장치의 IP 주소를 확인할 수 있습니다.

### 2.3 다양한 로그인 조합 시도

다음과 같은 일반적인 조합을 시도해 보세요:
- root / fa
- root / 1234
- ubuntu / ubuntu
- dietpi / dietpi
- root / (비밀번호 없음)

### 2.4 시리얼 콘솔 접속

문제가 지속된다면 시리얼 콘솔을 통해 접속을 시도할 수 있습니다. NanoPi Neo3의 시리얼 디버그 포트는 기본적으로 1500000bps 속도로 설정되어 있습니다.

## 3. 이미지 설치 방법

### 3.1 이미지 다운로드 및 플래싱

1. **이미지 다운로드**: FriendlyElec 공식 이미지나 Armbian 이미지를 다운로드합니다.
2. **플래싱**: balenaEtcher와 같은 도구를 사용하여 SD 카드에 이미지를 플래싱합니다.
3. **부팅**: SD 카드를 NanoPi Neo3에 삽입하고 전원을 연결합니다.

### 3.2 IP 주소 확인

```bash
# 라우터 관리 페이지에서 DHCP 클라이언트 목록 확인
# 또는 네트워크 스캔 도구 사용
nmap -sn 192.168.1.0/24
```

### 3.3 SSH 연결

```bash
# FriendlyElec 이미지의 경우
ssh root@[IP주소]
# 비밀번호: fa
```

## 4. SSH 연결 후 기본 설정

성공적으로 로그인한 후 다음 기본 설정을 수행하세요:

### 4.1 보안 설정

```bash
# 비밀번호 변경
passwd

# 시스템 업데이트
apt-get update && apt-get upgrade -y

# 타임존 설정 (한국 시간)
timedatectl set-timezone Asia/Seoul
```

### 4.2 기본 패키지 설치

```bash
# 유용한 도구들 설치
apt-get install -y htop nano curl wget git
```

## 5. NetworkManager를 이용한 고정 IP 설정

### 5.1 NetworkManager 개요

NetworkManager는 현대 리눅스 배포판에서 표준으로 채택된 네트워크 구성 관리 도구입니다. NanoPi Neo3의 우분투 이미지 대부분이 기본적으로 NetworkManager를 사용합니다.

```bash
# NetworkManager 사용 확인
cat /etc/netplan/01-network-manager-all.yaml
```

출력 예시:
```yaml
network:
  version: 2
  renderer: NetworkManager
```

### 5.2 nmcli를 이용한 CLI 설정

#### 현재 네트워크 상태 확인

```bash
nmcli device status
```

출력 예시:
```
DEVICE  TYPE      STATE      CONNECTION 
eth0    ethernet  connected  Wired connection 1
lo      loopback  unmanaged  --
```

#### 고정 IP 설정

```bash
sudo nmcli con mod "Wired connection 1" \
  ipv4.addresses 192.168.1.100/24 \
  ipv4.gateway 192.168.1.1 \
  ipv4.dns "8.8.8.8 1.1.1.1" \
  ipv4.method manual
```

#### 변경 사항 적용

```bash
sudo nmcli con down "Wired connection 1"
sudo nmcli con up "Wired connection 1"
```

#### 설정 검증

```bash
ip -4 addr show eth0
```

예상 출력:
```
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc mq state UP group default qlen 1000
    inet 192.168.1.100/24 brd 192.168.1.255 scope global eth0
       valid_lft forever preferred_lft forever
```

### 5.3 nmtui를 활용한 TUI 설정

텍스트 기반 사용자 인터페이스를 선호하는 경우:

```bash
sudo nmtui
```

설정 단계:
1. **Edit a connection** 선택
2. 대상 이더넷 연결 선택
3. IPv4 구성에서 Manual 설정
4. IP 주소/게이트웨이/DNS 입력
5. **OK**로 저장 후 종료

## 6. 고급 네트워크 설정

### 6.1 다중 IP 할당

```bash
sudo nmcli con mod "Wired connection 1" \
  +ipv4.addresses 192.168.1.101/24
```

### 6.2 VLAN 구성

```bash
sudo nmcli con add type vlan \
  dev eth0 id 10 \
  ip4 192.168.10.100/24 \
  gw4 192.168.10.1
```

### 6.3 성능 최적화

#### MTU 튜닝

```bash
sudo nmcli con mod "Wired connection 1" \
  802-3-ethernet.mtu 1500
```

#### TCP 버퍼 크기 조정

```bash
sudo sysctl -w net.core.rmem_max=16777216
sudo sysctl -w net.core.wmem_max=16777216

# 영구 적용을 위해 /etc/sysctl.conf에 추가
echo "net.core.rmem_max=16777216" >> /etc/sysctl.conf
echo "net.core.wmem_max=16777216" >> /etc/sysctl.conf
```

## 7. 문제 해결

### 7.1 일반적인 문제 해결

```bash
# NetworkManager 서비스 상태 확인
systemctl status NetworkManager

# 설정 새로고침
nmcli con reload

# NetworkManager 로그 확인
journalctl -u NetworkManager -f

# DNS 캐시 초기화
resolvectl flush-caches

# 라우팅 테이블 확인
ip route show
```

### 7.2 SSH 키 관련 문제

SSH 키 생성 시 `error in libcrypto` 오류가 발생하는 경우:

#### 공개 키 유효성 확인

```bash
ssh-keygen -l -f ~/.ssh/id_rsa.pub
```

#### 권한 설정 수정

```bash
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
chmod 600 ~/.ssh/id_rsa
chmod 644 ~/.ssh/id_rsa.pub
```

#### OpenSSL 및 SSH 버전 확인

```bash
openssl version
ssh -V
```

#### SSH 에이전트 재시작

```bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_rsa
```

## 8. 자동화 스크립트

### 8.1 초기 설정 자동화

```bash
#!/bin/bash
# nanopi_setup.sh

# 시스템 업데이트
apt-get update && apt-get upgrade -y

# 필수 패키지 설치
apt-get install -y htop nano curl wget git network-manager

# 타임존 설정
timedatectl set-timezone Asia/Seoul

# 고정 IP 설정
CONN_NAME="Wired connection 1"
IP_ADDR="192.168.1.100/24"
GW_ADDR="192.168.1.1"
DNS_SERVERS="8.8.8.8 1.1.1.1"

nmcli con mod "$CONN_NAME" \
  ipv4.method manual \
  ipv4.addresses "$IP_ADDR" \
  ipv4.gateway "$GW_ADDR" \
  ipv4.dns "$DNS_SERVERS"

nmcli con down "$CONN_NAME"
nmcli con up "$CONN_NAME"

echo "Setup completed! Fixed IP: 192.168.1.100"
```

### 8.2 실행 권한 부여 및 실행

```bash
chmod +x nanopi_setup.sh
sudo ./nanopi_setup.sh
```

## 9. 보안 강화

### 9.1 방화벽 설정

```bash
# UFW 설치 및 활성화
apt-get install -y ufw
ufw enable

# SSH 포트 허용
ufw allow ssh

# 필요한 포트만 개방
ufw allow 80/tcp
ufw allow 443/tcp

# 상태 확인
ufw status
```

### 9.2 SSH 보안 강화

```bash
# SSH 설정 파일 편집
nano /etc/ssh/sshd_config
```

권장 설정:
```
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
Port 22022  # 기본 포트 변경
```

```bash
# SSH 서비스 재시작
systemctl restart sshd
```

## 10. 모니터링 및 유지보수

### 10.1 시스템 상태 모니터링

```bash
# CPU 및 메모리 사용량
htop

# 디스크 사용량
df -h

# 네트워크 통계
nmcli dev show eth0

# 시스템 온도 (가능한 경우)
cat /sys/class/thermal/thermal_zone0/temp
```

### 10.2 로그 관리

```bash
# 시스템 로그 확인
journalctl -n 50

# 네트워크 관련 로그
journalctl -u NetworkManager -n 20

# 저장 공간 관리를 위한 로그 순환 설정
journalctl --vacuum-time=7d
```

## 결론

NanoPi Neo3는 작지만 강력한 ARM 기반 컴퓨터로, 적절한 설정을 통해 다양한 용도로 활용할 수 있습니다. 본 가이드를 통해 기본 설정부터 고급 네트워크 구성까지 체계적으로 설정할 수 있으며, 안정적인 운영을 위한 보안 및 모니터링 방법도 함께 제공했습니다.

정기적인 시스템 업데이트와 모니터링을 통해 NanoPi Neo3를 안정적으로 운영하시기 바랍니다.