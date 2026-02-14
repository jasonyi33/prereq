from flask import Flask, jsonify
from flask_cors import CORS

from src.routes.courses import courses
from src.routes.create import create
from src.routes.graph import graph
from src.routes.students import students

app = Flask(__name__)
CORS(app)

app.register_blueprint(create)
app.register_blueprint(courses)
app.register_blueprint(students)
app.register_blueprint(graph)


@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'}), 200


if __name__ == '__main__':
    app.run(debug=True, port=8080)
