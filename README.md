# MLDataAnalytics

这是武汉理工大学 Python 编程课程实验项目。我们开发了一个基于机器学习的数据分析系统，并通过 Git 团队协作将核心分析功能包装为 Web 服务。团队成员：@ma-jihan, @RanIMitake, @bronya511, @AAGCTC

## 项目架构

本项目采用 Flask 后端 + 原生 JavaScript 前端的架构，主要包含以下功能模块：

- **文件上传与管理**
- **文件预览**
- **数据可视化**
- **机器学习分析**（回归、分类、聚类）
- **数据清洗**

---

## 数据流详解

### 1. 文件上传流程

#### 前端 (`app/static/script/upload.js`)

```mermaid
graph LR
    A[用户选择文件<br/>或拖拽文件] --> B[initFileUpload<br/>初始化上传]
    B --> C[XMLHttpRequest<br/>POST /api/files/upload]
    C --> D[FormData包含<br/>user_id + file]
    D --> E[进度条更新<br/>updateProgress]
    E --> F[上传成功<br/>跳转到预览页]
```

**核心函数**：
- `initFileUpload()`: 初始化文件上传界面，监听文件选择和拖拽事件
- `uploadFile(file)`: 使用 XMLHttpRequest 发送文件到后端
- `handleFile(file)`: 处理文件上传逻辑，显示上传状态和进度

#### 后端 (`app/routes/files.py`)

```mermaid
graph LR
    A[POST /api/files/upload] --> B[验证请求参数<br/>file + user_id]
    B --> C[创建上传目录<br/>uploads/{user_id}]
    C --> D[生成唯一文件名<br/>原文件名_userId_时间戳]
    D --> E[保存文件到磁盘]
    E --> F[解析文件统计<br/>总行数/总列数]
    F --> G[处理重名冲突<br/>添加序号]
    G --> H[保存文件记录到数据库<br/>File表]
    H --> I[关联用户与文件<br/>UserFiles表]
    I --> J[返回JSON响应<br/>message+filename+fileId]
```

**核心函数**：
- `upload_file()`: 处理文件上传的主要接口函数

**数据模型** (`app/models.py`)：
- `File`: 存储文件信息（original_name, save_name, file_size, mime_type, file_path, total_rows, total_columns）
- `UserFiles`: 关联用户与文件的中间表

---

### 2. 文件预览流程

#### 前端 (`app/static/script/preview.js`)

```mermaid
graph LR
    A[用户进入预览页] --> B[fetchFileHistory<br/>获取文件历史]
    B --> C[GET /api/files/{user_id}/history]
    C --> D[用户选择文件]
    D --> E[showFileDetails<br/>加载预览数据]
    E --> F[GET /api/files/{user_id}/history/{file_id}/preview]
    F --> G[渲染预览表格<br/>renderPreviewTable]
    G --> H[更新文件信息<br/>updatePreviewInfo]
    H --> I[点击分析按钮<br/>调用analyze接口]
    I --> J[GET /api/files/history/{file_id}/analyze]
    J --> K[渲染分析图表<br/>renderAnalysisCharts]
```

**核心函数**：
- `initPreviewPage()`: 初始化预览页面
- `fetchFileHistory()`: 获取用户文件历史列表
- `showFileDetails()`: 加载并显示文件预览数据
- `renderPreviewTable()`: 渲染数据预览表格
- `renderAnalysisCharts()`: 渲染分析图表

#### 后端 (`app/routes/files.py`)

```mermaid
graph LR
    A[GET /api/files/{user_id}/history] --> B[查询UserFiles表<br/>获取用户文件ID列表]
    B --> C[查询File表<br/>获取文件详情]
    C --> D[返回文件列表JSON]
    
    E[GET /api/files/{user_id}/history/{file_id}/preview] --> F[查询File表<br/>获取文件记录]
    F --> G[load_dataframe<br/>读取文件为DataFrame]
    G --> H[获取前N行数据<br/>rowCount参数]
    H --> I[统计缺失值数量]
    I --> J[返回JSON<br/>data+columns+nonecount]
    
    K[GET /api/files/history/{file_id}/analyze] --> L[load_dataframe<br/>读取文件]
    L --> M[DataAnalyzer<br/>分析数据]
    M --> N[构建图表数据<br/>折线/柱状/散点/雷达]
    N --> O[返回JSON<br/>charts数组]
```

**核心工具函数** (`app/utils.py`)：
- `load_dataframe(file_path)`: 根据文件扩展名（csv/xlsx/json）读取文件为 pandas DataFrame
- `build_line_payload()`: 构建折线图数据
- `build_distribution_payload()`: 构建柱状图数据
- `build_scatter_payload()`: 构建散点图数据
- `build_radar_payload()`: 构建雷达图数据

---

### 3. 数据分析与可视化流程

#### 前端 (`app/static/script/visual.js`)

```mermaid
graph LR
    A[用户进入分析页] --> B[选择文件]
    B --> C[loadPreview<br/>加载文件预览]
    C --> D[GET /api/files/{user_id}/history/{file_id}/preview]
    D --> E[inferNumericColumns<br/>推断数值型字段]
    E --> F[添加图表配置<br/>createConfigCard]
    F --> G[添加机器学习配置<br/>createMlConfigCard]
    G --> H[点击生成按钮<br/>handleGenerate]
    H --> I[收集配置数据<br/>chartsConfig + mlConfigs]
    I --> J[POST /api/files/{user_id}/history/{file_id}/visualization]
    J --> K[接收图表数据]
    K --> L[renderCharts<br/>渲染Chart.js图表]
```

**核心函数**：
- `loadPreview(fileId)`: 加载文件预览数据并推断数值字段
- `createConfigCard()`: 创建图表配置卡片
- `createMlConfigCard()`: 创建机器学习配置卡片
- `handleGenerate()`: 处理图表生成请求
- `renderCharts()`: 调用后端接口并渲染图表

#### 后端 (`app/routes/files.py` + `app/visualization.py` + `app/ml_algorithm.py`)

```mermaid
graph LR
    A[POST /api/files/{user_id}/history/{file_id}/visualization] --> B[验证文件归属]
    B --> C[load_dataframe<br/>读取文件]
    C --> D[遍历chartConfig<br/>处理每个图表]
    D --> E{图表类型}
    E -->|bar| F[build_bar_payload<br/>app/visualization.py]
    E -->|line/area| G[build_line_area_payload]
    E -->|pie| H[build_pie_payload]
    E -->|scatter| I[build_scatter_payload]
    E -->|radar| J[build_radar_payload]
    F --> K
    G --> K
    H --> K
    I --> K
    J --> K[收集图表数据]
    
    K --> L[遍历mlConfig<br/>处理每个模型]
    L --> M{模型类型}
    M -->|regression| N[_build_regression_payload<br/>调用DataAnalyzer.regression]
    M -->|classification| O[_build_classification_payload<br/>调用DataAnalyzer.classification]
    M -->|clustering| P[_build_clustering_payload<br/>调用DataAnalyzer.clustering]
    N --> Q
    O --> Q
    P --> Q[收集ML数据]
    
    Q --> R[返回JSON<br/>success+data+mlData]
```

**可视化函数** (`app/visualization.py`)：
- `mlVisualization(df, mlConfig)`: 处理机器学习配置并返回可视化数据
- `_build_regression_payload()`: 构建回归分析可视化（系数柱状图 + 残差散点图）
- `_build_classification_payload()`: 构建分类分析可视化（指标柱状图）
- `_build_clustering_payload()`: 构建聚类分析可视化（饼图 + 散点图）
- `_build_residual_payload()`: 构建残差图可视化

**机器学习类** (`app/ml_algorithm.py`)：
```python
class DataAnalyzer:
    def __init__(self, df)  # 初始化，识别数值型和类别型字段
    
    # 回归预测
    def regression(self, target_col, feature_cols=None)
    # 返回: {r2, rmse, intercept, coefficients, y_pred, y_true, residuals}
    
    # 分类预测
    def classification(self, target_col, feature_cols=None)
    # 返回: {accuracy, precision, recall, f1, classes}
    
    # 聚类分析
    def clustering(self, n_clusters=3, feature_cols=None)
    # 返回: {silhouette_score, cluster_counts, data_points, feature_cols}
```

---

## 项目文件结构

```
MLDataAnalytics/
├── app/
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── auth.py           # 认证相关路由
│   │   ├── files.py          # 文件管理、上传、分析核心路由
│   │   └── main.py           # 主页面路由
│   ├── static/
│   │   ├── css/              # 样式文件
│   │   └── script/
│   │       ├── upload.js     # 文件上传脚本
│   │       ├── preview.js    # 文件预览脚本
│   │       ├── visual.js     # 可视化分析脚本
│   │       └── ...
│   ├── templates/            # HTML模板
│   ├── __init__.py           # Flask应用初始化
│   ├── config.py             # 配置文件
│   ├── models.py             # 数据模型定义
│   ├── utils.py              # 工具函数
│   ├── ml_algorithm.py       # 机器学习算法实现
│   └── visualization.py      # 可视化数据构建
├── dataselect.py             # 数据选择和清洗模块
├── run.py                    # 应用启动入口
├── API_DOC.md                # API文档
└── README.md                 # 项目说明
```

---

## 核心API接口

### 文件相关

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/files/upload` | 上传文件 |
| GET | `/api/files/{user_id}/history` | 获取文件历史列表 |
| GET | `/api/files/{user_id}/history/{file_id}/preview` | 获取文件预览数据 |
| POST | `/api/files/{user_id}/history/{file_id}/visualization` | 生成可视化图表和机器学习分析 |
| GET | `/api/files/history/{file_id}/analyze` | 自动分析文件（旧接口） |
| POST | `/api/files/{file_id}/detect` | 检测数据质量 |
| POST | `/api/files/{file_id}/clean` | 清洗数据 |
| GET | `/api/files/{file_id}/download` | 下载文件 |

### 机器学习相关

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/files/{file_id}/ml/regression` | 回归分析 |
| POST | `/api/files/{file_id}/ml/classification` | 分类分析 |
| POST | `/api/files/{file_id}/ml/clustering` | 聚类分析 |

---

## 运行项目

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 配置环境变量

在项目根目录创建 `.env` 文件，内容格式如下：

```env
# Flask 密钥（生产环境请更换为复杂随机字符串）
SECRET_KEY=your-secret-key-here

# MySQL 数据库配置
MYSQL_USER=your_mysql_username
MYSQL_PASSWORD=your_mysql_password
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DB=your_database_name
```

> **注意**：首次使用需要手动创建 MySQL 数据库，确保 `MYSQL_DB` 对应的数据库已存在，且务必保证为空数据库。因为项目会自动创建表结构以保证数据的一致性，自定义的表结构会导致数据不一致。

### 3. 启动应用

（如果需要激活虚拟环境,可执行.venv\Scripts\activate）
```bash
python run.py
```

应用将在 `http://localhost:5000` 启动。
