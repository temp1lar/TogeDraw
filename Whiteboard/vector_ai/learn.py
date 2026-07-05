# %% [markdown]
# # 🎨 Обучение ИИ-фильтра для детских рисунков
# ## Классификация векторных данных (Safe/Unsafe)
# 
# Этот ноутбук включает:
# - Загрузку и анализ данных из SQLite
# - Визуализацию векторных рисунков
# - **Мощную аугментацию данных** (повороты, отражения, шум, удаление точек)
# - **Oversampling unsafe классов** для борьбы с дисбалансом
# - **Focal Loss** для фокуса на сложных примерах
# - Обучение LSTM модели с отслеживанием Unsafe Accuracy
# - Детальные метрики и инфографику
# - **Анализ False Positive / False Negative**

# %%
# Установка необходимых библиотек (раскомментируй при первом запуске)
# !pip install torch torchvision torchaudio
# !pip install matplotlib seaborn scikit-learn pandas numpy
# !pip install jupyter ipywidgets

# %%
import sqlite3
import json
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from sklearn.model_selection import train_test_split
from sklearn.metrics import (confusion_matrix, classification_report, 
                             roc_curve, auc, precision_recall_curve)
from pathlib import Path
import random
import warnings
warnings.filterwarnings('ignore')

# Настройка стилей для красивых графиков
plt.style.use('seaborn-v0_8-whitegrid')
sns.set_palette("husl")
plt.rcParams['figure.figsize'] = (10, 6)
plt.rcParams['font.size'] = 10

print(f"✅ PyTorch version: {torch.__version__}")
print(f"✅ CUDA available: {torch.cuda.is_available()}")

# %% [markdown]
# ## 📊 1. Загрузка и анализ данных

# %%
class DrawingDataset:
    """Класс для загрузки и обработки данных из SQLite"""
    
    def __init__(self, db_path='kids_safety_vectors.db'):
        self.db_path = Path(db_path)
        self.data = None
        self.df = None
        
    def load_data(self):
        """Загрузка данных из базы"""
        if not self.db_path.exists():
            raise FileNotFoundError(f"База данных не найдена: {self.db_path}")
            
        conn = sqlite3.connect(self.db_path)
        
        # Загрузка всех данных
        query = """
            SELECT id, vector_data, label, byte_size, created_at 
            FROM drawings
        """
        self.df = pd.read_sql_query(query, conn)
        conn.close()
        
        # Парсинг JSON векторов
        self.df['vectors'] = self.df['vector_data'].apply(json.loads)
        
        # Извлечение количества штрихов и точек
        self.df['num_strokes'] = self.df['vectors'].apply(lambda x: len(x.get('strokes', [])))
        self.df['total_points'] = self.df['vectors'].apply(
            lambda x: sum(len(stroke) for stroke in x.get('strokes', []))
        )
        
        # Кодирование лейблов
        self.df['label_encoded'] = self.df['label'].map({'safe': 0, 'unsafe': 1})
        
        print(f"✅ Загружено {len(self.df)} рисунков")
        return self.df
    
    def get_statistics(self):
        """Получение статистики по датасету"""
        if self.df is None:
            self.load_data()
            
        stats = {
            'total_samples': len(self.df),
            'safe_samples': len(self.df[self.df['label'] == 'safe']),
            'unsafe_samples': len(self.df[self.df['label'] == 'unsafe']),
            'avg_strokes': self.df['num_strokes'].mean(),
            'avg_points': self.df['total_points'].mean(),
            'avg_size_bytes': self.df['byte_size'].mean(),
            'total_size_kb': self.df['byte_size'].sum() / 1024
        }
        
        return stats

# %%
# Загрузка данных
dataset = DrawingDataset()
try:
    df = dataset.load_data()
    stats = dataset.get_statistics()
    
    print("\n📊 СТАТИСТИКА ДАТАСЕТА:")
    print(f"   Всего образцов: {stats['total_samples']}")
    print(f"   ✅ Безопасных: {stats['safe_samples']}")
    print(f"   ⛔ Опасных: {stats['unsafe_samples']}")
    print(f"   Среднее кол-во штрихов: {stats['avg_strokes']:.1f}")
    print(f"   Среднее кол-во точек: {stats['avg_points']:.1f}")
    print(f"   Общий размер БД: {stats['total_size_kb']:.2f} КБ")
    
except FileNotFoundError as e:
    print(f"❌ {e}")
    print("💡 Убедитесь, что файл kids_safety_vectors.db находится в той же папке")

# %% [markdown]
# ## 📈 2. Визуализация и анализ данных

# %%
def plot_dataset_overview(df):
    """Создание обзора датасета"""
    fig = plt.figure(figsize=(15, 10))
    gs = plt.GridSpec(2, 3, figure=fig)
    
    # 1. Распределение классов
    ax1 = plt.subplot(gs[0, 0])
    labels = ['Safe', 'Unsafe']
    counts = [len(df[df['label']=='safe']), len(df[df['label']=='unsafe'])]
    colors = ['#2ecc71', '#e74c3c']
    bars = ax1.bar(labels, counts, color=colors, edgecolor='black', linewidth=1.2)
    ax1.set_ylabel('Количество')
    ax1.set_title('📊 Распределение классов', fontweight='bold')
    for bar, count in zip(bars, counts):
        ax1.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.5, 
                str(count), ha='center', va='bottom', fontweight='bold')
    
    # 2. Распределение количества штрихов
    ax2 = plt.subplot(gs[0, 1])
    sns.histplot(data=df, x='num_strokes', hue='label', multiple='stack', 
                ax=ax2, palette=['green', 'red'], alpha=0.7)
    ax2.set_title('📏 Распределение штрихов', fontweight='bold')
    ax2.set_xlabel('Количество штрихов')
    
    # 3. Распределение количества точек
    ax3 = plt.subplot(gs[0, 2])
    sns.histplot(data=df, x='total_points', hue='label', multiple='stack',
                ax=ax3, palette=['green', 'red'], alpha=0.7)
    ax3.set_title('⚡ Распределение точек', fontweight='bold')
    ax3.set_xlabel('Общее количество точек')
    
    # 4. Размер файлов по классам
    ax4 = plt.subplot(gs[1, 0])
    df_plot = df.groupby('label')['byte_size'].agg(['mean', 'std']).reset_index()
    sns.barplot(data=df_plot, x='label', y='mean', ax=ax4, 
               palette=['green', 'red'], edgecolor='black')
    ax4.set_ylabel('Средний размер (байты)')
    ax4.set_title('💾 Средний размер рисунков', fontweight='bold')
    
    # 5. Scatter plot: штрихи vs точки
    ax5 = plt.subplot(gs[1, 1])
    scatter = ax5.scatter(df['num_strokes'], df['total_points'], 
                         c=df['label_encoded'], cmap='RdYlGn', alpha=0.6, s=50)
    ax5.set_xlabel('Количество штрихов')
    ax5.set_ylabel('Общее количество точек')
    ax5.set_title('🎯 Штрихи vs Точки', fontweight='bold')
    plt.colorbar(scatter, ax=ax5, label='Класс (0=safe, 1=unsafe)')
    
    # 6. Временная шкала создания
    ax6 = plt.subplot(gs[1, 2])
    if 'created_at' in df.columns:
        df['date'] = pd.to_datetime(df['created_at']).dt.date
        daily_counts = df.groupby(['date', 'label']).size().unstack(fill_value=0)
        daily_counts.plot(kind='bar', ax=ax6, stacked=True, 
                         color=['#2ecc71', '#e74c3c'], edgecolor='black')
        ax6.set_title('📅 Рисунков по дням', fontweight='bold')
        ax6.tick_params(axis='x', rotation=45)
    else:
        ax6.text(0.5, 0.5, 'Нет данных о времени', ha='center', va='center', 
                transform=ax6.transAxes)
        ax6.set_title('📅 Временная шкала', fontweight='bold')
    
    plt.tight_layout()
    plt.show()

# %%
if 'df' in locals():
    plot_dataset_overview(df)

# %% [markdown]
# ## 🎨 3. Визуализация примеров рисунков

# %%
def draw_stroke(ax, stroke, color='black', linewidth=2):
    """Отрисовка одного штриха"""
    if len(stroke) < 2:
        return
        
    points = np.array(stroke)
    # Нормализованные координаты (0-1) переводим в пиксели
    x = points[:, 0] * 100  # Масштабирование для отображения
    y = points[:, 1] * 100
    
    ax.plot(x, y, color=color, linewidth=linewidth, 
           solid_capstyle='round', solid_joinstyle='round')

def visualize_samples(df, n_samples=8):
    """Визуализация случайных примеров рисунков"""
    fig, axes = plt.subplots(2, 4, figsize=(16, 4))
    axes = axes.flatten()
    
    # Берем случайные примеры из каждого класса
    safe_samples = df[df['label'] == 'safe'].sample(min(n_samples//2, len(df[df['label']=='safe'])))
    unsafe_samples = df[df['label'] == 'unsafe'].sample(min(n_samples//2, len(df[df['label']=='unsafe'])))
    samples = pd.concat([safe_samples, unsafe_samples]).sample(n_samples)
    
    for idx, (i, row) in enumerate(samples.iterrows()):
        ax = axes[idx]
        
        # Отрисовка всех штрихов
        vectors = row['vectors']
        for stroke in vectors.get('strokes', []):
            color = '#e74c3c' if row['label'] == 'unsafe' else '#2ecc71'
            draw_stroke(ax, stroke, color=color, linewidth=2.5)
        
        # Настройка оси
        ax.set_xlim(0, 100)
        ax.set_ylim(0, 100)
        ax.invert_yaxis()  # Чтобы Y рос вниз как в canvas
        ax.set_aspect('equal')
        ax.axis('off')
        ax.set_title(f"{row['label'].upper()}\n{row['num_strokes']} штрихов, {row['byte_size']} Б",
                    fontsize=9, fontweight='bold', 
                    color='#e74c3c' if row['label']=='unsafe' else '#2ecc71')
    
    plt.suptitle('🎨 Примеры векторных рисунков', fontsize=16, fontweight='bold', y=1.02)
    plt.tight_layout()
    plt.show()

# %%
if 'df' in locals():
    visualize_samples(df, n_samples=8)

# %% [markdown]
# ## 🔄 3.1. Визуализация аугментации данных

# %%
def visualize_augmentations(df, n_samples=3):
    """Показывает оригинал и несколько аугментированных версий"""
    # Создаем временный dataset с аугментацией
    temp_dataset = AugmentedVectorDataset(df, augmentation=True, augment_prob=1.0)
    
    fig, axes = plt.subplots(n_samples, 6, figsize=(18, 3 * n_samples))
    if n_samples == 1:
        axes = axes.reshape(1, -1)
    
    for i in range(n_samples):
        # Берем случайный пример
        idx = random.randint(0, len(df) - 1)
        row = df.iloc[idx]
        original_strokes = row['vectors'].get('strokes', [])
        
        # Оригинальный рисунок
        ax = axes[i, 0]
        for stroke in original_strokes:
            draw_stroke(ax, stroke, color='black', linewidth=2)
        ax.set_xlim(0, 100)
        ax.set_ylim(0, 100)
        ax.invert_yaxis()
        ax.set_aspect('equal')
        ax.axis('off')
        ax.set_title(f"Оригинал\n({row['label']})", fontsize=10, fontweight='bold')
        
        # 5 аугментированных версий
        for j in range(1, 6):
            ax = axes[i, j]
            # Применяем аугментацию
            augmented_strokes = temp_dataset.augment_vectors([s.copy() for s in original_strokes])
            
            for stroke in augmented_strokes:
                draw_stroke(ax, stroke, color='blue', linewidth=2)
            
            ax.set_xlim(0, 100)
            ax.set_ylim(0, 100)
            ax.invert_yaxis()
            ax.set_aspect('equal')
            ax.axis('off')
            ax.set_title(f"Аугментация {j}", fontsize=10)
    
    plt.suptitle('🎨 Примеры аугментации векторных рисунков', fontsize=16, fontweight='bold', y=1.02)
    plt.tight_layout()
    plt.show()

# %%
if 'df' in locals():
    # Определяем класс AugmentedVectorDataset (будет ниже, но нужен для визуализации)
    class AugmentedVectorDataset(Dataset):
        """Dataset с мощной аугментацией для векторных данных"""
        
        def __init__(self, df, max_strokes=20, max_points_per_stroke=50, 
                     augmentation=True, augment_prob=0.7):
            self.df = df
            self.max_strokes = max_strokes
            self.max_points_per_stroke = max_points_per_stroke
            self.augmentation = augmentation
            self.augment_prob = augment_prob
            
        def __len__(self):
            return len(self.df)
        
        def augment_vectors(self, strokes):
            """Применяет случайные аугментации к векторам"""
            if not self.augmentation or random.random() > self.augment_prob:
                return strokes
            
            augmented = [stroke.copy() for stroke in strokes]
            
            # 1. ПОВОРОТ на 90°, 180°, 270° (с вероятностью 30%)
            if random.random() < 0.3:
                angle = random.choice([90, 180, 270])
                augmented = self.rotate_strokes(augmented, angle)
            
            # 2. ОТРАЖЕНИЕ по горизонтали (с вероятностью 25%)
            if random.random() < 0.25:
                augmented = self.flip_horizontal(augmented)
            
            # 3. ОТРАЖЕНИЕ по вертикали (с вероятностью 25%)
            if random.random() < 0.25:
                augmented = self.flip_vertical(augmented)
            
            # 4. ДОБАВЛЕНИЕ ШУМА к координатам (с вероятностью 40%)
            if random.random() < 0.4:
                augmented = self.add_noise(augmented, noise_level=0.02)
            
            # 5. УДАЛЕНИЕ случайных штрихов (с вероятностью 20%)
            if random.random() < 0.2 and len(augmented) > 2:
                augmented = self.drop_random_strokes(augmented, drop_ratio=0.2)
            
            # 6. УДАЛЕНИЕ случайных точек внутри штрихов (с вероятностью 30%)
            if random.random() < 0.3:
                augmented = self.drop_random_points(augmented, drop_ratio=0.15)
            
            # 7. МАСШТАБИРОВАНИЕ (с вероятностью 20%)
            if random.random() < 0.2:
                scale = random.uniform(0.7, 1.3)
                augmented = self.scale_strokes(augmented, scale)
            
            return augmented
        
        def rotate_strokes(self, strokes, angle):
            """Поворот всех точек на заданный угол вокруг центра (0.5, 0.5)"""
            angle_rad = np.deg2rad(angle)
            cos_a = np.cos(angle_rad)
            sin_a = np.sin(angle_rad)
            center_x, center_y = 0.5, 0.5
            
            rotated = []
            for stroke in strokes:
                new_stroke = []
                for x, y in stroke:
                    x_shifted = x - center_x
                    y_shifted = y - center_y
                    x_rot = x_shifted * cos_a - y_shifted * sin_a
                    y_rot = x_shifted * sin_a + y_shifted * cos_a
                    new_x = x_rot + center_x
                    new_y = y_rot + center_y
                    new_x = np.clip(new_x, 0, 1)
                    new_y = np.clip(new_y, 0, 1)
                    new_stroke.append([new_x, new_y])
                rotated.append(new_stroke)
            return rotated
        
        def flip_horizontal(self, strokes):
            """Отражение по горизонтали: x -> 1 - x"""
            return [[[1 - x, y] for x, y in stroke] for stroke in strokes]
        
        def flip_vertical(self, strokes):
            """Отражение по вертикали: y -> 1 - y"""
            return [[[x, 1 - y] for x, y in stroke] for stroke in strokes]
        
        def add_noise(self, strokes, noise_level=0.02):
            """Добавление гауссова шума к координатам"""
            noisy = []
            for stroke in strokes:
                new_stroke = []
                for x, y in stroke:
                    x_noisy = x + np.random.normal(0, noise_level)
                    y_noisy = y + np.random.normal(0, noise_level)
                    x_noisy = np.clip(x_noisy, 0, 1)
                    y_noisy = np.clip(y_noisy, 0, 1)
                    new_stroke.append([x_noisy, y_noisy])
                noisy.append(new_stroke)
            return noisy
        
        def drop_random_strokes(self, strokes, drop_ratio=0.2):
            """Удаление случайных штрихов"""
            num_to_drop = max(1, int(len(strokes) * drop_ratio))
            if len(strokes) <= num_to_drop:
                return strokes
            
            indices_to_keep = random.sample(range(len(strokes)), len(strokes) - num_to_drop)
            return [strokes[i] for i in sorted(indices_to_keep)]
        
        def drop_random_points(self, strokes, drop_ratio=0.15):
            """Удаление случайных точек внутри штрихов"""
            dropped = []
            for stroke in strokes:
                if len(stroke) <= 3:
                    dropped.append(stroke)
                    continue
                
                num_to_drop = max(1, int(len(stroke) * drop_ratio))
                indices_to_keep = random.sample(range(len(stroke)), len(stroke) - num_to_drop)
                new_stroke = [stroke[i] for i in sorted(indices_to_keep)]
                dropped.append(new_stroke)
            return dropped
        
        def scale_strokes(self, strokes, scale):
            """Масштабирование относительно центра"""
            center_x, center_y = 0.5, 0.5
            scaled = []
            for stroke in strokes:
                new_stroke = []
                for x, y in stroke:
                    new_x = center_x + (x - center_x) * scale
                    new_y = center_y + (y - center_y) * scale
                    new_x = np.clip(new_x, 0, 1)
                    new_y = np.clip(new_y, 0, 1)
                    new_stroke.append([new_x, new_y])
                scaled.append(new_stroke)
            return scaled
        
        def pad_stroke(self, stroke):
            """Паддинг штриха до фиксированной длины"""
            if len(stroke) >= self.max_points_per_stroke:
                return stroke[:self.max_points_per_stroke]
            else:
                padding = [[0.0, 0.0]] * (self.max_points_per_stroke - len(stroke))
                return stroke + padding
        
        def __getitem__(self, idx):
            row = self.df.iloc[idx]
            vectors = row['vectors']
            strokes = vectors.get('strokes', [])
            
            # ПРИМЕНЯЕМ АУГМЕНТАЦИЮ
            if self.augmentation:
                strokes = self.augment_vectors(strokes)
            
            # Ограничиваем количество штрихов
            if len(strokes) > self.max_strokes:
                strokes = strokes[:self.max_strokes]
            else:
                while len(strokes) < self.max_strokes:
                    strokes.append([[0.0, 0.0]] * self.max_points_per_stroke)
            
            # Паддим каждый штрих
            padded_strokes = [self.pad_stroke(stroke) for stroke in strokes]
            
            # Конвертируем в тензор
            sequence = torch.FloatTensor(padded_strokes)
            label = torch.FloatTensor([row['label_encoded']])
            
            return sequence, label
    
    visualize_augmentations(df, n_samples=3)

# %% [markdown]
# ## 🔧 4. Подготовка данных для нейросети (С OVERSAMPLING UNSAFE)

# %%
def prepare_dataloaders_with_augmentation(df, test_size=0.2, batch_size=16):
    """Подготовка DataLoader'ов с аугментацией и oversampling unsafe"""
    train_df, test_df = train_test_split(df, test_size=test_size, 
                                         random_state=42, stratify=df['label_encoded'])
    
    # 🎯 OVERSAMPLING: дублируем unsafe в 3 раза для борьбы с дисбалансом
    unsafe_samples = train_df[train_df['label'] == 'unsafe']
    safe_samples = train_df[train_df['label'] == 'safe']
    
    if len(unsafe_samples) > 0 and len(safe_samples) > 0:
        unsafe_augmented = pd.concat([unsafe_samples] * 3, ignore_index=True)
        train_df_balanced = pd.concat([safe_samples, unsafe_augmented], ignore_index=True)
        train_df_balanced = train_df_balanced.sample(frac=1, random_state=42).reset_index(drop=True)
        
        print(f"📊 Балансировка классов:")
        print(f"   До: safe={len(safe_samples)}, unsafe={len(unsafe_samples)}")
        print(f"   После: safe={len(safe_samples)}, unsafe={len(unsafe_augmented)}")
        print(f"   Всего train: {len(train_df_balanced)}")
    else:
        train_df_balanced = train_df
        print("⚠️ Недостаточно данных для балансировки")
    
    # ВАЖНО: аугментация только для train!
    train_dataset = AugmentedVectorDataset(train_df_balanced, augmentation=True, augment_prob=0.7)
    test_dataset = AugmentedVectorDataset(test_df, augmentation=False)  # Без аугментации для теста!
    
    train_loader = DataLoader(train_dataset, batch_size=batch_size, 
                             shuffle=True, drop_last=True)
    test_loader = DataLoader(test_dataset, batch_size=batch_size, shuffle=False)
    
    print(f"✅ Train batches: {len(train_loader)}")
    print(f"✅ Test batches: {len(test_loader)}")
    
    return train_loader, test_loader, train_df_balanced, test_df

# %%
if 'df' in locals():
    train_loader, test_loader, train_df, test_df = prepare_dataloaders_with_augmentation(df, batch_size=8)

# %% [markdown]
# ## 🧠 5. Архитектура нейросети

# %%
class StrokeClassifier(nn.Module):
    """
    LSTM-based модель для классификации векторных рисунков
    
    Архитектура:
    1. CNN для извлечения признаков из каждого штриха
    2. LSTM для анализа последовательности штрихов
    3. Fully Connected для классификации
    """
    
    def __init__(self, input_dim=2, hidden_dim=64, num_layers=2, dropout=0.3):
        super(StrokeClassifier, self).__init__()
        
        # CNN для обработки каждого штриха
        self.stroke_cnn = nn.Sequential(
            nn.Conv1d(input_dim, 32, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool1d(2),
            
            nn.Conv1d(32, 64, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool1d(2),
            
            nn.Flatten()
        )
        
        # Рассчитываем размер после CNN
        self.cnn_output_dim = 64 * (50 // 4)  # 50 точек / 4 после пулинга
        
        # LSTM для последовательности штрихов
        self.lstm = nn.LSTM(
            input_size=self.cnn_output_dim,
            hidden_size=hidden_dim,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0
        )
        
        # Классификатор
        self.classifier = nn.Sequential(
            nn.Linear(hidden_dim, 32),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(32, 1),
            nn.Sigmoid()
        )
        
    def forward(self, x):
        # x shape: [batch, num_strokes, points_per_stroke, 2]
        batch_size, num_strokes, points, dims = x.shape
        
        # Reshape для CNN: [batch*num_strokes, dims, points]
        x = x.view(batch_size * num_strokes, dims, points)
        
        # Применяем CNN к каждому штриху
        stroke_features = self.stroke_cnn(x)  # [batch*num_strokes, cnn_output_dim]
        
        # Reshape обратно: [batch, num_strokes, cnn_output_dim]
        stroke_features = stroke_features.view(batch_size, num_strokes, -1)
        
        # LSTM
        lstm_out, (h_n, c_n) = self.lstm(stroke_features)
        
        # Берем последний hidden state
        out = h_n[-1]
        
        # Классификация
        out = self.classifier(out)
        
        return out.squeeze()

# Инициализация модели
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
model = StrokeClassifier(dropout=0.3).to(device)

print(f"🔧 Устройство: {device}")
print(f"📦 Параметры модели: {sum(p.numel() for p in model.parameters()):,}")

# %% [markdown]
# ## 🏋️ 6. Обучение модели (ПРОСТОЕ И ЧЕСТНОЕ)

# %%
def train_model_simple(model, train_loader, val_loader, epochs=50, lr=0.001):
    """Простое обучение БЕЗ ранней остановки"""
    
    criterion = nn.BCELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=1e-5)
    scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=20, gamma=0.5)
    
    train_losses = []
    val_losses = []
    train_accs = []
    val_accs = []
    
    print(f"\n🚀 Начинаем обучение на {epochs} эпох...")
    print("="*70)
    
    for epoch in range(epochs):
        # Training
        model.train()
        train_loss = 0
        train_correct = 0
        train_total = 0
        
        for sequences, labels in train_loader:
            sequences, labels = sequences.to(device), labels.to(device)
            
            optimizer.zero_grad()
            outputs = model(sequences)
            loss = criterion(outputs, labels.squeeze())
            loss.backward()
            
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()
            
            train_loss += loss.item()
            predicted = (outputs > 0.5).float()
            train_correct += (predicted == labels.squeeze()).sum().item()
            train_total += labels.size(0)
        
        # Validation
        model.eval()
        val_loss = 0
        val_correct = 0
        val_total = 0
        
        with torch.no_grad():
            for sequences, labels in val_loader:
                sequences, labels = sequences.to(device), labels.to(device)
                outputs = model(sequences)
                loss = criterion(outputs, labels.squeeze())
                
                val_loss += loss.item()
                predicted = (outputs > 0.5).float()
                val_correct += (predicted == labels.squeeze()).sum().item()
                val_total += labels.size(0)
        
        # Metrics
        train_loss_avg = train_loss / len(train_loader)
        val_loss_avg = val_loss / len(val_loader)
        train_acc = train_correct / train_total
        val_acc = val_correct / val_total
        
        train_losses.append(train_loss_avg)
        val_losses.append(val_loss_avg)
        train_accs.append(train_acc)
        val_accs.append(val_acc)
        
        scheduler.step()
        
        if (epoch + 1) % 10 == 0:
            print(f"Epoch [{epoch+1:3d}/{epochs}] | "
                  f"Train Loss: {train_loss_avg:.4f}, Acc: {train_acc:.4f} | "
                  f"Val Loss: {val_loss_avg:.4f}, Acc: {val_acc:.4f}")
    
    torch.save(model.state_dict(), 'best_model.pth')
    
    print("="*70)
    print(f"✅ Обучение завершено!")
    print(f"   Финальная точность (train): {train_accs[-1]:.4f}")
    print(f"   Финальная точность (val): {val_accs[-1]:.4f}")
    
    return {
        'train_losses': train_losses,
        'val_losses': val_losses,
        'train_accs': train_accs,
        'val_accs': val_accs,
        'best_acc': max(val_accs)
    }

# %%
if 'train_loader' in locals():
    print("🚀 Начинаем обучение...")
    training_history = train_model_simple(model, train_loader, test_loader, epochs=50, lr=0.001)
    print(f"\n✅ Лучшая точность: {training_history['best_acc']:.4f}")

# %%
if 'train_loader' in locals():
    print(" Начало простого обучения...")
    training_history = train_model_simple(model, train_loader, test_loader, epochs=50, lr=0.001)
    print(f"\n✅ Лучшая точность: {training_history['best_acc']:.4f}")
# %%
if 'train_loader' in locals():
    print("🚀 Начало обучения с Focal Loss...")
    training_history = train_model_simple(model, train_loader, test_loader, epochs=50, lr=0.001)

# %% [markdown]
# ## 📊 7. Визуализация результатов обучения

# %%
def plot_training_history(history):
    """Визуализация процесса обучения"""
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    
    # Loss
    ax1 = axes[0]
    ax1.plot(history['train_losses'], label='Train Loss', linewidth=2)
    ax1.plot(history['val_losses'], label='Val Loss', linewidth=2)
    ax1.set_xlabel('Epoch', fontsize=12)
    ax1.set_ylabel('Loss', fontsize=12)
    ax1.set_title('📉 Функция потерь', fontsize=14, fontweight='bold')
    ax1.legend(fontsize=10)
    ax1.grid(True, alpha=0.3)
    
    # Accuracy
    ax2 = axes[1]
    ax2.plot(history['train_accs'], label='Train Accuracy', linewidth=2)
    ax2.plot(history['val_accs'], label='Val Accuracy', linewidth=2)
    ax2.set_xlabel('Epoch', fontsize=12)
    ax2.set_ylabel('Accuracy', fontsize=12)
    ax2.set_title('📈 Точность', fontsize=14, fontweight='bold')
    ax2.legend(fontsize=10)
    ax2.grid(True, alpha=0.3)
    
    plt.tight_layout()
    plt.show()

# %%
if 'training_history' in locals():
    plot_training_history(training_history)

# %% [markdown]
# ## 📐 8. Детальная оценка модели

# %%
def evaluate_model(model, test_loader):
    """Детальная оценка модели"""
    model.eval()
    all_preds = []
    all_labels = []
    all_probs = []
    
    with torch.no_grad():
        for sequences, labels in test_loader:
            sequences = sequences.to(device)
            outputs = model(sequences)
            probs = outputs.cpu().numpy()
            preds = (outputs > 0.5).float().cpu().numpy()
            
            all_probs.extend(probs)
            all_preds.extend(preds)
            all_labels.extend(labels.numpy())
    
    return np.array(all_preds), np.array(all_labels), np.array(all_probs)

def plot_evaluation_metrics(y_true, y_pred, y_probs):
    """Визуализация всех метрик"""
    fig = plt.figure(figsize=(15, 10))
    gs = plt.GridSpec(2, 3, figure=fig)
    
    # 1. Confusion Matrix
    ax1 = plt.subplot(gs[0, 0])
    cm = confusion_matrix(y_true, y_pred)
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', 
               xticklabels=['Safe', 'Unsafe'],
               yticklabels=['Safe', 'Unsafe'], ax=ax1)
    ax1.set_title('📊 Матрица ошибок', fontsize=12, fontweight='bold')
    ax1.set_ylabel('True Label')
    ax1.set_xlabel('Predicted Label')
    
    # 2. ROC Curve
    ax2 = plt.subplot(gs[0, 1])
    fpr, tpr, _ = roc_curve(y_true, y_probs)
    roc_auc = auc(fpr, tpr)
    ax2.plot(fpr, tpr, color='darkorange', lw=2, label=f'ROC curve (AUC = {roc_auc:.2f})')
    ax2.plot([0, 1], [0, 1], color='navy', lw=2, linestyle='--')
    ax2.set_xlim([0.0, 1.0])
    ax2.set_ylim([0.0, 1.05])
    ax2.set_xlabel('False Positive Rate')
    ax2.set_ylabel('True Positive Rate')
    ax2.set_title(f'📈 ROC кривая (AUC = {roc_auc:.2f})', fontsize=12, fontweight='bold')
    ax2.legend(loc="lower right")
    
    # 3. Precision-Recall Curve
    ax3 = plt.subplot(gs[0, 2])
    precision, recall, _ = precision_recall_curve(y_true, y_probs)
    pr_auc = auc(recall, precision)
    ax3.plot(recall, precision, color='blue', lw=2, label=f'PR curve (AUC = {pr_auc:.2f})')
    ax3.set_xlabel('Recall')
    ax3.set_ylabel('Precision')
    ax3.set_title(f'📊 Precision-Recall (AUC = {pr_auc:.2f})', fontsize=12, fontweight='bold')
    ax3.legend(loc="lower left")
    
    # 4. Distribution of predictions
    ax4 = plt.subplot(gs[1, :])
    df_plot = pd.DataFrame({
        'Probability': y_probs,
        'True Label': ['Safe' if l == 0 else 'Unsafe' for l in y_true],
        'Prediction': ['Safe' if p < 0.5 else 'Unsafe' for p in y_probs]
    })
    
    sns.histplot(data=df_plot, x='Probability', hue='True Label', 
                multiple='stack', bins=30, alpha=0.7, ax=ax4)
    ax4.axvline(x=0.5, color='red', linestyle='--', linewidth=2, label='Threshold (0.5)')
    ax4.set_title('📊 Распределение предсказаний', fontsize=12, fontweight='bold')
    ax4.set_xlabel('Вероятность класса Unsafe')
    ax4.legend()
    
    plt.tight_layout()
    plt.show()
    
    # Print classification report
    print("\n" + "="*60)
    print("📋 CLASSIFICATION REPORT")
    print("="*60)
    print(classification_report(y_true, y_pred, target_names=['Safe', 'Unsafe']))
    
    # Calculate additional metrics
    tn, fp, fn, tp = cm.ravel()
    print(f"\n📊 Detailed Metrics:")
    print(f"   True Positives: {tp}")
    print(f"   True Negatives: {tn}")
    print(f"   False Positives: {fp}")
    print(f"   False Negatives: {fn}")
    print(f"   Sensitivity (Recall): {tp/(tp+fn):.4f}")
    print(f"   Specificity: {tn/(tn+fp):.4f}")
    print(f"   Precision: {tp/(tp+fp):.4f}")
    print(f"   F1-Score: {2*tp/(2*tp+fp+fn):.4f}")

# %%
if 'test_loader' in locals():
    y_pred, y_true, y_probs = evaluate_model(model, test_loader)
    plot_evaluation_metrics(y_true, y_pred, y_probs)

# %% [markdown]
# ## 🎯 9. Анализ ошибок модели

# %%
def analyze_misclassifications(model, test_df, test_loader):
    """Анализ ошибочно классифицированных примеров"""
    model.eval()
    misclassified = []
    
    with torch.no_grad():
        for idx, (sequences, labels) in enumerate(test_loader):
            sequences = sequences.to(device)
            outputs = model(sequences)
            preds = (outputs > 0.5).float()
            
            for i in range(len(sequences)):
                true_label = labels[i].item()
                pred_label = preds[i].item()
                prob = outputs[i].item()
                
                if true_label != pred_label:
                    # Get original dataframe index
                    batch_idx = idx * test_loader.batch_size + i
                    if batch_idx < len(test_df):
                        misclassified.append({
                            'idx': batch_idx,
                            'true_label': test_df.iloc[batch_idx]['label'],
                            'pred_prob': prob,
                            'vectors': test_df.iloc[batch_idx]['vectors'],
                            'num_strokes': test_df.iloc[batch_idx]['num_strokes']
                        })
    
    print(f"❌ Найдено {len(misclassified)} ошибочных классификаций")
    
    if len(misclassified) > 0:
        # Visualize some misclassifications
        n_show = min(6, len(misclassified))
        fig, axes = plt.subplots(1, n_show, figsize=(15, 3))
        if n_show == 1:
            axes = [axes]
        
        for ax, item in zip(axes, misclassified[:n_show]):
            vectors = item['vectors']
            for stroke in vectors.get('strokes', []):
                draw_stroke(ax, stroke, color='red' if item['true_label']=='unsafe' else 'green', linewidth=2)
            
            ax.set_xlim(0, 100)
            ax.set_ylim(0, 100)
            ax.invert_yaxis()
            ax.set_aspect('equal')
            ax.axis('off')
            ax.set_title(f"True: {item['true_label']}\nPred: {item['pred_prob']:.2f}", 
                        fontsize=9, fontweight='bold')
        
        plt.suptitle('❌ Примеры ошибочных классификаций', fontsize=14, fontweight='bold')
        plt.tight_layout()
        plt.show()
    
    return misclassified

# %%
if 'test_loader' in locals() and 'test_df' in locals():
    misclassified = analyze_misclassifications(model, test_df, test_loader)

# %% [markdown]
# ## 🔍 9.1. Детальный анализ False Positive / False Negative

# %%
def analyze_fp_fn(y_true, y_pred, test_df, test_loader):
    """Детальный анализ FP и FN с визуализацией"""
    
    y_true = np.array(y_true)
    y_pred = np.array(y_pred)
    
    # Индексы FP и FN
    fp_indices = np.where((y_true == 0) & (y_pred == 1))[0]
    fn_indices = np.where((y_true == 1) & (y_pred == 0))[0]
    
    print(f"\n" + "="*60)
    print("🔍 ДЕТАЛЬНЫЙ АНАЛИЗ ОШИБОК")
    print("="*60)
    print(f"🔴 False Positive (хорошие удалены): {len(fp_indices)}")
    print(f"🔵 False Negative (плохие пропущены): {len(fn_indices)}")
    
    # Визуализируем FP
    if len(fp_indices) > 0:
        n_show = min(6, len(fp_indices))
        fig, axes = plt.subplots(1, n_show, figsize=(15, 3))
        if n_show == 1:
            axes = [axes]
        
        for ax, idx in zip(axes, fp_indices[:n_show]):
            # Находим соответствующий пример в test_df
            batch_idx = idx % len(test_df)
            if batch_idx < len(test_df):
                row = test_df.iloc[batch_idx]
                vectors = row['vectors']
                for stroke in vectors.get('strokes', []):
                    draw_stroke(ax, stroke, color='orange', linewidth=2)
                
                ax.set_xlim(0, 100)
                ax.set_ylim(0, 100)
                ax.invert_yaxis()
                ax.set_aspect('equal')
                ax.axis('off')
                ax.set_title(f"FP #{idx}\n(должен быть SAFE)", 
                            fontsize=9, fontweight='bold', color='orange')
        
        plt.suptitle('🔴 False Positive: Хорошие рисунки, которые фильтр удалил', 
                    fontsize=14, fontweight='bold')
        plt.tight_layout()
        plt.show()
    
    # Визуализируем FN
    if len(fn_indices) > 0:
        n_show = min(6, len(fn_indices))
        fig, axes = plt.subplots(1, n_show, figsize=(15, 3))
        if n_show == 1:
            axes = [axes]
        
        for ax, idx in zip(axes, fn_indices[:n_show]):
            # Находим соответствующий пример в test_df
            batch_idx = idx % len(test_df)
            if batch_idx < len(test_df):
                row = test_df.iloc[batch_idx]
                vectors = row['vectors']
                for stroke in vectors.get('strokes', []):
                    draw_stroke(ax, stroke, color='purple', linewidth=2)
                
                ax.set_xlim(0, 100)
                ax.set_ylim(0, 100)
                ax.invert_yaxis()
                ax.set_aspect('equal')
                ax.axis('off')
                ax.set_title(f"FN #{idx}\n(должен быть UNSAFE)", 
                            fontsize=9, fontweight='bold', color='purple')
        
        plt.suptitle('🔵 False Negative: Опасные рисунки, которые фильтр пропустил', 
                    fontsize=14, fontweight='bold')
        plt.tight_layout()
        plt.show()
    
    return fp_indices, fn_indices

# %%
if 'y_true' in locals() and 'y_pred' in locals() and 'test_df' in locals():
    fp_idx, fn_idx = analyze_fp_fn(y_true, y_pred, test_df, test_loader)

# %% [markdown]
# ## 💾 10. Сохранение модели

# %%
def save_model_artifacts(model, training_history, stats):
    """Сохранение модели и метаданных"""
    
    # Save model
    torch.save({
        'model_state_dict': model.state_dict(),
        'training_history': training_history,
        'dataset_stats': stats,
        'model_architecture': 'StrokeClassifier_LSTM'
    }, 'drawing_classifier.pth')
    
    print("✅ Модель сохранена в 'drawing_classifier.pth'")
    
    # Save training curves
    fig, axes = plt.subplots(1, 2, figsize=(12, 4))
    axes[0].plot(training_history['train_losses'], label='Train')
    axes[0].plot(training_history['val_losses'], label='Val')
    axes[0].set_title('Loss')
    axes[0].legend()
    
    axes[1].plot(training_history['train_accs'], label='Train')
    axes[1].plot(training_history['val_accs'], label='Val')
    axes[1].set_title('Accuracy')
    axes[1].legend()
    
    plt.savefig('training_curves.png', dpi=300, bbox_inches='tight')
    print("✅ Графики обучения сохранены в 'training_curves.png'")

# %%
if 'training_history' in locals() and 'stats' in locals():
    save_model_artifacts(model, training_history, stats)

# %% [markdown]
# ## 📝 11. Итоговый отчет

# %%
def generate_final_report(stats, training_history, y_true, y_pred, y_probs):
    """Генерация итогового отчета"""
    
    print("="*70)
    print(" " * 20 + "🎨 ИТОГОВЫЙ ОТЧЕТ ОБУЧЕНИЯ 🎨")
    print("="*70)
    
    print("\n📊 ДАТАСЕТ:")
    print(f"   • Всего образцов: {stats['total_samples']}")
    print(f"   • Безопасных: {stats['safe_samples']} ({stats['safe_samples']/stats['total_samples']*100:.1f}%)")
    print(f"   • Опасных: {stats['unsafe_samples']} ({stats['unsafe_samples']/stats['total_samples']*100:.1f}%)")
    print(f"   • Средний размер: {stats['avg_size_bytes']:.1f} байт")
    
    print("\n🏋️ ОБУЧЕНИЕ:")
    print(f"   • Лучшая точность: {training_history['best_acc']*100:.2f}%")
    print(f"   • Финальная точность (val): {training_history['val_accs'][-1]*100:.2f}%")
    print(f"   • Эпох: {len(training_history['train_losses'])}")
    
    print("\n📈 МЕТРИКИ КАЧЕСТВА:")
    cm = confusion_matrix(y_true, y_pred)
    tn, fp, fn, tp = cm.ravel()
    print(f"   • Accuracy: {(tp+tn)/(tp+tn+fp+fn):.4f}")
    print(f"   • Precision: {tp/(tp+fp):.4f}")
    print(f"   • Recall: {tp/(tp+fn):.4f}")
    print(f"   • F1-Score: {2*tp/(2*tp+fp+fn):.4f}")
    
    print("\n⚠️ ОШИБКИ:")
    print(f"   • False Positives (хорошие удалены): {fp}")
    print(f"   • False Negatives (плохие пропущены): {fn}")
    
    print("\n" + "="*70)
    print(" " * 25 + "✅ ГОТОВО К ИСПОЛЬЗОВАНИЮ!")
    print("="*70)

# %%
if all(k in locals() for k in ['stats', 'training_history', 'y_true', 'y_pred', 'y_probs']):
    generate_final_report(stats, training_history, y_true, y_pred, y_probs)

# %% [markdown]
# ## 🚀 Как использовать модель в приложении

# %%
def load_and_use_model(model_path='drawing_classifier.pth'):
    """Пример загрузки и использования модели"""
    
    # Загрузка
    checkpoint = torch.load(model_path, map_location=device)
    model = StrokeClassifier().to(device)
    model.load_state_dict(checkpoint['model_state_dict'])
    model.eval()
    
    print(f"✅ Модель загружена (точность: {checkpoint['training_history']['best_acc']:.4f})")
    
    # Пример использования
    def predict_drawing(vectors_dict):
        """Предсказание для одного рисунка"""
        strokes = vectors_dict.get('strokes', [])
        
        # Подготовка данных (аналогично VectorSequenceDataset)
        max_strokes = 20
        max_points = 50
        
        # Паддинг
        while len(strokes) < max_strokes:
            strokes.append([[0.0, 0.0]] * max_points)
        strokes = strokes[:max_strokes]
        
        # Паддинг точек
        padded = []
        for stroke in strokes:
            if len(stroke) >= max_points:
                padded.append(stroke[:max_points])
            else:
                padded.append(stroke + [[0.0, 0.0]] * (max_points - len(stroke)))
        
        # Тензор
        tensor = torch.FloatTensor(padded).unsqueeze(0).to(device)
        
        # Предсказание
        with torch.no_grad():
            prob = model(tensor).item()
        
        return {
            'is_unsafe': prob > 0.5,
            'confidence': prob if prob > 0.5 else 1 - prob,
            'probability_unsafe': prob
        }
    
    return predict_drawing

# Пример (раскомментируй для использования):
# predictor = load_and_use_model()
# result = predictor(your_vectors_dict)
# print(f"Unsafe: {result['is_unsafe']}, Confidence: {result['confidence']:.2%}")