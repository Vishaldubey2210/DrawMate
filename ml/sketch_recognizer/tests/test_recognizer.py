import pytest
import io
import base64
from PIL import Image, ImageDraw
from fastapi.testclient import TestClient
from ml.sketch_recognizer.service.app import app

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["model_loaded"] is True
    assert data["num_classes"] == 20
    assert "apple" in data["classes"]
    assert "airplane" in data["classes"]

def test_blank_canvas_rejected():
    img = Image.new("RGB", (200, 200), color=(255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

    response = client.post("/predict", json={"image": f"data:image/png;base64,{b64}", "top_k": 3})
    assert response.status_code == 200
    data = response.json()
    assert data["recognized"] is False
    assert "blank or too sparse" in data["message"].lower()

def test_single_dot_rejected():
    img = Image.new("RGB", (200, 200), color=(255, 255, 255))
    img.putpixel((100, 100), (0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

    response = client.post("/predict", json={"image": f"data:image/png;base64,{b64}", "top_k": 3})
    assert response.status_code == 200
    data = response.json()
    assert data["recognized"] is False

def test_valid_drawing_prediction():
    img = Image.new("RGB", (200, 200), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.ellipse([40, 40, 160, 160], outline=(0, 0, 0), width=6)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

    response = client.post("/predict", json={"image": f"data:image/png;base64,{b64}", "top_k": 3})
    assert response.status_code == 200
    data = response.json()
    assert len(data["top_predictions"]) <= 3
    assert len(data["top_predictions"]) > 0
    top = data["top_predictions"][0]
    assert "class_name" in top
    assert "confidence" in top
    assert top["confidence"] > 0.0

def test_invalid_base64_payload():
    response = client.post("/predict", json={"image": "not_a_valid_base64_image_string", "top_k": 3})
    assert response.status_code == 200
    data = response.json()
    assert data["recognized"] is False
    assert "invalid" in data["message"].lower() or "corrupted" in data["message"].lower()
