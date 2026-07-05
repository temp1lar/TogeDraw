import tkinter as tk
from tkinter import ttk, messagebox
import sqlite3
import json
import os

import uuid
import math
from datetime import datetime

class VectorCollectorApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Сборщик векторов для ИИ-фильтра (Оптимизированный)")
        
        # Настройки холста
        self.canvas_width = 500
        self.canvas_height = 500
        self.min_distance = 4  # Минимальное расстояние в пикселях для записи новой точки
        
        # Данные для векторизации
        self.current_stroke = []
        self.all_strokes = []
        self.last_x, self.last_y = 0, 0
        
        # Инициализация БД
        self.init_db()
        
        # Создание интерфейса
        self.setup_ui()
        self.update_stats() # Загрузка статистики при старте
        
 # <-- Добавь этот импорт в самый верх файла

# ... (остальной код без изменений)

    def init_db(self):
        # 1. Получаем абсолютный путь к папке, где лежит сам Python-скрипт
        script_dir = os.path.dirname(os.path.abspath(__file__))
        db_path = os.path.join(script_dir, 'kids_safety_vectors.db')
        
        # 2. Подключаемся с таймаутом 10 секунд (на случай, если файл временно заблокирован)
        self.conn = sqlite3.connect(db_path, timeout=10)
        self.cursor = self.conn.cursor()
        
        # 3. Включаем WAL режим (СПАСАЕТ от повреждений при внезапном закрытии/краше)
        self.cursor.execute('PRAGMA journal_mode=WAL;')
        
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS drawings (
                id TEXT PRIMARY KEY,
                vector_data TEXT,
                label TEXT,
                byte_size INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        self.conn.commit()
        
        print(f"✅ База данных подключена: {db_path}") # Для отладки, чтобы видеть в консоли, где лежит БД
    def setup_ui(self):
        # Холст
        self.canvas = tk.Canvas(self.root, width=self.canvas_width, height=self.canvas_height, 
                                bg='white', cursor='crosshair')
        self.canvas.pack(pady=10)
        
        self.canvas.bind("<Button-1>", self.start_stroke)
        self.canvas.bind("<B1-Motion>", self.draw_stroke)
        self.canvas.bind("<ButtonRelease-1>", self.end_stroke)
        
        # Панель управления
        control_frame = tk.Frame(self.root)
        control_frame.pack(fill=tk.X, padx=10, pady=5)
        
        tk.Label(control_frame, text="Категория:").pack(side=tk.LEFT, padx=5)
        self.label_var = tk.StringVar(value="safe")
        
        tk.Radiobutton(control_frame, text="✅ Безопасно", variable=self.label_var, 
                       value="safe", bg="#d4edda").pack(side=tk.LEFT, padx=5)
        tk.Radiobutton(control_frame, text="⛔ Опасно", variable=self.label_var, 
                       value="unsafe", bg="#f8d7da").pack(side=tk.LEFT, padx=5)
        
        # Кнопки
        btn_frame = tk.Frame(self.root)
        btn_frame.pack(fill=tk.X, padx=10, pady=10)
        
        tk.Button(btn_frame, text="🗑️ Очистить", command=self.clear_canvas, 
                  bg="#f0f0f0").pack(side=tk.LEFT, expand=True, fill=tk.X, padx=5)
        
        self.save_btn = tk.Button(btn_frame, text="💾 Векторизовать и Сохранить", command=self.save_to_db, 
                                  bg="#007bff", fg="white", font=("Arial", 10, "bold"))
        self.save_btn.pack(side=tk.LEFT, expand=True, fill=tk.X, padx=5)

        # Статус и статистика
        self.status_label = tk.Label(self.root, text="Готов к рисованию...", fg="blue")
        self.status_label.pack(pady=2)

        self.stats_label = tk.Label(self.root, text="Статистика БД: ...", 
                                    font=("Arial", 9, "italic"), fg="#555")
        self.stats_label.pack(pady=5)

    def start_stroke(self, event):
        self.current_stroke = []
        self.last_x, self.last_y = event.x, event.y
        norm_x = round(event.x / self.canvas_width, 3)
        norm_y = round(event.y / self.canvas_height, 3)
        self.current_stroke.append([norm_x, norm_y])

    def draw_stroke(self, event):
        # 1. Рисуем на холсте ВСЕ точки (для плавности визуала)
        self.canvas.create_line(self.last_x, self.last_y, event.x, event.y, 
                                fill="black", width=3, capstyle=tk.ROUND, smooth=True)
        
        # 2. Считаем расстояние для ОПТИМИЗАЦИИ данных
        dx = event.x - self.last_x
        dy = event.y - self.last_y
        distance = math.hypot(dx, dy)
        
        # Записываем точку в векторные данные только если сдвинулись достаточно далеко
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
        self.status_label.config(text="Холст очищен.", fg="blue")

    def save_to_db(self):
        if not self.all_strokes:
            messagebox.showwarning("Пусто", "Нарисуйте что-нибудь перед сохранением!")
            return

        drawing_id = str(uuid.uuid4())
        label = self.label_var.get()
        
        # Формируем JSON
        vector_json = json.dumps({"strokes": self.all_strokes})
        
        # Считаем вес в байтах
        byte_size = len(vector_json.encode('utf-8'))
        
        # Сохраняем в БД (добавили поле byte_size)
        self.cursor.execute('''
            INSERT INTO drawings (id, vector_data, label, byte_size)
            VALUES (?, ?, ?, ?)
        ''', (drawing_id, vector_json, label, byte_size))
        self.conn.commit()
        
        # Фидбек с размером
        size_kb = byte_size / 1024
        self.status_label.config(
            text=f"✅ Сохранено! ID: {drawing_id[:8]}... | Лейбл: {label} | Вес: {byte_size} байт ({size_kb:.2f} КБ)", 
            fg="green"
        )
        
        self.clear_canvas()
        self.update_stats() # Обновляем счетчики

    def update_stats(self):
        """Запрашивает из БД количество рисунков по категориям и общий вес"""
        self.cursor.execute('SELECT label, COUNT(id), SUM(byte_size) FROM drawings GROUP BY label')
        rows = self.cursor.fetchall()
        
        stats = {"safe": 0, "unsafe": 0}
        total_bytes = 0
        
        for row in rows:
            label, count, size = row
            if label in stats:
                stats[label] = count
            total_bytes += (size or 0)
            
        total_kb = total_bytes / 1024
        
        self.stats_label.config(
            text=f"📊 БД: ✅ Безопасно: {stats['safe']} | ⛔ Опасно: {stats['unsafe']} | 💾 Общий вес БД: {total_kb:.1f} КБ"
        )

    def on_closing(self):
        self.conn.close()
        self.root.destroy()

if __name__ == "__main__":
    root = tk.Tk()
    app = VectorCollectorApp(root)
    root.protocol("WM_DELETE_WINDOW", app.on_closing)
    root.mainloop()