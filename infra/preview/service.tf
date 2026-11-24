resource "kubernetes_service" "app" {
  metadata {
    name      = "myapp"
    namespace = kubernetes_namespace.preview.metadata[0].name
  }

  spec {
    type     = "ClusterIP"
    selector = { app = "myapp" }

    port {
      port        = 80
      target_port = 3000
    }
  }
}