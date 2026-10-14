# Quick, Draw! Deep Learning Sketch Recognizer

This module implements the deep learning sketch recognition service for the DrawMate SaaS platform (AI Practice Mode).

---

## 1. Dataset Attribution & Storage Footprint
- **Dataset Source**: Official Google Quick, Draw! Dataset
  - Documentation: [https://github.com/googlecreativelab/quickdraw-dataset](https://github.com/googlecreativelab/quickdraw-dataset)
  - Categories: [categories.txt](file:///home/vishal/Downloads/web3task/data/quickdraw/categories.txt)
  - Raw Bitmaps: `https://storage.googleapis.com/quickdraw_dataset/full/numpy_bitmap/{category}.npy`
- **License**: Creative Commons Attribution 4.0 International (CC BY 4.0). See [DATASET_LICENSE.md](file:///home/vishal/Downloads/web3task/data/quickdraw/DATASET_LICENSE.md).
- **Downloaded Footprint**:
  - Number of classes: **20**
  - Total drawing samples: **3,010,742**
  - Total disk footprint: **2.36 GB** (Strictly respects the 10 GB budget limit)
  - Classes: `airplane`, `apple`, `banana`, `bicycle`, `bird`, `car`, `cat`, `chair`, `clock`, `cloud`, `dog`, `fish`, `flower`, `house`, `key`, `moon`, `mountain`, `pizza`, `tree`, `umbrella`
  - Validation: SHA-256 verified in `data/quickdraw/download_manifest.json`

---

## 2. Training Experiments & Real Metrics
The model was trained and evaluated via the fully executed Jupyter Notebook:
`ml/sketch_recognizer/notebooks/01_quickdraw_cnn_experiments.ipynb`

### Experiments Summary
- **Dataset Partition**: 30,000 balanced drawings (1,500/class), 70% Train (21,000), 15% Val (4,500), 15% Test (4,500).
- **Experiment 1 (Baseline CNN)**:
  - 3-layer CNN without batch normalization or dropout.
  - Validation Loss: `0.7027`
  - Validation Top-1 Accuracy: `79.69%`
  - Validation Top-3 Accuracy: `92.60%`
  - Runtime: 38.0s
- **Experiment 2 (Improved CNN — Selected Architecture)**:
  - 3 Conv blocks with `BatchNorm2d`, `Dropout2d(0.25)`, `AdaptiveAvgPool2d((4,4))`, and Dense `Dropout(0.30)`.
  - Validation Loss: `0.4175`
  - Validation Top-1 Accuracy: `87.60%`
  - Validation Top-3 Accuracy: `95.78%`
  - Runtime: 52.1s

### Held-Out Test Evaluation (4,500 Unseen Sketches)
- **Top-1 Accuracy**: **88.38%**
- **Top-3 Accuracy**: **95.84%**
- **Macro-Precision**: **88.47%**
- **Macro-Recall**: **88.38%**
- **Macro-F1 Score**: **88.30%**

---

## 3. Serialized Artifacts
All verified artifacts are located in `ml/sketch_recognizer/artifacts/`:
- `sketch_recognizer.pt` (1.45 MB) — Trained PyTorch weights
- `best_model.pt` (1.45 MB) — Checkpoint with model metadata
- `class_names.json` — 20 supported class labels
- `preprocessing.json` — Preprocessing contract, bounding box logic, uncertainty threshold (0.30)
- `evaluation_metrics.json` — Held-out test evaluation scores
- `training_config.json` — Hyperparameters, learning rate, optimizer settings
- `training_history.json` — Per-epoch loss and accuracy histories for both experiments
- `experiment_results.json` — Comparison metrics between Experiment 1 and 2
- `confusion_matrix.png` — Heatmap confusion matrix across all 20 classes
- `sample_classes.png` — Representative sketches from each category

---

## 4. Running the Inference Service
The FastAPI inference service runs on port 8000:

```bash
# Start service
uvicorn ml.sketch_recognizer.service.app:app --host 0.0.0.0 --port 8000

# Health check
curl http://localhost:8000/health

# Run test suite
python3 -m pytest ml/sketch_recognizer/tests/
```
