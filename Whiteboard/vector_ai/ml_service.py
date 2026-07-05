from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import torch
import torch.nn as nn
import math
import os
from typing import List

app = FastAPI(title="TogeDraw ML Moderation Service")

# ==========================================
# АРХИТЕКТУРА МОДЕЛИ (точно как в interferenceApp.py)
# ==========================================
class StrokeClassifier(nn.Module):
    def __init__(self, input_dim=2, hidden_dim=64, num_layers=2, dropout=0.3):
        super(StrokeClassifier, self).__init__()
        
        self.stroke_cnn = nn.Sequential(
            nn.Conv1d(input_dim, 32, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool1d(2),
            nn.Conv1d(32, 64, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool1d(2),
            nn.Flatten()
        )
        self.cnn_output_dim = 64 * (50 // 4) 
        
        self.lstm = nn.LSTM(
            input_size=self.cnn_output_dim,
            hidden_size=hidden_dim,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0
        )
        
        self.classifier = nn.Sequential(
            nn.Linear(hidden_dim, 32),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(32, 1),
            nn.Sigmoid()
        )
    
    def forward(self, x):
        batch_size, num_strokes, points, dims = x.shape
        x = x.view(batch_size * num_strokes, dims, points)
        stroke_features = self.stroke_cnn(x)
        stroke_features = stroke_features.view(batch_size, num_strokes, -1)
        lstm_out, (h_n, c_n) = self.lstm(stroke_features)
        out = h_n[-1]
        out = self.classifier(out)
        return out.squeeze()

# ==========================================
# ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
# ==========================================
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
model = None
MAX_STROKES = 20
MAX_POINTS = 50

# ==========================================
# МОДЕЛИ ДАННЫХ
# ==========================================
class DrawingRequest(BaseModel):
    strokes: List[List[List[float]]]

class ModerationResult(BaseModel):
    is_safe: bool
    confidence: float
    probability_unsafe: float
    message: str

# ==========================================
# ЗАГРУЗКА МОДЕЛИ ПРИ СТАРТЕ
# ==========================================
@app.on_event("startup")
async def load_model():
    global model
    model = StrokeClassifier().to(device)
    
    model_path = 'best_model.pth'
    if not os.path.exists(model_path):
        model_path = 'drawing_classifier.pth'
    
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model file not found: {model_path}")
    
    checkpoint = torch.load(model_path, map_location=device, weights_only=False)
    if 'model_state_dict' in checkpoint:
        model.load_state_dict(checkpoint['model_state_dict'])
    else:
        model.load_state_dict(checkpoint)
    
    model.eval()
    print(f"✅ Model loaded successfully on {device}")

# ==========================================
# ПРЕПРОЦЕССИНГ (точно как в interferenceApp.py)
# ==========================================
def preprocess_drawing(strokes: List[List[List[float]]]) -> torch.Tensor:
    # 1. Ограничиваем/добавляем штрихи
    if len(strokes) > MAX_STROKES:
        strokes = strokes[:MAX_STROKES]
    else:
        while len(strokes) < MAX_STROKES:
            strokes.append([[0.0, 0.0]] * MAX_POINTS)
    
    # 2. Паддим точки
    padded_strokes = []
    for stroke in strokes:
        if len(stroke) >= MAX_POINTS:
            padded_strokes.append(stroke[:MAX_POINTS])
        else:
            padding = [[0.0, 0.0]] * (MAX_POINTS - len(stroke))
            padded_strokes.append(stroke + padding)
    
    # 3. Превращаем в тензор [1, 20, 50, 2]
    tensor = torch.FloatTensor(padded_strokes).unsqueeze(0).to(device)
    return tensor

# ==========================================
# API ENDPOINTS
# ==========================================
@app.get("/")
async def root():
    return {
        "service": "TogeDraw ML Moderation",
        "status": "running",
        "device": str(device)
    }

@app.post("/moderate", response_model=ModerationResult)
async def moderate_drawing(request: DrawingRequest):
    if not request.strokes:
        raise HTTPException(status_code=400, detail="No strokes provided")
    
    try:
        # 1. Препроцессинг
        tensor = preprocess_drawing(request.strokes)
        
        # 2. Инференс
        with torch.no_grad():
            output = model(tensor)
            prob_unsafe = output.item()
        
        prob_safe = 1.0 - prob_unsafe
        threshold = 0.5
        is_safe = prob_unsafe <= threshold
        
        return ModerationResult(
            is_safe=is_safe,
            confidence=max(prob_safe, prob_unsafe) * 100,
            probability_unsafe=prob_unsafe,
            message="✅ Safe content" if is_safe else "⛔ Unsafe content detected"
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Moderation failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)