---
title: "DevOps 통합 실습: Terraform · Ansible · Kubernetes · Kafka"
date: "2025-01-20"
category: "DevOps"
tags: ["DevOps","Terraform","Ansible","Kubernetes","Kafka","Pipeline"]
excerpt: "네 가지 도구를 연결해 인프라 프로비저닝→설정 자동화→클러스터 구성→Kafka+마이크로서비스 배포까지 단일 파이프라인 시나리오."
author: "Admin"
published: true
---

# 통합 실습: 전체 DevOps 파이프라인

##  개요
Terraform, Ansible, Kubernetes, Kafka를 통합하여 완전한 DevOps 파이프라인을 구축하는 실습입니다.

##  목표
- 4가지 도구 간 연계 흐름 이해
- 이벤트 기반 마이크로서비스 아키텍처 구성
- IaC + 설정 자동화 + 컨테이너 오케스트레이션 + 스트리밍 통합

##  전체 아키텍처 개괄
```
1단계 Terraform: VPC, Subnets, EC2(K8s Nodes), SG
2단계 Ansible: Docker 설치, kubeadm 초기화, 모니터링 도구 배포
3단계 Kubernetes: Kafka StatefulSet + Microservices + Service
4단계 Streaming: 주문 → 결제 → 알림 이벤트 흐름
```

##  프로젝트 구조 (요약)
```
devops-pipeline/
├── terraform/
│   ├── main.tf / variables.tf / outputs.tf
│   └── modules/{vpc,ec2,security}
├── ansible/
│   ├── inventory/hosts.yml
│   ├── playbooks/full-setup.yml
│   └── roles/{docker,kubernetes,monitoring}
├── kubernetes/
│   ├── kafka/{namespace,statefulset들}
│   ├── microservices/{order,payment,notification}
│   └── monitoring/{prometheus,grafana}
└── apps/{order-service,payment-service,notification-service}
```

##  Terraform 핵심 (발췌)
```hcl
module "vpc" { source = "./modules/vpc" vpc_cidr = "10.0.0.0/16" }
module "k8s_nodes" {
  source = "./modules/ec2"
  instance_count = 3
  instance_type  = "t3.medium"
}
output "k8s_node_private_ips" { value = module.k8s_nodes.private_ips }
```

##  Ansible Inventory (발췌)
```yaml
all:
  vars:
    ansible_user: fedora
  children:
    k8s_masters:
      hosts:
        master01: { ansible_host: 10.0.1.10 }
    k8s_workers:
      hosts:
        worker01: { ansible_host: 10.0.1.11 }
        worker02: { ansible_host: 10.0.1.12 }
```

### Playbook 흐름
1. 시스템 업데이트
2. Docker 설치(Role)
3. kubeadm init + join
4. 모니터링 스택 배포

##  Kafka on Kubernetes (발췌)
ZooKeeper & Kafka StatefulSet 배포 후 Topic 생성:
```bash
kubectl apply -f kubernetes/kafka/namespace.yaml
kubectl apply -f kubernetes/kafka/zookeeper-statefulset.yaml
kubectl apply -f kubernetes/kafka/kafka-statefulset.yaml
kubectl exec -it kafka-0 -n kafka -- kafka-topics --create --topic orders --partitions 3 --replication-factor 3 --bootstrap-server kafka-0.kafka:9092
```

##  마이크로서비스 예시 (Order Service)
```python
producer = KafkaProducer(bootstrap_servers=['kafka-0.kafka.kafka.svc.cluster.local:9092'],
                         value_serializer=lambda v: json.dumps(v).encode('utf-8'))
@app.route('/orders', methods=['POST'])
def create_order():
    order = request.json
    producer.send('orders', value=order); producer.flush()
    return {"status": "success", "order_id": order.get('id')}, 201
```
배포:
```bash
docker build -t myregistry/order-service:v1 apps/order-service/
docker push myregistry/order-service:v1
kubectl apply -f kubernetes/microservices/
```

##  시스템 동작 테스트
```bash
ORDER_URL=$(kubectl get svc order-service -n kafka -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
curl -X POST http://$ORDER_URL/orders -H 'Content-Type: application/json' -d '{"id":"order-001","amount":99.9}'
kubectl logs -f deployment/payment-service -n kafka
```

##  모니터링 (Prometheus 발췌)
```yaml
scrape_configs:
  - job_name: 'kubernetes-pods'
    kubernetes_sd_configs:
      - role: pod
```

##  확장 실습 아이디어
| 단계 | 추가 과제 |
|------|-----------|
| CI/CD | GitHub Actions로 Terraform plan/apply 자동화 |
| 보안 | RBAC + 네트워크 정책(NetworkPolicy) 적용 |
| 관측성 | OpenTelemetry로 추적 수집 |
| 비용 | Terraform 태그 활용한 비용 분석 |

##  통합 트러블슈팅 요약
| 증상 | 원인 | 해결 |
|------|------|------|
| Worker Join 실패 | 토큰 만료 | `kubeadm token create` 재생성 |
| Kafka Pod Crash | 스토리지/환경 변수 오류 | `kubectl describe` + PVC 상태 확인 |
| 메시지 누락 | acks 설정 낮음 | `acks=all` + ISR 모니터링 |

##  참고 리소스
- Strimzi (Kafka on K8s): https://strimzi.io/
- Terraform AWS 모듈: https://registry.terraform.io/modules/terraform-aws-modules/vpc/aws/latest
- kubeadm Docs: https://kubernetes.io/docs/setup/

## ▶ 다음 예정 글
- Terraform으로 K8s 클러스터 프로비저닝 (예정)
- Kubernetes에서 Kafka 운영 (예정)
- 마이크로서비스 배포 고급 전략 (예정)
