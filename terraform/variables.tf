variable "aws_region" { type = string }
variable "ami_id" { type = string }
variable "instance_type" { type = string }
variable "key_name" { type = string }
variable "s3_bucket_name" { type = string }

variable "ssh_cidr" {
  description = "CIDR for SSH access"
  type        = string
}

variable "malaideu_port" {
  type = number
}
