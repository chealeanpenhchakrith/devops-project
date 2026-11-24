terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~>2.30"
    }
  }
  backend "local" {}
}
variable "pr_number" { type = string }
variable "image" { type = string }

provider "kubernetes" {
  config_path = "~/.kube/config"
}

resource "kubernetes_namespace" "preview" {
  metadata {
    name = "pr-${var.pr_number}"
    labels = {
      purpose = "preview"
      pr      = var.pr_number
      owner   = "rithchea"
      expires = "2026-11-30"
    }
  }
}
resource "kubernetes_deployment" "app" {
  metadata {
    name      = "myapp"
    namespace = kubernetes_namespace.preview.metadata[0].name
  }
  spec {
    replicas = 1
    selector { match_labels = { app = "myapp" } }
    template {
      metadata { labels = { app = "myapp" } }
      spec {
        container {
          name  = "myapp"
          image = var.image
          port { container_port = 3000 }
        }
      }
    }
  }
}