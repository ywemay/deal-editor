#!/usr/bin/env python3
"""Deal Editor — standalone PyWebView app for editing .deal files."""

import sys
import os
import json
import threading
import traceback
import base64
import webview

try:
    import bottle
    from bottle import route, request, response, static_file
except ImportError:
    bottle = None

_this_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _this_dir)

from prodlib.deal import Deal, OrderItem, WarehouseRecord, WarehouseItem, list_deals
from prodlib.core import Product


_log_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "deal-editor.log")
def log(msg):
    print(f"[deal-editor] {msg}", file=sys.stderr, flush=True)
    try:
        with open(_log_path, "a") as f:
            f.write(f"{msg}\n")
    except Exception:
        pass


def log_error(msg):
    print(f"[deal-editor ERROR] {msg}", file=sys.stderr, flush=True)
    traceback.print_exc(file=sys.stderr)


def _make_thumbnail(data: bytes, max_size: int = 120) -> str:
    return "data:image/jpeg;base64," + base64.b64encode(data).decode("ascii")


# ---------------------------------------------------------------------------
# Bottle HTTP server
# ---------------------------------------------------------------------------
if bottle is not None:
    bottle_app = bottle.Bottle()

    def json_ok(data):
        response.content_type = "application/json"
        return json.dumps({"ok": True, "data": data})

    def json_err(msg, status=400):
        response.content_type = "application/json"
        response.status = status
        return json.dumps({"ok": False, "error": msg})

    # ── Static files ──
    @bottle_app.route("/")
    def index():
        return static_file("index.html", root=os.path.join(_this_dir, "frontend"))

    @bottle_app.route("/src/<filename>")
    def static_src(filename):
        return static_file(filename, root=os.path.join(_this_dir, "frontend", "src"))

    # ── Health ──
    @bottle_app.get("/api/health")
    def api_health():
        return json_ok({"status": "ok", "version": "1.0.0"})

    @bottle_app.get("/api/open")
    def api_open_launch():
        """GET: Load the deal from launch query param or launch file."""
        try:
            # Check query param (?launch=/path/to/file.deal)
            path = request.query.get("launch", "")
            if path and os.path.isfile(path):
                log(f"Using launch query param: {path}")
                d = Deal.load(path)
                return json_ok({
                    "ok": True,
                    "data": {
                        "deal": d.to_dict(),
                        "filepath": path,
                        "directory": d.directory,
                    }
                })
            # Fallback: read fixed launch file
            info_path = os.path.join(os.path.expanduser("~/.local/share/deal-editor"), "launch_file.json")
            if os.path.isfile(info_path):
                with open(info_path, "r") as f:
                    launch = json.load(f)
                path = launch.get("path", "")
                if path and os.path.isfile(path):
                    d = Deal.load(path)
                    return json_ok({
                        "ok": True,
                        "data": {
                            "deal": d.to_dict(),
                            "filepath": path,
                            "directory": d.directory,
                        }
                    })
            return json_ok({"ok": False})
        except Exception as e:
            log(f"Error in api_open_launch: {e}")
            return json_err(str(e))

    # ── Open a .deal file (POST with path) ──
    @bottle_app.post("/api/open")
    def api_open():
        """Load a .deal file and return its data."""
        body = request.json or {}
        path = body.get("path", "")
        if not path:
            return json_err("path is required")
        if not os.path.isfile(path):
            return json_err(f"File not found: {path}")
        try:
            d = Deal.load(path)
            return json_ok({
                "deal": d.to_dict(),
                "filepath": path,
                "directory": d.directory,
            })
        except Exception as e:
            return json_err(str(e))

    # ── Save a .deal file ──
    @bottle_app.post("/api/save")
    def api_save():
        """Save deal data to a .deal file."""
        body = request.json or {}
        directory = body.get("directory", "")
        deal_data = body.get("deal", {})
        if not directory:
            return json_err("directory is required")
        try:
            d = Deal(directory)
            d.filename = deal_data.get("filename", "")
            d.title = deal_data.get("title", "")
            d.date = deal_data.get("date", "")
            d.status = deal_data.get("status", "pending")
            d.additional_costs = float(deal_data.get("additional_costs", 0))
            d.additional_costs_currency = deal_data.get("additional_costs_currency", "")
            d.notes = deal_data.get("notes", "")
            d.currency = deal_data.get("currency", "USD")

            for o in deal_data.get("order", []):
                d.order.append(OrderItem.from_dict(o))

            for w in deal_data.get("warehouse", []):
                d.warehouse.append(WarehouseRecord.from_dict(w))

            if not d.filename:
                d.filename = d.generate_filename()

            d.save()
            return json_ok({
                "deal": d.to_dict(),
                "filepath": d.filepath,
                "directory": d.directory,
            })
        except Exception as e:
            return json_err(str(e))

    # ── List .prod files in a directory ──
    @bottle_app.post("/api/list-products")
    def api_list_products():
        """List .prod files in a directory."""
        body = request.json or {}
        directory = body.get("dir", "")
        if not directory:
            return json_err("dir is required")
        try:
            entries = os.listdir(directory) if os.path.isdir(directory) else []
            products = [os.path.join(directory, e) for e in sorted(entries)
                        if e.endswith(".prod") and os.path.isfile(os.path.join(directory, e))]
            return json_ok(products)
        except Exception as e:
            return json_err(str(e))

    # ── Get product info (title, code, photos) ──
    @bottle_app.post("/api/get-product")
    def api_get_product():
        """Get product info for display in deal editor product picker."""
        body = request.json or {}
        path = body.get("path", "")
        if not path:
            return json_err("path is required")
        if not os.path.isfile(path):
            return json_err(f"File not found: {path}")
        try:
            p = Product.open(path)
            return json_ok({
                "title": p.header.title,
                "uuid": p.header.uuid,
                "code": p.header.code,
                "description": p.header.description,
                "photoCount": len(p.photos),
                "priceCount": len(p.price_history),
                "photos": [_make_thumbnail(d) for d in p.photos],
            })
        except Exception as e:
            return json_err(str(e))

    # ── Browse for file ──
    @bottle_app.get("/api/open-file")
    def api_open_file():
        """Open a native file dialog for .deal files."""
        try:
            file_types = ("Deal files (*.deal)",)
            result = webview.windows[0].create_file_dialog(
                webview.FileDialog.OPEN, allow_multiple=False,
                file_types=file_types
            )
            path = result[0] if result else ""
            return json_ok({"path": path})
        except Exception as e:
            return json_err(str(e))

    # ── Browse for directory ──
    @bottle_app.get("/api/browse-directory")
    def api_browse_directory():
        """Open a native directory picker."""
        try:
            result = webview.windows[0].create_file_dialog(
                webview.FileDialog.FOLDER
            )
            path = result[0] if result else ""
            return json_ok({"path": path})
        except Exception as e:
            return json_err(str(e))

    # ── CORS ──
    @bottle_app.hook("after_request")
    def enable_cors():
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"

else:
    bottle_app = None


# ---------------------------------------------------------------------------
# PyWebView
# ---------------------------------------------------------------------------
def start_server():
    if bottle_app:
        bottle_app.run(host="127.0.0.1", port=18093, quiet=True)


def main():
    # Accept file from command line
    file_to_open = ""
    if len(sys.argv) > 1:
        arg_path = sys.argv[1].strip()
        if arg_path.endswith(".deal") and os.path.isfile(arg_path):
            file_to_open = os.path.realpath(arg_path)

    # Write launch file BEFORE creating the window — frontend checks this on load
    # Write launch file to a fixed absolute path (not relative to _this_dir — PyInstaller temp bug)
    if file_to_open:
        info_path = os.path.join(os.path.expanduser("~/.local/share/deal-editor"), "launch_file.json")
        os.makedirs(os.path.dirname(info_path), exist_ok=True)
        with open(info_path, "w") as f:
            json.dump({"path": file_to_open}, f)
        log(f"Launch file written to {info_path}")
    else:
        log("No file argument — start page will be shown")

    t = threading.Thread(target=start_server, daemon=True)
    t.start()

    launch_url = "http://127.0.0.1:18093"
    if file_to_open:
        launch_url += "?launch=" + file_to_open

    webview.create_window(
        "Deal Editor",
        launch_url,
        width=1100,
        height=780,
        resizable=True,
        text_select=True,
    )

    webview.start(debug=False)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        log_error("Fatal crash in main()")
        sys.exit(1)
