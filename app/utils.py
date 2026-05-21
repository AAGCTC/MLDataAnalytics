import os
import chardet
import pandas as pd
import numpy as np
from ml_algorithm import DataAnalyzer

# 数据处理和图表构建工具函数
def load_dataframe(file_path):
    """根据文件扩展名加载数据为DataFrame"""
    ext = os.path.splitext(file_path)[1].lower()
    if ext in ['.csv', '.txt']:
        with open(file_path, 'rb') as f:
            encoding = chardet.detect(f.read())['encoding'] or 'utf-8'
        return pd.read_csv(file_path, encoding=encoding)
    if ext in ['.xlsx', '.xls']:
        return pd.read_excel(file_path)
    if ext in ['.json']:
        return pd.read_json(file_path)
    raise ValueError('unsupported file type')

def sample_series(series, limit=60):
    """对序列进行采样，限制返回数据点数量"""
    series = series.dropna()
    if len(series) <= limit:
        return series
    index = np.linspace(0, len(series) - 1, limit).astype(int)
    return series.iloc[index]

def build_line_payload(df, numeric_cols, limit=60):
    """构建折线图/面积图数据格式"""
    if not numeric_cols:
        return None
    datasets = []
    labels = None
    for col in numeric_cols[:4]:
        series = sample_series(df[col], limit)
        if series.empty:
            continue
        if labels is None:
            labels = list(range(1, len(series) + 1))
        datasets.append({'label': col, 'data': [float(value) for value in series]})
    return {'labels': labels, 'datasets': datasets} if datasets else None

def build_distribution_payload(df, column, top_limit=10, bins=8):
    """构建柱状图/饼图数据格式"""
    series = df[column].dropna()
    if series.empty:
        return None
    if pd.api.types.is_numeric_dtype(series):
        unique = max(3, min(bins, int(series.nunique())))
        cut = pd.cut(series, bins=unique)
        counts = cut.value_counts().sort_index()
        labels = [str(idx) for idx in counts.index]
        data = [int(value) for value in counts.values]
    else:
        counts = series.astype(str).value_counts().head(top_limit)
        labels = [str(idx) for idx in counts.index]
        data = [int(value) for value in counts.values]
    return {'labels': labels, 'datasets': [{'label': column, 'data': data}]}

def build_scatter_payload(df, numeric_cols, limit=120):
    """构建散点图数据格式"""
    if len(numeric_cols) < 2:
        return None
    x_col, y_col = numeric_cols[:2]
    subset = df[[x_col, y_col]].dropna()
    if subset.empty:
        return None
    if len(subset) > limit:
        index = np.linspace(0, len(subset) - 1, limit).astype(int)
        subset = subset.iloc[index]
    points = [
        {'x': float(row[x_col]), 'y': float(row[y_col])}
        for _, row in subset.iterrows()
    ]
    return {
        'labels': [],
        'datasets': [{'label': f'{x_col} vs {y_col}', 'data': points}]
    }

def build_radar_payload(analyzer, numeric_cols):
    """构建雷达图数据格式"""
    if not numeric_cols:
        return None
    labels = []
    values = []
    for col in numeric_cols[:6]:
        stats = analyzer.get_stats(col)
        if 'mean' in stats:
            labels.append(col)
            values.append(float(stats['mean']))
    return {'labels': labels, 'datasets': [{'label': '均值', 'data': values}]} if labels else None