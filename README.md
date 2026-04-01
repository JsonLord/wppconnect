---
title: WPPConnect API
sdk: docker
app_port: 7860
---

# WPPConnect API on Hugging Face Spaces

This is an automated deployment of WPPConnect on Hugging Face Spaces. It exposes a REST API for WhatsApp interaction, including poll messaging.

## Mandatory Endpoints
- **[/health](/health)**: Health check endpoint.
- **[/api-docs](/api-docs)**: API documentation.

## Functional Endpoints
- **[/send-message](/send-message)**: Send a text message (POST).
- **[/send-poll](/send-poll)**: Send a poll message (POST).
- **[/get-connection-status](/get-connection-status)**: Get the current WhatsApp connection status (GET).
