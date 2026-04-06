output "ec2_ip" {
  value = aws_instance.devops_server.public_ip
}

output "alb_dns" {
  value = aws_lb.devops_alb.dns_name
}
