---
title: "Proxmox QDevice 투표 문제 완벽 해결 가이드"
date: "2024-08-18"
category: "Proxmox"
tags: ['Proxmox', 'QDevice', '클러스터', '쿼럼', 'Raspberry Pi', '고가용성']
excerpt: "Proxmox 클러스터에서 QDevice가 투표권을 갖지 못하는 문제를 단계별로 해결하는 완전한 가이드입니다."
readTime: "4분"
---

## 문제 상황 분석

Proxmox 클러스터에서 QDevice를 구성했지만 `pvecm status` 출력에서 "Qdevice (votes 0)"로 표시되어 제대로 작동하지 않는 상황입니다. 이는 고가용성 클러스터 운영에 심각한 문제가 될 수 있습니다.

### 현재 환경 확인

현재 상황을 정리하면:
- Proxmox 노드(192.168.1.30)에 "nodove"라는 단일 노드 클러스터 존재
- QDevice는 구성되었지만 투표권이 없음(0 votes)
- Raspberry Pi(192.168.1.55)와 Proxmox 노드 간 네트워크 연결은 정상

## QDevice의 역할과 중요성

### QDevice란?

QDevice는 Proxmox 클러스터에서 **타이 브레이커(tie-breaker)** 역할을 수행하는 중요한 구성 요소입니다. 특히 2노드 클러스터에서 한 노드가 오프라인 상태가 되어도 클러스터가 계속 작동할 수 있게 해주는 핵심 기능을 담당합니다.

### 투표 메커니즘

- **정상 상태**: 2개 노드 + 1개 QDevice = 총 3표
- **장애 상황**: 1개 노드 오프라인 시, 남은 노드(1표) + QDevice(1표) = 2표로 과반수 확보
- **문제 상황**: QDevice 투표권 없음 시, 노드 1개 장애 시 클러스터 정지

## 단계별 해결 방법

### 1단계: Raspberry Pi에서 QDevice 서비스 확인

먼저 Raspberry Pi에서 QDevice 서비스 상태를 확인합니다:

```bash
# Raspberry Pi에서 실행
sudo systemctl status corosync-qnetd
```

서비스가 실행 중이어도 투표 문제가 발생할 수 있으므로 추가 점검이 필요합니다.

#### 로그 확인

```bash
# QDevice 서비스 로그 확인
sudo journalctl -u corosync-qnetd -f

# 네트워크 연결 확인
sudo netstat -tlnp | grep :5403
```

### 2단계: 기존 QDevice 제거 및 재설정

#### Proxmox 노드에서 QDevice 제거

```bash
# Proxmox 노드에서 실행
pvecm qdevice remove
```

#### Raspberry Pi에서 재설정

```bash
# 필요한 패키지 재설치
sudo apt update
sudo apt reinstall corosync-qnetd

# SSH 설정 확인 및 수정
sudo nano /etc/ssh/sshd_config
```

SSH 설정 파일에서 다음 사항 확인:
```
PermitRootLogin yes
PasswordAuthentication yes  # 필요한 경우
```

```bash
# SSH 서비스 재시작
sudo systemctl restart ssh

# QDevice 서비스 재시작
sudo systemctl restart corosync-qnetd
sudo systemctl enable corosync-qnetd

# 서비스 상태 재확인
sudo systemctl status corosync-qnetd
```

### 3단계: Proxmox에서 QDevice 재구성

#### 필수 패키지 확인 및 설치

```bash
# Proxmox 노드에서 실행
apt update
apt install corosync-qdevice

# 서비스 활성화
systemctl enable corosync-qdevice
```

#### QDevice 강제 설정

```bash
# 강제 설정으로 QDevice 추가
pvecm qdevice setup 192.168.1.55 -f
```

### 4단계: 설정 파일 직접 수정

투표 문제가 지속되는 경우, Corosync 설정 파일을 직접 수정합니다.

#### corosync.conf 파일 편집

```bash
# Proxmox 노드에서 실행
nano /etc/pve/corosync.conf
```

설정 파일을 다음과 같이 수정합니다:

```
logging {
  debug: off
  to_syslog: yes
}

nodelist {
  node {
    name: nodove
    nodeid: 1
    quorum_votes: 1
    ring0_addr: 192.168.1.30
  }
}

quorum {
  provider: corosync_votequorum
  device {
    model: net
    net {
      algorithm: ffsplit
      host: 192.168.1.55
      tls: on
    }
    votes: 1  # 이 값이 중요합니다!
  }
}

totem {
  cluster_name: nodove
  config_version: 3
  interface {
    linknumber: 0
    ringnumber: 0
  }
  ip_version: ipv4
  secauth: on
  version: 2
}
```

#### 중요한 설정 포인트

1. **votes: 1** - QDevice가 1표의 투표권을 갖도록 명시적 설정
2. **tls: on** - 보안 연결 활성화
3. **algorithm: ffsplit** - 분할 뇌(split-brain) 방지 알고리즘

### 5단계: 서비스 재시작 및 확인

#### 관련 서비스 순차적 재시작

```bash
# Proxmox 노드에서 순서대로 실행
systemctl restart corosync
sleep 5
systemctl restart corosync-qdevice
sleep 5
systemctl restart pve-cluster
```

#### 상태 확인

```bash
# 클러스터 상태 확인
pvecm status

# QDevice 상세 상태 확인
pvecm qdevice status

# Corosync 쿼럼 상태 확인
corosync-quorumtool -s
```

정상적으로 설정되었다면 다음과 같은 출력을 볼 수 있습니다:

```
Cluster information
-------------------
Name:             nodove
Config Version:   3
Transport:        knet
Secure auth:      on

Quorum information
------------------
Date:             Wed Mar 01 10:30:45 2024
Quorum provider:  corosync_votequorum
Nodes:            1
Node ID:          0x00000001
Ring ID:          1.2
Quorate:          Yes

Votequorum information
----------------------
Expected votes:   2
Highest expected: 2
Total votes:      2
Quorum:           2  
Flags:            Quorate Qdevice 

Membership information
----------------------
    Nodeid      Votes Name
0x00000001          1 nodove (local)
0x00000000          1 Qdevice (votes 1)  # 이제 1표로 표시됨
```

## 고급 문제 해결

### 네트워크 문제 진단

#### 방화벽 설정 확인

```bash
# Proxmox 노드에서
iptables -L | grep 5403

# Raspberry Pi에서
sudo ufw status
sudo iptables -L | grep 5403
```

필요한 경우 포트 5403 허용:

```bash
# Raspberry Pi에서
sudo ufw allow 5403/tcp
sudo ufw allow 5403/udp
```

#### SSL/TLS 인증서 문제

QDevice 통신에 문제가 있는 경우 인증서를 재생성:

```bash
# Proxmox 노드에서
pvecm qdevice remove
rm -rf /etc/corosync/qdevice/
pvecm qdevice setup 192.168.1.55 -f
```

### 로그 모니터링

실시간으로 문제를 진단하려면:

```bash
# Proxmox 노드에서
tail -f /var/log/corosync/corosync.log

# Raspberry Pi에서
sudo tail -f /var/log/syslog | grep qnetd
```

## 예방 및 모니터링

### 정기 상태 점검

다음 스크립트를 cron으로 등록하여 정기적으로 QDevice 상태를 점검할 수 있습니다:

```bash
#!/bin/bash
# qdevice_check.sh

STATUS=$(pvecm status | grep "Qdevice" | awk '{print $3}')
if [[ "$STATUS" == "1)" ]]; then
    echo "QDevice is working properly"
else
    echo "QDevice problem detected!" | mail -s "Proxmox QDevice Alert" admin@example.com
    logger "Proxmox QDevice has 0 votes - investigation needed"
fi
```

### 백업 전략

QDevice 설정 백업:

```bash
# 설정 파일 백업
cp /etc/pve/corosync.conf /root/backup/corosync.conf.$(date +%Y%m%d)
cp -r /etc/corosync/qdevice/ /root/backup/qdevice.$(date +%Y%m%d)/
```

## 결론

Proxmox QDevice의 투표 문제는 주로 설정 파일의 불일치나 서비스 간 통신 문제로 발생합니다. 이 가이드의 단계별 접근 방법을 따르면:

1. **서비스 상태 점검**을 통한 기본 문제 확인
2. **완전한 재설정**을 통한 깔끔한 구성
3. **설정 파일 직접 수정**을 통한 정확한 투표권 부여
4. **체계적인 재시작**을 통한 변경 사항 적용

이러한 과정을 통해 QDevice가 정상적으로 1표의 투표권을 갖고 클러스터의 고가용성을 보장할 수 있습니다.

**중요**: QDevice는 클러스터의 안정성에 핵심적인 역할을 하므로, 설정 후 반드시 장애 상황을 시뮬레이션하여 정상 동작을 확인하는 것이 권장됩니다.