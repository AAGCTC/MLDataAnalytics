import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import r2_score, mean_squared_error, accuracy_score, precision_score, recall_score, f1_score
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score


class DataAnalyzer:
    def __init__(self, df):
        self.df = df.copy()
        self.numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        self.categorical_cols = df.select_dtypes(include=['object']).columns.tolist()

    # ========== 基础信息 ==========
    def get_info(self):
        return {
            'numeric_cols': self.numeric_cols,
            'categorical_cols': self.categorical_cols,
            'rows': len(self.df),
            'cols': len(self.df.columns)
        }

    # ========== 数据清洗 ==========
    def get_clean_info(self):
        return {
            'total_rows': len(self.df),
            'missing_count': int(self.df.isnull().sum().sum()),
            'missing_by_column': self.df.isnull().sum().to_dict(),
            'duplicate_rows': int(self.df.duplicated().sum())
        }

    def remove_duplicates(self):
        before = len(self.df)
        self.df = self.df.drop_duplicates()
        return {'removed': before - len(self.df), 'remaining': len(self.df)}

    def handle_missing(self, strategy='mean', fill_value=None):
        if strategy == 'drop':
            self.df = self.df.dropna()
        elif strategy == 'mean':
            for col in self.numeric_cols:
                self.df[col] = self.df[col].fillna(self.df[col].mean())
        elif strategy == 'constant':
            self.df = self.df.fillna(fill_value or 0)
        return {'strategy': strategy, 'remaining_missing': int(self.df.isnull().sum().sum())}

    def detect_outliers(self, column, threshold=1.5):
        Q1 = self.df[column].quantile(0.25)
        Q3 = self.df[column].quantile(0.75)
        IQR = Q3 - Q1
        lower = Q1 - threshold * IQR
        upper = Q3 + threshold * IQR
        outliers = self.df[(self.df[column] < lower) | (self.df[column] > upper)]
        return {'count': len(outliers), 'lower_bound': lower, 'upper_bound': upper}

    def handle_outliers(self, column, method='cap', threshold=1.5):
        Q1 = self.df[column].quantile(0.25)
        Q3 = self.df[column].quantile(0.75)
        IQR = Q3 - Q1
        lower = Q1 - threshold * IQR
        upper = Q3 + threshold * IQR

        if method == 'remove':
            self.df = self.df[(self.df[column] >= lower) & (self.df[column] <= upper)]
        elif method == 'cap':
            self.df[column] = self.df[column].clip(lower, upper)
        return {'method': method, 'processed': len(self.df)}

    def get_stats(self, column):
        if column in self.numeric_cols:
            return {
                'mean': round(self.df[column].mean(), 4),
                'std': round(self.df[column].std(), 4),
                'min': round(self.df[column].min(), 4),
                'max': round(self.df[column].max(), 4)
            }
        return {'unique_values': self.df[column].nunique(), 'top': self.df[column].mode()[0] if len(self.df[column].mode()) > 0 else None}

    # ========== 回归预测 ==========
    def regression(self, target_col, feature_cols=None):
        if target_col not in self.numeric_cols:
            return {'error': f'目标列 "{target_col}" 不是数值类型'}

        if feature_cols is None:
            feature_cols = [col for col in self.numeric_cols if col != target_col]

        X = self.df[feature_cols].fillna(self.df[feature_cols].mean())
        y = self.df[target_col].fillna(self.df[target_col].mean())

        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

        scaler = StandardScaler()
        X_train = scaler.fit_transform(X_train)
        X_test = scaler.transform(X_test)

        model = LinearRegression()
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)

        return {
            'success': True,
            'type': 'regression',
            'target': target_col,
            'r2': round(r2_score(y_test, y_pred), 4),
            'rmse': round(np.sqrt(mean_squared_error(y_test, y_pred)), 4),
            'intercept': round(model.intercept_, 4),
            'coefficients': {col: round(coef, 4) for col, coef in zip(feature_cols, model.coef_)}
        }

    # ========== 分类预测 ==========
    def classification(self, target_col, feature_cols=None):
        if target_col not in self.df.columns:
            return {'error': f'目标列 "{target_col}" 不存在'}

        # 处理目标列
        if target_col in self.categorical_cols:
            le = LabelEncoder()
            y = le.fit_transform(self.df[target_col].astype(str))
            classes = le.classes_.tolist()
        else:
            y = self.df[target_col].values
            classes = list(set(y))

        if len(classes) != 2:
            return {'error': f'只支持二分类，当前有 {len(classes)} 个类别'}

        if feature_cols is None:
            feature_cols = [col for col in self.numeric_cols if col != target_col]

        X = self.df[feature_cols].fillna(self.df[feature_cols].mean())

        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

        scaler = StandardScaler()
        X_train = scaler.fit_transform(X_train)
        X_test = scaler.transform(X_test)

        model = LogisticRegression(random_state=42, max_iter=1000)
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)

        return {
            'success': True,
            'type': 'classification',
            'target': target_col,
            'classes': classes,
            'accuracy': round(accuracy_score(y_test, y_pred), 4),
            'precision': round(precision_score(y_test, y_pred), 4),
            'recall': round(recall_score(y_test, y_pred), 4),
            'f1': round(f1_score(y_test, y_pred), 4)
        }

    # ========== 聚类分析 ==========
    def clustering(self, n_clusters=3, feature_cols=None):
        if feature_cols is None:
            feature_cols = self.numeric_cols

        if len(feature_cols) < 2:
            return {'error': '需要至少2个数值特征'}

        X = self.df[feature_cols].fillna(self.df[feature_cols].mean())

        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        labels = kmeans.fit_predict(X_scaled)

        return {
            'success': True,
            'type': 'clustering',
            'n_clusters': n_clusters,
            'silhouette_score': round(silhouette_score(X_scaled, labels), 4),
            'cluster_counts': {int(k): int(v) for k, v in zip(*np.unique(labels, return_counts=True))}
        }


def create_analyzer(file_path):
    if file_path.endswith('.csv'):
        df = pd.read_csv(file_path)
    else:
        df = pd.read_excel(file_path)
    return DataAnalyzer(df)