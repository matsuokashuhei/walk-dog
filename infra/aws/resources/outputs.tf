output "ecr_repository_url" {
  description = "URI for the API image repository (host/name), keyed by env."
  value = {
    for env, repo in aws_ecr_repository.api : env => repo.repository_url
  }
}

output "github_actions_ecr_role_arn" {
  description = "IAM role ARN for the main publish workflow to push to ECR via OIDC, keyed by env."
  value = {
    for env, role in aws_iam_role.github_actions_ecr : env => role.arn
  }
}

output "sakura_vps_iam_user_name" {
  description = "IAM user for Sakura VPS ECR pull and api/worker AWS calls, keyed by env."
  value = {
    for env, user in aws_iam_user.sakura_vps : env => user.name
  }
}

output "sakura_vps_aws_access_key_id" {
  description = "Access key id for the Sakura VPS IAM user, keyed by env. Put the same key in host AWS CLI and apps/.env.vps."
  value = {
    for env, key in aws_iam_access_key.sakura_vps : env => key.id
  }
}

output "sakura_vps_aws_secret_access_key" {
  description = "Secret access key for the Sakura VPS IAM user, keyed by env. Sensitive. Put the same key in host AWS CLI and apps/.env.vps."
  value = {
    for env, key in aws_iam_access_key.sakura_vps : env => key.secret
  }
  sensitive = true
}
