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
  type    = string
}

variable "zone_id" {
  type    = string
}

variable "dkim_tokens" {
  type = set(string)
  validation {
    condition     = length(var.dkim_tokens) == 3
    error_message = "Amazon SES Easy DKIM must provide exactly three DKIM tokens."
  }
}

variable "verification_token" {
  type = string
  description = "aws ses verify-domain-identity --domain xxx"
}
