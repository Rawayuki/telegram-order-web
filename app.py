from flask import Flask, send_from_directory, request
import requests
import os

app = Flask(__name__)

TOKEN = os.environ.get("8834186857:AAFGC_7Zkz24AQwKXDxEcNPf5snsSO8s2ZQ")
CHAT_ID = os.environ.get("8588885397")


@app.route("/")
def home():
    return send_from_directory(".", "index.html")


@app.route("/style.css")
def style():
    return send_from_directory(".", "style.css")


@app.route("/order", methods=["POST"])
def order():
    data = request.get_json() or {}

    username = str(data.get("username", "")).strip()
    items = data.get("items", [])

    if not username:
        return {
            "message": "กรุณากรอกชื่อผู้สั่ง"
        }, 400

    if not items:
        return {
            "message": "ไม่มีสินค้าในตะกร้า"
        }, 400

    total_items = 0
    total_price = 0
    item_lines = []

    for item in items:
        name = str(item.get("name", "ไม่ระบุสินค้า"))
        price = int(item.get("price", 0))
        quantity = int(item.get("quantity", 0))

        if quantity <= 0:
            continue

        subtotal = price * quantity

        total_items += quantity
        total_price += subtotal

        item_lines.append(
            f"• {name} × {quantity} = {subtotal:,} บาท"
        )

    if total_items == 0:
        return {
            "message": "จำนวนสินค้าไม่ถูกต้อง"
        }, 400

    items_text = "\n".join(item_lines)

    message = (
        "🛒 คำสั่งซื้อใหม่\n\n"
        f"👤 ผู้สั่ง: {username}\n\n"
        f"{items_text}\n\n"
        "──────────────\n"
        f"📦 รวมทั้งหมด {total_items} ชิ้น\n"
        f"💰 ยอดรวม {total_price:,} บาท"
    )

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
            "message": (
                f"สั่งซื้อสำเร็จ\n"
                f"รวม {total_items} ชิ้น "
                f"ยอด {total_price:,} บาท"
            )
        }

    return {
        "message": "ส่งคำสั่งซื้อไปยัง Telegram ไม่สำเร็จ"
    }, 500


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 5000)),
        debug=True
    )