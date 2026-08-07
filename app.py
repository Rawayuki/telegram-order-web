from flask import Flask, send_from_directory, request
import requests
import os

app = Flask(__name__)

TOKEN = os.environ.get("TELEGRAM_TOKEN")
CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID")


@app.route("/")
def home():
    return send_from_directory(".", "index.html")


@app.route("/style.css")
def style():
    return send_from_directory(".", "style.css")


@app.route("/order", methods=["POST"])
def order():
    data = request.get_json() or {}

    username = data.get("username", "User111")
    product = data.get("product", "ไม่ระบุสินค้า")
    quantity = data.get("quantity", 1)

    message = f"{username} สั่ง {product} จำนวน {quantity} ชิ้น"

    url = f"https://api.telegram.org/bot{TOKEN}/sendMessage"

    telegram_data = {
        "chat_id": CHAT_ID,
        "text": message
    }

    try:
        response = requests.post(
            url,
            data=telegram_data,
            timeout=10
        )
    except requests.RequestException:
        return {
            "message": "เชื่อมต่อ Telegram ไม่สำเร็จ"
        }, 500

    if response.ok:
        return {
            "message": f"สั่ง {product} จำนวน {quantity} ชิ้น สำเร็จ"
        }

    return {
        "message": "ส่งคำสั่งซื้อไม่สำเร็จ"
    }, 500


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 5000))
    )