---
title: "Kafka 로컬 설치: Docker & 네이티브"
date: "2025-01-15"
category: "DevOps"
tags: ["DevOps","Kafka","설치","Docker","실습"]
excerpt: "Docker Compose로 3 Broker 클러스터 구성과 네이티브 설치 두 가지 방식 비교, 기본 명령어/Topic/Consumer Group 실습."
author: "Admin"
published: true
---

# Kafka 로컬 설치 및 실행

##  개요
로컬 환경에서 Kafka를 설치하고 Topic 생성, 메시지 발행/소비, Consumer Group 관리를 실습합니다. Docker Compose(권장)와 네이티브 두 방법을 다룹니다.

##  방법 1: Docker Compose (3 Broker + ZooKeeper + UI)
`docker-compose.yml` 요약:
```yaml
version: '3.8'
services:
  zookeeper:
    image: confluentinc/cp-zookeeper:7.5.0
    ports: ["2181:2181"]
  kafka1:
    image: confluentinc/cp-kafka:7.5.0
    ports: ["9092:9092"]
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: 'zookeeper:2181'
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka1:29092,PLAINTEXT_HOST://localhost:9092
  kafka2: # ... 동일 패턴
  kafka3: # ... 동일 패턴
  kafka-ui:
    image: provectuslabs/kafka-ui:latest
    ports: ["8080:8080"]
```

실행:
```bash
docker-compose up -d
docker-compose ps
docker-compose logs -f kafka1
```
종료/정리:
```bash
docker-compose down
docker-compose down -v  # 볼륨 포함 완전 삭제
```

##  방법 2: 네이티브 설치
```bash
wget https://downloads.apache.org/kafka/3.6.0/kafka_2.13-3.6.0.tgz
tar -xzf kafka_2.13-3.6.0.tgz
cd kafka_2.13-3.6.0
```
ZooKeeper & Broker 실행:
```bash
bin/zookeeper-server-start.sh -daemon config/zookeeper.properties
bin/kafka-server-start.sh -daemon config/server.properties
```
다중 Broker 구성: `server-1.properties`, `server-2.properties` 복사 및 포트/로그 디렉토리 변경 후 각각 실행.

##  Topic 관리 명령어
```bash
# 생성
kafka-topics --create --bootstrap-server localhost:9092 --topic my-topic --partitions 3 --replication-factor 3
# 목록
kafka-topics --list --bootstrap-server localhost:9092
# 상세
kafka-topics --describe --bootstrap-server localhost:9092 --topic my-topic
# 삭제
kafka-topics --delete --bootstrap-server localhost:9092 --topic my-topic
# Partition 수 증가
kafka-topics --alter --bootstrap-server localhost:9092 --topic my-topic --partitions 5
```

##  Console Producer / Consumer
Producer:
```bash
kafka-console-producer --bootstrap-server localhost:9092 --topic my-topic
# Key:Value 형식
kafka-console-producer --bootstrap-server localhost:9092 --topic my-topic \
  --property "parse.key=true" --property "key.separator=:"
```
Consumer:
```bash
kafka-console-consumer --bootstrap-server localhost:9092 --topic my-topic
kafka-console-consumer --bootstrap-server localhost:9092 --topic my-topic --from-beginning
kafka-console-consumer --bootstrap-server localhost:9092 --topic my-topic --from-beginning \
  --property print.key=true --property key.separator=":"
```
Consumer Group:
```bash
kafka-console-consumer --bootstrap-server localhost:9092 --topic my-topic --group my-group --from-beginning
```

##  Consumer Group 관리
```bash
kafka-consumer-groups --bootstrap-server localhost:9092 --list
kafka-consumer-groups --bootstrap-server localhost:9092 --group my-group --describe
# Offset 리셋 (주의)
kafka-consumer-groups --bootstrap-server localhost:9092 --group my-group --reset-offsets --to-earliest --topic my-topic --execute
```

##  상태/오프셋 확인
```bash
kafka-run-class kafka.tools.GetOffsetShell --broker-list localhost:9092 --topic my-topic
```
출력 예:
```
my-topic:0:1234
my-topic:1:2345
my-topic:2:3456
```

##  Cluster 운영 확인
```bash
docker exec kafka1 ls -la /var/lib/kafka/data
```

##  성능 테스트 (선택)
```bash
kafka-producer-perf-test --topic perf-test --num-records 100000 --record-size 512 --throughput -1 --producer-props bootstrap.servers=localhost:9092 acks=all
kafka-consumer-perf-test --broker-list localhost:9092 --topic perf-test --messages 100000 --threads 1
```

##  트러블슈팅 요약
| 문제 | 원인 | 해결 |
|------|------|------|
| Connection to node -1 | Broker 미실행 | logs 확인 후 재시작 |
| Replication factor 오류 | Broker 수 부족 | RF 조정 또는 Broker 추가 |
| Topic 생성 Timeout | ZooKeeper 연결 문제 | ZooKeeper 상태 점검 (`echo stat | nc localhost 2181`) |
| 디스크 공간 부족 | 로그 누적 | retention 설정 조정 |

##  환경 정리
```bash
docker-compose down -v
rm -rf /tmp/kafka-logs* /tmp/zookeeper
```

## ▶ 다음 단계
- Producer/Consumer 실습 (예정)
- 토픽과 파티션 관리 (예정)

##  참고
- Quickstart: https://kafka.apache.org/quickstart
- Kafka UI: https://github.com/provectus/kafka-ui
