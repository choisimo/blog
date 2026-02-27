---
title: "Terraform 기본 설정과 첫 리소스"
date: "2025-01-09"
category: "DevOps"
tags: ["DevOps","Terraform","IaC","초급","실습"]
excerpt: "Terraform 설치부터 첫 local_file 리소스 생성까지 필수 워크플로우(init, plan, apply, destroy)를 단계별로 정리."
author: "Admin"
published: true
---

# Terraform 기본 설정

##  개요

Terraform은 HashiCorp Configuration Language(HCL)를 사용하여 인프라를 코드로 정의하는 IaC 도구입니다.

##  학습 목표
- Terraform 설치 및 기본 구조 이해
- 첫 번째 리소스 생성
- Terraform 워크플로우 (init, plan, apply, destroy) 실습

##  설치

### Linux/macOS
```bash
wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
unzip terraform_1.6.0_linux_amd64.zip
sudo mv terraform /usr/local/bin/
terraform --version
```

### Windows (Chocolatey)
```powershell
choco install terraform
```

## ️ 기본 프로젝트 구조
```
project/
├── main.tf          # 주요 리소스 정의
├── variables.tf     # 변수 선언
├── outputs.tf       # 출력 값 정의
├── terraform.tfvars # 변수 값 설정
└── .terraform/      # 플러그인 & 상태 (자동 생성)
```

## ️ 첫 번째 예제: local_file 리소스 생성

`examples/01-local-file/main.tf`:
```hcl
terraform {
  required_version = ">= 1.0"
  required_providers {
    local = {
      source  = "hashicorp/local"
      version = "~> 2.0"
    }
  }
}

resource "local_file" "hello" {
  filename = "${path.module}/hello.txt"
  content  = "Hello, Terraform!"
}

resource "local_file" "multiple" {
  count    = 3
  filename = "${path.module}/file-${count.index}.txt"
  content  = "This is file number ${count.index}"
}
```

### 초기화
```bash
cd examples/01-local-file
terraform init
```

### 실행 계획 확인
```bash
terraform plan
```

### 적용
```bash
terraform apply
```

### 상태 및 리소스 확인
```bash
terraform show
terraform state list
terraform state show local_file.hello
```

### 제거
```bash
terraform destroy
```

##  핵심 개념

### Provider (프로바이더)
Terraform이 인프라와 상호작용하도록 하는 플러그인.
```hcl
provider "aws" { region = "us-east-1" }
provider "azurerm" { features {} }
```

### Resource (리소스)
생성/관리할 인프라 구성 요소.
```hcl
resource "리소스타입" "이름" {
  argument1 = "value1"
}
```

### Data Source (데이터 소스)
기존 리소스 정보 조회.
```hcl
data "local_file" "existing" { filename = "/path/file.txt" }
output "file_content" { value = data.local_file.existing.content }
```

##  Terraform 워크플로우 요약
```
1. Write
2. terraform init
3. terraform plan
4. terraform apply
5. terraform destroy
```

| 명령어 | 설명 | 사용 시점 |
|--------|------|-----------|
| `terraform init` | 플러그인 다운로드, 백엔드 초기화 | 시작/프로바이더 추가 |
| `terraform plan` | 변경 사항 미리보기 | 적용 전 검증 |
| `terraform apply` | 실제 리소스 생성/변경/삭제 | 인프라 변경 시 |
| `terraform destroy` | 모든 리소스 삭제 | 테스트 환경 정리 |
| `terraform fmt` | 코드 포맷팅 | 정리 |
| `terraform validate` | 구문 검증 | 오류 체크 |

##  실습 과제

### 과제 1: 디렉토리 구조 생성
```
output/
├── logs/
│   ├── app.log
│   └── error.log
└── data/
    └── config.json
```

힌트:
```hcl
resource "local_file" "app_log" {
  filename = "${path.module}/output/logs/app.log"
  content  = "Application started at ${timestamp()}"
}
```

### 과제 2: 변수 활용
```hcl
variable "file_content" { type = string default = "Default content" }
resource "local_file" "dynamic" { filename = "${path.module}/dynamic.txt" content = var.file_content }
```
실행:
```bash
terraform apply -var="file_content=Custom message"
```

##  트러블슈팅
| 문제 | 원인 | 해결 |
|------|------|------|
| `terraform: command not found` | PATH 미설정 | PATH에 /usr/local/bin 추가 |
| Provider init failed | 네트워크 문제 | `.terraform` 삭제 후 재 init |
| State lock 에러 | 다른 프로세스 실행 중 | `terraform force-unlock <LOCK_ID>` |

##  참고 자료
- Terraform 공식 문서: https://developer.hashicorp.com/terraform/docs
- Registry: https://registry.terraform.io/
- HCL 문법: https://developer.hashicorp.com/terraform/language/syntax

## ▶ 다음 단계
- [AWS EC2 실습 예제](terraform-02-aws-ec2-example.md)
- 상태 관리와 모듈화 (예정)
