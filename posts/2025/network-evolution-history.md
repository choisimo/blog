---
title: '네트워크 발전의 역사: ARPANET에서 5G/6G까지'
description: '패킷 교환의 탄생부터 인터넷 표준화, 웹의 폭발적 성장, 모바일·클라우드·엣지, 그리고 5G/6G로 이어지는 네트워크 발전사를 핵심 이정표 중심으로 정리합니다.'
date: 2025-08-31
updated: 2025-08-31
tags:
  ['network', 'history', 'internet', '5G', '6G', 'protocols', 'architecture']
category: 'CS'
series: '네트워크 다시보기'
cover: '/images/covers/network-history.jpg'
readingTime: 10
---

네트워크 기술의 역사는 분산과 연결의 역사다. 하드웨어의 진보, 프로토콜의 표준화, 서비스의 확장, 보안 위협과의 공진화가 얽혀 오늘의 인터넷을 만들었다. 이 글은 핵심 전환점만 추려 빠르게 훑는다.

## 1) 회선 교환에서 패킷 교환으로: ARPANET의 탄생(1960s–1970s)

- 전화망은 회선 교환(circuit switching) 기반으로 전체 구간을 점유. 비효율적.
- 폴 바란, 도널드 데이비스가 제안한 패킷 교환(packet switching) 개념 등장.
- 1969년 ARPANET 가동: IMP(Interface Message Processor), NCP 프로토콜.
- 1974년 Cerf & Kahn의 TCP 초기 제안. “인터네트워킹” 개념 확립.

## 2) TCP/IP 표준화와 인터넷의 탄생(1980s)

- 1983-01-01 ‘Flag Day’: ARPANET이 NCP→TCP/IP 전환.
- IP 라우팅, 자율시스템(AS), BGP 전신(EGP) 도입으로 상호연결 확장.
- DNS(1983)로 호스트 파일의 한계 극복. 도메인 네임 체계 확립.

## 3) 웹과 상용화의 폭발(1990s)

- 1991–1993: WWW(HTTP/HTML/URL), 브라우저 모자이크/넷스케이프.
- 상용 ISP 확산, BGP-4(1994)로 CIDR/경로 벡터 안정화, 백본 성장.
- 이더넷 스위칭/LAN의 보급, 802.11 Wi‑Fi(1997) 등장.

## 4) 광대역, 모바일, 콘텐츠 전송(2000s)

- ADSL/Cable로 가정 광대역. 데이터센터/IDC 확장.
- 모바일 3G(UMTS/CDMA2000)로 데이터 중심 전환, 스마트폰 전야.
- CDN(Akamai 등)과 캐싱, Anycast, Peering 전략 고도화.
- 보안: NAT 대중화, 방화벽/IPS, SSL 전자상거래 보편화.

## 5) 클라우드 네이티브와 모바일 인터넷(2010s)

- IaaS/PaaS/SaaS 대중화, SDN/NFV로 제어/데이터 분리.
- 4G LTE로 모바일 대역폭/지연 개선, 앱 생태계 폭발.
- IPv6 상용화 확산, QUIC/HTTP/2로 전송 계층 혁신.
- Zero Trust, TLS Everywhere, DDoS 대응(스크러빙, Anycast) 체계화.

## 6) 초저지연·대규모 연결의 시대: 5G와 그 다음(2020s–)

- 5G: eMBB/URLLC/mMTC로 사용례 분화, 네트워크 슬라이싱.
- 엣지 컴퓨팅로 지연 감소, 산업용 사설 5G.
- 클라우드 WAN, SASE, 서비스형 네트워킹(NaaS) 부상.
- DNS over HTTPS/QUIC, Encrypted SNI(ESNI/ECH)로 프라이버시 강화.

## 7) 6G를 향한 시나리오(2030s 가정)

- 서브테라헤르츠/THz, RIS(Reconfigurable Intelligent Surface).
- AI‑Native 네트워크(자율 최적화/Healing), 디지털 트윈 기반 계획/운영.
- 통신·센싱·컴퓨팅 융합(JCS), 초정밀 위치/센싱 통합.

## 핵심 프로토콜/기술 타임라인(간단 버전)

- 1969 ARPANET, 1974 TCP, 1983 TCP/IP 전환, 1983 DNS
- 1989–1991 WWW 구상/공개, 1994 BGP-4, 1997 Wi‑Fi
- 2003 IPv6 상용 시동, 2004 TLS 1.0 확산, 2009 CDNs 대중화
- 2012 SDN(ONF/OpenFlow), 2013–2016 HTTP/2, 2016– QUIC, 2019 5G 상용

## 오늘의 설계 관점에서 본 교훈

- 단순성+확장성: IP의 최소 공통분모가 글로벌 상호연결을 가능케 했다.
- End-to-End 원칙과 약한 상태 유지가 진화를 가속.
- 표준과 구현의 공진화: 오픈 표준, 오픈 소스가 네트워크 혁신의 토대.
- 지연/변동성/장애를 전제로 설계할 것. 캐시, 재시도, 백오프, 애니캐스트, 멀티패스.

## 참고

- Cerf & Kahn, “A Protocol for Packet Network Intercommunication” (1974)
- RFC 791(IP), RFC 793(TCP), RFC 1034/1035(DNS), RFC 4271(BGP-4)
- 3GPP 5G 사양, IETF QUIC/HTTP WG 문서
