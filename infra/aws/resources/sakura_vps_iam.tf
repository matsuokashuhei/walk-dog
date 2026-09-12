locals {
  sakura_vps_sqs_queue_arn = format(
    "arn:aws:sqs:%s:%s:%s",
    data.aws_region.current.name,
    data.aws_caller_identity.current.account_id,
    var.sakura_vps_sqs_queue_name,
  )
  sakura_vps_dynamodb_table_arn = format(
    "arn:aws:dynamodb:%s:%s:table/%s",
    data.aws_region.current.name,
    data.aws_caller_identity.current.account_id,
    var.sakura_vps_dynamodb_table_name,
  )
}

resource "aws_iam_user" "sakura_vps" {
  name = join("-", [var.project, "sakura-vps"])

  tags = {
    Project = var.project
  }
}

resource "aws_iam_user_policy" "sakura_vps" {
  name = "runtime-and-ecr-pull"
  user = aws_iam_user.sakura_vps.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "EcrAuth"
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = ["*"]
      },
      {
        Sid    = "EcrPull"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:BatchGetImage",
          "ecr:GetDownloadUrlForLayer",
        ]
        Resource = [aws_ecr_repository.api.arn]
      },
      {
        Sid    = "SqsTrackPoints"
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
        ]
        Resource = [local.sakura_vps_sqs_queue_arn]
      },
      {
        Sid    = "DynamoDbTrackPoints"
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:Query",
          "dynamodb:DescribeTable",
          "dynamodb:CreateTable",
        ]
        Resource = [local.sakura_vps_dynamodb_table_arn]
      },
      {
        Sid    = "CognitoAppClientAuth"
        Effect = "Allow"
        Action = [
          "cognito-idp:SignUp",
          "cognito-idp:ConfirmSignUp",
          "cognito-idp:ResendConfirmationCode",
          "cognito-idp:InitiateAuth",
          "cognito-idp:RespondToAuthChallenge",
          "cognito-idp:GlobalSignOut",
        ]
        Resource = [for pool in aws_cognito_user_pool.user : pool.arn]
      },
    ]
  })
}

resource "aws_iam_access_key" "sakura_vps" {
  user = aws_iam_user.sakura_vps.name
}
