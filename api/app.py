from flask import Flask, jsonify, request
from flask_cors import CORS

from src.routes.pages import pages
from src.routes.courses import courses
from src.routes.create import create
from src.routes.graph import graph
from src.routes.students import students
from src.routes.heatmap import heatmap
from src.routes.lectures import lectures
from src.routes.transcripts import transcripts
from src.routes.concepts import concepts
from src.routes.polls import polls
from src.routes.tutoring import tutoring
from src.routes.auth import auth

app = Flask(__name__)
CORS(app)

app.register_blueprint(auth)
app.register_blueprint(create)
app.register_blueprint(courses)
app.register_blueprint(students)
app.register_blueprint(graph)
app.register_blueprint(heatmap)
app.register_blueprint(lectures)
app.register_blueprint(transcripts)
app.register_blueprint(concepts)
app.register_blueprint(polls)
app.register_blueprint(tutoring)
app.register_blueprint(pages)



@app.after_request
def add_cache_headers(response):
    if request.method == 'GET' and response.status_code == 200:
        response.headers['Cache-Control'] = 'public, max-age=5'
    return response


@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'}), 200


if __name__ == '__main__':
    import os
    port = int(os.getenv("PORT", 8080))
    app.run(host="0.0.0.0", port=port, debug=True)
