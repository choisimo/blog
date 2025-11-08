---
title: "Terraform 상태 관리와 모듈화"
date: "2025-02-03"
category: "DevOps"
tags: ["DevOps","Terraform","State","Module"]
excerpt: "Terraform state 원격 백엔드, 잠금(lock), drift 감지, 워크스페이스 전략과 모듈화 베스트 프랙티스를 손에 잡히게 정리합니다."
author: "Admin"
published: true
---

Terraform는 선언형 IaC 도구이지만, 실제 인프라의 현재 상태를 추적해야 원하는 변경만 안전하게 반영할 수 있습니다. 이 글은 Terraform의 상태(state) 관리와 모듈화 전략을 실무 관점에서 정리합니다.

## 왜 state가 필요한가
- 변경 최소화: 현재 상태를 알고 있어야 차이만 계획(plan)하고 적용(apply)합니다.
- 병렬 안전성: 여러 사람이 동시에 작업할 때 잠금(lock)으로 충돌을 방지합니다.
- drift 감지: 코드와 실제 인프라의 불일치를 탐지합니다.

## 로컬 vs 원격 state
- 로컬: 기본값. 팀 협업, 잠금, 백업에 취약합니다.
- 원격(권장): S3/DynamoDB, GCS, Azure Blob 등. 버전 관리와 잠금 제공.

예: AWS S3 + DynamoDB 백엔드 설정 (루트 모듈에서만 설정)

```hcl
terraform {
  backend "s3" {
    bucket         = "my-tf-state-bucket"
    key            = "prod/network/terraform.tfstate" # 워크스페이스/스택별로 키 분리
    region         = "ap-northeast-2"
    dynamodb_table = "my-tf-locks"
    encrypt        = true
  }
}
```

베스트 프랙티스
- 루트 모듈에서만 backend를 정의하고, 모듈 내부에서는 절대 정의하지 않습니다.
- 버킷 버저닝/암호화/KMS, 최소 권한 버킷 정책을 적용합니다.
- 키(key) 네이밍을 환경/스택/컴포넌트 단위로 일관되게 관리합니다.

## 상태 파일 보안과 민감정보
- state에는 리소스 속성(암호/시크릿 포함 가능)이 저장됩니다.
- 가능하면 시크릿은 외부 비밀관리(SSM Parameter Store, Secrets Manager 등)를 사용하고, 값은 data 소스로 참조합니다.
- `terraform state pull`/`show` 결과를 저장소에 커밋하지 않습니다.

## Drift 감지와 점검 루틴
- `terraform plan -refresh-only`: 실제와 상태를 동기화하는 변경만 제안합니다.
- `terraform validate` + `tflint` (선택)로 정적 점검을 선행합니다.
- `terraform state list`/`show`로 특정 리소스 추적이 가능합니다.

## 상태 이동/정리 명령어 핵심
- 리소스 주소 변경: 리팩터링 시
  ```bash
  terraform state mv aws_security_group.web module.vpc.aws_security_group.web
  ```
- 잘못 추적된 리소스 제거(실제 삭제 아님):
  ```bash
  terraform state rm aws_s3_bucket.temp
  ```
- 부분 교체 적용(taint 대체):
  ```bash
  terraform apply -replace=aws_instance.web
  ```

## 워크스페이스 전략
워크스페이스는 동일한 코드로 경량 환경 분기를 제공합니다.

```bash
terraform workspace new dev
terraform workspace select dev
terraform workspace list
```

언제 쓸까?
- 동일 스택을 소규모 환경(dev/stage)으로 빠르게 분기할 때 적합.
- 대규모/격리 요구가 크면 디렉터리 분리 또는 별도 스택(리포지토리)로 관리하는 것이 안전합니다.

## 모듈화의 목적
- 재사용/표준화: 보안/태깅/로깅 등 공통 정책을 캡슐화.
- 경계 명확화: 입력 변수, 출력 값으로 명세화.
- 변경 영향 축소: 모듈 버저닝으로 점진적 배포.

### 모듈 구조 예시
디렉터리 레이아웃(모듈 repo 또는 `modules/` 폴더):

```
modules/
  vpc/
    main.tf
    variables.tf
    outputs.tf
```

`modules/vpc/variables.tf`
```hcl
variable "name" { type = string }
variable "cidr_block" { type = string }
variable "tags" {
  type    = map(string)
  default = {}
}
```

`modules/vpc/main.tf`
```hcl
resource "aws_vpc" "this" {
  cidr_block           = var.cidr_block
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags = merge({ Name = var.name }, var.tags)
}
```

`modules/vpc/outputs.tf`
```hcl
output "vpc_id" { value = aws_vpc.this.id }
```

루트 모듈 사용 예시
```hcl
module "vpc" {
  source     = "./modules/vpc"
  name       = "prod-main"
  cidr_block = "10.0.0.0/16"
  tags = {
    Project = "core"
    Env     = "prod"
  }
}
```

베스트 프랙티스
- 모듈 입력은 최소/명시적으로, 출력은 소비자가 필요한 것만 제공합니다.
- 기본값을 과도하게 넣지 말고, 필수 값은 명확하게 요구합니다.
- 레지스트리/깃 소스 사용 시 버전 pinning(`?ref=v1.2.3`)으로 재현성을 확보합니다.

## 폴더 전략과 상태 키 네이밍
- 예시 레이아웃
```
live/
  prod/
    network/
    compute/
  stage/
    network/
modules/
  vpc/
  ecs-service/
```
- 백엔드 키 예: `prod/network/terraform.tfstate`, `stage/network/terraform.tfstate`
- CI에서 워크스페이스/디렉터리/변수를 조합해 일관된 배포 파이프라인을 구성합니다.

## 로컬 → 원격 백엔드 마이그레이션
1) 루트 모듈에 backend 블록 추가
2) `terraform init -migrate-state` 실행하여 기존 상태를 이동
3) 원격 백엔드에서 잠금/버저닝이 동작하는지 확인

문제 해결 팁
- 잠금 충돌: `-lock-timeout=5m` 옵션 사용 또는 DynamoDB 항목 확인 후 해제
- 권한 오류: S3 PutObject/GetObject, DynamoDB GetItem/PutItem/UpdateItem 권한 점검

## 체크리스트
- [ ] 루트 모듈에서만 backend 정의했는가?
- [ ] 키 네이밍이 환경/스택별로 일관적인가?
- [ ] 시크릿은 외부에서 주입하고 state 노출을 최소화하는가?
- [ ] plan/validate/lint가 CI에 포함되어 있는가?
- [ ] 모듈 버전이 고정되어 있는가?

## 마무리
견고한 상태 관리와 모듈화는 팀 규모가 커질수록 가치가 커집니다. 백엔드/잠금/키 전략을 표준화하고, 모듈 경계를 명확히 하여 안전하고 예측 가능한 IaC 운영 기반을 마련하세요.
