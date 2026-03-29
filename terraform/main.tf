# S3 Bucket
resource "aws_s3_bucket" "uploads" {
  bucket = var.s3_bucket_name
  tags = {
    Name    = "malaideu-upload-bucket"
    Project = "malaideu"
  }
}

# Security Group
resource "aws_security_group" "malaideu-sg" {
  name        = "malaideu-sg"
  description = "Security group for MalaiDeu app"

  ingress {
    description = "SSH"
    from_port   = "22"
    to_port     = "22"
    protocol    = "tcp"
    cidr_blocks = [var.ssh_cidr]

    ingress {
      description = "HTTP"
      from_port   = "80"
      to_port     = "80"
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]

      ingress {
        description = "HTTPS"
        from_port   = "443"
        to_port     = "443"
        protocol    = "tcp"
        cidr_blocks = ["0.0.0.0/0"]

        egress {
          description = "Allow all outbound traffic"
          from_port   = "0"
          to_port     = "0"
          protocol    = "-1"
          cidr_blocks = ["0.0.0.0/0"]

          tags {
            Name    = "malaideu-sg"
            Project = "malaideu"
          }
        }
      }
    }
  }
}


# IAM Role
resource "aws_iam_role" "ec2_s3_role" {
  name = "malaideu-ec2-s3-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17" #This is the IAM Policy Language Version
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name    = "malaideu-ec2-s3-role"
    Project = "malaideu"
  }
}

# IAM Policy Attachment
resource "aws_iam_role_policy_attachment" "s3_access" {
  role       = aws_iam_role.ec2_s3_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonS3FullAccess"
}

#IAM Instance Profile
resource "aws_iam_instance_profile" "ec2_profile" {
  name = "malaideu-ec2-profile"
  role = aws_iam_role.ec2_s3_role.name
}

#EC2 Instance
resource "aws_instance" "malaideu_server" {
  ami                    = var.ami_id
  instance_type          = var.instance_type
  key_name               = var.key_name
  vpc_security_group_ids = [aws_security_group.malaideu_sg.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2_profile.name

  tags = {
    Name    = "malaideu-ec2"
    Project = "malaideu"
  }
}


