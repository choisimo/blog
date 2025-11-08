---
title: "Terraform로 AWS EC2 배포 실습"
date: "2025-01-10"
category: "DevOps"
tags: ["DevOps","Terraform","AWS","EC2","실습"]
excerpt: "VPC, Subnet, Security Group, EC2, User Data까지 포함한 AWS 웹 서버 인프라를 Terraform으로 단계별 구성."
author: "Admin"
published: true
---

# Terraform AWS EC2 실습

##  개요
실제 클라우드 리소스를 Terraform으로 프로비저닝하는 실습입니다. AWS EC2 인스턴스, VPC, Security Group을 생성합니다.

##  학습 목표
- AWS Provider 설정
- VPC 및 네트워크 리소스 생성
- EC2 인스턴스 배포 및 User Data 초기화
- SSH 접근 및 상태/비용 최적화

##  사전 준비: AWS CLI & 자격 증명
```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
aws --version
aws configure
```
입력 예:
```
AWS Access Key ID: YOUR_ACCESS_KEY
AWS Secret Access Key: YOUR_SECRET_KEY
Default region name: ap-northeast-2
Default output format: json
```

##  프로젝트 구조
```
02-aws-ec2/
├── main.tf
├── variables.tf
├── outputs.tf
├── terraform.tfvars
└── userdata.sh
```

##  variables.tf
```hcl
variable "aws_region" { type = string default = "ap-northeast-2" }
variable "instance_type" { type = string default = "t2.micro" }
variable "instance_name" { type = string default = "terraform-web-server" }
variable "allowed_ssh_ips" { type = list(string) default = ["0.0.0.0/0"] }
variable "key_name" { type = string }
```

##  main.tf (요약)
```hcl
terraform {
  required_version = ">= 1.0"
  required_providers { aws = { source = "hashicorp/aws" version = "~> 5.0" } }
}
provider "aws" { region = var.aws_region }

# VPC
resource "aws_vpc" "main" { cidr_block = "10.0.0.0/16" enable_dns_hostnames = true enable_dns_support = true tags = { Name = "terraform-vpc" } }

# Internet Gateway
resource "aws_internet_gateway" "main" { vpc_id = aws_vpc.main.id tags = { Name = "terraform-igw" } }

# Subnet
resource "aws_subnet" "public" { vpc_id = aws_vpc.main.id cidr_block = "10.0.1.0/24" availability_zone = "${var.aws_region}a" map_public_ip_on_launch = true tags = { Name = "terraform-public-subnet" } }

# Route Table + Association
resource "aws_route_table" "public" { vpc_id = aws_vpc.main.id route { cidr_block = "0.0.0.0/0" gateway_id = aws_internet_gateway.main.id } tags = { Name = "terraform-public-rt" } }
resource "aws_route_table_association" "public" { subnet_id = aws_subnet.public.id route_table_id = aws_route_table.public.id }

# Security Group
resource "aws_security_group" "web" {
  name = "terraform-web-sg" vpc_id = aws_vpc.main.id
  ingress { description = "SSH" from_port = 22 to_port = 22 protocol = "tcp" cidr_blocks = var.allowed_ssh_ips }
  ingress { description = "HTTP" from_port = 80 to_port = 80 protocol = "tcp" cidr_blocks = ["0.0.0.0/0"] }
  egress  { description = "All outbound" from_port = 0 to_port = 0 protocol = "-1" cidr_blocks = ["0.0.0.0/0"] }
  tags = { Name = "terraform-web-sg" }
}

# 최신 Fedora Cloud AMI 조회 (data source)
data "aws_ami" "fedora" {
  most_recent = true
  owners      = ["125523088429"] # Fedora Cloud (공식)
  filter { name = "name" values = ["Fedora-Cloud-Base-*.x86_64-*-HVM-*"] }
  filter { name = "virtualization-type" values = ["hvm"] }
}

# EC2 Instance + User Data
resource "aws_instance" "web" {
  ami                         = data.aws_ami.fedora.id
  instance_type               = var.instance_type
  key_name                    = var.key_name
  subnet_id                   = aws_subnet.public.id
  vpc_security_group_ids      = [aws_security_group.web.id]
  user_data = <<-EOF
              #!/bin/bash
              set -euxo pipefail
              dnf -y update
              dnf -y install nginx
              echo "<h1>Hello from Terraform (Fedora)!</h1>" > /usr/share/nginx/html/index.html
              systemctl enable --now nginx
              EOF
  tags = { Name = var.instance_name }
}
```

##  outputs.tf
```hcl
output "instance_id" { value = aws_instance.web.id }
output "instance_public_ip" { value = aws_instance.web.public_ip }
output "web_url" { value = "http://${aws_instance.web.public_ip}" }
output "ssh_command" { value = "ssh -i ~/.ssh/${var.key_name}.pem fedora@${aws_instance.web.public_ip}" }
```

##  terraform.tfvars 예시
```hcl
aws_region     = "ap-northeast-2"
instance_type  = "t2.micro"
instance_name  = "my-web-server"
key_name       = "my-key-pair"
```

##  배포 실행
```bash
terraform init
terraform plan -var="key_name=my-key-pair"
terraform apply -var="key_name=my-key-pair"
terraform output
```
출력 예:
```
instance_public_ip = "3.35.123.45"
web_url = "http://3.35.123.45"
ssh_command = "ssh -i ~/.ssh/my-key-pair.pem fedora@3.35.123.45"
```

##  접근 테스트
```bash
curl http://$(terraform output -raw instance_public_ip)
ssh -i ~/.ssh/my-key-pair.pem fedora@$(terraform output -raw instance_public_ip)
```

##  리소스 간 종속성 시각화
```
VPC → Internet Gateway → Subnet
                     ↓
Security Group ← EC2 Instance → Route Table
```
명시적 depends_on 필요 시:
```hcl
resource "aws_instance" "web" {
  depends_on = [aws_internet_gateway.main]
}
```

##  고급 패턴
- 다중 인스턴스 생성: `count`
- 조건부 생성: `count = var.create_instance ? 1 : 0`
- 동적 블록: Security Group ingress 규칙 반복 생성

##  비용 최적화 팁
1. 프리티어 인스턴스(t2.micro) 활용
2. 사용 후 즉시 `terraform destroy`
3. AWS Budgets 알림 설정
4. 지역 선택 비용 비교 (서울 vs 도쿄)

##  트러블슈팅
| 에러 | 원인 | 해결 |
|------|------|------|
| InvalidKeyPair.NotFound | 키 페어 미존재 | 콘솔에서 생성 후 이름 확인 |
| VpcLimitExceeded | VPC 수량 제한 | 사용 안 하는 VPC 정리 |
| SSH Connection refused | SG 규칙 또는 IP 오류 | 실제 공인 IP 확인 후 허용 CIDR 수정 |
| UnauthorizedOperation | IAM 권한 부족 | EC2FullAccess 임시 부여 후 최소 권한 재설계 |

##  인프라 업데이트 예시
```hcl
# terraform.tfvars
instance_type = "t3.small"
```
```bash
terraform plan
terraform apply
```

##  리소스 정리
```bash
terraform destroy
terraform destroy -target=aws_instance.web   # 특정 리소스만
```

##  다음 단계
- 상태 관리와 모듈화 (예정)
- 변수와 출력 고급 패턴 (예정)

##  참고 자료
- AWS Provider: https://registry.terraform.io/providers/hashicorp/aws
- AWS Free Tier: https://aws.amazon.com/free/
