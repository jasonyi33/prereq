import os

from flask import Flask
from flask_cors import CORS

from src.routes.create import create

app = Flask(__name__, static_folder="", static_url_path="")
app.register_blueprint(create)
CORS(app)


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
