import os
import chardet
import pandas as pd
from datetime import datetime
from werkzeug.utils import secure_filename
from flask import Blueprint, request, jsonify, current_app, send_from_directory
from app.models import db, File,UserFiles
from urllib.parse import quote
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import dataselect

files_bp = Blueprint('files', __name__, url_prefix='/api/files')

@files_bp.route('/upload', methods=['POST'])
def upload_file():
    """文件上传接口"""
    if 'file' not in request.files:
        return jsonify({'error': 'missing file'}), 400
    if 'user_id' not in request.form:
        return jsonify({'error': 'missing user_id'}), 400
    file = request.files['file']
    user_id = request.form['user_id']
    if not file or file.filename == '':
        return jsonify({'error': 'empty filename'}), 400
    print(f"Received file upload: filename={file.filename}, user_id={user_id}")
    # 创建上传目录
    os.makedirs(current_app.config['UPLOAD_FOLDER'], exist_ok=True)
    user_upload_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], str(user_id))
    os.makedirs(user_upload_dir, exist_ok=True)
    filename = secure_filename(file.filename)
    save_path = os.path.join(user_upload_dir, filename)
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
        file_path=os.path.join('uploads', user_id, filename),
        total_rows=total_rows,
        total_columns=total_columns
    )
    db.session.add(new_file)
    db.session.commit()
    user_file = UserFiles(user_id=user_id, file_id=new_file.id)
    db.session.add(user_file)
    db.session.commit()
    return jsonify({
        'message': 'uploaded',
        'filename': filename,
        'fileId': new_file.id
    }), 200

@files_bp.route('/<int:user_id>/history', methods=['GET'])
def get_file_history(user_id):
    """获取文件上传历史"""
    print(f"Fetching file history for user_id={user_id}")
    filesid_list = db.session.query(UserFiles.file_id).filter_by(user_id=user_id).all()
    filesid_list = [file_id for (file_id,) in filesid_list]
    files = db.session.query(File).filter(File.id.in_(filesid_list)).order_by(File.upload_time.desc()).all()
    return jsonify({'data': [file.to_dict() for file in files]})

@files_bp.route('/<int:user_id>/history/<int:file_id>/preview', methods=['GET'])
def get_file_preview(user_id, file_id):
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
@files_bp.route('/<int:user_id>/history/<int:file_id>/visualization', methods=['POST'])
def Visualization(user_id, file_id):
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


# 文件检测接口，返回缺失值数量和重复行数量以及异常值等统计信息
@files_bp.route('/<int:file_id>/detect', methods=['POST'])
def detect_file(file_id):
    """文件检测接口"""
    request_data = request.get_json()
    user_id = request_data.get('userId')
    file_record = db.session.get(File, file_id)
    if not file_record:
        return jsonify({'error': 'file not found'}), 404
    user_fileIds=db.session.query(UserFiles.file_id).filter_by(user_id=user_id).all()
    user_fileIds=[fid for (fid,) in user_fileIds]
    print(f"user_id={user_id}, file_id={file_id}, user_fileIds={user_fileIds}")
    if file_id not in user_fileIds:
        return jsonify({'error': 'file does not belong to user'}), 403
    
    # 读取文件内容
    file_path = os.path.join(current_app.root_path, '..', file_record.file_path)
    try:
        with open(file_path, 'rb') as f:
            encoding = chardet.detect(f.read())['encoding']
        df = pd.read_csv(file_path, encoding=encoding)
    except Exception as e:
        current_app.logger.error(f"Failed to read file: {e}")
        return jsonify({'error': 'failed to read file'}), 500
    
    # 使用 dataselect.py 进行数据质量检测
    quality_report = dataselect.detect_data_quality(df)
    
    return jsonify({
        "totalRows": quality_report['total_rows'],
        "nullRows": quality_report['null_rows'],
        "outlierRows": quality_report['outlier_rows'],
        "nullHeaders": quality_report['null_headers'],
        "nullData": quality_report['null_data'],
        "outlierHeaders": quality_report['outlier_headers'],
        "outlierData": quality_report['outlier_data'],
        "effectiveRows": quality_report['effective_rows'],
        "qualityScore": quality_report['quality_score']
    })
    
# userId: localStorage.getItem('animeflowUserId'),
# rules: {
# null: nullRule,
# outlier: outlierRule,
# duplicate: duplicateRule
# }
@files_bp.route('/<int:file_id>/clean', methods=['POST'])
def clean_file(file_id):
    request_data = request.get_json()
    user_id = request_data.get('userId')
    rules = request_data.get('rules')
    file_record = db.session.get(File, file_id)
    if not file_record:
        return jsonify({'error': 'file not found'}), 404
    user_fileIds=db.session.query(UserFiles.file_id).filter_by(user_id=user_id).all()
    user_fileIds=[fid for (fid,) in user_fileIds]
    print(f"user_id={user_id}, file_id={file_id}, user_fileIds={user_fileIds}")
    if file_id not in user_fileIds:
        return jsonify({'error': 'file does not belong to user'}), 403

    # 读取文件内容
    file_path = os.path.join(current_app.root_path, '..', file_record.file_path)
    try:
        with open(file_path, 'rb') as f:
            encoding = chardet.detect(f.read())['encoding']
        df = pd.read_csv(file_path, encoding=encoding)
    except Exception as e:
        current_app.logger.error(f"Failed to read file: {e}")
        return jsonify({'error': 'failed to read file'}), 500

    # 使用 dataselect.py 进行数据清洗
    df_cleaned, stats = dataselect.clean_data_by_rules(df, rules)

    # 保存清洗后的文件
    cleaned_dir = os.path.join(current_app.config['CLEANED_FOLDER'], str(user_id))
    os.makedirs(cleaned_dir, exist_ok=True)
    cleaned_file_path = os.path.join(cleaned_dir, f"cleaned_{file_record.save_name}")
    df_cleaned.to_csv(cleaned_file_path, index=False, encoding='utf-8')

    # 更新文件记录
    file_record.is_cleaned = True
    file_record.cleaned_path = os.path.join('cleaned', str(user_id), f"cleaned_{file_record.save_name}")
    db.session.commit()

    return jsonify({
        "success": True,
        "cleanedFileId": file_record.id,
        "summary": {
            "originalRows": stats['original_rows'],
            "cleanedRows": stats['cleaned_rows'],
            "deletedNulls": stats['deleted_nulls'],
            "handledOutliers": stats['handled_outliers'],
            "deletedDuplicates": stats['deleted_duplicates']
        }
    })
    
    
@files_bp.route('/<int:file_id>/download', methods=['GET'])
def download_file(file_id):
    # 1. 验证用户身份
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        print("Missing or invalid Authorization header")
        return jsonify({'error': '未授权访问'}), 401
    
    user_id = auth_header.split(' ')[1]
    if not user_id:
        print("Invalid user ID in Authorization header")
        return jsonify({'error': '用户ID无效'}), 401

    # 2. 查询文件信息
    file = File.query.get(file_id)
    if not file:
        print(f"File with ID {file_id} not found")
        return jsonify({'error': '文件不存在'}), 404

    # 3. 验证文件归属权限
    user_fileIds = db.session.query(UserFiles.file_id).filter_by(user_id=user_id).all()
    user_fileIds = [fid for (fid,) in user_fileIds]
    if file.id not in user_fileIds:
        print(f"File with ID {file_id} does not belong to user {user_id}")
        return jsonify({'error': '无权访问该文件'}), 403

    # 4. 确定文件存储目录
    if file.is_cleaned:
        file_path = file.cleaned_path 
    else:
        file_path = file.file_path
        
    # 5. 检查文件是否实际存在于服务器
    full_file_path = os.path.join(os.getcwd(), file_path)
    if not os.path.exists(full_file_path) or not os.path.isfile(full_file_path):
        print(f"File path {full_file_path} does not exist or is not a file")
        return jsonify({'error': '文件已损坏或不存在'}), 404

    try:
        # 6. 处理中文文件名（兼容所有浏览器）
        encoded_filename = quote(file.original_name)
        # 生成下载文件名（清洗后的文件自动添加前缀）
        download_filename = f"cleaned_{file.original_name}" if file.is_cleaned else file.original_name
        encoded_download_filename = quote(download_filename)
        print(f"Preparing to send file: {file_path}, original_name={file.original_name}, download_name={download_filename}")
        # 7. 发送文件
        # 7. 使用send_file替代send_from_directory（关键修复）
        from flask import send_file
        
        response = send_file(
            path_or_file=full_file_path,
            as_attachment=True,
            mimetype='text/csv'  # 明确指定CSV文件的MIME类型
        )
        
        # 手动设置Content-Disposition头确保中文兼容
        response.headers['Content-Disposition'] = f"attachment; filename*=UTF-8''{encoded_download_filename}"
        
        return response

    except Exception as e:
        print(f"Error during file download: {e}")
        print("当前工作目录:", os.getcwd())
        print("当前代码文件所在目录:", os.path.dirname(os.path.abspath(__file__)))
        current_app.logger.error(f"文件下载失败: {str(e)}")
        return jsonify({'error': f'下载失败: {str(e)}'}), 500