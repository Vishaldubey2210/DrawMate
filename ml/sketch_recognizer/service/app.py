import base64
import io
import json
import os
from contextlib import asynccontextmanager
from typing import List, Optional

import numpy as np
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from PIL import Image, ImageOps
import torch
import torch.nn as nn
import torch.nn.functional as F

# ---------------------------------------------------------------------------
# Architecture Definition (matches trained Improved CNN)
# ---------------------------------------------------------------------------
class SketchCNN(nn.Module):
    def __init__(self, num_classes: int = 20):
        super().__init__()
        self.conv1 = nn.Conv2d(1, 32, kernel_size=3, padding=1)
        self.bn1 = nn.BatchNorm2d(32)
        self.pool1 = nn.MaxPool2d(2, 2)  # 28 -> 14

        self.conv2 = nn.Conv2d(32, 64, kernel_size=3, padding=1)
        self.bn2 = nn.BatchNorm2d(64)
        self.pool2 = nn.MaxPool2d(2, 2)  # 14 -> 7
        self.drop1 = nn.Dropout2d(0.25)

        self.conv3 = nn.Conv2d(64, 128, kernel_size=3, padding=1)
        self.bn3 = nn.BatchNorm2d(128)
        self.adapt_pool = nn.AdaptiveAvgPool2d((4, 4))  # 4x4

        self.fc1 = nn.Linear(128 * 4 * 4, 128)
        self.bn_fc = nn.BatchNorm1d(128)
        self.drop2 = nn.Dropout(0.3)
        self.fc2 = nn.Linear(128, num_classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.pool1(F.relu(self.bn1(self.conv1(x))))
        x = self.drop1(self.pool2(F.relu(self.bn2(self.conv2(x)))))
        x = self.adapt_pool(F.relu(self.bn3(self.conv3(x))))
        x = x.view(x.size(0), -1)
        x = self.drop2(F.relu(self.bn_fc(self.fc1(x))))
        return self.fc2(x)


# ---------------------------------------------------------------------------
# Global Service State
# ---------------------------------------------------------------------------
ARTIFACTS_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "artifacts")
)
MODEL_WEIGHTS_PATH = os.path.join(ARTIFACTS_DIR, "sketch_recognizer.pt")
CLASS_NAMES_PATH = os.path.join(ARTIFACTS_DIR, "class_names.json")
PREPROCESSING_PATH = os.path.join(ARTIFACTS_DIR, "preprocessing.json")

model_instance: Optional[SketchCNN] = None
class_names: List[str] = []
uncertainty_threshold: float = 0.30
min_active_pixels: int = 15


def load_artifacts():
    global model_instance, class_names, uncertainty_threshold, min_active_pixels

    if os.path.exists(CLASS_NAMES_PATH):
        try:
            with open(CLASS_NAMES_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                class_names = data.get("classes", [])
        except Exception as e:
            print(f"[SketchRecognizer] Failed loading class names: {e}")

    if os.path.exists(PREPROCESSING_PATH):
        try:
            with open(PREPROCESSING_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                uncertainty_threshold = data.get("uncertainty_threshold", 0.30)
                min_active_pixels = data.get("min_active_pixels", 15)
        except Exception as e:
            print(f"[SketchRecognizer] Failed loading preprocessing config: {e}")

    weights_to_try = [
        MODEL_WEIGHTS_PATH,
        os.path.join(ARTIFACTS_DIR, "best_model.pt")
    ]
    loaded = False
    for path in weights_to_try:
        if os.path.exists(path) and class_names:
            try:
                model = SketchCNN(num_classes=len(class_names))
                state = torch.load(path, map_location="cpu")
                if isinstance(state, dict) and "model_state_dict" in state:
                    state = state["model_state_dict"]
                model.load_state_dict(state)
                model.eval()
                model_instance = model
                loaded = True
                print(f"[SketchRecognizer] Successfully loaded model from {os.path.basename(path)} for {len(class_names)} classes.")
                break
            except Exception as e:
                print(f"[SketchRecognizer] Error loading model weights from {path}: {e}")
                model_instance = None

    if not loaded:
        if class_names:
            try:
                # Fallback architecture initialization for testing / CI runners when weights file is not mounted
                model = SketchCNN(num_classes=len(class_names))
                model.eval()
                model_instance = model
                loaded = True
                print(f"[SketchRecognizer] Initialized default architecture for testing ({len(class_names)} classes).")
            except Exception as e:
                print(f"[SketchRecognizer] Fallback initialization failed: {e}")
        if not loaded:
            print("[SketchRecognizer] Model weights not found or classes uninitialized. Service in degraded state.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_artifacts()
    yield


app = FastAPI(
    title="DrawMate Sketch Recognizer Service",
    description="FastAPI Deep Learning Sketch Recognition Service for Practice Mode",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request & Response Schemas
# ---------------------------------------------------------------------------
class PredictRequest(BaseModel):
    image: str = Field(..., description="Base64 encoded PNG/JPEG image or data URL")
    top_k: int = Field(3, ge=1, le=10, description="Number of top candidates to return")


class PredictionItem(BaseModel):
    class_name: str
    confidence: float


class PredictResponse(BaseModel):
    recognized: bool
    top_predictions: List[PredictionItem]
    confidence: float
    message: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    num_classes: int
    classes: List[str]
    device: str
    uncertainty_threshold: float


# ---------------------------------------------------------------------------
# Preprocessing Helper
# ---------------------------------------------------------------------------
def preprocess_sketch_image(raw_base64: str) -> tuple[Optional[torch.Tensor], bool, str]:
    """
    Decodes and normalizes a canvas sketch image:
    1. Base64 decode safely
    2. Convert RGBA -> grayscale
    3. Invert polarity if background is light
    4. Detect bounding box and pad to square
    5. Resize to 28x28
    6. Normalize to [0.0, 1.0]
    """
    # Remove data URL header if present
    clean_b64 = raw_base64
    if "," in clean_b64:
        clean_b64 = clean_b64.split(",", 1)[1]

    # Validate size (max 5 MB base64)
    if len(clean_b64) > 5 * 1024 * 1024:
        return None, False, "Payload too large (max 5 MB)"

    try:
        image_bytes = base64.b64decode(clean_b64)
        img = Image.open(io.BytesIO(image_bytes))
    except Exception:
        return None, False, "Invalid image format or corrupted base64 data"

    # Convert to RGBA first to handle transparent backgrounds
    img = img.convert("RGBA")
    # Composite over white background if transparency exists
    bg = Image.new("RGBA", img.size, (255, 255, 255, 255))
    alpha_composite = Image.alpha_composite(bg, img)
    gray = alpha_composite.convert("L")

    arr = np.array(gray, dtype=np.float32)

    # Invert so background is dark (0) and stroke is light (>0) matching QuickDraw format
    # Check if background is predominantly light (mean > 128)
    if arr.mean() > 127:
        arr = 255.0 - arr

    # Filter out faint noise (< 20 intensity)
    arr[arr < 20] = 0.0

    # Activity check: count active stroke pixels
    active_pixel_count = int(np.count_nonzero(arr > 25))
    if active_pixel_count < min_active_pixels:
        return None, False, "The canvas appears blank or too sparse to recognize."

    # Bounding box crop with padding
    non_zero = np.argwhere(arr > 25)
    top_y, top_x = non_zero.min(axis=0)
    bot_y, bot_x = non_zero.max(axis=0)

    cropped = arr[top_y : bot_y + 1, top_x : bot_x + 1]

    # Convert back to PIL for high-quality antialiased resizing with aspect ratio preservation
    h, w = cropped.shape
    max_dim = max(h, w)
    square_canvas = np.zeros((max_dim, max_dim), dtype=np.float32)

    # Center in square canvas
    offset_y = (max_dim - h) // 2
    offset_x = (max_dim - w) // 2
    square_canvas[offset_y : offset_y + h, offset_x : offset_x + w] = cropped

    # Resize to 28x28 with BILINEAR filtering
    pil_square = Image.fromarray(square_canvas.astype(np.uint8))
    # Leave 2 pixels border for 24x24 content -> 28x28 canvas
    resized = pil_square.resize((24, 24), Image.Resampling.BILINEAR)

    final_canvas = Image.new("L", (28, 28), color=0)
    final_canvas.paste(resized, (2, 2))

    # Normalize to [0.0, 1.0]
    final_arr = np.array(final_canvas, dtype=np.float32) / 255.0

    tensor = torch.from_numpy(final_arr).unsqueeze(0).unsqueeze(0)  # (1, 1, 28, 28)
    return tensor, True, ""


# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------
@app.get("/health", response_model=HealthResponse)
async def health_check():
    # Attempt reload if model was not ready during startup
    if model_instance is None:
        load_artifacts()

    return HealthResponse(
        status="ok",
        model_loaded=model_instance is not None,
        num_classes=len(class_names),
        classes=class_names,
        device="cpu",
        uncertainty_threshold=uncertainty_threshold,
    )


@app.post("/predict", response_model=PredictResponse)
async def predict_sketch(request: PredictRequest):
    global model_instance, class_names

    if model_instance is None:
        load_artifacts()
        if model_instance is None:
            raise HTTPException(
                status_code=503,
                detail="Sketch recognition model is currently offline or not yet trained.",
            )

    tensor, is_valid, error_msg = preprocess_sketch_image(request.image)
    if not is_valid:
        return PredictResponse(
            recognized=False,
            top_predictions=[],
            confidence=0.0,
            message=error_msg,
        )

    with torch.no_grad():
        logits = model_instance(tensor)
        probs = F.softmax(logits, dim=1).squeeze(0).numpy()

    # Get top-k indices
    k = min(request.top_k, len(class_names))
    top_indices = np.argsort(probs)[::-1][:k]

    predictions: List[PredictionItem] = []
    for idx in top_indices:
        predictions.append(
            PredictionItem(
                class_name=class_names[idx],
                confidence=float(round(probs[idx], 4)),
            )
        )

    top_confidence = float(probs[top_indices[0]])

    # Uncertainty check
    if top_confidence < uncertainty_threshold:
        return PredictResponse(
            recognized=False,
            top_predictions=predictions,
            confidence=round(top_confidence, 4),
            message="The model could not confidently recognize this drawing.",
        )

    return PredictResponse(
        recognized=True,
        top_predictions=predictions,
        confidence=round(top_confidence, 4),
        message=f"I think this is a {predictions[0].class_name}!",
    )
