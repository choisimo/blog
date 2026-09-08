---
title: "Kafka 핵심 개념과 아키텍처"
date: "2025-01-14"
category: "DevOps"
tags: ["DevOps","Kafka","Streaming","아키텍처","초급"]
excerpt: "Topic, Partition, Broker, Replication, Producer/Consumer와 Consumer Group까지 Kafka 구조를 시각적으로 이해."
author: "Admin"
published: true
---

# Kafka 개념 및 아키텍처

##  개요
Apache Kafka는 고성능 분산 이벤트 스트리밍 플랫폼으로 실시간 데이터 파이프라인과 스트리밍 애플리케이션을 구축하는 데 사용됩니다.

##  학습 목표
- Kafka 핵심 개념 이해
- 아키텍처 구성 요소 파악
- 메시지 저장/전송 메커니즘 흐름 이해

##  전체 아키텍처 (요약)
```diagram
{
  "title": "Kafka 메시지 전달 구조",
  "kind": "structure",
  "nodes": [
    {
      "id": "producer",
      "label": "Producer",
      "detail": "토픽의 파티션에 메시지를 발행한다."
    },
    {
      "id": "cluster",
      "label": "Kafka Cluster",
      "detail": "브로커가 파티션과 복제본을 나누어 저장한다.",
      "items": [
        "Broker 1",
        "Broker 2",
        "Broker 3"
      ]
    },
    {
      "id": "a",
      "label": "Topic A",
      "items": [
        "Partition 0",
        "Partition 1",
        "Partition 2"
      ]
    },
    {
      "id": "b",
      "label": "Topic B",
      "items": [
        "Partition 0",
        "Partition 1",
        "Partition 2"
      ]
    },
    {
      "id": "consumer",
      "label": "Consumer Groups",
      "detail": "각 그룹이 독립적으로 메시지를 읽고 처리 위치를 관리한다."
    }
  ],
  "edges": [
    {
      "to": "a",
      "from": "producer",
      "label": "발행"
    },
    {
      "to": "b",
      "from": "producer",
      "label": "발행"
    },
    {
      "to": "a",
      "from": "cluster",
      "label": "저장"
    },
    {
      "to": "b",
      "from": "cluster",
      "label": "저장"
    },
    {
      "to": "consumer",
      "from": "a",
      "label": "읽기"
    },
    {
      "to": "consumer",
      "from": "b",
      "label": "읽기"
    }
  ]
}
```

##  핵심 개념
### Topic
메시지가 저장되는 논리적 카테고리.
특징: append-only, retention 기간 내 유지.

### Partition
Topic을 나누는 단위로 병렬 처리와 스케일링 핵심.
Key 기반 라우팅 혹은 라운드로빈.

### Broker
Kafka 서버 인스턴스. Partition Leader/Follower 역할 수행.

### Replication
고가용성 확보. ISR(In-Sync Replica) 개념으로 Leader 장애 시 선출.

### Producer
메시지를 Topic에 발행.
```java
props.put("acks", "all"); // 신뢰성 향상
```

### Consumer & Consumer Group
Group 내에서 Partition을 분배 처리. 다른 Group은 독립 소비.
Rebalancing 시 Partition 재할당.

##  메시지 구성
```diagram
{
  "title": "메시지를 읽을 때 보는 정보",
  "kind": "compare",
  "nodes": [
    {
      "id": "offset",
      "label": "Offset",
      "detail": "파티션 안에서 메시지의 위치를 나타낸다."
    },
    {
      "id": "timestamp",
      "label": "Timestamp",
      "detail": "메시지의 시간 정보다."
    },
    {
      "id": "key",
      "label": "Key",
      "detail": "파티션 선택 등에 사용하는 키다."
    },
    {
      "id": "value",
      "label": "Value",
      "detail": "전달할 데이터다."
    },
    {
      "id": "headers",
      "label": "Headers",
      "detail": "부가 메타데이터다."
    }
  ],
  "edges": []
}
```
Offset은 Partition 내 일련번호. Consumer는 __consumer_offsets에 커밋.

커밋 전략: auto / manual sync / manual async.

##  데이터 흐름
### Write Path
1. Producer → Leader → Followers 복제 → acks 설정에 따른 응답

### Read Path
1. Consumer Fetch 요청 → Broker 전달 → 처리 후 Offset 커밋

##  사용 사례 패턴
1. 주문 처리 시스템: orders Topic → 결제/알림 서비스
2. 로그 수집: logs Topic → ES / S3 아카이브
3. 이벤트 소싱: user-events → 분석 / ML 학습

##  주요 설정 (발췌)
| 설정 | 설명 | 권장 |
|------|------|------|
| num.partitions | Partition 수 | Consumer 병렬성 고려 |
| replication.factor | 복제 수 | 3 (프로덕션) |
| retention.ms | 보관 기간 | 용도별 조정 |
| compression.type | 압축 방식 | snappy/lz4 |

### Producer
```properties
acks=all
retries=2147483647
compression.type=snappy
```
### Consumer
```properties
enable.auto.commit=true
auto.offset.reset=latest
```

##  Kafka vs 전통 메시지 큐 (요약)
- 저장 방식: 디스크(영구) vs 메모리 중심
- 재처리: Offset 기반 자유 vs 어려움
- 확장성: 수평 확장 용이 vs 제한적

##  설계 원칙
Partition 수 결정: 예상 처리량 / 단일 Consumer 처리량.
Replication Factor: 프로덕션 3, 테스트 1.
Key 설계: 동일 엔티티 이벤트 순서 보존.

## ▶ 다음 단계
- [Kafka 로컬 설치 및 실행](kafka-02-installation-setup.md)
- Producer/Consumer 실습 (예정)

##  참고 자료
- 공식 문서: https://kafka.apache.org/documentation/
- Confluent 소개: https://docs.confluent.io/
