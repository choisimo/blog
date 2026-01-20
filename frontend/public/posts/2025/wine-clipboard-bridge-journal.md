---
title: "Wayland 위에서 Wine 카카오톡이 복붙을 잃어버린 날"
date: "2025-10-31"
category: "Linux"
tags: ['Wine','Wayland','클립보드','Hyprland','wl-clipboard']
excerpt: "EndeavourOS에서 Wine 카카오톡과 호스트 사이 복붙이 끊겼던 사건을 기록하며, 왜 그런지 그리고 어떻게 우회했는지 정리했다."
readTime: "8분"
---


![1768909026526](image/wine-clipboard-bridge-journal/1768909026526.png)

EndeavourOS를 설치한 뒤 메신저 세팅까지 마쳤을 때만 해도 마음이 한결 가벼웠다. 그런데 금요일 오전, 카카오톡 창에서 복사한 문장을 호스트 쪽 에디터로 붙여넣는 순간 텍스트가 사라져 버렸다. 반대로 리눅스에서 복사한 주소를 Wine 속 카카오톡 입력창에 붙여넣으면 텔레파시처럼 조용히 실패했다. “같은 창 안에서는 잘 되는데 왜 바깥으로 나오면 말을 안 듣지?” 이상하게도 Wine 안에서는 복붙이 멀쩡했기에 더 혼란스러웠다.

먼저 의심한 건 쓰고 있는 Hyprland와 Wayland 조합이었다. 예전에 Xorg를 쓸 때는 이런 문제가 없었는데, Wayland로 넘어오면서 클립보드 인프라가 확 달라졌다는 이야기를 들었기 때문이다. X11에는 PRIMARY, CLIPBOARD 같은 선택 버퍼가 따로 있고, 프로그램이 종료되면 클립보드 소유자가 사라지는 구조라 매니저가 없으면 내용이 비어버린다. Wayland에서는 이 역할을 컴포지터가 맡는데, XWayland 앱과 네이티브 Wayland 앱 사이에는 여전히 브리지 계층이 필요하다. Wine은 Windows의 클립보드를 Linux 선택 시스템에 매핑해야 하고, 이 과정에서 Wayland 지원은 비교적 최근 버전까지 계속 손봐 왔다.

Reddit을 조금 뒤져 보니 Hyprland에서 XWayland와 Wayland 사이 클립보드 동기화가 깨진다는 보고가 여럿 있었다. KDE Plasma 6.5에서도 Wine이나 Proton 앱에 붙여넣기가 안 된다는 사례가 눈에 띄었다. 결국 KakaoTalk의 문제가 아니라 내 컴포지터와 Wine Wayland 드라이버의 조합이 서로 말을 안 섞는 것이었다. 특히 Wine 10.3 즈음에서 Wayland 드라이버가 wl_data_device 경로를 통해 클립보드를 다루기 시작했다는 릴리스 노트가 있는데, 그 이전 버전이나 특정 Proton 빌드에서는 CLIPBOARD 전송이 아예 빠져 있을 수 있다는 얘기도 들려왔다.

가만히 있을 수 없으니 직접 확인해 보기로 했다. `wine --backtrace` 대신 클립보드 트레이스를 켜서 로그를 뜯어보면 어느 지점에서 형식이 끊어지는지 볼 수 있다기에, `WINEDEBUG=clipboard` 환경 변수를 걸고 KakaoTalk에서 복사를 해봤다. 로그에는 Windows API 단계에서 CLIPBOARD를 잡았다는 메시지가 보였지만, 호스트 쪽에는 전달되지 않았다. 이때 깨달았다. 브리지 계층을 중간에서 대신 동기화해 주면 어떨까?

마침 EndeavourOS 커뮤니티 글에서 Wayland↔X11 클립보드 브릿지를 띄우면 문제를 우회할 수 있다는 팁을 찾았다. `wl-clipboard`와 `xclip`을 설치한 다음 다음 명령을 백그라운드로 돌리는 방식이었다.

```bash
wl-paste -t text -w xclip -selection clipboard
```

이 명령은 Wayland에서 텍스트를 복사하면 그 내용을 X클립보드(CLIPBOARD)에 전달하고, Wine(XWayland) 쪽이 이를 읽어갈 수 있게 해 준다. 반대로 역방향 브리지를 위해서는 `xclip -selection clipboard -o | wl-copy` 같은 파이프를 만들어 두면 리눅스 → Wine 방향도 연결된다. 이 방식은 임시방편이지만, 그날 당장 메신저에서 주소를 복사해 브라우저에 붙여넣어야 했던 나는 한숨 돌릴 수 있었다.

다만 처음에는 이 명령이 통하지 않았다. 터미널에 `XDG_RUNTIME_DIR is invalid or not set` 같은 메시지가 뜨고, `Failed to connect to a Wayland server`라는 경고가 연달아 나왔다. 원인은 간단했다. 아마 습관처럼 `sudo`를 붙여 실행했기에, 루트 환경에서는 Wayland 세션 정보(`XDG_RUNTIME_DIR`, `WAYLAND_DISPLAY`)가 비어 있기 때문이다. 결국 브리지는 루트 권한이 아니라, Wayland 세션을 열고 있는 사용자 계정으로 실행해야 한다. 다시 말해 데스크톱에서 바로 터미널을 켜고, `sudo` 없이 `wl-paste`를 띄우면 문제가 사라진다. 꼭 권한 상승이 필요하다면 `sudo -E`로 환경 변수를 넘기거나, 아예 `systemd --user` 서비스로 등록해 로그인할 때 자동 실행되도록 하는 편이 훨씬 안정적이다.

또 하나 배운 점은, TTY로 빠져나온 상태나 SSH 세션에서는 Wayland 소켓이 열려 있지 않기 때문에 브리지가 실패할 수 있다는 사실이다. 그런 환경에서는 우회 스크립트를 띄우기 전에 `echo $XDG_RUNTIME_DIR`, `echo $WAYLAND_DISPLAY`를 확인해 보고, 값이 비어 있다면 데스크톱 세션 안으로 들어가 다시 시도해야 한다. 작은 습관 하나만 바꿨을 뿐인데, 그 뒤로는 더 이상 같은 오류를 보지 않았다.

여기에 한 가지 함정이 더 있었다. `wl-paste`의 `-w/--watch` 모드는 `zwlr_data_control_manager_v1`이라는 wlroots 확장 프로토콜이 있어야 동작한다. 지원하지 않는 컴포지터에서는 “Watch mode requires a compositor that supports the wlroots data-control protocol”이라는 메시지만 남기고 즉시 종료된다. `wayland-info | grep data_control`로 해당 프로토콜이 노출되는지 확인해 보고, Hyprland·sway 같은 wlroots 계열이라면 최신 버전으로 업데이트하거나 설정 파일에서 data-control을 비활성화하지 않았는지 점검해야 한다. GNOME이나 KDE Plasma처럼 아직 data-control을 제공하지 않는 환경에서는 이 방식이 근본적으로 불가능하므로, 대신 `wl-paste --type text | xclip -selection clipboard`를 짧은 간격으로 반복 실행하는 간단한 스크립트나 `cliphist`, `wl-clipboard-rs` 같은 별도 브리지 도구를 사용하는 편이 낫다.

물론 임시 브리지를 계속 켜 두는 것이 불편하다면 환경 자체를 손보는 편이 낫다. 나는 먼저 Wine을 최신 버전으로 올려서 Wayland 드라이버 패치를 받은 다음, Hyprland의 최신 릴리스를 적용했다. 그래도 완벽하지 않을 때는 Xorg 세션으로 잠시 갈아타서 테스트해 보는 것도 좋은 진단법이다. Xorg에서는 기존처럼 X11 선택 기능이 그대로 동작하니 문제가 사라진다면 Wayland 계층의 책임이 확실해진다. 또 GNOME이나 Plasma에서 기본으로 제공하는 클립보드 매니저(예: Klipper, gnome-shell-extension clipboard indicator)를 켜두면 CLIPBOARD가 프로그램 종료 후에도 유지돼서 일부 문제를 완화하기도 했다.

재미있었던 점은, 동일한 Wine 환경 안에서 다른 Windows 프로그램끼리는 복붙이 잘 된다는 것이었다. KakaoTalk과 메모장 사이, 프로토콜 뷰어와 브라우저 사이에서는 아무 일 없다는 듯 데이터가 오갔다. 이것만으로도 “브리지 구간”에서 문제가 생겼다는 추정을 확신할 수 있었다. 실제로 Wine 개발자 포럼에서도 Wayland 드라이버가 호스트와 데이터를 주고받는 계층이 가장 민감하다고 언급하고 있었다.

몇 시간의 시행착오를 지나 작은 체크리스트를 갖게 되었다. 호스트 ↔ Wine 복붙이 안 될 때는 가장 먼저 Wine 버전을 확인하고, 컴포지터 업데이트 여부를 살핀다. 필요하다면 위 브리지 스크립트를 구동해 놓고, `wl-paste`, `wl-copy`, `xclip` 같은 도구가 있는지 점검한다. 그리고 여전히 문제가 계속되면 Xorg 세션으로 부팅해 보고, 거기서도 문제라면 Wine 로그를 추적한다. 이상하게 들릴지 몰라도, 이런 루틴을 갖춘 뒤로는 복붙이 끊겨도 당황하지 않게 되었다.

마지막으로, 이 글을 읽는 분들께도 조심스럽게 권하고 싶은 건 “당분간 X세상과 Wayland 사이를 이어주는 임시 다리”를 하나 정도는 준비해 두자는 것이다. 완벽한 해결은 언젠가 더 다듬어진 Wine Wayland 드라이버와 컴포지터 업데이트가 가져다주겠지만, 오늘도 KakaoTalk에서 복사한 메시지를 리눅스 메모 앱에 붙여넣어야 하는 우리는 현실적인 우회로가 필요하니까. 언젠가 이 글을 다시 읽으며 “그땐 이런 브리지가 필요했지” 하고 웃을 수 있기를 바라며, 오늘도 `wl-paste`와 `xclip`이 곁을 지켜 주길 기대해 본다.
