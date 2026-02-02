---
title: "Container Network Interface"
date: "2026-02-01"
category: "Network, Container, CNI"
tags: ["Network", "Container", "CNI"]
excerpt: "Networking without NAT, the CNI's role in remote container networking, and more."
readTime: "5분"
---

# Container Network Interface

기존의 레거시 서버 배포 방식에서는 서버 간의 통신을 위한 NAT(Network Address Translation)가 일반적이었으며,
도커 컨테이너 사용과 함께 Docker Bridge 네트워크가 같이 사용되었습니다.
단일 호스트 Docker 환경에서는 호스트 전용 네트워크 모델을 사용하여 NAT 없이도 통신이 가능했습니다.

#### 호스트 전용 네트워크 모델
![bridge](images/2026/CNI/bridge.png)
- IP 할당과 격리 
   - Docker 데몬이 시작될 때 docker0 라는 가상 브리지가 생성됩니다. (이는 물리적인 네트워크 스위치와 유사한 역할을 합니다.)
   - veth pair (새로운 이더넷 쌍) : 컨테이너가 새로 생성될 때마다 Docker는 가상 이더넷 장치쌍을 할당합니다.
   - 이 중 한쪽은 컨테이너 내부에 Linux 네임스페이스 격리 방법을 통한 격리된 환경엣서 컨테이너가 독립적인 네트워크 카드를 가진 것 처럼 동작합니다.
   - 컨테이너는 이 브리지에 연결되어 호스트 네트워크와 동일한 네트워크 공간을 공유합니다.
  </br>
  > 브리지 네트워크는 호스트 내부의 격리된 사설망이므로, 기본적으로 외부 네트워크와 통신하기 위해서는 NAT가 필요합니다.
  
#### 통신 흐름 
- **컨테이너 -> 외부 (Outbound)**: 컨테이너가 인터넷과 같은 외부 네트워크로 패킷을 보낼 때는 호스트의 docker0 브리지를 거쳐 호스트의 물리 인터페이스(예: eth0)를 통해 나갑니다. 이때 **IP Masquerading(NAT)**이 적용되어, 패킷의 출발지 IP가 호스트의 IP로 변경됩니다.

- **외부 -> 컨테이너 (Inbound)**: 외부에서 컨테이너 내부의 서비스(예: Tomcat의 8080 포트)에 접근하려면 **포트 매핑(Port Mapping)**이 필수적입니다.

- 이 과정에서 Docker는 호스트의 **iptables** 규칙을 수정하여, 호스트의 특정 포트(8080)로 들어오는 트래픽을 docker0 브리지를 통해 컨테이너의 IP와 포트(8080)로 포워딩(DNAT)합니다.

하지만 이러한 NAT 기반의 네트워킹은 몇 가지 단점이 있습니다:
1. **포트 충돌** : 여러 컨테이너가 동일한 호스트에서 동일한 포트를 사용하려고 할 때 충돌이 발생할 수 있습니다.
2. **통신의 복잡성**: NAT는 네트워크 트래픽의 흐름을 복잡하게 만들어 디버깅과 관리가 어려워집니다. 컨테이너는 자신이 NAT 뒤에 있다는 사실을 모르며, 동적인 service discovery가 어렵습니다. (이를 해결하기 위해 과도기에 consul 등의 서비스 디스커버리 툴이 사용되었습니다.)

---

그러나 **플랫 네트워크 (Flat Network)** 에서는 NAT 없이도 네트워킹이 가능하며, 이는 **CNI(Container Network Interface)**를 통해 구현됩니다.
이 글에서는 CNI의 역할과 원격 컨테이너 네트워킹에 대해 살펴보겠습니다.

## CNI(Container Network Interface)란?
CNI는 "IP per pod" 모델이라고도 불리며, 모든 Pod는 클러스터 내에서 고유한 IP 주소를 할당받습니다.

#### IP 할당 및 접근성
모든 Pod는 클러스터 내에서 고유한 IP 주소를 할당받으며, 이는 동일한 네트워크 세그먼트에 속합니다.
이 IP는 단순히 호스트 내부용이 아니라, 네트워크 상에서 라우팅 가능한 IP 입니다.

#### 통신 흐름
- **Pod -> Pod**: 동일한 클러스터 내의 다른 Pod로 통신할 때, Pod는 직접 상대 Pod의 IP 주소로 패킷을 보냅니다. Pod A 가 Pod B 로 패킷을 보낼 때, 파드 B가 어느 노드에 있든지 상관없이 파드 B 의 실제 IP로 직접 전송합니다.

  - **Pod -> 외부 (Outbound)**: Pod가 클러스터 외부로 통신할 때도 NAT 없이 직접 통신이 가능합니다. 클러스터의 네트워크 플러그인은 라우팅 테이블을 설정하여, Pod의 IP가 외부 네트워크에서 인식될 수 있도록 합니다.

  - **외부 -> Pod (Inbound)**: 외부에서 Pod 내부의 서비스에 접근할 때도 NAT 없이 직접 접근이 가능합니다. 클러스터의 네트워크 플러그인은 외부 요청을 해당 Pod의 IP로 라우팅합니다.
  
### 장점
- **포트 관리 불필요**: 각 파드가 고유 IP를 가지므로, 같은 노드에 포트 80을 쓰는 웹 서버 파드를 여러 개 띄워도 포트 충돌이 발생하지 않습니다.
 - **레거시 호환성**: VM이나 물리 서버를 다루는 방식과 네트워크 관점이 동일하여 기존 애플리케이션을 포팅하기 쉽습니다.

### 예시: Docker Compose
```yaml
services:
  web:
    image: nginx:alpine
    ports:
      - "8080:80"        # 호스트 포트 8080을 컨테이너 포트 80에 매핑
    restart: always      # 컨테이너 중단 시 재시작 정책
```
- services: 실행할 컨테이너 서비스 정의
- ports: 외부 접근을 위한 포트 매핑 설정

### 예시: Kubernetes Pod
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
  labels:
    app: nginx
spec:
  replicas: 2               # 파드 복제본 개수 (Docker Compose의 scale 개념)
  selector:
    matchLabels:
      app: nginx            # 이 레이블을 가진 파드를 관리 대상으로 지정
  template:                 # 파드 템플릿 정의
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
    image: nginx:alpine
    ports:
    - containerPort: 80 # 컨테이너 내부 포트
    resources: # 리소스 제한 (옵션)
        limits:
            cpu: 100m
            memory: 200Mi
```
- apiVersion: API 버전 지정
- kind: Deployment: 배포 객체 유형
- replicas: 파드 복제본 개수 지정, Pod 가 죽으면 컨트롤러가 자동으로 감지 후 재생성
- selector: Deployment가 관리할 파드를 식별하는 레이블 
  

 ### 예시: Kubernetes Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: nginx-service
spec:
  type: NodePort        # 서비스 유형 (LoadBalancer, NodePort,ClusterIP 등) - 외부 접근을 위해 NodePort 사용
  selector:
    app: nginx        # 이 레이블을 가진 파드에 트래픽 전달
  ports:
   - port: 8080        # 서비스 포트
     targetPort: 80    # 파드의 컨테이너 포트
     nodePort: 30080   # 노드 포트 (외부에서 접근 가능한 포트)
```

- kind: Service: 파드 그룹에 대한 네트워크 접근 정책을 정의하는 객체 유형
- selector: app: nginx 레이블을 가진 파드들로 트래픽을 로드밸런싱하여 전달
- type: NodePort: 클러스터 외부에서 접근할 수 있도록 노드 포트를 할당

### On-premise 환경에서의 네트워크 가상화
AWS, GCP 가 제공하는 VPC(Virtual Private Cloud)와 같은 하드웨어 수준의 네트워크 가상화나 자동화된 VPN 구성을 바로 사용하기 힘든 On-premise 환경에서의 경우에는 CNI 플러그인과 쿠버네티스 네이티브 조합을 사용하여 VPC 와 유사한 격리와 보안을 구현할 수 있습니다.

### VPC 대안: 오버레이 네트워크
클라우드의 VPC 가 제공하는 '격리된 사설망' 은 논리적인 소프트웨어 기술 (SDN) 으로 구현됩니다.
이는 거대한 물리 서버 공유기 위에서, 각 사용자 데이터에 tag 를 붙여 꼬이지 않게끔하는 기술이라 볼 수 있습니다.

VPC 의 핵심 작동 메커니즘에 대해 간략하게 살펴보면,

#### 1. 터널링과 태깅 : 
물리적으로는 수천 명의 사용자가 같은 스위치와 라우터를 공유합니다. 이러한 복합성에 의한 충돌을 피하기 위해 터널링 프로토콜 (VXLAN, NVGRE)을 사용하여 각 사용자의 데이터를 독립적인 네트워크 공간으로 터널링합니다. 
    
  - VNI : vpc 를 생성하면 클라우드 제공자는 고유한 ID 번호 (VNI)를 할당합니다. 이는 각 VPC가 독립적인 네트워크 공간을 가지도록 합니다. (예시: 사용자 1 -> VNI: 1000, 사용자 2 -> VNI: 2000)
  - 캡슐화 : 사용자의 가상머신이 데이터를 보낼 때, 물리 호스트의 HyperVisor 가 데이터를 **물리 네트워크용 헤더** 으로 감쌉니다.

> 우체국에서 편지를 배송할 때, 겉봉투 (우편번호)를 사용하여 편지를 정확한 주소로 배송합니다.  같은 주소의 다른 편지를 구분하기 위해 겉봉투를 사용합니다.

#### 2. 패킷의 트래킹 : 

사용자 A가 VPC 내부에서 VM 1 -> VM 2로 데이터를 보낼 때 일어나는 일입니다.

출발 (VM 1): VM 1은 자신이 10.0.0.5라는 사설 IP를 가지고 있다고 생각하고, 목적지 10.0.1.5(VM 2)로 패킷을 보냅니다.

가로채기 (Hypervisor): 물리 서버의 하이퍼바이저(가상화 관리자)가 이 패킷을 잡습니다. "어? 이건 VPC ID 100번에서 나온 거네?"라고 인식합니다.

포장 (Encapsulation): 하이퍼바이저는 원본 패킷에 VPC ID 100이라는 태그를 붙이고, VM 2가 위치한 물리 서버의 실제 IP를 목적지로 하는 새로운 패킷으로 감쌉니다.

이동 (Physical Network): 데이터 센터의 물리적 라우터들은 원본 데이터(사설 IP 등)는 볼 수 없고, 겉면의 물리 서버 IP만 보고 데이터를 전달합니다.

도착 및 해제 (Decapsulation): 목적지 물리 서버의 하이퍼바이저가 패킷을 받아서 겉 포장을 뜯습니다. "VPC ID 100번이네? 그럼 내 서버에 있는 VM들 중 ID 100번을 쓰는 녀석에게 줘야지."

전달 (VM 2): VM 2는 VM 1이 보낸 원본 패킷을 그대로 받습니다.

즉,  물리 네트워크를 공유하지만, VNI 태그가 다르면 절대 서로 통신할 수 없습니다. 이것이 '격리'의 실체입니다.

