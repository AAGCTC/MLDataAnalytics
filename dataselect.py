import pandas as pd
import numpy as np
from typing import Optional, List, Tuple, Union, Dict
import os


def read_csv_file(file_path: str) -> Tuple[pd.DataFrame, int]:
    """
    读取CSV文件并返回数据和总行数（包含数据行，不含表头）
    
    Args:
        file_path: 文件路径
        
    Returns:
        (DataFrame, 数据行数)
    """
    df = pd.read_csv(file_path)
    # 返回DataFrame和数据行数（不包括表头行）
    return df, len(df)


def get_file_row_count(file_path: str) -> int:
    """
    获取CSV文件的总行数（包括表头行和所有数据行）
    
    Args:
        file_path: 文件路径
        
    Returns:
        总行数（表头 + 数据行）
    """
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()
    # 统计非空行
    row_count = sum(1 for line in lines if line.strip())
    return row_count


def read_file_with_stats(file_path: str, encoding: str = None) -> Tuple[pd.DataFrame, int, int]:
    """
    读取文件并返回数据、数据行数和列数

    Args:
        file_path: 文件路径
        encoding: 文件编码（可选）
        
    Returns:
        (DataFrame, 数据行数, 列数)
    """
    if encoding:
        df = pd.read_csv(file_path, encoding=encoding)
    else:
        df = pd.read_csv(file_path)
    
    # 返回DataFrame、数据行数（不含表头）和列数
    return df, int(df.shape[0]), int(df.shape[1])


def drop_missing_values(df: pd.DataFrame,
                        axis: int = 0,
                        thresh: Optional[int] = None) -> pd.DataFrame:
    if thresh is None:
        return df.dropna(axis=axis)
    return df.dropna(axis=axis, thresh=thresh)


def fill_missing_values(df: pd.DataFrame,
                        method: str = 'mean',
                        columns: Optional[List[str]] = None,
                        value: Optional[Union[int, float, str]] = None) -> pd.DataFrame:
    df_copy = df.copy()

    if columns is None:
        columns = df_copy.columns

    # 对于 ffill 和 bfill，整体处理
    if method == 'ffill':
        df_copy = df_copy.ffill()
        return df_copy
    elif method == 'bfill':
        df_copy = df_copy.bfill()
        return df_copy

    for col in columns:
        if col not in df_copy.columns:
            continue
        
        # 检查列是否有缺失值
        if not df_copy[col].isna().any():
            continue

        # 处理数值列
        if pd.api.types.is_numeric_dtype(df_copy[col]):
            if method == 'mean':
                fill_val = df_copy[col].mean()
                # 如果均值是 NaN 或无穷大，使用 0 填充
                if pd.isna(fill_val) or not np.isfinite(fill_val):
                    fill_val = 0
            elif method == 'median':
                fill_val = df_copy[col].median()
                # 如果中位数是 NaN 或无穷大，使用 0 填充
                if pd.isna(fill_val) or not np.isfinite(fill_val):
                    fill_val = 0
            elif method == 'mode':
                mode_val = df_copy[col].mode()
                fill_val = mode_val.iloc[0] if not mode_val.empty else 0
                # 如果众数是 NaN 或无穷大，使用 0 填充
                if pd.isna(fill_val) or not np.isfinite(fill_val):
                    fill_val = 0
            elif method == 'constant':
                fill_val = value if value is not None else 0
                # 如果指定的值是 NaN 或无穷大，使用 0 填充
                # 只对数值类型进行 np.isfinite 检查
                if pd.isna(fill_val) or (isinstance(fill_val, (int, float, np.number)) and not np.isfinite(fill_val)):
                    fill_val = 0
            else:
                continue
            df_copy[col] = df_copy[col].fillna(fill_val)
        
        # 处理非数值列
        else:
            if method == 'mode':
                mode_val = df_copy[col].mode()
                fill_val = mode_val.iloc[0] if not mode_val.empty else ''
            elif method == 'constant':
                fill_val = value if value is not None else ''
            else:
                fill_val = ''
            df_copy[col] = df_copy[col].fillna(fill_val)
    
    return df_copy


def remove_duplicates(df: pd.DataFrame,
                      subset: Optional[List[str]] = None,
                      keep: str = 'first') -> pd.DataFrame:
    return df.drop_duplicates(subset=subset, keep=keep)


def detect_outliers(df: pd.DataFrame,
                    columns: Optional[List[str]] = None,
                    method: str = 'iqr',
                    threshold: float = 1.5) -> pd.DataFrame:
    df_copy = df.copy()

    if columns is None:
        columns = df_copy.select_dtypes(include=[np.number]).columns

    numeric_cols = [c for c in columns if c in df_copy.select_dtypes(include=[np.number]).columns]

    for col in numeric_cols:
        if method == 'iqr':
            q1 = df_copy[col].quantile(0.25)
            q3 = df_copy[col].quantile(0.75)
            iqr = q3 - q1
            # 如果 IQR 为 0（所有值相同或分布非常集中），不标记任何异常值
            if iqr == 0:
                df_copy[f'is_outlier_{col}'] = False
                continue
            lower_bound = q1 - threshold * iqr
            upper_bound = q3 + threshold * iqr
            df_copy[f'is_outlier_{col}'] = ~df_copy[col].between(lower_bound, upper_bound)
        elif method == 'zscore':
            mean = df_copy[col].mean()
            std = df_copy[col].std()
            if std == 0:
                df_copy[f'is_outlier_{col}'] = False
                continue
            z_scores = np.abs((df_copy[col] - mean) / std)
            df_copy[f'is_outlier_{col}'] = z_scores > threshold
        else:
            raise ValueError(f"Unknown method: {method}")
    return df_copy


def remove_outliers(df: pd.DataFrame,
                    columns: Optional[List[str]] = None,
                    method: str = 'iqr',
                    threshold: float = 1.5) -> pd.DataFrame:
    df_copy = df.copy()

    if columns is None:
        columns = df_copy.select_dtypes(include=[np.number]).columns

    numeric_cols = [c for c in columns if c in df_copy.select_dtypes(include=[np.number]).columns]

    # 先找出所有异常值的索引
    outlier_indices = set()
    for col in numeric_cols:
        if method == 'iqr':
            q1 = df_copy[col].quantile(0.25)
            q3 = df_copy[col].quantile(0.75)
            iqr = q3 - q1
            # 如果 IQR 为 0（所有值相同或分布非常集中），跳过该列
            if iqr == 0:
                continue
            lower_bound = q1 - threshold * iqr
            upper_bound = q3 + threshold * iqr
            col_outliers = ~df_copy[col].between(lower_bound, upper_bound)
        elif method == 'zscore':
            mean = df_copy[col].mean()
            std = df_copy[col].std()
            if std == 0:
                continue
            z_scores = np.abs((df_copy[col] - mean) / std)
            col_outliers = z_scores > threshold
        else:
            raise ValueError(f"Unknown method: {method}")
        
        outlier_indices.update(df_copy[col_outliers].index)
    
    # 移除所有异常值行
    return df_copy.drop(index=list(outlier_indices))


def handle_outliers(df: pd.DataFrame,
                    columns: Optional[List[str]] = None,
                    method: str = 'iqr',
                    threshold: float = 1.5,
                    handle_method: str = 'remove') -> pd.DataFrame:
    df_copy = df.copy()

    if columns is None:
        columns = df_copy.select_dtypes(include=[np.number]).columns

    numeric_cols = [c for c in columns if c in df_copy.select_dtypes(include=[np.number]).columns]

    for col in numeric_cols:
        if method == 'iqr':
            q1 = df_copy[col].quantile(0.25)
            q3 = df_copy[col].quantile(0.75)
            iqr = q3 - q1
            lower_bound = q1 - threshold * iqr
            upper_bound = q3 + threshold * iqr
            outliers = ~df_copy[col].between(lower_bound, upper_bound)
        elif method == 'zscore':
            mean = df_copy[col].mean()
            std = df_copy[col].std()
            if std == 0:
                continue
            z_scores = np.abs((df_copy[col] - mean) / std)
            outliers = z_scores > threshold
        else:
            raise ValueError(f"Unknown method: {method}")

        if handle_method == 'remove':
            # 只记录需要删除的索引，最后统一处理
            pass
        elif handle_method == 'replace':
            median_val = df_copy[col].median()
            df_copy.loc[outliers, col] = median_val
        elif handle_method == 'cap':
            if method == 'iqr':
                q1 = df_copy[col].quantile(0.25)
                q3 = df_copy[col].quantile(0.75)
                iqr = q3 - q1
                lower_bound = q1 - threshold * iqr
                upper_bound = q3 + threshold * iqr
            df_copy[col] = df_copy[col].clip(lower=lower_bound, upper=upper_bound)
    
    # 如果是 remove 方法，最后统一删除
    if handle_method == 'remove':
        df_copy = remove_outliers(df_copy, columns=columns, method=method, threshold=threshold)
    
    return df_copy


def standardize_data(df: pd.DataFrame,
                     columns: Optional[List[str]] = None) -> pd.DataFrame:
    df_copy = df.copy()

    if columns is None:
        columns = df_copy.select_dtypes(include=[np.number]).columns

    numeric_cols = [c for c in columns if c in df_copy.select_dtypes(include=[np.number]).columns]

    for col in numeric_cols:
        mean = df_copy[col].mean()
        std = df_copy[col].std()
        if std != 0:
            df_copy[col] = (df_copy[col] - mean) / std
        else:
            df_copy[col] = 0  # 全相同值，标准化为0
    return df_copy


def normalize_data(df: pd.DataFrame,
                   columns: Optional[List[str]] = None,
                   method: str = 'minmax') -> pd.DataFrame:
    df_copy = df.copy()

    if columns is None:
        columns = df_copy.select_dtypes(include=[np.number]).columns

    numeric_cols = [c for c in columns if c in df_copy.select_dtypes(include=[np.number]).columns]

    for col in numeric_cols:
        if method == 'minmax':
            min_val = df_copy[col].min()
            max_val = df_copy[col].max()
            if max_val != min_val:
                df_copy[col] = (df_copy[col] - min_val) / (max_val - min_val)
            else:
                df_copy[col] = 0
        elif method == 'maxabs':
            max_abs = df_copy[col].abs().max()
            if max_abs != 0:
                df_copy[col] = df_copy[col] / max_abs
            else:
                df_copy[col] = 0
    return df_copy


def convert_dtypes(df: pd.DataFrame,
                   conversions: Optional[dict] = None) -> pd.DataFrame:
    df_copy = df.copy()
    if conversions is None:
        return df_copy.convert_dtypes()
    for col, dtype in conversions.items():
        if col in df_copy.columns:
            df_copy[col] = df_copy[col].astype(dtype)
    return df_copy


def trim_string_columns(df: pd.DataFrame,
                        columns: Optional[List[str]] = None) -> pd.DataFrame:
    df_copy = df.copy()
    if columns is None:
        columns = df_copy.select_dtypes(include=['object', 'string']).columns
    for col in columns:
        df_copy[col] = df_copy[col].astype(str).str.strip()
    return df_copy


def remove_special_characters(df: pd.DataFrame,
                              columns: Optional[List[str]] = None,
                              pattern: str = r'[^a-zA-Z0-9\u4e00-\u9fa5\s]') -> pd.DataFrame:
    df_copy = df.copy()
    if columns is None:
        columns = df_copy.select_dtypes(include=['object', 'string']).columns
    for col in columns:
        df_copy[col] = df_copy[col].astype(str).str.replace(pattern, '', regex=True)
    return df_copy


def filter_by_condition(df: pd.DataFrame,
                        conditions: List[Tuple[str, str, Union[int, float, str]]]) -> pd.DataFrame:
    df_copy = df.copy()
    mask = pd.Series([True] * len(df_copy))

    for col, op, val in conditions:
        if col not in df_copy.columns:
            continue

        if op == '==':
            mask &= df_copy[col] == val
        elif op == '!=':
            mask &= df_copy[col] != val
        elif op == '>':
            mask &= df_copy[col] > val
        elif op == '<':
            mask &= df_copy[col] < val
        elif op == '>=':
            mask &= df_copy[col] >= val
        elif op == '<=':
            mask &= df_copy[col] <= val
        elif op == 'in':
            mask &= df_copy[col].isin(val)
        elif op == 'not in':
            mask &= ~df_copy[col].isin(val)
        elif op == 'contains':
            # 只对字符串列安全执行
            if df_copy[col].dtype == 'object' or df_copy[col].dtype == 'string':
                mask &= df_copy[col].str.contains(val, na=False)
    return df_copy[mask]


def get_data_summary(df: pd.DataFrame) -> pd.DataFrame:
    summary = pd.DataFrame({
        '列名': df.columns,
        '数据类型': df.dtypes.values,
        '非空值数量': df.notnull().sum().values,
        '空值数量': df.isnull().sum().values,
        '空值比例': (df.isnull().sum() / len(df)).round(4).values
    })
    return summary


def clean_data_by_rules(df: pd.DataFrame, rules: Dict) -> Tuple[pd.DataFrame, Dict]:
    """
    根据规则清洗数据，并返回清洗后的结果和统计信息
    
    Args:
        df: 原始数据
        rules: 清洗规则字典，格式如下:
            {
                'null': 'drop' | 'fill-mean' | 'fill-median' | 'fill-mode' | 'fill-zero' | 'fill-empty',
                'outlier': 'ignore' | 'drop' | 'cap' | 'replace-mean' | 'replace-median',
                'duplicate': 'drop' | 'keep'
            }
    
    Returns:
        (清洗后的DataFrame, 统计信息字典)
    """
    df_copy = df.copy()
    
    # 统计信息
    stats = {
        'original_rows': len(df_copy),
        'deleted_nulls': 0,
        'handled_outliers': 0,
        'deleted_duplicates': 0
    }
    
    # 处理重复值
    duplicate_rule = rules.get('duplicate', 'drop')
    if duplicate_rule == 'drop':
        before_dup = len(df_copy)
        df_copy = remove_duplicates(df_copy)
        stats['deleted_duplicates'] = before_dup - len(df_copy)
    
    # 处理空值
    null_rule = rules.get('null', 'drop')
    if null_rule == 'drop':
        before_null = len(df_copy)
        df_copy = drop_missing_values(df_copy)
        stats['deleted_nulls'] = before_null - len(df_copy)
    else:
        fill_method_map = {
            'fill-mean': 'mean',
            'fill-median': 'median',
            'fill-mode': 'mode',
            'fill-zero': 'constant',
            'fill-empty': 'constant'  # 改为用空字符串填充
        }
        method = fill_method_map.get(null_rule, 'mean')
        if null_rule == 'fill-zero':
            value = 0
        elif null_rule == 'fill-empty':
            value = ''  # 空字符串
        else:
            value = None
        df_copy = fill_missing_values(df_copy, method=method, value=value)
    
    # 处理异常值
    outlier_rule = rules.get('outlier', 'ignore')
    if outlier_rule != 'ignore':
        # 首先检测有多少行包含异常值
        before_outlier_count = 0
        # 获取所有数值列
        numeric_cols = df_copy.select_dtypes(include=[np.number]).columns.tolist()
        business_numeric_cols = [col for col in numeric_cols]
        
        if len(business_numeric_cols) > 0:
            df_outliers = detect_outliers(df_copy, columns=business_numeric_cols)
            outlier_cols = [col for col in df_outliers.columns if col.startswith('is_outlier_')]
            if outlier_cols:
                any_outlier = df_outliers[outlier_cols].any(axis=1)
                before_outlier_count = sum(any_outlier)
        
        before_outlier_len = len(df_copy)
        
        # 根据不同的异常值处理规则进行处理
        if outlier_rule == 'drop':
            df_copy = handle_outliers(df_copy, columns=business_numeric_cols, handle_method='remove')
            stats['handled_outliers'] = before_outlier_len - len(df_copy)
        elif outlier_rule == 'cap':
            df_copy = handle_outliers(df_copy, columns=business_numeric_cols, handle_method='cap')
            stats['handled_outliers'] = before_outlier_count
        elif outlier_rule == 'replace-mean':
            # 使用均值替换异常值（排除异常值后计算均值）
            for col in business_numeric_cols:
                df_outliers = detect_outliers(df_copy, columns=[col])
                outliers = df_outliers[f'is_outlier_{col}']
                if outliers.any():
                    # 排除异常值后计算均值
                    non_outlier_values = df_copy.loc[~outliers, col]
                    mean_val = non_outlier_values.mean()
                    if pd.isna(mean_val) or not np.isfinite(mean_val):
                        mean_val = 0
                    # 根据列的数据类型转换值
                    if df_copy[col].dtype == np.int64:
                        mean_val = int(mean_val)
                    df_copy.loc[outliers, col] = mean_val
            stats['handled_outliers'] = before_outlier_count
        elif outlier_rule == 'replace-median':
            # 使用中位数替换异常值（排除异常值后计算中位数）
            for col in business_numeric_cols:
                df_outliers = detect_outliers(df_copy, columns=[col])
                outliers = df_outliers[f'is_outlier_{col}']
                if outliers.any():
                    # 排除异常值后计算中位数
                    non_outlier_values = df_copy.loc[~outliers, col]
                    median_val = non_outlier_values.median()
                    if pd.isna(median_val) or not np.isfinite(median_val):
                        median_val = 0
                    # 根据列的数据类型转换值
                    if df_copy[col].dtype == np.int64:
                        median_val = int(median_val)
                    df_copy.loc[outliers, col] = median_val
            stats['handled_outliers'] = before_outlier_count
        else:
            df_copy = handle_outliers(df_copy, columns=business_numeric_cols, handle_method='remove')
            stats['handled_outliers'] = before_outlier_len - len(df_copy)
    
    stats['cleaned_rows'] = len(df_copy)
    
    return df_copy, stats


def detect_data_quality(df: pd.DataFrame) -> Dict:
    """
    检测数据质量，返回详细的质量报告

    Args:
        df: 数据

    Returns:
        质量报告字典
    """
    report = {
        'total_rows': len(df),
        'total_columns': len(df.columns),
        'null_headers': [],
        'null_data': [],
        'outlier_headers': [],
        'outlier_data': [],
        'duplicate_rows': 0,
        'duplicate_data': [],
        'null_rows': 0,
        'outlier_rows': 0,
        'effective_rows': 0,
        'quality_score': 0.0
    }

    # 检测重复行（优先级最高）
    duplicate_mask = df.duplicated()
    duplicate_rows = df[duplicate_mask]
    duplicate_count = len(duplicate_rows)
    report['duplicate_rows'] = duplicate_count
    if duplicate_count > 0:
        report['outlier_headers'] = list(df.columns)
        report['outlier_data'] = duplicate_rows.fillna('').head(20).values.tolist()
        report['duplicate_data'] = duplicate_rows.fillna('').head(20).values.tolist()

    # 先去除重复行，只取其中一条
    df_unique = df.drop_duplicates()

    # 找出含有空值的行（只在空值行中显示，不混入异常值）
    null_mask = df_unique.isnull().any(axis=1)
    null_rows = df_unique[null_mask]
    report['null_rows'] = len(null_rows)
    if len(null_rows) > 0:
        report['null_headers'] = list(df.columns)
        report['null_data'] = null_rows.fillna('').head(20).values.tolist()

    # 检测数值异常值（排除空值行，确保空值行不在异常行中显示）
    df_no_null = df_unique[~null_mask]
    numeric_cols = df_no_null.select_dtypes(include=[np.number]).columns.tolist()
    id_columns = ['年份', '月份', '版本', 'id', 'ID', 'Id', 'no', 'No', 'NO', 'number', 'Number']
    business_numeric_cols = [col for col in numeric_cols if col not in id_columns]

    numeric_outlier_count = 0
    if len(business_numeric_cols) > 0:
        df_outliers = detect_outliers(df_no_null, columns=business_numeric_cols)
        outlier_cols = [col for col in df_outliers.columns if col.startswith('is_outlier_')]
        if outlier_cols:
            any_outlier = df_outliers[outlier_cols].any(axis=1)
            # 只返回原始数据列，不包含检测标记列
            outlier_rows = df_no_null[any_outlier]
            numeric_outlier_count = len(outlier_rows)
            if numeric_outlier_count > 0:
                if report['outlier_data'] == []:
                    report['outlier_headers'] = list(df.columns)
                    report['outlier_data'] = outlier_rows.fillna('').head(20).values.tolist()
                else:
                    outlier_data_list = outlier_rows.fillna('').head(20).values.tolist()
                    report['outlier_data'].extend(outlier_data_list)

    # 异常值行数 = 重复行数 + 数值异常值行数（不包含空值行）
    report['outlier_rows'] = duplicate_count + numeric_outlier_count

    # 计算有效行数（去重后 - 空值行 - 数值异常行）
    unique_rows = len(df_unique)
    report['effective_rows'] = unique_rows - report['null_rows'] - numeric_outlier_count
    if unique_rows > 0:
        report['quality_score'] = round(report['effective_rows'] / unique_rows * 100, 1)
    else:
        report['quality_score'] = 0.0

    return report
