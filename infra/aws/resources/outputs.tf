output "ecr_repository_url" {
  description = "URI for the API image repository (host/name)."
  value       = aws_ecr_repository.api.repository_url
}

output "github_actions_ecr_role_arn" {
  description = "IAM role ARN for the main publish workflow to push to ECR via OIDC."
  value       = aws_iam_role.github_actions_ecr.arn
}
