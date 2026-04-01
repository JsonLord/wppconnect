# Deployment Manager: WPPConnect on Hugging Face Spaces

This file documents the ongoing deployment best practices and tricks for running WPPConnect in a containerized Hugging Face Space.

## Deployment Best Practices
1. **Puppeteer in Containers**: Ensure the `--no-sandbox` and `--disable-setuid-sandbox` flags are present in the Puppeteer configuration (`src/config/puppeteer.config.ts`). These are already part of the project but should be verified on each deployment.
2. **Persistence**: Hugging Face Spaces are ephemeral. Session tokens (`tokens/`) will be lost on container restart unless a persistent storage solution (like a Hugging Face Space volume or an external database) is configured. Currently, sessions must be re-authenticated via QR code on every deployment.
3. **QR Code Monitoring**: Since the app is headless, use the `/health` endpoint or logs to monitor when a QR code is generated. WPPConnect's `logQR: true` will output the ASCII QR code to the container logs.
4. **Port Allocation**: Always listen on port `7860`, which is the mandatory port for Hugging Face Spaces.

## Troubleshooting Common Issues
- **Puppeteer Crashes**: Usually due to missing system-level libraries in the Docker image. The `Dockerfile` must install `chromium` and its dependencies.
- **Port Conflicts**: Ensure no other process is bound to `7860`.
- **Hugging Face Health Check**: If the `/health` endpoint does not return 200 within 5-10 minutes, the deployment will fail. Ensure the application initializes quickly enough or returns 200 even while waiting for login.

## Mandatory Endpoints
- `/health`: Returns HTTP 200 when ready.
- `/api-docs`: Documentation for all available API endpoints.

## Iterative Deployment Workflow
1. Modify the code to fix bugs or add features.
2. Build and verify locally if possible.
3. Upload to Hugging Face using `huggingface-cli upload`.
4. Monitor logs via the Space UI or the provided `curl` log streaming commands.
5. If deployment fails (Status: *Building* -> *Failed* or *Running* -> *Crashed*), analyze the build/run logs, fix the code, and repeat.
