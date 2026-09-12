resource "aws_ecr_repository" "api" {
  name                 = join("-", [var.project, "api"])
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Project = var.project
  }
}
