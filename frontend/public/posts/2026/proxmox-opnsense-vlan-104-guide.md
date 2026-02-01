---
title: "Proxmox & OPNsense VLAN 추가 및 설정 가이드"
date: "2026-01-26"
category: "Guide"
tags: ["Proxmox", "OPNsense", "VLAN", "Network", "Virtualization"]
excerpt: "Proxmox VE에서 OPNsense VM에 새로운 가상 네트워크 인터페이스(vNIC)를 추가하고, VLAN 104 네트워크로 설정하는 단계별 가이드입니다."
readTime: "10분"
---

이 가이드는 **Proxmox VE**에서 **OPNsense VM**에 새로운 가상 네트워크 인터페이스(vNIC)를 추가하고, 이를 **VLAN 104** 네트워크로 설정하는 전체 과정을 다룹니다.

## 1부: Proxmox VE 설정 (하드웨어 추가)

가장 먼저 Proxmox 하이퍼바이저에서 물리적인 랜선을 하나 더 꽂는 것과 같은 작업을 수행합니다. 여기서 VLAN ID(104)를 지정하여 가상으로 분리된 네트워크를 연결합니다.

### 1단계: VM 하드웨어 메뉴 진입

1. Proxmox 관리자 페이지에 로그인합니다.
2. 좌측 트리 메뉴에서 **OPNsense VM** (예: `100 (OPNsense)`)을 선택합니다.
3. 중앙 패널에서 **Hardware** 탭을 클릭합니다.

### 2단계: 네트워크 장치 추가

1. 하드웨어 목록 상단의 **Add** 버튼을 클릭합니다.
2. 드롭다운 메뉴에서 **Network Device**를 선택합니다.

### 3단계: 장치 세부 설정 (중요)

팝업창에 다음 내용을 입력합니다.

*   **Bridge**: `vmbr0` (또는 물리 포트와 연결된 브리지 선택)
*   **VLAN Tag**: `104`
    *   > [!NOTE]
        > **핵심**: 여기에 `104`를 입력하면 Proxmox가 104번 태그가 붙은 패킷만 걸러서 이 랜카드로 보내줍니다. OPNsense 입장에서는 태그가 없는 순수한 패킷(Native)을 받게 됩니다.
*   **Model**: `VirtIO (paravirtualized)`
    *   성능이 가장 우수한 모델입니다. OPNsense에서 `vtnet` 장치로 인식됩니다.
*   **Mac Address**: (자동 생성됨, 건드리지 않음)
*   **Firewall**: **체크 해제 권장**
    *   OPNsense가 방화벽 역할을 하므로 Proxmox 단에서는 끄는 것이 관리하기 편합니다.

설정이 끝나면 **Add**를 눌러 저장합니다.

### 4단계: VM 재부팅

새로 추가된 PCI 장치(랜카드)를 OPNsense가 확실하게 인식하도록 VM을 재부팅합니다.

1. 우측 상단 **Reboot** 버튼 클릭
2. **Yes**를 눌러 확인

---

## 2부: OPNsense 설정 (소프트웨어 설정)

재부팅이 완료되면 OPNsense 웹 관리 페이지로 접속하여 새 인터페이스를 구성합니다.

### 1단계: 인터페이스 할당 (Assignments)

1. 메뉴: **Interfaces > Assignments**로 이동합니다.
2. 화면 하단 **New interface** 섹션을 확인합니다.
3. 드롭다운 목록에 새로 추가된 장치(예: `vtnet5` - 기존 장치 번호 다음 번호)가 보입니다.
4. **Description** 칸에 `VLAN104`라고 입력합니다.
5. 우측 **Add (+)** 버튼을 클릭합니다.
6. **Save**를 누릅니다.

### 2단계: IP 주소 및 활성화

1. 좌측 메뉴에 새로 생긴 **[VLAN104]** 메뉴를 클릭합니다.
2. **Enable Interface**: 체크
3. **IPv4 Configuration Type**: `Static IPv4` 선택
4. 스크롤을 내려 **Static IPv4 configuration** 항목을 작성합니다.
    *   **IPv4 Address**: `192.168.104.1` (이 네트워크의 게이트웨이 주소)
    *   **IPv4 Netmask**: `24` (`255.255.255.0`)
    *   **IPv4 Upstream Gateway**: `Auto` 또는 `None`
        *   > [!WARNING]
            > **주의**: 절대 설정하지 마세요. 이미 WAN에 게이트웨이가 존재하므로, 내부 네트워크 인터페이스에는 게이트웨이를 설정하면 안 됩니다.
5. **Save** 클릭 후 상단에 뜨는 **Apply Changes**를 클릭합니다.

### 3단계: DHCP 서버 설정 (IP 자동 할당)

연결된 기기들이 IP를 자동으로 받을 수 있게 설정합니다.

1. 메뉴: **Services > DHCPv4 > [VLAN104]**로 이동합니다.
2. **Enable DHCP server on VLAN104 interface**: 체크
3. **Range**:
    *   From: `192.168.104.100`
    *   To: `192.168.104.200`
4. **Save** 클릭.

### 4단계: 방화벽 규칙 (통신 허용)

기본적으로 모든 통신이 차단되어 있으므로, 인터넷이 되도록 규칙을 엽니다.

1. 메뉴: **Firewall > Rules > [VLAN104]**로 이동합니다.
2. 우측 상단 **Add (+)** 버튼 클릭.
3. 규칙 설정:
    *   **Action**: `Pass`
    *   **Interface**: `VLAN104`
    *   **Protocol**: `Any` (또는 TCP/UDP)
    *   **Source**: `VLAN104 net`
    *   **Destination**: `Any`
4. **Save** 클릭 후 **Apply Changes** 클릭.

---

## 3부: 연결 확인

이제 모든 설정이 완료되었습니다.

1. PC나 스위치의 포트를 VLAN 104로 설정하여 연결합니다.
2. IP 주소를 `192.168.104.xxx` 대역으로 할당받는지 확인합니다.
3. 인터넷(예: 구글 등)에 접속이 되는지 확인합니다.
