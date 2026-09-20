resource "aws_sqs_queue" "track_points" {
  name = var.sakura_vps_sqs_queue_name

  tags = {
    Project = var.project
  }
}
