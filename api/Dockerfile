FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .
COPY src/ ./src/

EXPOSE 8080
ENTRYPOINT ["sh", "-c", "gunicorn app:app --bind 0.0.0.0:$PORT"]