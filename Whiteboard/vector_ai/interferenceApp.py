import tkinter as tk
from tkinter import messagebox
import torch
import torch.nn as nn
import math
import os

# ==========================================
# 1. АРХИТЕКТУРА МОДЕЛИ (Должна точно совпадать с той, что в ноутбуке!)
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
# 2. ГЛАВНОЕ ПРИЛОЖЕНИЕ ПРОВЕРКИ
# ==========================================
class SafetyCheckerApp:
    def __init__(self, root):
        self.root = root
        self.root.title("🛡️ ИИ-Фильтр: Проверка рисунков")
        self.root.geometry("600x650")
        
        # Настройки
        self.canvas_width = 500
        self.canvas_height = 500
        self.min_distance = 4
        self.max_strokes = 20
        self.max_points = 50
        
        # Данные рисунка
        self.current_stroke = []
        self.all_strokes = []
        self.last_x, self.last_y = 0, 0
        
        # Загрузка модели
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.model = self.load_model()
        
        # Интерфейс
        self.setup_ui()

    def load_model(self):
        """Загрузка весов обученной модели"""
        import sys
        
        model = StrokeClassifier().to(self.device)
        
        # Ищем файл модели
        model_path = 'drawing_classifier.pth'
        if not os.path.exists(model_path):
            model_path = 'best_model.pth'
            
        if not os.path.exists(model_path):
            messagebox.showerror("Ошибка", f"Файл модели не найден!\nПоложите {model_path} в папку со скриптом.")
            self.root.destroy()
            sys.exit(1)  # ✅ КРИТИЧНО: полностью останавливаем программу!

        try:
            checkpoint = torch.load(model_path, map_location=self.device, weights_only=False)
            if 'model_state_dict' in checkpoint:
                model.load_state_dict(checkpoint['model_state_dict'])
            else:
                model.load_state_dict(checkpoint)
                
            model.eval()
            print(f"✅ Модель успешно загружена с устройства: {self.device}")
            return model
        except Exception as e:
            messagebox.showerror("Ошибка загрузки", f"Не удалось загрузить модель:\n{e}")
            self.root.destroy()
            sys.exit(1)  # ✅ И здесь тоже!

    def setup_ui(self):
        # Холст
        self.canvas = tk.Canvas(self.root, width=self.canvas_width, height=self.canvas_height, 
                                bg='white', cursor='crosshair', highlightthickness=2, highlightbackground="#ccc")
        self.canvas.pack(pady=10)
        
        self.canvas.bind("<Button-1>", self.start_stroke)
        self.canvas.bind("<B1-Motion>", self.draw_stroke)
        self.canvas.bind("<ButtonRelease-1>", self.end_stroke)
        
        # Кнопки
        btn_frame = tk.Frame(self.root)
        btn_frame.pack(fill=tk.X, padx=20, pady=10)
        
        tk.Button(btn_frame, text="🗑️ Очистить", command=self.clear_canvas, 
                  font=("Arial", 12), bg="#f0f0f0").pack(side=tk.LEFT, expand=True, fill=tk.X, padx=5)
        
        tk.Button(btn_frame, text="🔍 ПРОВЕРИТЬ БЕЗОПАСНОСТЬ", command=self.check_drawing, 
                  font=("Arial", 12, "bold"), bg="#007bff", fg="white").pack(side=tk.LEFT, expand=True, fill=tk.X, padx=5)

        # Большой лейбл для результата
        self.result_label = tk.Label(self.root, text="Нарисуйте что-нибудь и нажмите Проверить", 
                                     font=("Arial", 16, "bold"), fg="#555", pady=20)
        self.result_label.pack(fill=tk.X)
        
        self.confidence_label = tk.Label(self.root, text="", font=("Arial", 12), fg="#888")
        self.confidence_label.pack()

    def start_stroke(self, event):
        self.current_stroke = []
        self.last_x, self.last_y = event.x, event.y
        norm_x = round(event.x / self.canvas_width, 3)
        norm_y = round(event.y / self.canvas_height, 3)
        self.current_stroke.append([norm_x, norm_y])

    def draw_stroke(self, event):
        self.canvas.create_line(self.last_x, self.last_y, event.x, event.y, 
                                fill="black", width=3, capstyle=tk.ROUND, smooth=True)
        
        dx = event.x - self.last_x
        dy = event.y - self.last_y
        distance = math.hypot(dx, dy)
        
        if distance >= self.min_distance:
            norm_x = round(event.x / self.canvas_width, 3)
            norm_y = round(event.y / self.canvas_height, 3)
            self.current_stroke.append([norm_x, norm_y])
            self.last_x, self.last_y = event.x, event.y

    def end_stroke(self, event):
        if len(self.current_stroke) > 1:
            self.all_strokes.append(self.current_stroke)

    def clear_canvas(self):
        self.canvas.delete("all")
        self.all_strokes = []
        self.current_stroke = []
        self.result_label.config(text="Нарисуйте что-нибудь и нажмите Проверить", fg="#555")
        self.confidence_label.config(text="")
        self.canvas.config(highlightbackground="#ccc")

    def preprocess_for_model(self):
        """Подготовка векторов точно так же, как в ноутбуке при обучении"""
        strokes = self.all_strokes
        
        # 1. Ограничиваем/добавляем штрихи до max_strokes
        if len(strokes) > self.max_strokes:
            strokes = strokes[:self.max_strokes]
        else:
            while len(strokes) < self.max_strokes:
                strokes.append([[0.0, 0.0]] * self.max_points)
        
        # 2. Паддим точки внутри каждого штриха до max_points
        padded_strokes = []
        for stroke in strokes:
            if len(stroke) >= self.max_points:
                padded_strokes.append(stroke[:self.max_points])
            else:
                padding = [[0.0, 0.0]] * (self.max_points - len(stroke))
                padded_strokes.append(stroke + padding)
                
        # 3. Превращаем в тензор [1, 20, 50, 2]
        tensor = torch.FloatTensor(padded_strokes).unsqueeze(0).to(self.device)
        return tensor

    def check_drawing(self):
        if not self.all_strokes:
            messagebox.showwarning("Пусто", "Сначала нарисуйте что-нибудь!")
            return
            
        if not self.model:
            return

        # 1. Подготовка данных
        tensor = self.preprocess_for_model()
        
        # 2. Инференс (Предсказание)
        with torch.no_grad():
            output = self.model(tensor)
            # output - это вероятность того, что рисунок UNSAFE (от 0.0 до 1.0)
            prob_unsafe = output.item() 
            
        prob_safe = 1.0 - prob_unsafe
        
        # 3. Визуализация результата
        # Порог срабатывания 50%. Можно менять (например, 0.7 для большей параноидальности)
        threshold = 0.5 
        
        if prob_unsafe > threshold:
            # ОПАСНО
            self.result_label.config(text="⛔ ОПАСНЫЙ КОНТЕНТ!", fg="#dc3545")
            self.canvas.config(highlightbackground="#dc3545", highlightthickness=4)
            self.confidence_label.config(text=f"ИИ уверен на {prob_unsafe*100:.1f}%, что это запрещено", fg="#dc3545")
        else:
            # БЕЗОПАСНО
            self.result_label.config(text="✅ РИСУНОК БЕЗОПАСЕН", fg="#28a745")
            self.canvas.config(highlightbackground="#28a745", highlightthickness=4)
            self.confidence_label.config(text=f"ИИ уверен на {prob_safe*100:.1f}%, что всё хорошо", fg="#28a745")

if __name__ == "__main__":
    root = tk.Tk()
    app = SafetyCheckerApp(root)
    root.mainloop()