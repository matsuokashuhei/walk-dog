resource "aws_cognito_user_pool" "user" {
  for_each = toset(var.envs)
  name     = join("-", [var.project, each.key, "user"])

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]
  user_pool_tier           = "ESSENTIALS"

  user_attribute_update_settings {
    attributes_require_verification_before_update = ["email"]
  }

  schema {
    name                = "name"
    attribute_data_type = "String"
    mutable             = true
    required            = false
    string_attribute_constraints {
      min_length = 0
      max_length = 2048
    }
  }

  schema {
    name                = "email"
    attribute_data_type = "String"
    mutable             = true
    required            = true
    string_attribute_constraints {
      min_length = 0
      max_length = 2048
    }
  }

  mfa_configuration = "OFF"

  sign_in_policy {
    allowed_first_auth_factors = ["EMAIL_OTP", "PASSWORD"]
  }

  email_configuration {
    email_sending_account = "DEVELOPER"
    from_email_address    = join("@", ["no-reply", aws_ses_domain_identity.cognito[each.key].domain])
    source_arn            = aws_ses_domain_identity.cognito[each.key].arn
  }

  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
  }

  admin_create_user_config {
    allow_admin_create_user_only = false
  }

  tags = {
    Environment = each.key
    Project     = var.project
  }
}
