data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}


# S3
resource "aws_s3_bucket" "uploads" {
  bucket = var.s3_bucket_name

  tags = {
    Name    = "malaideu-uploads"
    Project = "devops"
  }
}


# ALB Security Group
resource "aws_security_group" "devops_alb_sg" {
  name   = "devops-alb-sg"
  vpc_id = data.aws_vpc.default.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# EC2 Security Group
resource "aws_security_group" "devops_server_sg" {
  name   = "devops-server-sg"
  vpc_id = data.aws_vpc.default.id

  # SSH
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.ssh_cidr]
  }

  # App from ALB
  ingress {
    from_port       = var.malaideu_port
    to_port         = var.malaideu_port
    protocol        = "tcp"
    security_groups = [aws_security_group.devops_alb_sg.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}


# IAM Role (shared)
resource "aws_iam_role" "devops_server_role" {
  name = "devops-server-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "s3_access" {
  role       = aws_iam_role.devops_server_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonS3FullAccess"
}

resource "aws_iam_instance_profile" "devops_server_profile" {
  name = "devops-server-profile"
  role = aws_iam_role.devops_server_role.name
}

# EC2 Instance (shared)
resource "aws_instance" "devops_server" {
  ami                         = var.ami_id
  instance_type               = var.instance_type
  key_name                    = var.key_name
  vpc_security_group_ids      = [aws_security_group.devops_server_sg.id]
  iam_instance_profile        = aws_iam_instance_profile.devops_server_profile.name
  associate_public_ip_address = true

  tags = {
    Name = "devops-server"
  }
}


# Target Group
resource "aws_lb_target_group" "malaideu_tg" {
  name        = "malaideu-tg"
  port        = var.malaideu_port
  protocol    = "HTTP"
  vpc_id      = data.aws_vpc.default.id
  target_type = "instance"

  health_check {
    path    = "/"
    matcher = "200-399"
  }
}

resource "aws_lb_target_group_attachment" "malaideu_attach" {
  target_group_arn = aws_lb_target_group.malaideu_tg.arn
  target_id        = aws_instance.devops_server.id
  port             = var.malaideu_port
}


# ALB

resource "aws_lb" "devops_alb" {
  name               = "devops-alb"
  load_balancer_type = "application"
  subnets            = data.aws_subnets.default.ids
  security_groups    = [aws_security_group.devops_alb_sg.id]
}


# Listener
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.devops_alb.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.malaideu_tg.arn
  }
}
