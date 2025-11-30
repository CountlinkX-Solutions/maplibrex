import Config

# Configuración para testing
config :maplibrex,
  debug: false

# Para Wallaby
config :wallaby,
  otp_app: :maplibrex,
  driver: Wallaby.Chrome,
  screenshot_on_failure: true
