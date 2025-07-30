---
title: "ChangeDetection.io 완벽 활용 가이드"
date: "2024-01-20"
category: "DevOps"
tags: ['웹 모니터링', '자동화', 'Discord', 'Webhook', 'ChangeDetection']
excerpt: "웹페이지 변경 감지 서비스 ChangeDetection.io의 Duration Time 설정과 Discord 웹훅 연동을 통한 효율적인 모니터링 방법을 소개합니다."
readTime: "3분"
---

## ChangeDetection.io란?

ChangeDetection.io는 웹페이지의 변화를 감지하고 알림을 제공하는 강력한 서비스입니다. 이 서비스를 효과적으로 활용하기 위한 핵심 기능들을 자세히 알아보겠습니다.

## Duration Time의 목적과 작동 원리

### Duration Time의 목적

Duration Time은 changedetection.io의 스케줄러 기능에서 중요한 역할을 합니다. 이 설정은 각 요일별로 웹페이지 변경 감지가 얼마나 오랫동안 실행될지를 결정합니다.

#### 특정 시간대 동안만 감지 실행

Duration Time은 사용자가 지정한 시간 범위 내에서만 웹페이지 변경 감지를 실행할 수 있도록 합니다. 예를 들어, 업무 시간인 오전 9시부터 오후 5시까지만 웹페이지 변경을 확인하고 싶을 때 유용합니다.

#### 비용 절감 효과

많은 사용자들이 프록시 제공업체의 비용을 절감하기 위해 이 기능을 활용합니다. 필요한 시간대에만 웹페이지 변경 감지를 실행함으로써 불필요한 네트워크 요청을 줄이고 리소스 사용을 최적화할 수 있습니다.

### Duration Time의 작동 메커니즘

#### 스케줄러와의 통합

Duration Time은 changedetection.io의 스케줄러 기능의 일부로 작동합니다. 사용자 인터페이스에서는 각 요일마다 "Start At"(시작 시간)과 함께 "Run duration"(실행 지속 시간)을 설정할 수 있습니다.

#### 시간 계산 방식

"Start At" 시간부터 "Run duration"에 설정된 시간 동안 웹페이지 변경 감지가 활성화됩니다. 예를 들어:
- 시작 시간이 09:00
- 실행 지속 시간이 8시간

이 경우 웹페이지 변경 감지는 09:00부터 17:00(09:00 + 8시간)까지 활성화됩니다.

#### 타임존 지원

changedetection.io는 타임존 설정을 지원합니다. "Optional timezone to run in" 필드에 타임존을 입력하면, 해당 타임존의 현지 시간에 맞춰 스케줄이 작동합니다.

## Discord 웹훅 알림 설정 가이드

### Discord 서버에서 웹훅 생성하기

1. Discord 서버에서 알림을 받고 싶은 채널이 있는 서버를 선택합니다.
2. 서버 이름을 우클릭하고 **서버 설정**을 선택합니다.
3. 왼쪽 메뉴에서 **통합(Integrations)**을 클릭합니다.
4. **웹훅(Webhooks)** 항목을 클릭하고 **새 웹훅(New Webhook)** 버튼을 클릭합니다.
5. 웹훅의 이름을 설정하고(예: "ChangeDetection 알림"), 웹훅 메시지가 전송될 채널을 선택합니다.
6. **웹훅 URL 복사(Copy Webhook URL)** 버튼을 클릭하여 웹훅 URL을 복사합니다.

### ChangeDetection.io에서 웹훅 URL 설정하기

웹훅 URL은 일반적으로 다음과 같은 형식을 가집니다:
`https://discord.com/api/webhooks/webhook_id/webhook_token`

ChangeDetection.io에서는 다음과 같은 형식으로 변환하여 입력해야 합니다:
`discord://webhook_id/webhook_token`

설정 단계:
1. ChangeDetection.io에 접속하여 모니터링 중인 사이트의 **편집** 또는 전체 설정의 **알림(Notifications)** 탭으로 이동합니다.
2. **Notification URL List** 필드에 변환된 Discord 웹훅 URL을 입력합니다.
3. **저장(Save)** 버튼을 클릭하여 설정을 저장합니다.
4. **Send test notification** 버튼을 클릭하여 테스트 알림을 보내볼 수 있습니다.

## 스크린샷 첨부 설정

ChangeDetection.io는 변경 사항 감지 시 스크린샷을 함께 전송할 수 있는 기능을 제공합니다:

1. 알림 설정 페이지에서 **Attach screenshot to notification (where possible)** 옵션을 체크합니다.
2. 이 옵션을 활성화하면 웹사이트 변경 사항이 감지될 때 스크린샷이 Discord 메시지에 첨부되어 전송됩니다.

## Discord 웹훅 알림의 장점

1. **실시간 알림**: 웹사이트 변경 사항이 발생하면 즉시 Discord 채널에 알림이 전송됩니다.
2. **팀 공유 용이성**: 특정 Discord 채널에 알림을 보내 팀원들과 변경 사항을 쉽게 공유할 수 있습니다.
3. **모바일 접근성**: Discord 모바일 앱을 통해 데스크톱에 접속하지 않아도 알림을 받을 수 있습니다.
4. **커스터마이징 가능**: 알림 메시지의 제목, 내용, 이미지 등을 Jinja2 템플릿을 사용하여 사용자 정의할 수 있습니다.
5. **통합 관리**: 여러 웹사이트의 변경 사항을 한 채널에서 관리하거나, 웹사이트별로 다른 채널에 알림을 보낼 수 있습니다.
6. **시각적 확인**: 스크린샷 첨부 기능을 활용하면 변경 사항을 시각적으로 즉시 확인할 수 있습니다.

## 실용적 활용 사례

### 업무 시간 모니터링

"Business hours" 바로가기를 클릭하면 자동으로 평일(월-금) 09:00부터 8시간 동안(17:00까지) 실행되는 일정이 설정됩니다. 이는 업무 시간 동안만 중요한 웹사이트의 변경을 모니터링하려는 사용자에게 이상적입니다.

### 특정 요일만 모니터링

예를 들어 일요일에만 웹페이지 변경을 확인하고 싶다면, 일요일의 "Start At" 체크박스만 선택하고 시작 시간을 00:00으로, 시간(Hours)을 23, 분(Minutes)을 59로 설정하면 됩니다.

## 결론

ChangeDetection.io의 Duration Time 설정과 Discord 웹훅 연동을 통해 효율적이고 스마트한 웹페이지 모니터링 시스템을 구축할 수 있습니다. 이러한 기능들을 적절히 활용하면 시스템 자원을 효율적으로 사용하면서도 실시간으로 중요한 변경 사항을 놓치지 않을 수 있습니다.