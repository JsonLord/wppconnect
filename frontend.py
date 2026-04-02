import gradio as gr
import requests
import time
import os

NODE_URL = "http://127.0.0.1:3000"

def get_status():
    try:
        r = requests.get(f"{NODE_URL}/health", timeout=2)
        return r.json()
    except Exception as e:
        return {"whatsappStatus": "Offline", "connected": False, "ready": False, "logs": [str(e)]}

def update_ui():
    status = get_status()

    status_msg = status.get('whatsappStatus', 'Unknown')
    connected = "Connected" if status.get('connected') else "Disconnected"
    ready = "READY" if status.get('ready') else "Initializing"

    info_text = f"## 🚦 Status: {status_msg}\n**Instance:** {connected} | **API:** {ready}"

    qr_html = "<div style='text-align:center; padding:20px; color:#888;'>Waiting for WhatsApp initialization...</div>"
    if status.get('hasQR'):
        try:
            qr_r = requests.get(f"{NODE_URL}/qr-data", timeout=1)
            if qr_r.status_code == 200:
                qr_data = qr_r.json()
                ascii_qr = qr_data['ascii']
                qr_html = f"""
                <div style='background:white; color:black; padding:20px; display:flex; flex-direction:column; align-items:center; border-radius:12px; border: 4px solid #128c7e;'>
                    <h3 style='margin:0 0 10px 0; font-family:sans-serif; color:#128c7e;'>SCAN TO CONNECT</h3>
                    <pre style='font-size:7px; line-height:1; margin:0; font-family:monospace; font-weight:bold;'>{ascii_qr}</pre>
                    <p style='margin-top:10px; font-size:12px; color:#555;'>Open WhatsApp > Linked Devices > Link a Device</p>
                </div>
                """
        except:
            pass
    elif status.get('ready'):
        qr_html = """
        <div style='text-align:center; padding:40px; color:#4caf50; background:#f0f9f0; border-radius:12px; border:2px dashed #4caf50;'>
            <h2 style='margin:0;'>✅ CONNECTED</h2>
            <p>Ready to send polls and messages.</p>
        </div>
        """

    logs = "\n".join(status.get('logs', []))

    screenshot_path = None
    try:
        sc_r = requests.get(f"{NODE_URL}/screenshot", timeout=5)
        if sc_r.status_code == 200:
            screenshot_path = "current_screen.png"
            with open(screenshot_path, "wb") as f:
                f.write(sc_r.content)
    except:
        pass

    return info_text, qr_html, logs, screenshot_path

def trigger_init():
    try:
        requests.post(f"{NODE_URL}/init")
        return "Init sequence started..."
    except Exception as e:
        return f"Error: {str(e)}"

def clear_session():
    try:
        requests.post(f"{NODE_URL}/clear-session")
        return "Session cleared. Please click Start."
    except Exception as e:
        return f"Error: {str(e)}"

def send_poll(number, title, options):
    try:
        opts = [o.strip() for o in options.split(",")]
        r = requests.post(f"{NODE_URL}/send-poll", json={"telnumber": number, "name": title, "choices": opts})
        return r.json()
    except Exception as e:
        return {"error": str(e)}

with gr.Blocks(title="WPPConnect Dashboard") as demo:
    gr.Markdown("# 🤖 WPPConnect WhatsApp Hub")

    with gr.Row():
        with gr.Column(scale=1):
            status_display = gr.Markdown("Initializing...")
            with gr.Row():
                init_btn = gr.Button("🚀 Start", variant="primary")
                refresh_btn = gr.Button("🔄 Refresh")
            clear_btn = gr.Button("🗑️ Reset", variant="stop")

        with gr.Column(scale=2):
            qr_display = gr.HTML(label="QR Code")

    with gr.Tabs():
        with gr.Tab("📊 Poll Automation"):
            with gr.Row():
                poll_num = gr.Textbox(label="Target Number", placeholder="e.g. 5511999999999")
                poll_title = gr.Textbox(label="Poll Name")
            poll_opts = gr.Textbox(label="Options (comma separated)")
            poll_send = gr.Button("Send Poll Message", variant="primary")
            poll_output = gr.JSON(label="Response")

        with gr.Tab("📋 Debug Logs"):
            log_display = gr.Code(label="Internal Logs", lines=15, language="markdown")

        with gr.Tab("🔍 Browser View"):
            gr.Markdown("Direct view of the headless browser state.")
            screenshot_display = gr.Image(label="Live View")

    init_btn.click(trigger_init, outputs=status_display)
    clear_btn.click(clear_session, outputs=status_display)
    refresh_btn.click(update_ui, outputs=[status_display, qr_display, log_display, screenshot_display])
    poll_send.click(send_poll, inputs=[poll_num, poll_title, poll_opts], outputs=poll_output)

    try:
        demo.load(update_ui, outputs=[status_display, qr_display, log_display, screenshot_display], every=10)
    except:
        demo.load(update_ui, outputs=[status_display, qr_display, log_display, screenshot_display])

if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=7860, theme=gr.themes.Soft(primary_hue="green"))
