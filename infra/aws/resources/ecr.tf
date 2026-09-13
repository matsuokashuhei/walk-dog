resource "aws_ecr_repository" "api" {
  for_each = toset(var.envs)
  name                 = join("-", [var.project, each.key, "api"])
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Project = join("-", [var.project, each.key])
  }
}
