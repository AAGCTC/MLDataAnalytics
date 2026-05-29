import numpy as np
import pandas as pd


def build_bar_payload(df, label_key, value_key, top_limit=10):
    if not label_key or label_key not in df.columns:
        return None
    series = df[label_key].dropna()
    if series.empty:
        return None
    if value_key and value_key in df.columns and pd.api.types.is_numeric_dtype(df[value_key]):
        counts = df.groupby(label_key, dropna=True)[value_key].sum()
        counts = counts.sort_values(ascending=False).head(top_limit)
        labels = [str(idx) for idx in counts.index]
        values = [float(v) for v in counts.values]
    else:
        counts = series.astype(str).value_counts().head(top_limit)
        labels = [str(idx) for idx in counts.index]
        values = [int(v) for v in counts.values]
    return {'labels': labels, 'values': values}


def build_line_area_payload(df, x_key, y_key, limit=60):
    if not y_key or y_key not in df.columns:
        return None
    series = df[y_key].dropna()
    if series.empty:
        return None
    if limit and len(series) > limit:
        index = np.linspace(0, len(series) - 1, limit).astype(int)
        series = series.iloc[index]
    if x_key and x_key in df.columns:
        x_series = df[x_key].dropna().iloc[:len(series)]
        labels = [str(v) for v in x_series]
    else:
        labels = [str(i) for i in range(1, len(series) + 1)]
    values = [float(v) for v in series]
    return {'labels': labels, 'values': values}


def build_pie_payload(df, label_key, value_key, top_limit=10):
    if not label_key or label_key not in df.columns:
        return None
    series = df[label_key].dropna()
    if series.empty:
        return None
    if value_key and value_key in df.columns and pd.api.types.is_numeric_dtype(df[value_key]):
        counts = df.groupby(label_key, dropna=True)[value_key].sum()
        counts = counts.sort_values(ascending=False).head(top_limit)
        labels = [str(idx) for idx in counts.index]
        values = [float(v) for v in counts.values]
    else:
        counts = series.astype(str).value_counts().head(top_limit)
        labels = [str(idx) for idx in counts.index]
        values = [int(v) for v in counts.values]
    return {'labels': labels, 'values': values}


def build_scatter_payload(df, x_key, y_key, limit=120):
    if not x_key or x_key not in df.columns or not y_key or y_key not in df.columns:
        return None
    subset = df[[x_key, y_key]].dropna()
    if subset.empty:
        return None
    if limit and len(subset) > limit:
        index = np.linspace(0, len(subset) - 1, limit).astype(int)
        subset = subset.iloc[index]
    points = [{'x': float(row[x_key]), 'y': float(row[y_key])} for _, row in subset.iterrows()]
    return {'labels': [f'{x_key} vs {y_key}'], 'points': points}


def build_radar_payload(df, label_key, value_key, top_limit=8):
    if not label_key or label_key not in df.columns or not value_key or value_key not in df.columns:
        return None
    numeric_series = pd.to_numeric(df[value_key], errors='coerce').dropna()
    if numeric_series.empty:
        return None
    grouped = df.groupby(label_key, dropna=True)[value_key].mean()
    grouped = grouped.sort_values(ascending=False).head(top_limit)
    labels = [str(idx) for idx in grouped.index]
    values = [float(v) for v in grouped.values]
    return {'labels': labels, 'values': values}