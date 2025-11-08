---
title: "Ansible 설치와 첫 Inventory 구성"
date: "2025-01-13"
category: "DevOps"
tags: ["DevOps","Ansible","자동화","Inventory","초급"]
excerpt: "패키지 설치부터 SSH 키, Inventory 작성, Ad-hoc 명령(ping, shell) 실행까지 Ansible 입문 필수 흐름."
author: "Admin"
published: true
---

# Ansible 설치 및 초기 설정

##  개요
Ansible은 에이전트가 필요 없는 자동화 도구로 SSH를 통해 원격 서버를 관리합니다. YAML 기반 선언적 구성이며 학습 곡선이 완만합니다.

##  학습 목표
- 설치 및 환경 구성
- SSH 키 기반 인증
- Inventory 작성
- Ad-hoc 명령 실행

##  설치
### Ubuntu/Debian
```bash
sudo apt update
sudo apt install -y ansible
ansible --version
```
### CentOS/RHEL
```bash
sudo yum install -y epel-release
sudo yum install -y ansible
```
### macOS
```bash
brew install ansible
```
### pip (모든 OS)
```bash
pip install ansible
pip install --upgrade ansible
```

##  디렉토리 기본 구조
```bash
mkdir -p ~/ansible-lab/{inventory,playbooks,roles}
cd ~/ansible-lab
```
```
ansible-lab/
├── ansible.cfg
├── inventory/
│   ├── hosts
│   └── group_vars/
├── playbooks/
├── roles/
└── files/
```

##  ansible.cfg 예시
```ini
[defaults]
inventory = ./inventory/hosts
host_key_checking = False
remote_user = ubuntu
private_key_file = ~/.ssh/id_rsa
stdout_callback = yaml
forks = 10
gathering = smart
log_path = ./ansible.log

[privilege_escalation]
become = True
become_method = sudo
become_user = root
```

##  SSH 키 설정
```bash
ssh-keygen -t rsa -b 4096 -f ~/.ssh/ansible_key -N ""
# 각 서버에 공개키 배포
ssh-copy-id -i ~/.ssh/ansible_key.pub user@node1.example.com
```

##  첫 Inventory 파일 (`inventory/hosts`)
```ini
node1.example.com

[webservers]
web1.example.com
web2.example.com ansible_host=192.168.1.11

[databases]
db1.example.com ansible_host=192.168.1.21 ansible_port=2222

[production:children]
webservers
databases

[webservers:vars]
ansible_user=ubuntu
http_port=80
app_env=production

[databases:vars]
ansible_user=admin
db_port=5432
```

### 핵심 Inventory 변수 요약
| 변수 | 설명 | 예시 |
|------|------|------|
| ansible_host | 실제 IP | 192.168.1.10 |
| ansible_port | SSH 포트 | 22 |
| ansible_user | SSH 사용자 | ubuntu |
| ansible_ssh_private_key_file | 키 경로 | ~/.ssh/id_rsa |

##  첫 Ad-hoc 명령
```bash
# 연결 테스트
ansible all -m ping
ansible webservers -m ping

# 시스템 정보
ansible all -m shell -a "uptime"
ansible all -m shell -a "df -h"
ansible all -m shell -a "free -m"
```

성공 출력 예:
```yaml
node1.example.com | SUCCESS => {
  "changed": false,
  "ping": "pong"
}
```

##  패키지 & 서비스 관리 예시
```bash
ansible all -m apt -a "name=nginx state=present" --become
ansible all -m service -a "name=nginx state=started" --become
```

##  Facts 수집
```bash
ansible all -m setup
ansible all -m setup -a "filter=ansible_distribution*"
ansible all -m setup -a "filter=ansible_default_ipv4"
```
유용한 Facts:
```
ansible_hostname
ansible_distribution
ansible_processor_cores
ansible_memtotal_mb
```

##  실습 과제
1. webservers 그룹 대상 Nginx 설치 후 상태 확인
2. 모든 서버 디스크/메모리 정보를 `/tmp/facts` 디렉토리에 저장
3. 특정 그룹 제외(`all:!databases`) ping 테스트 수행

##  트러블슈팅
| 문제 | 원인 | 해결 |
|------|------|------|
| Failed to connect via ssh | 키 경로 오류 | ansible.cfg 키 경로 재확인 |
| Permission denied | sudo 권한 부족 | `--become` 추가 또는 사용자 그룹 조정 |
| MODULE FAILURE | Python 미설치 | raw 모듈로 python3 설치 |

##  다음 단계
- Inventory 작성 방법 (예정)
- Playbook 작성 실습 (예정)

##  참고 자료
- 공식 문서: https://docs.ansible.com/
- 모듈 목록: https://docs.ansible.com/ansible/latest/collections/index_module.html
