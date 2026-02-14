FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .
COPY src/ ./src/

EXPOSE 8080
ENTRYPOINT ["sh", "-c", "gunicorn main:app --bind 0.0.0.0:$PORT --timeout 240 --keep-alive 120 --threads 4"]