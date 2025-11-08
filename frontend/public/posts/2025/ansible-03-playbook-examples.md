---
title: "Ansible Playbook 작성 실습 모음"
date: "2025-02-11"
category: "DevOps"
tags: ["DevOps","Ansible","Playbook","실습"]
excerpt: "첫 Playbook을 써 내려가며 겪은 시행착오와 재사용 패턴을 에세이처럼 풀어낸 실습 노트."
author: "Admin"
published: true
---

## 첫 Playbook을 일상으로 끌어들이기

처음 Playbook을 열어 봤을 때 저는 빈 YAML 파일 앞에서 깊은 한숨부터 쉬었습니다. “이 많은 설정을 정말 사람이 읽을 수 있는 문장으로 묶을 수 있을까?”라는 걱정이 먼저 올라왔죠. 그래도 마음을 다잡고 한 줄씩 적어 보니, 마치 일기 쓰듯 내 환경을 서술하는 기분이 들었습니다. 혹시 여러분도 비슷한 막막함을 느끼고 있다면, 제가 손으로 더듬어 찾은 길을 따라와 보세요.

### 가장 먼저 끄적여 본 작은 Playbook

저는 서버의 패키지를 최신 상태로 맞추고 Nginx를 설치하는 아주 단순한 목표부터 세웠습니다. 아래는 그날 저녁에 완성한 첫 Playbook입니다. `hosts`와 `become`을 자연스럽게 적어 넣고, task 이름을 문장처럼 적어 두니 읽을 때 마음이 훨씬 편해지더군요.

```yaml
---
- name: keep web nodes tidy
  hosts: webservers
  become: true

  tasks:
    - name: update package cache
      dnf:
        update_cache: true

    - name: install nginx from official repo
      dnf:
        name: nginx
        state: present

    - name: ensure nginx is running
      service:
        name: nginx
        state: started
        enabled: true
```

Playbook을 저장하고 나니 “혹시 포트 충돌은 없을까? 서비스는 제대로 떴을까?” 하는 의문이 들었습니다. 그래서 저는 `ansible-playbook site.yml --check`로 먼저 건조 실행을 돌려 보고, 문제가 없다는 확신이 들 때 실제 실행을 진행했습니다. 예상대로 모든 task가 초록색으로 물들어 가는 모습을 보니 “정말 간단하죠?”라는 말이 절로 나왔습니다.

### 핸들러와 notify가 준 두 번째 도약

반복 실행을 하다 보면 “변경이 있을 때만 서비스 재시작을 하고 싶다”는 욕심이 생깁니다. 저는 핸들러를 활용해 이 문제를 풀었습니다. 아래처럼 템플릿을 적용한 뒤 서비스 재시작을 요청하고, 핸들러가 마지막에 한 번만 실행되도록 설계했습니다.

```yaml
- name: deploy nginx template
  hosts: webservers
  become: true

  tasks:
    - name: copy nginx config from template
      template:
        src: templates/nginx.conf.j2
        dest: /etc/nginx/nginx.conf
      notify: reload nginx gracefully

  handlers:
    - name: reload nginx gracefully
      service:
        name: nginx
        state: reloaded
```

핸들러를 쓰고 나니 “그동안 왜 매번 service task를 반복했을까?” 싶을 정도로 코드가 단정해졌습니다. 변경 사항이 없을 때는 조용히 넘어가고, 진짜 업데이트가 있을 때만 서비스가 살짝 재시작되는 모습이 꽤 든든했습니다.

### 조건과 루프는 이야기를 더 현명하게 만든다

서버 종류마다 조금씩 다른 패키지를 설치해야 할 때 저는 조건문과 루프를 적절히 섞었습니다. 짧은 예시지만, 환경에 따라 설치 패키지가 갈리는 상황을 자연스럽게 표현할 수 있습니다.

```yaml
- name: install runtime packages
  hosts: all
  become: true

  vars:
    common_packages:
      - git
      - curl
    web_only_packages:
      - nodejs

  tasks:
    - name: install common packages everywhere
      dnf:
        name: "{{ item }}"
        state: present
      loop: "{{ common_packages }}"

    - name: install web specific packages
      dnf:
        name: "{{ item }}"
        state: present
      loop: "{{ web_only_packages }}"
      when: "'webservers' in group_names"
```

조건문이 단순한 문자열 비교라도, 저는 꼭 주석이나 설명을 덧붙였습니다. 그래야 다음에 Playbook을 열어볼 제 자신이 “아, web 그룹에만 nodejs가 필요한 이유가 있었지”라고 자연스럽게 추억을 떠올릴 수 있거든요.

### 템플릿으로 문장의 숨결을 불어넣다

Playbook을 쓰다 보면 결국 Jinja2 템플릿을 만나게 됩니다. 저는 기본 설정 파일에 환경별 값을 녹여 넣고 싶어서 아래처럼 변수를 주입했습니다. 템플릿 안에서도 구어체로 주석을 남겨 두면, 나중에 파일을 열어보는 사람이 미소를 짓게 됩니다.

```jinja
# templates/nginx.conf.j2
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log;
pid /run/nginx.pid;

events {
  worker_connections 1024;
}

http {
  server {
    listen {{ nginx_port | default(80) }} default_server;
    server_name {{ inventory_hostname }};

    location /healthz {
      return 200 'ok';
    }
  }
}
```

템플릿을 배포할 때는 반드시 `ansible-playbook --diff` 옵션을 켜 두었습니다. 변경 사항이 화면에 펼쳐지면 “이 정도 수정은 괜찮겠네”라는 확신을 갖고 버튼을 눌러 볼 수 있으니까요.

### 플레이 결과를 믿을 수 있게 만드는 체크 단계

마지막으로 저는 각 Playbook이 자신의 일을 제대로 끝냈는지 검증하는 task를 붙여 놓았습니다. 예를 들어 Nginx처럼 눈으로 바로 확인하기 어려운 서비스는 HTTP 요청을 보내 보거나, 상태 파일을 확인하는 명령을 추가했죠. 잘 작동하면 `debug` 모듈로 조용히 메시지만 출력하고, 실패하면 자연스럽게 알람이 울리게 했습니다. 덕분에 배포 후에 브라우저를 열어 URL을 직접 확인하는 번거로운 루틴에서 조금씩 벗어날 수 있었습니다.

### 마무리하며 다음 글을 예고하며

Playbook은 결국 “내가 어떤 상태를 원하고 있는가”를 일상의 언어로 적어 내려가는 작업이었습니다. 처음에는 기계적인 키워드의 나열처럼 보였지만, 반복해서 써 내려가다 보니 제 업무의 맥락과 우선순위가 자연스럽게 담기더군요. 다음 글에서는 이 Playbook들을 더 단단하게 만들어 준 Role 설계 이야기와 태그 전략을 나눌 예정입니다. 혹시 오늘도 빈 YAML 파일 앞에서 망설이고 있다면, 작게라도 하나의 task를 적어 보세요. 그 한 줄이 분명 다음 걸음을 이끌어 줄 겁니다.
