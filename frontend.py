import gradio as gr
import requests
import time
import os

NODE_URL = "http://localhost:3000"

def get_status():
    try:
        r = requests.get(f"{NODE_URL}/health", timeout=2)
        return r.json()
    except Exception as e:
        return {"whatsappStatus": "Offline", "connected": False, "ready": False, "logs": [f"Error connecting to backend: {str(e)}"]}

def update_ui():
    status = get_status()

    # Connection info
    status_msg = status.get('whatsappStatus', 'Unknown')
    connected = "✅ Yes" if status.get('connected') else "❌ No"
    ready = "🚀 Ready" if status.get('ready') else "⏳ Initializing"

    info_text = f"WhatsApp Status: {status_msg}\nConnected: {connected}\nReady: {ready}"

    # QR Code handling
    qr_html = "<div style='text-align:center; padding:40px; color:#888;'>Waiting for WhatsApp to initialize...</div>"
    if status.get('hasQR'):
        try:
            qr_r = requests.get(f"{NODE_URL}/qr-data", timeout=1)
            if qr_r.status_code == 200:
                qr_data = qr_r.json()
                ascii_qr = qr_data.get('ascii', '')
                qr_html = f"""
                <div style='background:white; color:black; padding:20px; display:flex; flex-direction:column; align-items:center; border-radius:12px; box-shadow: 0 8px 24px rgba(0,0,0,0.2);'>
                    <h3 style='margin:0 0 15px 0; font-family:sans-serif; color:#128c7e;'>Scan with WhatsApp</h3>
                    <pre style='font-size:7px; line-height:1; margin:0; font-family:monospace; font-weight:bold; letter-spacing:0;'>{ascii_qr}</pre>
                    <p style='margin-top:15px; font-size:13px; font-family:sans-serif;'>Open WhatsApp > Linked Devices > Link a Device</p>
                </div>
                """
        except:
            pass
    elif status.get('ready'):
        qr_html = """
        <div style='text-align:center; padding:40px; color:#4caf50; background:#f0f9f0; border-radius:12px; border:2px dashed #4caf50;'>
            <h2 style='margin:0;'>✅ Connected!</h2>
            <p>You can now use the API to send messages.</p>
        </div>
        """

    logs = "\n".join(status.get('logs', []))

    screenshot_url = f"{NODE_URL}/screenshot?t={int(time.time())}"

    return info_text, qr_html, logs, screenshot_url

def trigger_init():
    try:
        requests.post(f"{NODE_URL}/init")
        return "Initialization command sent."
    except Exception as e:
        return f"Error: {str(e)}"

def send_poll(number, title, options):
    try:
        opts = [o.strip() for o in options.split(",")]
        r = requests.post(f"{NODE_URL}/send-poll", json={"telnumber": number, "name": title, "choices": opts})
        return r.json()
    except Exception as e:
        return {"error": str(e)}

def send_message(number, message):
    try:
        r = requests.post(f"{NODE_URL}/send-message", json={"telnumber": number, "message": message})
        return r.json()
    except Exception as e:
        return {"error": str(e)}

with gr.Blocks(title="WPPConnect Dashboard", theme=gr.themes.Default(primary_hue="green")) as demo:
    gr.Markdown("# 🤖 WPPConnect WhatsApp Control Center")

    with gr.Row():
        with gr.Column(scale=1):
            status_display = gr.Textbox(label="Session Info", lines=4, interactive=False)
            init_btn = gr.Button("🚀 (Re)Start WhatsApp", variant="primary")
            refresh_btn = gr.Button("🔄 Refresh UI")

        with gr.Column(scale=2):
            qr_display = gr.HTML(label="Connection Status / QR Code")

    with gr.Tabs():
        with gr.TabItem("📊 Send Poll"):
            with gr.Row():
                poll_num = gr.Textbox(label="Phone Number", placeholder="Country code + number (e.g. 5511999999999)")
                poll_title = gr.Textbox(label="Question", placeholder="Your question here")
            poll_opts = gr.Textbox(label="Choices", placeholder="Option 1, Option 2, Option 3")
            poll_send = gr.Button("Send Poll", variant="primary")
            poll_out = gr.JSON(label="Result")

        with gr.TabItem("💬 Send Text"):
            with gr.Row():
                msg_num = gr.Textbox(label="Phone Number")
                msg_txt = gr.Textbox(label="Message", lines=2)
            msg_btn = gr.Button("Send Message")
            msg_out = gr.JSON(label="Result")

        with gr.TabItem("📋 Debug Logs"):
            log_display = gr.Code(label="Backend Logs", lines=15, language="markdown")

        with gr.TabItem("🔍 Live Browser"):
            gr.Markdown("Visual debugging of the underlying browser page.")
            screenshot_display = gr.Image(label="Browser Screenshot")

    init_btn.click(trigger_init, outputs=status_display)
    refresh_btn.click(update_ui, outputs=[status_display, qr_display, log_display, screenshot_display])
    poll_send.click(send_poll, inputs=[poll_num, poll_title, poll_opts], outputs=poll_out)
    msg_btn.click(send_message, inputs=[msg_num, msg_txt], outputs=msg_out)

    # Auto-refresh
    demo.load(update_ui, outputs=[status_display, qr_display, log_display, screenshot_display])

if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=7860)
