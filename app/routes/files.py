import os
import chardet
import pandas as pd
from datetime import datetime
from werkzeug.utils import secure_filename
from flask import Blueprint, request, jsonify, current_app
from app.models import db, File
from app.ml_algorithm import DataAnalyzer
from app.utils import load_dataframe, build_line_payload, build_distribution_payload, build_scatter_payload, build_radar_payload

files_bp = Blueprint('files', __name__, url_prefix='/api/files')

@files_bp.route('/upload', methods=['POST'])
def upload_file():
    """文件上传接口"""
    if 'file' not in request.files:
        return jsonify({'error': 'missing file'}), 400

    file = request.files['file']
    if not file or file.filename == '':
        return jsonify({'error': 'empty filename'}), 400

    # 创建上传目录
    os.makedirs(current_app.config['UPLOAD_FOLDER'], exist_ok=True)
    filename = secure_filename(file.filename)
    save_path = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
    file.save(save_path)

    # 解析文件统计信息
    total_rows = 0
    total_columns = 0
    try:
        ext = os.path.splitext(filename)[1].lower()
        df = None
        if ext in ['.csv', '.txt']:
            with open(save_path, 'rb') as f:
                encoding = chardet.detect(f.read())['encoding']
            df = pd.read_csv(save_path, encoding=encoding)
        elif ext in ['.xlsx', '.xls']:
            df = pd.read_excel(save_path)
        elif ext in ['.json']:
            df = pd.read_json(save_path)

        if df is not None:
            total_rows = int(df.shape[0])
            total_columns = int(df.shape[1])
    except Exception as e:
        current_app.logger.warning(f"Failed to parse file stats: {e}")

    # 保存文件记录到数据库
    new_file = File(
        original_name=file.filename,
        save_name=filename,
        file_size=os.path.getsize(save_path),
        mime_type=file.mimetype,
        file_path=os.path.join('uploads', filename),
        total_rows=total_rows,
        total_columns=total_columns
    )
    db.session.add(new_file)
    db.session.commit()

    return jsonify({
        'message': 'uploaded',
        'filename': filename,
        'fileId': new_file.id
    }), 200

@files_bp.route('/history', methods=['GET'])
def get_file_history():
    """获取文件上传历史"""
    files = File.query.order_by(File.upload_time.desc()).all()
    return jsonify({'data': [file.to_dict() for file in files]})

@files_bp.route('/history/<int:file_id>/preview', methods=['GET'])
def get_file_preview(file_id):
    """获取文件预览数据"""
    row_count = request.args.get('rowCount', default=100, type=int)
    file_record = db.session.get(File, file_id)

    if not file_record:
        return jsonify({'error': 'file not found'}), 404

    file_path = os.path.join(current_app.root_path, '..', file_record.file_path)
    try:
        with open(file_path, 'rb') as f:
            encoding = chardet.detect(f.read())['encoding']
        df = pd.read_csv(file_path, encoding=encoding)

        columns = df.columns.tolist()
        missing_count = int(df.replace('', pd.NA).isna().sum().sum())
        preview_df = df.head(row_count)
        rows = preview_df.fillna('').to_dict(orient='records')

        return jsonify({
            'data': rows,
            'columns': columns,
            'nonecount': missing_count
        })
    except Exception as e:
        current_app.logger.error(f"Failed to read file: {e}")
        return jsonify({'error': 'failed to read file'}), 500


# 可视化接口api
# 接收数据格式：
# {
#   "chartConfig": [
#     {
#       "type": "bar",
#       "fields": {
#         "x": "name",
#         "y": "value"
#       }
#     }
#   ]
# }
# 返回数据格式：
# {
#   "success": true,
#   "data": [
#     {
#       "labels": ["小王", "小李", "小张", "小赵", "小刘"],
#       "values": [12, 19, 3, 5, 2]
#     }
#   ]
# }
#顺序保持一致，前端根据返回的data数组顺序渲染图表
@files_bp.route('/history/<int:file_id>/visualization', methods=['POST'])
def Visualization(file_id):
    request_data = request.get_json()
    chartsconfig = request_data.get('chartConfig')
    if not chartsconfig:
        return jsonify({'error': 'missing chartConfig'}), 400
    print(chartsconfig)
    result=[]
    for config in chartsconfig:
        chart_type = config.get('type')
        if chart_type in ['bar', 'line', 'scatter', 'radar','pie','area']:
            result.append({
                'labels':['小王','小李','小张','小赵','小刘'],
                'values':[12, 19, 3, 5, 2]
            })
    print(result)
    return jsonify({'success': True, 'data': result})


@files_bp.route('/history/<int:file_id>/analyze', methods=['GET'])
def analyze_file(file_id):
    """对指定上传文件运行基础数据分析并返回可视化负载"""
    file_record = db.session.get(File, file_id)
    if not file_record:
        return jsonify({'error': 'file not found'}), 404

    file_path = os.path.join(current_app.root_path, '..', file_record.file_path)
    try:
        # 使用 utils 加载 DataFrame（会自动处理编码和格式）
        df = load_dataframe(file_path)
    except Exception as e:
        current_app.logger.error(f"Failed to load file for analysis: {e}")
        return jsonify({'error': 'failed to load file for analysis'}), 500

    try:
        analyzer = DataAnalyzer(df)

        # 基本摘要
        summary = analyzer.get_info()
        clean = analyzer.get_clean_info()

        # 构建图表负载：折线/分布/散点/雷达（可根据数据存在性选择）
        charts = []

        line_payload = build_line_payload(df, analyzer.numeric_cols, limit=60)
        if line_payload:
            charts.append({'type': 'line', 'data': line_payload})

        # 选择一个合适的列用于分布图：优先非数值列，否则第一个数值列
        dist_column = None
        for col in analyzer.categorical_cols:
            dist_column = col
            break
        if not dist_column and analyzer.numeric_cols:
            dist_column = analyzer.numeric_cols[0]
        if dist_column:
            dist_payload = build_distribution_payload(df, dist_column)
            if dist_payload:
                charts.append({'type': 'bar', 'data': dist_payload})

        scatter_payload = build_scatter_payload(df, analyzer.numeric_cols, limit=200)
        if scatter_payload:
            charts.append({'type': 'scatter', 'data': scatter_payload})

        radar_payload = build_radar_payload(analyzer, analyzer.numeric_cols)
        if radar_payload:
            charts.append({'type': 'radar', 'data': radar_payload})

        return jsonify({'success': True, 'summary': summary, 'clean': clean, 'charts': charts})
    except Exception as e:
        current_app.logger.error(f"Analysis failed: {e}")
        return jsonify({'error': 'analysis failed'}), 500