---
title: "Ansible 설치와 첫 Inventory 구성"
date: "2025-01-13"
category: "DevOps"
tags: ["DevOps","Ansible","자동화","Inventory","초급"]
excerpt: "패키지 설치부터 SSH 키, Inventory 작성, Ad-hoc 명령(ping, shell) 실행까지 Ansible 입문 필수 흐름."
author: "Admin"
published: true
---
# Ansible 설치와 첫 Inventory 구성

서버 자동화를 처음 시도했을 때 제일 먼저 부딪힌 건 “이 많은 서버를 언제 다 만지지?”라는 막막함이었습니다. 매번 SSH로 접속해서 같은 명령을 반복하다 보면 손보다 마음이 먼저 지치더라고요. 혹시 비슷한 경험을 해보신 적 있나요? 이 글은 한 발씩 정리해 둔 개인 실습 노트입니다. 건조한 매뉴얼 대신, 직접 부딪히며 느낀 흐름을 따라가 보시죠.

## 설치를 익히는 나만의 리듬

Ansible과 먼저 말을 섞기 위해 로컬 환경을 맞추는 것부터 시작했습니다. Fedora에서 작업할 때는 아래 순서로 진행합니다. 패키지를 최신 상태로 올리고, 설치를 마치면 `ansible --version`을 꼭 확인합니다.

```bash
sudo dnf -y update
sudo dnf -y install ansible
ansible --version
```

macOS에서 실습한다면 홈브루 한 줄이면 끝입니다.

```bash
brew install ansible
```

그리고 Python 가상환경을 마련해 둔 뒤 `pip install ansible`로 동일한 버전을 유지하는 방법도 자주 씁니다.

```bash
pip install ansible
pip install --upgrade ansible
```

## 작업장을 정돈하며 마음 다잡기

설치가 끝나면 폴더 정리부터 시작합니다. 머릿속이 복잡할수록 작업 폴더는 더 깔끔해야 한다는 것이 개인 철칙입니다.

```bash
mkdir -p ~/ansible-lab/{inventory,playbooks,roles}
cd ~/ansible-lab
```

`ansible-lab/` 구조를 화면에 띄워 놓고 오늘 어떤 목표를 먼저 채울지 점검합니다.

## cfg 파일에 나만의 규칙 새겨 두기

`ansible.cfg`를 열고 인벤토리 위치, SSH 키 경로, 출력 포맷을 한 번에 정해 두면 실수할 여지를 줄일 수 있습니다.

```ini
[defaults]
inventory = ./inventory/hosts
host_key_checking = False
remote_user = fedora
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

출력 포맷을 `yaml`로 바꾸고 로그 경로를 지정해 두면, 나중에 트러블슈팅할 때 사건의 조각들을 편하게 모을 수 있습니다.

## SSH 키를 준비하는 순간

신뢰를 쌓는 일은 SSH 키에서 시작합니다. 전용 키를 만들어 두고 각 서버에 배포하면 이제 비밀번호를 입력하느라 손목을 혹사시키지 않아도 됩니다.

```bash
ssh-keygen -t rsa -b 4096 -f ~/.ssh/ansible_key -N ""
ssh-copy-id -i ~/.ssh/ansible_key.pub user@node1.example.com
```

## 인벤토리를 채우며 그림 그리기

이제 `inventory/hosts` 파일을 펼쳐 놓고, 관리할 서버들의 이름을 한 줄씩 적어 봅니다.

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
ansible_user=fedora
http_port=80
app_env=production

[databases:vars]
ansible_user=admin
db_port=5432
```

`ansible_host`는 실제 접속 IP, `ansible_port`는 SSH 포트, `ansible_user`는 기본 로그인 계정, `ansible_ssh_private_key_file`은 키 파일 경로를 의미합니다.

## 첫 번째 핑

모든 준비를 마쳤다면 `ping` 모듈로 모든 호스트와 대화를 시도해 보세요.

```bash
ansible all -m ping
ansible webservers -m ping
```

이어서 `shell` 모듈로 시스템 상태를 훑습니다.

```bash
ansible all -m shell -a "uptime"
ansible all -m shell -a "df -h"
ansible all -m shell -a "free -m"
```

성공한 출력:

```yaml
node1.example.com | SUCCESS => {
  "changed": false,
  "ping": "pong"
}
```

## 패키지와 서비스를 한 번에 돌보는 법

Nginx를 설치하고 서비스를 올려 봅니다.

```bash
ansible all -m dnf -a "name=nginx state=present" --become
ansible all -m service -a "name=nginx state=started" --become
```

## 서버의 정보를 더 깊게 보고 싶을 때

`setup` 모듈을 사용해 운영체제 버전이나 CPU 코어, 기본 IP 같은 정보를 확인합니다.

```bash
ansible all -m setup
ansible all -m setup -a "filter=ansible_distribution*"
ansible all -m setup -a "filter=ansible_default_ipv4"
```

유용한 키: `ansible_hostname`, `ansible_distribution`, `ansible_processor_cores`, `ansible_memtotal_mb`.

## 스스로에게 던지는 작은 미션들

연습용 미션 아이디어:
- webservers 그룹에 Nginx 설치 후 상태 확인
- 모든 서버의 디스크/메모리 정보를 `/tmp/facts`에 저장
- `all:!databases` 패턴으로 특정 그룹 제외하고 ping 실행

## 막히는 순간마다 정리한 해결법

- SSH 실패: 키 경로/권한 확인 (`ansible.cfg` 점검)
- sudo 거부: `--become` 옵션 추가 또는 서버 사용자 권한 조정
- MODULE FAILURE: Python 미설치 → raw 모듈로 `dnf -y install python3`

## 다음 이야기로 넘어가기 전에

여기까지 따라오셨다면 이제 Ansible과 서로의 이름을 제대로 불러 준 셈입니다. 다음 편에서는 인벤토리를 세분화하고 플레이북을 짜는 이야기를 다룹니다.

## 더 깊이 파고들고 싶다면

- 공식 문서: https://docs.ansible.com/
- 모듈 목록: https://docs.ansible.com/ansible/latest/collections/index_module.html
