---
title: "Kubernetes 로컬 클러스터 설치 (minikube·kind·Docker Desktop)"
date: "2025-01-16"
category: "DevOps"
tags: ["DevOps","Kubernetes","Cluster","minikube","kind"]
excerpt: "minikube, kind, Docker Desktop 세 가지 방법으로 로컬 K8s 클러스터 구성하고 kubectl 기본 명령을 익힌다."
author: "Admin"
published: true
---

# Kubernetes 클러스터 설정

##  개요
로컬 환경에서 Kubernetes 클러스터를 구성하는 세 가지 방법(minikube, kind, Docker Desktop)과 kubectl 기본 명령어를 학습합니다.

##  학습 목표
- 로컬 클러스터 설치
- kubectl 설치 및 사용
- 노드/네임스페이스/리소스 조회
- 첫 Deployment & Service 생성

##  kubectl 설치
### Linux
```bash
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl
sudo mv kubectl /usr/local/bin/
kubectl version --client
```
### macOS
```bash
brew install kubectl
```
### Windows
```powershell
choco install kubernetes-cli
```

##  옵션 1: minikube (권장)
```bash
curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube
minikube start --driver=docker
minikube status
minikube dashboard
```
멀티 노드:
```bash
minikube start --nodes 3 --driver=docker
```
리소스 지정:
```bash
minikube start --cpus=4 --memory=8192 --disk-size=20g
```

##  옵션 2: kind
```bash
curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64
chmod +x ./kind
sudo mv ./kind /usr/local/bin/kind
kind create cluster --name my-cluster
```
멀티 노드 설정 파일:
```yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
- role: worker
- role: worker
```
```bash
kind create cluster --config kind-config.yaml --name multi-node
```

##  옵션 3: Docker Desktop
1. Docker Desktop 설치
2. Settings → Kubernetes → Enable 체크
3. Apply & Restart

##  클러스터 기본 확인
```bash
kubectl cluster-info
kubectl get nodes
kubectl describe node <node-name>
kubectl api-resources
kubectl api-versions
```

##  Context 관리
```bash
kubectl config get-contexts
kubectl config current-context
kubectl config use-context minikube
cat ~/.kube/config
```

##  네임스페이스
```bash
kubectl get ns
kubectl create namespace dev
kubectl config set-context --current --namespace=dev
kubectl get pods -n kube-system
kubectl get pods -A
```

##  리소스 조회/출력
```bash
kubectl get pods
kubectl get deployments
kubectl get services
kubectl get pods -o wide
kubectl get pod my-pod -o yaml
kubectl get pods -l app=nginx
```

##  첫 Deployment & Service
```bash
kubectl create deployment nginx --image=nginx:latest
kubectl get deployments,pods
kubectl expose deployment nginx --type=NodePort --port=80
kubectl get services
```
접속 (minikube):
```bash
minikube service nginx --url
```
포트포워드:
```bash
kubectl port-forward deployment/nginx 8080:80
```

##  스케일링
```bash
kubectl scale deployment nginx --replicas=5
kubectl get pods -w
```

##  정리
```bash
kubectl delete service nginx
kubectl delete deployment nginx
minikube stop && minikube delete
kind delete cluster --name my-cluster
```

##  실습 과제
1. 3 노드 클러스터 생성 후 nginx 3 replicas 배포 → 각 노드 분포 확인
2. development, staging, production 네임스페이스 생성 후 각 환경에 동일 Deployment 생성
3. metrics-server 활성화 후 `kubectl top nodes` 출력

##  자주 보는 문제
| 문제 | 원인 | 해결 |
|------|------|------|
| connection refused | 클러스터 미실행 | `minikube status`, 재시작 |
| Unable to connect to server | kubeconfig 오류 | context 변경/파일 확인 |
| Pod Pending | 리소스 부족 | describe로 원인 확인 후 리소스 증가 |
| ImagePullBackOff | 이미지 이름 오류 | 이미지 태그 확인 후 수정 |

## ▶ 다음 단계
- [Pod와 Deployment](kubernetes-02-pods-deployments.md)
- Service & Networking (예정)

##  참고
- Kubernetes Docs: https://kubernetes.io/docs/home/
- kubectl Cheatsheet: https://kubernetes.io/docs/reference/kubectl/cheatsheet/
