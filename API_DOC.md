# 数据分析 API 文档

## 基础路径
所有 API 前缀为 `/api/files`

---

## 1. 一键分析
**路径**: `/history/<file_id>/analyze`  
**方法**: GET  

**响应**:
```json
{
    "success": true,
    "charts": [
        {"type": "line", "title": "...", "data": {...}},
        {"type": "bar", "title": "...", "data": {...}},
        {"type": "scatter", "title": "...", "data": {...}},
        {"type": "radar", "title": "...", "data": {...}}
    ]
}
```

---

## 2. 数据质量检测
**路径**: `/{file_id}/detect`  
**方法**: POST  

**请求**:
```json
{
    "userId": 1
}
```

**响应**:
```json
{
    "totalRows": 1000,
    "nullRows": 50,
    "outlierRows": 30,
    "nullHeaders": ["col1"],
    "nullData": {"col1": 20},
    "outlierHeaders": ["col2"],
    "outlierData": {"col2": 15},
    "effectiveRows": 920,
    "qualityScore": 0.92
}
```

---

## 3. 数据清洗
**路径**: `/{file_id}/clean`  
**方法**: POST  

**请求**:
```json
{
    "userId": 1,
    "rules": {
        "null": {"strategy": "mean"},
        "outlier": {"strategy": "cap"},
        "duplicate": true
    }
}
```

**响应**:
```json
{
    "success": true,
    "cleanedFileId": 1,
    "summary": {
        "originalRows": 1000,
        "cleanedRows": 950,
        "deletedNulls": 30,
        "handledOutliers": 20,
        "deletedDuplicates": 0
    }
}
```

---

## 4. 回归预测
**路径**: `/{file_id}/ml/regression`  
**方法**: POST  

**请求**:
```json
{
    "userId": 1,
    "target_col": "销售额",
    "feature_cols": ["广告投入", "价格"]  // 可选
}
```

**响应**:
```json
{
    "success": true,
    "data": {
        "type": "regression",
        "target": "销售额",
        "r2": 0.85,
        "rmse": 123.45,
        "intercept": 10.5,
        "coefficients": {"广告投入": 2.3, "价格": -1.2}
    }
}
```

---

## 5. 分类预测
**路径**: `/{file_id}/ml/classification`  
**方法**: POST  

**请求**:
```json
{
    "userId": 1,
    "target_col": "是否流失",
    "feature_cols": ["年龄", "消费金额"]  // 可选
}
```

**响应**:
```json
{
    "success": true,
    "data": {
        "type": "classification",
        "target": "是否流失",
        "classes": ["no", "yes"],
        "accuracy": 0.89,
        "precision": 0.85,
        "recall": 0.92,
        "f1": 0.88
    }
}
```

---

## 6. 聚类分析
**路径**: `/{file_id}/ml/clustering`  
**方法**: POST  

**请求**:
```json
{
    "userId": 1,
    "n_clusters": 3,  // 可选，默认3
    "feature_cols": ["年龄", "收入"]  // 可选
}
```

**响应**:
```json
{
    "success": true,
    "data": {
        "type": "clustering",
        "n_clusters": 3,
        "silhouette_score": 0.65,
        "cluster_counts": {"0": 300, "1": 400, "2": 300}
    }
}
```

---

## 错误响应格式
```json
{
    "success": false,
    "error": "错误描述"
}
```

**HTTP 状态码**:
- 400: 请求参数错误
- 403: 权限不足
- 404: 文件不存在
- 500: 服务器内部错误

---

## 机器学习模块调用说明

### 调用流程
1. 前端调用后端 API（如 `/ml/regression`）
2. 后端自动读取文件数据
3. 调用 `ml_algorithm.py` 中的 `DataAnalyzer` 类执行算法
4. 返回结构化的分析结果

### 算法实现
| API | 算法 | 功能 |
|-----|------|------|
| `/ml/regression` | 线性回归 | 数值预测 |
| `/ml/classification` | 逻辑回归 | 二分类预测 |
| `/ml/clustering` | K-Means | 无监督聚类 |

### 特点
- **黑盒封装**: 机器学习模块不直接暴露，通过 API 调用
- **自动预处理**: 缺失值填充、数据标准化
- **结构化输出**: 返回统一格式的分析指标