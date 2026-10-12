#!/usr/bin/env python3
"""Local web server and secure-configurable email delivery for HYSACAM Kumba Tracker."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from email.message import EmailMessage
import json, os, smtplib, ssl, base64, re

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
DATA_DIR.mkdir(exist_ok=True)
REPORTS_FILE = DATA_DIR / "reports.json"
CONFIG_FILE = ROOT / "email_config.json"


def load_config():
    config = {"recipient": "kelechiwisdom19950@gmail.com", "smtp_host": "smtp.gmail.com", "smtp_port": 587, "smtp_user": "", "smtp_app_password": "", "sender_name": "HYSACAM Kumba Tracker"}
    if CONFIG_FILE.exists():
        try:
            stored = json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
            if isinstance(stored, dict): config.update(stored)
        except Exception: pass
    # Environment variables override config file for safer deployment.
    for key, env in [("smtp_user", "HYSACAM_SMTP_USER"), ("smtp_app_password", "HYSACAM_SMTP_APP_PASSWORD"), ("smtp_host", "HYSACAM_SMTP_HOST"), ("recipient", "HYSACAM_REPORTS_EMAIL")]:
        if os.getenv(env): config[key] = os.environ[env]
    return config


def send_report(report):
    cfg = load_config()
    if not cfg.get("smtp_user") or not cfg.get("smtp_app_password"):
        return False, "Email is not configured yet."
    msg = EmailMessage()
    ref = str(report.get("reference", "HYSACAM report"))
    msg["Subject"] = f"HYSACAM Kumba Tracker — {ref} — {report.get('issueType', 'Waste issue')}"
    msg["From"] = f"{cfg.get('sender_name', 'HYSACAM Kumba Tracker')} <{cfg['smtp_user']}>"
    msg["To"] = cfg.get("recipient", "kelechiwisdom19950@gmail.com")
    msg["Reply-To"] = report.get("reporterEmail", "") if re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", str(report.get("reporterEmail", ""))) else cfg["smtp_user"]
    lines = ["A new waste issue has been submitted through HYSACAM Kumba Tracker.", "", f"Reference: {ref}", f"Issue: {report.get('issueType', '')}", f"Priority: {report.get('priority', '')}", f"Area: {report.get('area', '')}", f"Nearby landmark: {report.get('landmark', '')}", f"Description: {report.get('description', '')}", f"Reporter: {report.get('reporterName', '')}", f"Reporter email: {report.get('reporterEmail', '')}", f"Submitted: {report.get('createdAt', '')}"]
    msg.set_content("\n".join(lines))
    # Include an attached image when the browser sends a valid data URL.
    photo = report.get("photoData", "")
    if isinstance(photo, str) and photo.startswith("data:image/") and ";base64," in photo:
        try:
            header, encoded = photo.split(",", 1)
            mime = header[5:].split(";", 1)[0]
            major, minor = mime.split("/", 1)
            raw = base64.b64decode(encoded, validate=True)
            if len(raw) <= 8 * 1024 * 1024:
                msg.add_attachment(raw, maintype=major, subtype=minor, filename=Path(report.get("photoName") or f"{ref}.{minor}").name)
        except Exception: pass
    context = ssl.create_default_context()
    with smtplib.SMTP(cfg.get("smtp_host", "smtp.gmail.com"), int(cfg.get("smtp_port", 587)), timeout=20) as smtp:
        smtp.ehlo(); smtp.starttls(context=context); smtp.ehlo()
        smtp.login(cfg["smtp_user"], cfg["smtp_app_password"])
        smtp.send_message(msg)
    return True, "Email sent."


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs): super().__init__(*args, directory=str(ROOT), **kwargs)
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()
    def _json(self, code, payload):
        body = json.dumps(payload).encode()
        self.send_response(code); self.send_header("Content-Type", "application/json; charset=utf-8"); self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
    def do_POST(self):
        if self.path != "/api/reports": return self._json(404, {"message": "Endpoint not found."})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length < 2 or length > 16 * 1024 * 1024: return self._json(413, {"message": "Report is empty or too large."})
            report = json.loads(self.rfile.read(length).decode("utf-8"))
            if not isinstance(report, dict): return self._json(400, {"message": "Invalid report data."})
            for field in ("reference", "issueType", "area", "description", "reporterName", "reporterEmail"):
                if not str(report.get(field, "")).strip(): return self._json(400, {"message": f"Missing required field: {field}."})
            records = []
            if REPORTS_FILE.exists():
                try: records = json.loads(REPORTS_FILE.read_text(encoding="utf-8"))
                except Exception: records = []
            if not isinstance(records, list): records = []
            # Save metadata on server; don't persist large image data in the report archive.
            stored = {k:v for k,v in report.items() if k != "photoData"}
            records.insert(0, stored)
            REPORTS_FILE.write_text(json.dumps(records[:5000], ensure_ascii=False, indent=2), encoding="utf-8")
            try:
                sent, detail = send_report(report)
            except Exception as exc:
                print(f"Email delivery error for {report.get('reference')}: {exc}")
                sent, detail = False, "Report stored on server, but email delivery failed. Check email_config.json and the server log."
            return self._json(200, {"ok": True, "reference": report.get("reference"), "emailSent": sent, "message": detail, "recipient": load_config().get("recipient", "kelechiwisdom19950@gmail.com")})
        except json.JSONDecodeError: return self._json(400, {"message": "Report data was not valid JSON."})
        except Exception as exc:
            print("Report server error:", exc)
            return self._json(500, {"message": "The server could not process this report."})

if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 8000), Handler)
    print("HYSACAM Kumba Tracker running at http://127.0.0.1:8000/index.html")
    print("Reports inbox: " + load_config().get("recipient", "kelechiwisdom19950@gmail.com"))
    print("Keep this window open. Press Ctrl+C to stop.")
    try: server.serve_forever()
    except KeyboardInterrupt: print("\nServer stopped.")
    finally: server.server_close()
