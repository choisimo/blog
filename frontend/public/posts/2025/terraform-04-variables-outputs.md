---
title: "Terraform 변수와 출력 고급 패턴"
date: "2025-02-04"
category: "DevOps"
tags: ["DevOps","Terraform","Variables","Outputs"]
excerpt: "변수 타입/검증, locals, dynamic/for_each, map/object, 민감정보, 출력 패턴까지 실무형 레시피로 정리합니다."
author: "Admin"
published: true
---

Terraform 변수와 출력은 모듈 경계를 정의하고 재사용성을 높이는 핵심 요소입니다. 이 글은 실무에서 자주 쓰는 변수/locals/출력 패턴을 간단한 예제와 함께 소개합니다.

## 변수 타입과 검증
`variables.tf`
```hcl
variable "name" {
  type        = string
  description = "리소스 식별용 이름"
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "공통 태그"
}

variable "subnets" {
  type        = list(object({
    name = string
    cidr = string
    az   = string
  }))
  description = "서브넷 목록"
}

variable "replicas" {
  type        = number
  default     = 2
  validation {
    condition     = var.replicas >= 1 && var.replicas <= 10
    error_message = "replicas must be between 1 and 10"
  }
}
```

- 타입을 명시하면 계획/검증 단계에서 오류를 빠르게 발견합니다.
- `validation` 블록으로 범위/형식 조건을 강제합니다.

## locals로 의도 드러내기
`locals`는 계산값/표준화를 캡슐화합니다.
```hcl
locals {
  base_tags = merge({
    ManagedBy = "terraform"
    Project   = "core"
  }, var.tags)

  subnet_tags = { for s in var.subnets : s.name => {
    Name = s.name
    AZ   = s.az
  }}
}
```
- `locals.base_tags`로 모든 리소스에 공통 태그 적용
- 파생 데이터(`subnet_tags`)를 맵으로 재구성해 참조를 단순화

## for_each와 dynamic 블록
반복 리소스 작성 시 핵심 도구입니다.

```hcl
resource "aws_subnet" "this" {
  for_each          = { for s in var.subnets : s.name => s }
  vpc_id            = aws_vpc.this.id
  cidr_block        = each.value.cidr
  availability_zone = each.value.az
  tags = merge(local.base_tags, {
    Name = each.value.name
  })
}
```

Security Group 예: 인바운드 규칙을 변수로 정의하고 동적으로 생성
```hcl
variable "ingress_rules" {
  type = list(object({
    port     = number
    protocol = string
    cidrs    = list(string)
  }))
  default = [
    { port = 22,  protocol = "tcp", cidrs = ["0.0.0.0/0"] },
    { port = 443, protocol = "tcp", cidrs = ["0.0.0.0/0"] },
  ]
}

resource "aws_security_group" "web" {
  name        = "web-sg"
  description = "Web SG"
  vpc_id      = aws_vpc.this.id

  dynamic "ingress" {
    for_each = var.ingress_rules
    content {
      from_port   = ingress.value.port
      to_port     = ingress.value.port
      protocol    = ingress.value.protocol
      cidr_blocks = ingress.value.cidrs
    }
  }
}
```

## 조건부/병합 패턴
- 삼항 연산식
  ```hcl
  count = var.enable_nat ? 1 : 0
  ```
- 맵 병합으로 선택적 값 적용
  ```hcl
  tags = merge(local.base_tags, (var.extra_tag != null ? { Extra = var.extra_tag } : {}))
  ```

## 민감정보 다루기
- 입력 변수: `sensitive = true`로 계획 출력에서 마스킹
  ```hcl
  variable "db_password" {
    type      = string
    sensitive = true
  }
  ```
- 출력 값: `sensitive = true`로 마스킹
  ```hcl
  output "db_password" {
    value     = var.db_password
    sensitive = true
  }
  ```
- 가능하면 외부 비밀관리(SSM/Secrets Manager/Key Vault)를 사용하고 `data` 소스 참조를 권장

## 출력(outputs) 패턴
`outputs.tf`
```hcl
output "vpc_id" {
  description = "생성된 VPC ID"
  value       = aws_vpc.this.id
}

output "subnet_ids" {
  description = "서브넷 ID 목록 (가용영역별)"
  value       = [for s in aws_subnet.this : s.id]
}

output "subnet_map" {
  description = "서브넷 이름→ID 매핑"
  value       = { for k, s in aws_subnet.this : k => s.id }
}

output "sg_rule_summary" {
  description = "보안그룹 규칙 요약"
  value       = join(", ", [for r in var.ingress_rules : "${r.protocol}:${r.port}"])
}
```
- 소비자 관점에서 바로 사용 가능한 형태로 가공합니다.
- 리스트/맵 변환으로 참조를 단순화합니다.

## 모듈 간 전달 베스트 프랙티스
- 입력은 필수/선택을 명확히, 기본값 남발 금지
- 출력은 실제로 필요한 최소 데이터만 노출
- 모듈 소스 버전 고정(`?ref=vX.Y.Z` 또는 레지스트리 `~> 1.2`)
- 크로스 모듈 의존은 출력→입력으로 느슨하게 연결

## 예시: 네트워크 모듈 출력 → 앱 모듈 입력
루트 모듈
```hcl
module "network" {
  source     = "./modules/network"
  name       = "prod"
  subnets    = [
    { name = "a", cidr = "10.0.1.0/24", az = "ap-northeast-2a" },
    { name = "c", cidr = "10.0.2.0/24", az = "ap-northeast-2c" },
  ]
}

module "app" {
  source      = "./modules/app"
  vpc_id      = module.network.vpc_id
  subnet_ids  = module.network.subnet_ids
  common_tags = module.network.common_tags
}
```

`modules/network/outputs.tf`
```hcl
output "common_tags" {
  value = local.base_tags
}
```

## 체크리스트
- [ ] 변수 타입/검증이 정의되어 있는가?
- [ ] locals로 파생 데이터를 캡슐화했는가?
- [ ] 반복은 for_each/dynamic으로 선언적으로 표현했는가?
- [ ] 민감정보는 sensitive/외부 비밀관리로 보호되는가?
- [ ] 출력은 소비자 친화적으로 가공되었는가?

## 마무리
명확한 변수/출력 계약과 locals 정리는 모듈 재사용성을 극대화합니다. 작은 규칙의 일관성이 대규모 IaC 코드베이스의 유지보수성을 좌우합니다.
