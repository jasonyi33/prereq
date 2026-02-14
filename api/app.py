import os

from flask import Flask
from flask_cors import CORS

from api.src.routes.courses import courses
from api.src.routes.students import students
from src.routes.create import create

app = Flask(__name__, static_folder="", static_url_path="")
app.register_blueprint(create)
app.register_blueprint(courses)
app.register_blueprint(students)
CORS(app)


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
