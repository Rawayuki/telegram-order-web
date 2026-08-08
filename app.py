from flask import Flask, send_from_directory, request
import requests
import os
import json

app = Flask(__name__)

TOKEN = os.environ.get("TELEGRAM_TOKEN")
CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID")


# =========================
# PRODUCTS
# =========================

def load_products():
    with open("products.json", "r", encoding="utf-8") as file:
        return json.load(file)


def save_products(products):
    with open("products.json", "w", encoding="utf-8") as file:
        json.dump(
            products,
            file,
            ensure_ascii=False,
            indent=2
        )


# =========================
# PAGES
# =========================

@app.route("/")
def home():
    return send_from_directory(".", "index.html")


@app.route("/admin")
def admin():
    return send_from_directory(".", "admin.html")


@app.route("/style.css")
def style():
    return send_from_directory(".", "style.css")


# =========================
# PRODUCT API
# =========================

@app.route("/api/products")
def get_products():
    products = load_products()

    active_products = [
        product
        for product in products
        if product.get("active", True)
    ]

    return active_products


@app.route("/api/admin/products")
def get_admin_products():
    return load_products()

@app.route(
    "/api/admin/products",
    methods=["POST"]
)
@app.route(
    "/api/admin/products/<int:product_id>",
    methods=["DELETE"]
)
def delete_product(product_id):

    products = load_products()

    product = next(
        (
            item
            for item in products
            if item["id"] == product_id
        ),
        None
    )

    if product is None:
        return {
            "message": "ไม่พบสินค้า"
        }, 404

    products = [
        item
        for item in products
        if item["id"] != product_id
    ]

    save_products(products)

    return {
        "message": "ลบสินค้าเรียบร้อย"
    }
def add_product():
    data = request.get_json() or {}

    name = str(
        data.get("name", "")
    ).strip()

    image = str(
        data.get("image", "")
    ).strip()

    try:
        price = int(
            data.get("price", 0)
        )

    except (TypeError, ValueError):
        return {
            "message": "ราคาไม่ถูกต้อง"
        }, 400


    if not name:
        return {
            "message": "กรุณากรอกชื่อสินค้า"
        }, 400


    if price < 0:
        return {
            "message": "ราคาต้องไม่ติดลบ"
        }, 400


    if not image:
        return {
            "message": "กรุณาใส่ URL รูปสินค้า"
        }, 400


    products = load_products()


    if products:
        new_id = max(
            product["id"]
            for product in products
        ) + 1

    else:
        new_id = 1


    new_product = {
        "id": new_id,
        "name": name,
        "price": price,
        "image": image,
        "active": bool(
            data.get("active", True)
        )
    }


    products.append(new_product)

    save_products(products)


    return {
        "message": "เพิ่มสินค้าเรียบร้อย",
        "product": new_product
    }, 201

@app.route(
    "/api/admin/products/<int:product_id>",
    methods=["PUT"]
)
def update_product(product_id):
    data = request.get_json() or {}

    products = load_products()

    product = next(
        (
            item
            for item in products
            if item["id"] == product_id
        ),
        None
    )

    if product is None:
        return {
            "message": "ไม่พบสินค้า"
        }, 404

    name = str(
        data.get("name", "")
    ).strip()

    image = str(
        data.get("image", "")
    ).strip()

    try:
        price = int(
            data.get("price", 0)
        )

    except (TypeError, ValueError):
        return {
            "message": "ราคาไม่ถูกต้อง"
        }, 400

    if not name:
        return {
            "message": "กรุณากรอกชื่อสินค้า"
        }, 400

    if price < 0:
        return {
            "message": "ราคาต้องไม่ติดลบ"
        }, 400

    product["name"] = name
    product["price"] = price
    product["image"] = image
    product["active"] = bool(
        data.get("active", True)
    )

    save_products(products)

    return {
        "message": "บันทึกสินค้าเรียบร้อย",
        "product": product
    }


# =========================
# ORDER / TELEGRAM
# =========================

@app.route("/order", methods=["POST"])
def order():
    data = request.get_json() or {}

    username = str(
        data.get("username", "")
    ).strip()

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
        name = str(
            item.get("name", "ไม่ระบุสินค้า")
        )

        try:
            price = int(
                item.get("price", 0)
            )

            quantity = int(
                item.get("quantity", 0)
            )

        except (TypeError, ValueError):
            continue

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

    if not TOKEN or not CHAT_ID:
        print(
            "ERROR: ไม่พบ TELEGRAM_TOKEN "
            "หรือ TELEGRAM_CHAT_ID"
        )

        return {
            "message": "ยังไม่ได้ตั้งค่า Telegram ในระบบ"
        }, 500

    url = (
        f"https://api.telegram.org/"
        f"bot{TOKEN}/sendMessage"
    )

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

    except requests.RequestException as error:
        print(
            "TELEGRAM CONNECTION ERROR:",
            error
        )

        return {
            "message": "เชื่อมต่อ Telegram ไม่สำเร็จ"
        }, 500

    if response.ok:
        return {
            "message": (
                f"สั่งซื้อสำเร็จ!\n"
                f"รวม {total_items} ชิ้น\n"
                f"ยอดรวม {total_price:,} บาท"
            )
        }

    print(
        "TELEGRAM ERROR:",
        response.status_code,
        response.text
    )

    return {
        "message": "ส่งคำสั่งซื้อไปยัง Telegram ไม่สำเร็จ"
    }, 500


# =========================
# RUN APP
# =========================

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(
            os.environ.get("PORT", 5000)
        ),
        debug=True
    )