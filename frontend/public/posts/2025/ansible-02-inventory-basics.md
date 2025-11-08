---
title: "Ansible Inventory 심화: 그룹/변수/패턴"
date: "2025-02-10"
category: "DevOps"
tags: ["DevOps","Ansible","Inventory","Pattern"]
excerpt: "Static/동적 인벤토리, 그룹 중첩, 변수 계층, 패턴 매칭, 환경 분리 전략까지 실전 정리"
author: "Admin"
published: true
---

Ansible 인벤토리는 어떤 호스트에 어떤 설정과 플레이를 적용할지를 선언하는 중심 축입니다. 이 글은 단순한 `hosts` 파일을 넘어서 그룹 중첩, 변수 계층, 패턴, 동적 인벤토리, 환경 분리 전략을 실무 예제로 정리합니다.

## 1. 기본 INI 스타일 예시
`inventory/hosts.ini`
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

특징
- 그룹 헤더 `[web]` 등으로 호스트 묶기
- 호스트 변수 인라인 선언 (`web1 ansible_host=...`)
- `[all:vars]` 전체 공통 변수 정의

## 2. YAML Inventory 권장 포맷
가독성과 구조화에 유리합니다.
`inventory/hosts.yml`
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

## 3. 그룹 중첩과 메타 그룹
상위 그룹을 구성해 역할/환경에 따라 다층 구조를 만듭니다.
`inventory/hosts.yml` 추가:
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

## 4. group_vars와 host_vars 계층
디렉터리 구조:
```
inventory/
  hosts.yml
  group_vars/
    all.yml
    prod.yml
    web.yml
  host_vars/
    web1.yml
```
`group_vars/prod.yml`
```yaml
ansible_user: ec2-user
logging_level: INFO
```
`group_vars/web.yml`
```yaml
nginx_keepalive_timeout: 65
```
`host_vars/web1.yml`
```yaml
nginx_custom_header: "X-Web1"
```
우선순위 (낮음→높음): role defaults < inventory group_vars(all) < group_vars(spec) < host_vars < play vars < extra vars.

## 5. 패턴 매칭 사용법
Play 실행 시 특정 집합을 선택:
```bash
ansible-playbook site.yml -l "web"        # web 그룹 전체
ansible-playbook site.yml -l "web:&prod"  # web AND prod 교집합
ansible-playbook site.yml -l "web:!web3"  # web에서 web3 제외
ansible-playbook site.yml -l "web_prod:db_prod" # 합집합
```
기호 요약
- `:` 합집합 (OR)
- `&` 교집합 (AND)
- `!` 제외 (NOT)

## 6. 동적 인벤토리 (AWS 예)
`requirements.txt` (ansible-core 외에 boto 라이브러리 필요)
```bash
pip install boto3 botocore
```
`inventory/aws_ec2.yml`
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
실행 테스트
```bash
ansible-inventory -i inventory/aws_ec2.yml --graph
```
베스트 프랙티스
- 태그 기반 필터로 최소 범위 유지
- `keyed_groups`로 태그→그룹 자동 매핑
- 다중 클라우드면 파일 분리(`aws_ec2.yml`, `gcp_compute.yml`) 후 상위 디렉터리에서 병합

## 7. 환경 분리 전략
선택지
1. 단일 레포 + 디렉터리 분리: `inventory/prod`, `inventory/stage` (소규모 권장)
2. 단일 동적 인벤토리 + 태그로 필터 (클라우드 태그 일관 시)
3. 완전 별도 레포 (규제/보안 구분 강함)

예시 레이아웃
```
inventory/
  prod/
    hosts.yml
    group_vars/
  stage/
    hosts.yml
```
CI 전략
- `ENV` 파이프라인 변수로 해당 디렉터리 선택
- `ansible-playbook -i inventory/${ENV}/hosts.yml site.yml`

## 8. 변수 충돌과 디버깅
- `ansible-inventory --host web1 -i inventory/hosts.yml` 로 최종 변수 확인
- `-vvv` 로깅 레벨 ↑ 상세 출력
- 중복 키 발견 시 group_vars를 재구성(범용 → 세분화)

## 9. 성능 고려
- 동적 인벤토리 캐시: `cache_plugin = jsonfile`, `cache_timeout` 설정 (`ansible.cfg`)
- 너무 넓은 필터 사용 금지 (리스트 지연 증가)
- 병렬 실행: `forks` 값 조정 (`ansible.cfg`) 기본 5 → 20~50 범위 튜닝

## 10. 체크리스트
- [ ] group_vars/host_vars 구조가 명확한가?
- [ ] 패턴(`:&:!`) 사용을 플레이북 문서에 예시로 남겼는가?
- [ ] 동적 인벤토리 태그 필터가 최소 권한/최소 범위인가?
- [ ] 환경 분리 표준(디렉터리/태그/레포)이 합의되었는가?
- [ ] 캐싱과 forks 튜닝으로 성능 확보했는가?

## 마무리
선명한 인벤토리 계층과 패턴 사용은 플레이북 복잡도를 줄이고 예측 가능성을 높입니다. 동적 인벤토리와 태그 전략을 조합해 변경을 수용하면서도 통제를 강화하세요.
