output "ecr_repository_url" {
  description = "URI for the API image repository (host/name)."
  value       = aws_ecr_repository.api.repository_url
}

output "github_actions_ecr_role_arn" {
  description = "IAM role ARN for the main publish workflow to push to ECR via OIDC."
  value       = aws_iam_role.github_actions_ecr.arn
}

output "sakura_vps_iam_user_name" {
  description = "IAM user for Sakura VPS ECR pull and api/worker AWS calls."
  value       = aws_iam_user.sakura_vps.name
}

output "sakura_vps_aws_access_key_id" {
  description = "Access key id for the Sakura VPS IAM user. Put the same key in host AWS CLI and apps/.env.vps."
  value       = aws_iam_access_key.sakura_vps.id
}

output "sakura_vps_aws_secret_access_key" {
  description = "Secret access key for the Sakura VPS IAM user. Sensitive. Put the same key in host AWS CLI and apps/.env.vps."
  value       = aws_iam_access_key.sakura_vps.secret
  sensitive   = true
}
