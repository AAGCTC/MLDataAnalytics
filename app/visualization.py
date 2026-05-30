import numpy as np
import pandas as pd
from app.ml_algorithm import DataAnalyzer


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


def mlVisualization(df, mlConfig):
    """
    处理机器学习配置，返回可视化图表数据

    参数:
        df: pandas DataFrame - 数据文件内容
        mlConfig: list - 机器学习配置列表，格式如:
            [{"type": "regression", "fields": {"target": "列名", "feature": "列名"}}]

    返回:
        list - 图表数据列表，格式与 build_*_payload 一致
    """
    if not mlConfig or not isinstance(mlConfig, list):
        return []

    analyzer = DataAnalyzer(df)
    result = []

    for config in mlConfig:
        ml_type = config.get('type')
        fields = config.get('fields', {})

        if ml_type == 'regression':
            chart_data = _build_regression_payload(analyzer, fields)
            result.append(chart_data)

        elif ml_type == 'classification':
            chart_data = _build_classification_payload(analyzer, fields)
            result.append(chart_data)

        elif ml_type == 'clustering':
            chart_data = _build_clustering_payload(analyzer, fields)
            result.append(chart_data)

        elif ml_type == 'residual':
            chart_data = _build_residual_payload(analyzer, fields)
            result.append(chart_data)

    return result


def _build_regression_payload(analyzer, fields):
    """
    构建回归分析可视化数据
    同时返回柱状图（系数）和残差散点图
    """
    target_col = fields.get('target')
    feature_cols = fields.get('features')

    if not target_col:
        return {'error': '缺少目标列'}

    if isinstance(feature_cols, str):
        feature_cols = [feature_cols] if feature_cols else None
    elif not feature_cols:
        feature_cols = None

    ml_result = analyzer.regression(target_col=target_col, feature_cols=feature_cols)

    if 'error' in ml_result:
        return {'error': ml_result['error']}

    coefficients = ml_result.get('coefficients', {})
    labels = list(coefficients.keys())
    values = list(coefficients.values())

    y_pred = ml_result.get('y_pred', [])
    residuals = ml_result.get('residuals', [])
    scatter_points = [{'x': float(pred), 'y': float(res)} for pred, res in zip(y_pred, residuals)]

    return {
        'bar': {
            'labels': labels if labels else ['无特征'],
            'values': values if values else [0],
            'metrics': {
                'r2': ml_result.get('r2', 0),
                'rmse': ml_result.get('rmse', 0),
                'intercept': ml_result.get('intercept', 0)
            }
        },
        'scatter': {
            'predicted': y_pred,
            'residuals': residuals,
            'points': scatter_points,
            'metrics': {
                'r2': ml_result.get('r2', 0),
                'rmse': ml_result.get('rmse', 0)
            }
        },
        'metrics': {
            'r2': ml_result.get('r2', 0),
            'rmse': ml_result.get('rmse', 0),
            'intercept': ml_result.get('intercept', 0)
        }
    }


def _build_classification_payload(analyzer, fields):
    """
    构建分类分析可视化数据
    返回柱状图格式，显示各评估指标
    """
    target_col = fields.get('target')
    feature_col = fields.get('feature')

    if not target_col:
        return {'error': '缺少目标列'}

    feature_cols = [feature_col] if feature_col else None

    ml_result = analyzer.classification(target_col=target_col, feature_cols=feature_cols)

    if 'error' in ml_result:
        return {'error': ml_result['error']}

    return {
        'labels': ['准确率', '精确率', '召回率', 'F1分数'],
        'values': [
            ml_result.get('accuracy', 0),
            ml_result.get('precision', 0),
            ml_result.get('recall', 0),
            ml_result.get('f1', 0)
        ],
        'metrics': {
            'accuracy': ml_result.get('accuracy', 0),
            'precision': ml_result.get('precision', 0),
            'recall': ml_result.get('recall', 0),
            'f1': ml_result.get('f1', 0)
        }
    }


def _build_clustering_payload(analyzer, fields):
    """
    构建聚类分析可视化数据
    当特征列为2个时，返回饼图和散点图；否则只返回饼图
    """
    n_clusters = fields.get('n_clusters', 3)
    feature_cols = fields.get('features')

    if isinstance(feature_cols, str):
        feature_cols = [feature_cols] if feature_cols else None
    elif not feature_cols:
        feature_cols = None

    ml_result = analyzer.clustering(n_clusters=n_clusters, feature_cols=feature_cols)

    if 'error' in ml_result:
        return {'error': ml_result['error']}

    cluster_counts = ml_result.get('cluster_counts', {})
    pie_labels = [f'簇 {k}' for k in sorted(cluster_counts.keys())]
    pie_values = [cluster_counts[k] for k in sorted(cluster_counts.keys())]

    # 检查特征列数量是否为2
    used_feature_cols = ml_result.get('feature_cols', [])
    if len(used_feature_cols) == 2:
        # 构建散点图数据
        data_points = ml_result.get('data_points', [])
        x_col = used_feature_cols[0]
        y_col = used_feature_cols[1]
        
        # 按簇分组数据点
        cluster_points = {}
        for point in data_points:
            cluster = point['cluster']
            if cluster not in cluster_points:
                cluster_points[cluster] = []
            cluster_points[cluster].append({
                'x': point[x_col],
                'y': point[y_col]
            })
        
        return {
            'pie': {
                'labels': pie_labels if pie_labels else ['无数据'],
                'values': pie_values if pie_values else [0]
            },
            'scatter': {
                'x_col': x_col,
                'y_col': y_col,
                'cluster_points': cluster_points
            },
            'metrics': {
                'silhouette_score': ml_result.get('silhouette_score', 0),
                'n_clusters': ml_result.get('n_clusters', n_clusters)
            }
        }
    else:
        # 特征列不为2个时，只返回饼图（保持原有结构）
        return {
            'labels': pie_labels if pie_labels else ['无数据'],
            'values': pie_values if pie_values else [0],
            'metrics': {
                'silhouette_score': ml_result.get('silhouette_score', 0),
                'n_clusters': ml_result.get('n_clusters', n_clusters)
            }
        }


def _build_residual_payload(analyzer, fields):
    """
    构建残差图可视化数据
    横轴：模型预测值（拟合值）
    纵轴：残差（真实值 - 预测值）
    """
    target_col = fields.get('target')
    feature_cols = fields.get('features')

    if isinstance(feature_cols, str):
        feature_cols = [feature_cols] if feature_cols else None
    elif not feature_cols:
        feature_cols = None

    ml_result = analyzer.regression(target_col=target_col, feature_cols=feature_cols)

    if 'error' in ml_result:
        return {'error': ml_result['error']}

    y_pred = ml_result.get('y_pred', [])
    residuals = ml_result.get('residuals', [])

    points = [{'x': float(pred), 'y': float(res)} for pred, res in zip(y_pred, residuals)]

    return {
        'predicted': y_pred,
        'residuals': residuals,
        'points': points,
        'metrics': {
            'r2': ml_result.get('r2', 0),
            'rmse': ml_result.get('rmse', 0)
        }
    }