variable "project" {
  type    = string
  default = "walkdog"
}

variable "envs" {
  type = list(string)
}

variable "aws_region" {
  type    = string
  default = "ap-northeast-1"
}

variable "domain" {
  type = string
}

variable "github_org" {
  type    = string
  default = "matsuokashuhei"
}

variable "github_repo" {
  type    = string
  default = "walk-dog"
}
