FROM python:3.11-slim

WORKDIR /app

# Install dependencies in a separate layer for Docker cache efficiency
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the full project
COPY . .

# HF Spaces always uses port 7860
ENV PORT=7860
EXPOSE 7860

CMD ["gunicorn", "services.api:app", \
     "--bind", "0.0.0.0:7860", \
     "--workers", "1", \
     "--timeout", "120", \
     "--log-level", "info"]
