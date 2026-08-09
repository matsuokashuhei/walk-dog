data "archive_file" "custom_message" {
  type        = "zip"
  source_dir  = "${path.module}/lambda/custom_message"
  output_path = "${path.module}/lambda/custom_message.zip"
}

resource "aws_iam_role" "custom_message" {
  for_each = toset(var.envs)
  name     = join("-", [var.project, each.key, "custom-message"])

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "custom_message" {
  for_each   = toset(var.envs)
  role       = aws_iam_role.custom_message[each.key].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_cloudwatch_log_group" "custom_message" {
  for_each          = toset(var.envs)
  name              = "/aws/lambda/${join("-", [var.project, each.key, "custom-message"])}"
  retention_in_days = 14
}

resource "aws_lambda_function" "custom_message" {
  for_each         = toset(var.envs)
  function_name    = join("-", [var.project, each.key, "custom-message"])
  role             = aws_iam_role.custom_message[each.key].arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  filename         = data.archive_file.custom_message.output_path
  source_code_hash = data.archive_file.custom_message.output_base64sha256
  timeout          = 10

  depends_on = [
    aws_cloudwatch_log_group.custom_message,
    aws_iam_role_policy_attachment.custom_message,
  ]

  tags = {
    Environment = each.key
    Project     = var.project
  }
}

resource "aws_lambda_permission" "custom_message" {
  for_each      = toset(var.envs)
  statement_id  = "AllowCognitoInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.custom_message[each.key].function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.user[each.key].arn
}
