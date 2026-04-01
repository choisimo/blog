---
title: "Ansible Role 설계와 재사용성"
date: "2025-02-12"
category: "DevOps"
tags: ["DevOps","Ansible","Role","구조"]
excerpt: "Role 디렉터리를 생활 속 사례로 풀어내며 재사용성과 협업 패턴을 정리한 실습 에세이."
author: "Admin"
published: true
---

## Role이라는 집을 처음 지어 보면서

Playbook을 몇 편 쓰다 보면 자연스럽게 “이제는 구조를 정리해야겠다”는 생각이 듭니다. 저도 한동안 tasks 디렉터리에 모든 걸 우겨 넣다가, 결국 주말을 통째로 Role 설계에 투자했어요. 처음에는 설명서를 보며 기계적으로 따라 했지만, 지금 돌이켜보면 역할(Role)은 단순한 폴더 묶음이 아니라 팀이 합의한 생활 방식 그 자체였습니다.

### 뼈대를 세울 때 기억한 여섯 칸

처음 Role을 만들면서 저는 항상 아래 구조부터 떠올립니다.

```text
roles/
  webserver/
    tasks/
      main.yml
    handlers/
      main.yml
    templates/
    files/
    defaults/
      main.yml
    vars/
      main.yml
    meta/
      main.yml
```

`tasks`는 오늘 할 일 목록, `handlers`는 변화가 생겼을 때 불러낼 비상 연락망, `templates`와 `files`는 우리가 미리 준비한 선물 보따리, `defaults`와 `vars`는 서로 약속한 기본값이었습니다. meta는 아직 낯설지만, 언젠가 다른 Role과 친구를 맺어야 할 때 꼭 필요하다는 사실을 금방 깨달았습니다.

### tasks/main.yml을 일기로 쓰듯 정리하다

저는 tasks의 첫 줄을 항상 role의 목적을 설명하는 문장으로 시작합니다. 아래 예시는 Nginx 기반 웹 서버 환경을 준비하는 데 필요한 작업을 순서대로 적어 둔 기록입니다.

```yaml
# roles/webserver/tasks/main.yml
---
- name: ensure prerequisite packages exist
  dnf:
    name: "{{ item }}"
    state: present
  loop:
    - python3-dnf
    - unzip

- name: configure nginx and php-fpm
  include_tasks: web.yml

- name: register systemd overrides
  include_tasks: systemd.yml
  when: webserver_enable_override
```

핵심 작업을 분리하고 싶을 때는 `include_tasks`를 써서 작은 파일로 쪼갰습니다. 덕분에 나중에 구조를 읽어 보는 팀원이 “아, 여기서 웹 설정이 시작되는구나” 하고 쉽게 맥락을 잡을 수 있죠.

### defaults와 vars의 미묘한 선 긋기

Role을 공유하다 보면 “기본값인데 변경 가능해야 하는 값”과 “거의 고정이라 손대면 위험한 값” 사이에 선을 그어야 합니다. 저는 가능한 값들을 `defaults/main.yml`에 담고, 절대 바뀌면 안 되는 값은 `vars/main.yml`로 올려 둡니다.

```yaml
# roles/webserver/defaults/main.yml
webserver_nginx_port: 80
webserver_enable_override: false
webserver_ssl_enabled: false

# roles/webserver/vars/main.yml
webserver_log_dir: /var/log/nginx
webserver_user: www-data
```

이렇게 나눠 두니 배포 환경마다 포트나 SSL 설정을 덮어써도 core 값은 안정적으로 유지됩니다. 팀 내부에서는 “defaults는 사용자 취향, vars는 팀이 지켜야 할 규칙”이라고 설명하곤 합니다.

### handlers는 잔잔한 알람으로 남겨두기

Role이 커질수록 핸들러가 난무하기 쉽죠. 저는 꼭 필요한 메시지만 남기고, 출력 문구도 사람 말투로 적어 두었습니다.

```yaml
# roles/webserver/handlers/main.yml
- name: restart nginx politely
  service:
    name: nginx
    state: restarted

- name: reload php-fpm gracefully
  service:
    name: php8.2-fpm
    state: reloaded
```

핸들러 이름에 “politely”, “gracefully” 같은 표현을 넣어 두면, 로그를 읽을 때도 기분이 조금 나아집니다. 무엇보다 “재시작이 꼭 필요한 순간인가?”를 task 단계에서 더 깊게 고민하게 되죠.

### meta/main.yml로 의존 관계를 솔직하게 드러내기

Role을 미리 준비해 두면 다른 팀이 그대로 가져다 쓰기도 합니다. 그럴 때 meta 파일에 의존성을 명확히 적어 두면 덜 헤매게 됩니다.

```yaml
# roles/webserver/meta/main.yml
---
dependencies:
  - role: common
    vars:
      common_state: hardened
  - role: security
    tags:
      - baseline
```

`dependencies`에 태그를 걸어 두면 상위 Playbook에서 `--tags baseline`처럼 선택적으로 실행할 수 있어서 훨씬 유연해집니다. “이 Role을 쓰려면 먼저 common을 읽어야 해요”라는 메시지가 자연스럽게 전달되죠.

### 태그 전략으로 협업의 언어를 맞추기

Role이 늘어나면 `--tags`와 `--skip-tags`가 사실상 협업의 약속이 됩니다. 저는 팀 회의 때 “운영팀은 `security`, 애플리케이션팀은 `deploy` 태그를 중심으로 본다”는 합의를 만들었고, Role 안에서도 태그 이름을 일관되게 쓰려 노력했습니다.

```yaml
- name: copy hardened nginx config
  template:
    src: nginx.conf.j2
    dest: /etc/nginx/nginx.conf
  notify: restart nginx politely
  tags:
    - config
    - security

- name: deploy default landing page
  template:
    src: index.html.j2
    dest: /var/www/html/index.html
  tags:
    - deploy
```

태그가 읽는 사람에게 이야기처럼 다가갈수록, 서로의 작업 범위도 명확해졌습니다.

### collections와 galaxy에 대한 작은 다짐

Role을 정리하다 보면 언젠가 galaxy에 공개하고 싶다는 마음이 슬쩍 들죠. 저는 아직 용기를 내지는 못했지만, `collections/requirements.yml`을 작성해 두고 다른 Role을 불러오는 연습을 조금씩 하고 있습니다. 이렇게 준비해 두면 언젠가 외부 배포를 할 때도 훨씬 수월할 거라 믿어요.

### 다음 단계로 이어지는 마음가짐

Role은 재사용을 위한 기술이지만, 결국 팀의 목소리를 정리하는 작업이었습니다. 오늘 기록한 구조와 패턴이 여러분의 플레이라이트를 조금 더 단단하게 만들어 주길 바랍니다. 다음에는 이 Role들을 이용해 여러 환경을 동시에 배포하는 전략과, 테스트 자동화를 곁들이는 방법을 공유해 보려 합니다. 혹시 지금 Role 디렉터리가 어지럽게 흩어져 있다면, 커피 한 잔 내리고 오늘 소개한 여섯 칸부터 천천히 다시 배치해 보세요. 생각보다 금방 공간이 정돈될 거예요.
