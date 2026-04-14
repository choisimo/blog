---
title: "ArgoCD에서 GitHub 연결이 실패했을 때, 진짜 원인은 SSH가 아니라 DNS였다"
date: "2026-04-05"
category: "Kubernetes"
tags: ["ArgoCD", "CoreDNS", "DNS", "GitHub", "Kubernetes", "k3s", "Troubleshooting"]
excerpt: "ArgoCD의 Repository Failed는 마지막 증상이었고, 실제 원인은 CoreDNS가 외부 질의를 넘기던 upstream resolver 체인이 깨져 `github.com` 이름 해석이 실패한 데 있었다."
slug: "argocd-github-dns-failure"
---

ArgoCD에서 GitHub repository 연결이 실패하면 대개 가장 먼저 SSH 키나 Git 인증부터 의심하게 된다. 실제로 나 역시 처음에는 Deploy Key 등록, private key 입력, repo URL, `known_hosts` 같은 전형적인 원인부터 떠올렸다.

그런데 이번 문제는 그 방향으로만 보면 오래 헤맬 수 있는 유형이었다. 겉으로는 ArgoCD의 repository connection failure처럼 보였지만, 실제 원인은 그 아래 계층인 DNS에 있었다. 더 정확히는 **애플리케이션 장애처럼 보인 현상이, 이름 해석 계층의 문제 때문에 발생했고, 그 결과가 ArgoCD의 GitHub 연결 실패로 표면화된 사건**이었다.

이런 종류의 장애는 특히 까다롭다. 마지막에 보이는 증상과 실제 원인이 서로 다른 계층에 있기 때문이다. 이번 사례도 정확히 그랬다.

## TL;DR

- 표면 증상은 ArgoCD GUI의 `Repository Failed`였다.
- 처음엔 SSH 인증 문제처럼 보였지만, 결정적 로그는 `lookup github.com on 10.43.0.10:53: server misbehaving`였다.
- 즉 GitHub에 접속하기 전에, `github.com`이라는 이름을 IP로 바꾸는 단계에서 이미 실패하고 있었다.
- `argocd-repo-server`는 문제의 원인이 아니라 DNS 계층의 피해자였다.
- CoreDNS는 `forward . /etc/resolv.conf`로 외부 질의를 upstream resolver에 넘기고 있었고, 그 경로가 깨져 있었다.
- k3s 쪽에서 nameserver 경로를 명시하고 CoreDNS를 재시작한 뒤 `getent hosts github.com`이 다시 응답하면서 문제가 해결됐다.

## 1. 처음 보인 것은 단순한 `Repository Failed`였다

출발점은 단순했다. ArgoCD GUI에서 repository 상태가 `Failed`로 보였다.

이 장면만 보면 보통 이런 것부터 점검한다.

- GitHub Deploy Key가 잘못 등록됐는가
- private key와 public key를 잘못 넣었는가
- repo URL이 틀렸는가
- `known_hosts`가 비어 있거나 mismatch가 났는가
- SSH 인증 방식이 잘못 선택됐는가

실제로 `argocd-repo-server` 로그 초반에도 SSH 쪽을 의심하게 만드는 메시지가 있었다.

```text
invalid auth method
SSH_AUTH_SOCK not-specified
```

이 정도만 보면 충분히 SSH 계층 문제처럼 느껴진다. 그런데 이 메시지들만 보고 곧바로 키를 다시 만들거나 인증 방식을 갈아엎었으면, 핵심 병목을 놓쳤을 가능성이 높다. 진짜로 봐야 했던 로그는 따로 있었다.

```text
lookup github.com on 10.43.0.10:53: server misbehaving
```

이 한 줄이 문제의 성격을 바꿨다. 이제 이건 "GitHub 인증 실패"가 아니라, **GitHub라는 이름 자체를 해석하지 못하는 DNS 문제**가 된다.

## 2. ArgoCD가 아니라 DNS 계층이 먼저 무너져 있었다

쿠버네티스 안의 Pod는 보통 외부 DNS에 직접 질의하지 않는다. 대신 Pod 내부 `/etc/resolv.conf`에 적힌 클러스터 DNS 서비스로 먼저 질문을 던진다.

이번 경우 `argocd-repo-server` 안의 `/etc/resolv.conf`는 `10.43.0.10`을 가리키고 있었다.

```text
nameserver 10.43.0.10
```

이 주소는 `kube-dns` 서비스이고, 실제 이름 해석 처리는 CoreDNS가 맡는다. 흐름을 단순하게 풀면 다음과 같다.

1. `argocd-repo-server`가 GitHub 저장소에 접근하려 한다.
2. 그 전에 `github.com`의 IP를 알아야 한다.
3. Pod는 `10.43.0.10`에 질의한다.
4. `10.43.0.10`은 CoreDNS로 연결된다.
5. CoreDNS는 외부 도메인을 upstream resolver로 넘긴다.
6. 이 forwarding 체인이 깨져 있으면 Pod는 외부 도메인을 해석하지 못한다.

즉 ArgoCD는 장애의 발화점이 아니라, **DNS 계층 위에서 동작하던 소비자**였을 뿐이다.

## 3. 결정적인 단서는 CoreDNS의 `forward . /etc/resolv.conf`

CoreDNS ConfigMap을 보면 이번 사건의 중심축이 되는 설정이 있었다.

```text
forward . /etc/resolv.conf
```

뜻은 단순하다. CoreDNS는 `*.cluster.local` 같은 쿠버네티스 내부 이름은 스스로 처리하지만, `github.com` 같은 외부 도메인은 자기 컨테이너 안의 `/etc/resolv.conf`에 적힌 상위 DNS 서버로 다시 넘긴다.

여기서 중요한 건 **두 개의 `/etc/resolv.conf`를 분리해서 이해해야 한다는 점**이다.

- 애플리케이션 Pod의 `/etc/resolv.conf`는 보통 `kube-dns` 서비스 IP를 가리킨다.
- CoreDNS Pod가 참조하는 `/etc/resolv.conf`는 노드나 k3s가 제공한 upstream resolver를 가리킨다.

이 둘을 하나로 생각하면 장애를 절반만 보게 된다. 애플리케이션 Pod 안에서 `10.43.0.10`이 보였다고 끝이 아니라, 그 뒤쪽에 연결된 CoreDNS의 forward 체인까지 따라가야 진짜 원인이 보인다.

## 4. 왜 처음에는 실패했고, 나중에는 성공했을까

초기 상태에서는 `argocd-repo-server` 안에서 `getent hosts github.com`이 응답하지 않았다. 동시에 repo-server 로그에는 `lookup github.com on 10.43.0.10:53: server misbehaving`가 반복됐다.

이 조합은 의미가 분명하다. Pod에서 CoreDNS까지는 도달하지만, CoreDNS가 외부 도메인 해석을 끝내지 못하고 있었다는 뜻이다.

그 뒤 k3s 쪽에서 nameserver 관련 설정을 명시하고 CoreDNS를 재시작한 후, 같은 Pod 안에서 다시 확인하자 `github.com`이 정상적으로 해석됐다.

```bash
getent hosts github.com
```

```text
20.205.243.166 github.com
```

즉, 이 결과는 **이름 해석 경로 자체가 복구됐다는 증거**다.

가장 유력한 해석은 이러하다. 기존에는 CoreDNS가 외부 도메인을 넘기던 upstream resolver 체인이 불안정하거나 부적절했다.
systemd-resolved, 로컬 stub resolver, VPN 또는 Tailscale이 개입한 DNS 체인처럼, 노드의 기본 resolver 환경이 이미 복잡해져 있었을 가능성이 높다. 실제로 search 도메인에 Tailscale 흔적이 보였다는 점도, 로컬 DNS 환경이 단순하지 않았다는 신호였다. 종종 dns 해석 오류 발생 시 원인 이었던 tailscale vpn 를 먼저 의심해서 살펴본 이유도 그러하기 때문이다.

이 상태에서 k3s 쪽에 명시적인 nameserver 경로를 지정했다는 것은, CoreDNS가 의존할 upstream resolver를 "애매한 기본 체인" 대신 "통제 가능한 resolver 집합"으로 고정했다는 의미다. 그리고 CoreDNS를 재기동하면서 그 변경이 실제 질의 경로에 반영됐다.

즉 바뀐 것은 ArgoCD 설정이 아니라, **CoreDNS가 외부 세계와 대화하는 방식**이었다.

## 5. 왜 CoreDNS 재시작이 중요했는가

여기서 재시작은 부수 동작이 아니었다. 어떤 사람은 "설정만 바꾸면 자동 반영되는 것 아닌가?"라고 생각하지만, 실제로는 그렇게 단순하지 않을 수 있다.

CoreDNS는 Pod 안에서 돌아가는 프로세스이기에, resolver 관련 설정이 바뀌어도, 이미 떠 있는 프로세스는 이전 상태를 계속 보고 있을 수 있다. 그래서 새 upstream resolver 구성을 확실하게 반영하려면 CoreDNS Pod 자체를 다시 띄우는 편이 가장 명확하다.

그러한 이유로 이번에도 마지막 적용은 다음 명령을 사용하여 마무리했다.

```bash
kubectl rollout restart deployment/coredns -n kube-system
```

그리고 직후 예상대로 이름 해석이 살아났다. 즉 재시작이 문제를 고친 것이 아니라, **새 resolver 구성을 먹고 다시 시작하게 만들었기에** 해결된 것이다.

## 6. 왜 SSH 에러도 같이 보였을까

이번 오류 해결을 더 헷갈리게 만든 건 SSH 관련 메시지가 같이 찍혔다는 점이다.

```text
invalid auth method
error creating SSH agent: "SSH agent requested but SSH_AUTH_SOCK not-specified"
```

물론, 이런 로그는 무시하면 안 된다. 다만 **우선순위를 잘 잡아야 한다.**

- DNS가 깨져 있으면 `github.com` 이름 자체를 못 찾으니 저장소 테스트는 반드시 실패한다.
- 동시에 저장소 설정이 agent 기반 인증을 기대하거나, private key 입력 방식이 어색하면 SSH 관련 경고도 뜰 수 있다.
- 하지만 이번 장애를 반복적으로 유발한 핵심 병목은 DNS였다.

즉 SSH 메시지는 완전히 틀린 방향은 아니었지만, **이번 장애의 주원인**은 아니었다. 이 순서를 잘못 잡으면 DNS 문제를 놔둔 채 SSH 키만 계속 바꾸는 미궁에 빠지기 쉽다.

## 7. 이번 트러블슈팅이 잘 풀린 이유

이번 해결 과정이 좋았던 이유는, 처음 보인 증상만 보고 결론 내리지 않았기 때문이다.

실제 흐름은 꽤 정석적이었다.

1. ArgoCD GUI에서 `Failed`를 확인했다.
2. `argocd-repo-server` 로그를 열었다.
3. `lookup github.com ... server misbehaving`를 잡아냈다.
4. Pod 내부에서 `/etc/resolv.conf`와 `getent hosts github.com`으로 이름 해석 상태를 확인했다.
5. CoreDNS Service와 ConfigMap을 확인해 `forward . /etc/resolv.conf` 구조를 이해했다.
6. k3s 쪽 nameserver 설정을 명시하고 CoreDNS를 재시작했다.
7. 다시 Pod 내부에서 `getent hosts github.com`을 실행해 결과를 검증했다.

결국 이번 해결은, **관찰 → 가설 → 계층 추적 → 설정 변경 → 재검증**이라는 평소의 습관이 빛을 발했기에 금방 고쳐졌다.

## 8. 이 트러블슈팅의 본질

이번 장애는 **ArgoCD repository connection failure로 보였지만, 실제로는 CoreDNS가 외부 도메인 질의를 전달하던 upstream resolver 체인이 잘못되어 `github.com`을 해석하지 못했던 DNS 경로 장애였다. k3s에서 nameserver 경로를 명시하고 CoreDNS를 재시작하면서 그 경로가 정상화됐고, 그 결과 repo-server의 GitHub 접근이 복구되었다.**


## 9. 교훈

첫째, **애플리케이션 에러 메시지는 종종 인프라 장애의 마지막 표현일 뿐**이다. ArgoCD는 실패를 보여줬지만, 실제로 망가진 건 GitOps가 아니라 DNS였다.

둘째, **쿠버네티스 DNS는 단일 컴포넌트가 아니라 연결된 체인**이다. Pod의 `/etc/resolv.conf`, `kube-dns` Service, CoreDNS Pod, Corefile, upstream resolver, 노드의 resolver 환경이 모두 이어져 있다.

셋째, **불안정한 로컬 resolver 체인에 클러스터 외부 통신의 안정성을 맡기면 안 된다.** 특히 k3s, 로컬 실습 환경, VPN, Tailscale, systemd-resolved가 뒤엉키는 환경에서는 `/etc/resolv.conf`가 생각보다 쉽게 복잡해진다. 그럴수록 `resolv-conf` 같은 설정으로 CoreDNS가 참고할 upstream을 명시적으로 통제하는 편이 훨씬 예측 가능하다.

## 배운 점

이번 해결은 단순히 repository 하나를 다시 연결한 것이 아닌, 사실상 **클러스터가 외부 세계를 바라보는 이름 해석 경로를 바로잡은 작업**에 가까웠던 것 같다.

그래서 영향 범위도 ArgoCD 하나로 끝나지 않는다. 앞으로 GitHub, 외부 API, 이미지 레지스트리, 패키지 서버처럼 클러스터가 의존하는 모든 외부 서비스 접근 안정성과 직접 연결된다.

겉으로는 작은 수정처럼 보일 수 있다. 하지만 구조적으로 보면 꽤 큰 정리였다. 이런 종류의 트러블슈팅을 몇 번 겪고나면, 더 이상 "앱이 실패했다"는 문장을 그대로 믿지 않고, 근본적인 설계 단계부터 의심하게 되는 것 같다.

결국 내가 생각하는, 오류 해결에서 가장 중요한 것은
**이 실패는 어느 계층의 그림자인가?**
라는 질문을 초기에 잘 정의하는 것이라 본다.
