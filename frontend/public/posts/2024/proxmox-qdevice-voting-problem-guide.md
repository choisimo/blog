---
title: Proxmox QDevice 투표 문제에 대해서
excerpt: Proxmox 클러스터에서 QDevice가 투표권을 갖지 못하는 문제 트러블슈팅
date: '2025-08-10'
category: Proxmox
tags:
  - Proxmox
  - QDevice
  - 클러스터
  - 쿼럼
  - Raspberry Pi
  - 고가용성
readTime: 3분
---
Proxmox 클러스터에서 QDevice가 "votes 0"으로 표시되는 문제를 해결하려면 다음 단계를 따르십시오. 이 가이드는 단일 노드 클러스터(nodove, 192.168.1.30)와 Raspberry Pi(192.168.1.55)를 기반으로 합니다. 네트워크 연결이 정상이라고 가정합니다.

## QDevice 역할

QDevice는 2노드 클러스터에서 타이 브레이커로 작동합니다. 정상 상태에서 노드 2개 + QDevice 1개 = 총 3표. 한 노드가 다운되면 남은 노드 1표 + QDevice 1표 = 2표로 과반수를 유지합니다. votes가 0이면 장애 시 클러스터가 정지할 수 있습니다.

## 1. Raspberry Pi에서 서비스 확인

Raspberry Pi에서 실행:

```
sudo systemctl status corosync-qnetd
```

로그 확인:

```
sudo journalctl -u corosync-qnetd -f
```

포트 확인:

```
sudo netstat -tlnp | grep :5403
```

## 2. 기존 QDevice 제거

Proxmox 노드에서:

```
pvecm qdevice remove
```

Raspberry Pi에서 패키지 재설치:

```
sudo apt update
sudo apt reinstall corosync-qnetd
```

SSH 설정(/etc/ssh/sshd_config) 확인 및 수정:

- PermitRootLogin yes
- PasswordAuthentication yes (필요 시)

서비스 재시작:

```
sudo systemctl restart ssh
sudo systemctl restart corosync-qnetd
sudo systemctl enable corosync-qnetd
sudo systemctl status corosync-qnetd
```

## 3. Proxmox에서 QDevice 재설정

Proxmox 노드에서 패키지 설치:

```
apt update
apt install corosync-qdevice
systemctl enable corosync-qdevice
```

QDevice 추가:

```
pvecm qdevice setup 192.168.1.55 -f
```

## 4. 설정 파일 수정

Proxmox 노드에서 /etc/pve/corosync.conf 편집:

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
    votes: 1
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

주요 설정: votes: 1, tls: on, algorithm: ffsplit.

## 5. 서비스 재시작 및 확인

Proxmox 노드에서:

```
systemctl restart corosync
sleep 5
systemctl restart corosync-qdevice
sleep 5
systemctl restart pve-cluster
```

상태 확인:

```
pvecm status
pvecm qdevice status
corosync-quorumtool -s
```

정상 출력 예시:

- Nodes: 1
- Total votes: 2
- Qdevice (votes 1)

## 추가 문제 해결

### 네트워크 확인

Proxmox에서:

```
iptables -L | grep 5403
```

Raspberry Pi에서:

```
sudo ufw status
sudo iptables -L | grep 5403
sudo ufw allow 5403/tcp
sudo ufw allow 5403/udp
```

### 인증서 재생성

Proxmox에서:

```
pvecm qdevice remove
rm -rf /etc/corosync/qdevice/
pvecm qdevice setup 192.168.1.55 -f
```

### 로그 모니터링

Proxmox에서:

```
tail -f /var/log/corosync/corosync.log
```

Raspberry Pi에서:

```
sudo tail -f /var/log/syslog | grep qnetd
```

## 예방 조치

정기 점검 스크립트(qdevice_check.sh):

```
#!/bin/bash
STATUS=$(pvecm status | grep "Qdevice" | awk '{print $3}')
if [[ "$STATUS" == "1)" ]]; then
    echo "QDevice is working properly"
else
    echo "QDevice problem detected!" | mail -s "Proxmox QDevice Alert" admin@example.com
    logger "Proxmox QDevice has 0 votes - investigation needed"
fi
```

백업:

```
cp /etc/pve/corosync.conf /root/backup/corosync.conf.$(date +%Y%m%d)
cp -r /etc/corosync/qdevice/ /root/backup/qdevice.$(date +%Y%m%d)/
```

설정 후 장애 시뮬레이션을 통해 동작 확인 권장.
