terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
  }
}

resource "docker_image" "nginx" {
  name = var.image
}

resource "docker_container" "web" {
  name  = "tf-web-${var.env_name}"
  image = docker_image.nginx.image_id

  ports {
    internal = 80
    external = var.external_port
  }
}