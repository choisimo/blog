---
title: "Ansible Inventory 심화: 그룹/변수/패턴"
date: "2025-02-10"
category: "DevOps"
tags: ["DevOps","Ansible","Inventory","Pattern"]
excerpt: "Static/동적 인벤토리, 그룹 중첩, 변수 계층, 패턴 매칭, 환경 분리 전략까지 실전 정리"
author: "Admin"
published: true
---
## Inventory를 이야기로 엮어 보기

처음 인벤토리를 맡았을 때 저는 ‘호스트 목록 하나 만드는 일이 이렇게 까다롭다고?’라는 생각부터 들었습니다. 어떤 서버가 어떤 역할을 맡는지 눈앞에 정리돼 있지 않으면, 플레이북을 돌릴 때마다 불안한 마음이 고개를 들더라고요. 그래서 이 글에서는 제가 실제로 겪었던 시행착오와 함께 인벤토리를 서술형으로 풀어 보려고 합니다. 단순한 `hosts` 파일을 넘어, 그룹을 중첩하고 변수를 계층화하며, 패턴과 동적 인벤토리까지 다뤘던 경험을 차근차근 나눠 볼게요.

### INI 스타일로 첫 걸음을 옮기다

처음에는 익숙한 INI 포맷이 가장 편했습니다. `inventory/hosts.ini` 파일을 열어 다음과 같이 작성했죠. 웹 서버, 데이터베이스, 캐시를 그룹으로 묶고, 필요한 변수는 호스트 옆에 덧붙입니다. 마지막에는 `[all:vars]` 블록을 열어 모든 서버가 공유해야 할 SSH 사용자와 키 파일을 적어 두었습니다. 이렇게 한눈에 역할과 접근 정보를 정리하면 어느 서버를 향해 명령이 날아갈지 머릿속 그림이 또렷해집니다.

```ini
[web]
web1 ansible_host=10.0.1.11 env=prod
web2 ansible_host=10.0.1.12 env=prod
web3 ansible_host=10.0.2.21 env=stage

[db]
db1 ansible_host=10.0.5.10 env=prod

[cache]
redis1 ansible_host=10.0.6.11 env=prod

[all:vars]
ansible_user=ec2-user
ansible_ssh_private_key_file=~/.ssh/prod.pem
```

이 구성을 나란히 바라보면, 그룹 헤더가 자연스럽게 서버를 역할별로 묶고 있음을 느낄 수 있습니다. INI 형식은 단순하지만 빠르게 쓸 수 있고, 호스트 이름 옆에 필요한 속성을 즉시 붙여 넣을 수 있다는 점이 마음에 들었습니다.

### YAML로 옮겨 적으며 구조를 다듬다

조금 더 구조를 명확히 하고 싶을 때는 YAML 포맷이 도움이 됐습니다. 계층 구조와 공통 변수를 시각적으로 구분하기 쉬워 설명이 쉬워집니다. 아래 예시는 `inventory/hosts.yml`을 YAML로 옮겨 적은 버전입니다.

```yaml
all:
  vars:
    ansible_user: ec2-user
    ansible_ssh_private_key_file: ~/.ssh/prod.pem
  children:
    web:
      hosts:
        web1:
          ansible_host: 10.0.1.11
          env: prod
        web2:
          ansible_host: 10.0.1.12
          env: prod
        web3:
          ansible_host: 10.0.2.21
          env: stage
    db:
      hosts:
        db1:
          ansible_host: 10.0.5.10
          env: prod
    cache:
      hosts:
        redis1:
          ansible_host: 10.0.6.11
          env: prod
```

공통 변수는 `all.vars`에 모아 두고, 하위 그룹을 `children`으로 구조화하니 한눈에 흐름이 잡히더군요. YAML은 처음엔 다소 장황해 보이지만, 나중에 환경이 늘어났을 때도 확장성이 좋아서 애착이 생겼습니다.

### 그룹을 겹겹이 쌓아 메타 구조 만들기

인프라가 복잡해지자 저는 환경별로 서버를 구분해야 했습니다. prod와 stage를 나눠 관리하려면 상위 그룹을 더 만들어 줘야겠죠. 아래처럼 `prod`와 `stage`라는 메타 그룹을 구성한 뒤, 그 아래에 실제 역할 그룹을 children으로 배치했습니다. 이 구조를 사용하면 “프로덕션 웹 서버만”이라는 조건을 훨씬 자연스럽게 표현할 수 있습니다.

```yaml
all:
  children:
    prod:
      children:
        web_prod:
          hosts:
            web1:
              ansible_host: 10.0.1.11
            web2:
              ansible_host: 10.0.1.12
        db_prod:
          hosts:
            db1:
              ansible_host: 10.0.5.10
    stage:
      children:
        web_stage:
          hosts:
            web3:
              ansible_host: 10.0.2.21
```

이렇게 겹겹이 쌓아 두면, 특정 환경이나 역할만 골라서 플레이북을 돌릴 때 생각이 훨씬 단순해집니다. ‘이 호스트가 상속받는 변수는 무엇일까?’라는 질문에도 금세 답을 찾게 되죠.

### group_vars와 host_vars에 이야기를 저장하다

어느 순간부터 저는 변수들을 파일로 분리하지 않으면 혼란이 생긴다는 사실을 깨달았습니다. 그래서 `group_vars`와 `host_vars`를 디렉터리로 나누고, 각 그룹과 호스트가 사용하는 설정을 별도 YAML 파일에 옮겨 적었습니다.

```text
inventory/
  hosts.yml
  group_vars/
    all.yml
    prod.yml
    web.yml
  host_vars/
    web1.yml
```

`group_vars/prod.yml`에는 공통 사용자와 로깅 레벨을 담았고, `group_vars/web.yml`에는 웹 서버만의 타임아웃 값을, `host_vars/web1.yml`에는 특정 헤더 값을 지정했습니다.

```yaml
# group_vars/prod.yml
ansible_user: ec2-user
logging_level: INFO

# group_vars/web.yml
nginx_keepalive_timeout: 65

# host_vars/web1.yml
nginx_custom_header: "X-Web1"
```

변수 우선순위는 항상 머릿속에 떠올려야 했습니다. role defaults에서 시작해 inventory의 `group_vars(all)`을 거치고, 더 구체적인 group_vars, host_vars, play vars, 마지막으로 extra vars까지 올라가는 흐름이죠. 이 순서를 이해하고 나니, “왜 이 값이 덮어씌워졌지?”라는 의문이 생길 때 훨씬 빨리 진단할 수 있었습니다.

### 패턴 매칭으로 원하는 집합만 골라내기

플레이북을 실행하려다 보면, 특정 서버 그룹에만 작업을 적용하고 싶은 순간이 옵니다. 그럴 때 저는 `-l` 옵션과 패턴 연산자를 적극적으로 활용합니다. 아래 예시처럼 OR, AND, NOT을 조합하면 머릿속으로 생각한 집합을 그대로 표현할 수 있습니다.

```bash
ansible-playbook site.yml -l "web"        # web 그룹 전체
ansible-playbook site.yml -l "web:&prod"  # prod 환경의 web만 교집합
ansible-playbook site.yml -l "web:!web3"  # web에서 web3 제외
ansible-playbook site.yml -l "web_prod:db_prod" # prod 웹과 DB 합집합
```

콜론은 합집합, 앰퍼샌드는 교집합, 느낌표는 제외를 의미합니다. 이런 문법을 겁내지 않고 쓰다 보면, “필요한 범위만 정확히 집어냈다”는 안도감이 찾아옵니다.

### AWS 동적 인벤토리를 붙이며 자동화를 넓히다

클라우드 환경에서는 호스트가 수시로 늘고 줄기 때문에 정적인 파일만으로는 버틸 수가 없었습니다. 그래서 저는 boto3와 botocore를 설치한 뒤, AWS EC2 플러그인을 활용한 동적 인벤토리를 구성했습니다.

```bash
pip install boto3 botocore
```

`inventory/aws_ec2.yml` 파일은 다음과 같습니다. 태그 기반 필터를 걸어 prod 환경의 실행 중 인스턴스만 불러오고, 태그 값으로 그룹을 자동 생성하도록 구성했습니다.

```yaml
plugin: aws_ec2
regions:
  - ap-northeast-2
filters:
  tag:Environment: prod
  instance-state-name: running
keyed_groups:
  - key: tags.Role
    prefix: role
  - key: tags.Environment
    prefix: env
hostnames:
  - tag:Name
compose:
  ansible_host: public_ip_address or private_ip_address
```

구성이 끝나면 `ansible-inventory -i inventory/aws_ec2.yml --graph` 명령으로 구조를 먼저 확인합니다. 태그 관리만 깔끔하면, 새로운 인스턴스가 생성될 때 자동으로 인벤토리에 포함되는 모습을 볼 수 있습니다. 저는 태그 범위를 과도하게 넓히지 말고, 역할과 환경을 정확히 지정하는 것이 베스트 프랙티스라고 느꼈습니다.

### 환경을 분리하는 여러 가지 선택지

프로덕션과 스테이징을 어떻게 분리할지도 늘 고민거리였습니다. 세 가지 전략을 번갈아 적용했습니다. 첫 번째는 단일 레포 안에서 `inventory/prod`와 `inventory/stage` 디렉터리를 나누는 방식입니다. 두 번째는 동적 인벤토리를 쓰되 태그 조건으로 환경을 구분하는 방법입니다. 마지막으로는 규제가 강한 환경에서 쓰는 완전 별도 레포 전략입니다. 환경마다 접근 권한이 다를 때 유용합니다.

```text
inventory/
  prod/
    hosts.yml
    group_vars/
  stage/
    hosts.yml
    group_vars/
```

CI 파이프라인을 구성할 때는 `ENV` 변수를 전달해 적절한 디렉터리를 선택하고, `ansible-playbook -i inventory/${ENV}/hosts.yml site.yml` 명령으로 원하는 환경만 조준합니다. 이렇게 흐름을 정리해 두면, 누군가 실수로 잘못된 환경에 배포하는 상황을 미리 막을 수 있습니다.

### 변수 충돌과 성능 문제를 다루는 태도

복잡한 인벤토리를 다루다 보면 언젠가 변수 충돌을 마주하게 됩니다. 저는 `ansible-inventory --host web1 -i inventory/hosts.yml` 명령으로 최종 머지된 변수를 확인하고, 필요하면 `-vvv` 옵션으로 세부 로그를 열어 봅니다. 충돌이 발견되면 공통 변수를 더 작은 범위로 이동시키거나, 중복된 키를 정리하면서 구조를 다듬었습니다.

성능 이슈가 있을 때는 캐시 플러그인과 `cache_timeout` 값을 조정해 조회 시간을 줄였습니다. 필터가 너무 넓으면 인벤토리 로딩 시간이 길어지니, 조건을 정교하게 다듬는 습관도 함께 길렀습니다. 마지막으로 `forks` 값을 기본 5에서 상황에 따라 20 이상으로 높여 병렬 실행을 활용하니, 배포 시간이 훨씬 짧아졌습니다.

### 정리하며 다음 걸음을 떠올리다

지금까지 따라오느라 고생 많으셨습니다. 인벤토리는 처음엔 그저 호스트 목록처럼 보이지만, 구조를 한 번 정리해 놓으면 운영의 리듬이 달라집니다. 이 과정을 통해 “누가 어디서 어떤 역할을 하고 있는가”라는 질문에 빠르게 답할 수 있게 되었습니다. 이제 다음 단계로는 플레이북 구조나 역할(Role) 설계를 살펴보고 싶습니다. 오늘 정리한 내용이 인벤토리를 조금 더 친근한 문장으로 바꾸는 데 도움이 되길 바랍니다.
