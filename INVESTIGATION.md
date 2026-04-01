# WPPConnect Project Investigation Report

## 1. Overall Architecture
WPPConnect is a WhatsApp Web wrapper built with Node.js and Puppeteer. It follows a **layered inheritance model** where the final `Whatsapp` class inherits from a long chain of functional layers:
`HostLayer` → `NewsletterLayer` → ... → `SenderLayer` → ... → `Whatsapp`.

This design allows for modularity, where each layer handles a specific set of WhatsApp features (e.g., messages, groups, business features).

## 2. Major Components
- **Whatsapp Client (`src/api/whatsapp.ts`)**: The main entry point for developers.
- **Initializer (`src/controllers/initializer.ts`)**: Handles session startup, browser launching, and authentication (QR code/tokens).
- **WAPI/WPP (`src/lib/wapi`)**: The core JavaScript bridge injected into the WhatsApp Web browser context.
- **Token Stores (`src/token-store`)**: Manages session persistence via files or memory.
- **REST API Example (`examples/rest/index.js`)**: Demonstrates how to expose functionality via HTTP.

## 3. Workflow & Data Flow
1.  **Launch**: Puppeteer opens WhatsApp Web.
2.  **Auth**: User scans QR or uses a saved token.
3.  **Injection**: `wapi.js` is injected into the page.
4.  **Execution**: Node.js calls `client.method()` -> `page.evaluate()` -> `WAPI.method()` in browser.
5.  **Feedback**: Browser events are sent back to Node.js via exposed functions.

## 4. Feasibility for Deployment & Integration

### Deployment (Docker / Hugging Face)
- **Feasible**: Yes.
- **Requirements**: A Docker environment with Node.js and Chromium system dependencies.
- **Hugging Face**: Can run as a Docker Space. Persistence (tokens) must be handled carefully since Spaces are ephemeral.
- **Puppeteer Config**: The project already includes flags (`--no-sandbox`) necessary for containerized environments.

### Integration (Curl / Automation)
- **Feasible**: Yes.
- **Method**: Use an Express.js wrapper (like the provided `examples/rest`) to expose endpoints.
- **Poll Messaging**: The `sendPollMessage` method is already implemented in `SenderLayer` and can be easily triggered via a POST request in a REST API.

## 5. Notable Patterns & Risks
- **wa-js Integration**: Uses `@wppconnect/wa-js` for robust internal module interaction.
- **Risk**: Dependency on WhatsApp Web's internal structure; frequent updates of the library are required to maintain compatibility.
- **Risk**: Browser resource usage (RAM) can be high in containerized environments.

---
**Status**: READY for implementation instructions.
