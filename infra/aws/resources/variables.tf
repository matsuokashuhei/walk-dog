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

variable "sakura_vps_sqs_queue_name" {
  type        = string
  description = "SQS queue name used by api/worker on Sakura VPS (URL path suffix)."
  default     = "track-points"
}

variable "sakura_vps_dynamodb_table_name" {
  type        = string
  description = "DynamoDB table name used by api/worker on Sakura VPS."
  default     = "TrackPoints"
}
