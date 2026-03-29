output "ec2_public_ip" {
  value       = aws_instance.malaideu_server.public_ip
  description = "Public IP of the EC2 instance"
}

output "s3_bucket_name" {
  value       = aws_s3_bucket.uploads.bucket
  description = "Upload bucket name"
}

output "security_group_id" {
  value       = aws_security_group.malaideu_sg.id
  description = "Security group ID"
}

output "iam_role_name" {
  value       = aws_iam_role.ec2_s3_role.name
  description = "IAM role name"
}
