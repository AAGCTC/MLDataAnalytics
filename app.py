from flask import Flask, render_template, request, redirect, url_for, jsonify
from werkzeug.utils import secure_filename
import os
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import pandas as pd
import os
from sqlalchemy import text
from datetime import datetime
from dotenv import load_dotenv
import chardet
import bcrypt
# 加载环境变量
load_dotenv()

# 创建Flask应用
app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = os.path.join(app.root_path, 'uploads')
CORS(app)

app.config['SQLALCHEMY_DATABASE_URI'] = (
    f"mysql+pymysql://{os.getenv('MYSQL_USER')}:{os.getenv('MYSQL_PASSWORD')}@{os.getenv('MYSQL_HOST')}:{os.getenv('MYSQL_PORT')}/{os.getenv('MYSQL_DB')}"
)
db = SQLAlchemy(app)

# 定义数据库模型
class File(db.Model):
    __tablename__ = 'files'

    # 字段定义
    id = db.Column(db.Integer, primary_key=True, comment='文件唯一ID')
    original_name = db.Column(db.String(255), nullable=False, comment='原始文件名')
    save_name = db.Column(db.String(255), nullable=False, unique=True, comment='服务器保存名')
    file_size = db.Column(db.BigInteger, nullable=False, comment='文件大小(字节)')
    mime_type = db.Column(db.String(100), nullable=False, comment='MIME类型')
    file_path = db.Column(db.String(500), nullable=False, comment='文件存储路径')
    total_rows = db.Column(db.Integer, default=0, comment='数据总行数')
    total_columns = db.Column(db.Integer, default=0, comment='数据总列数')
    upload_time = db.Column(db.DateTime, default=datetime.now, comment='上传时间')
    last_modified = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now, comment='最后修改时间')

    # 自定义方法：将对象转换为字典（用于返回JSON）
    def to_dict(self):
        return {
            'id': self.id if self.id is not None else None,
            'name': self.original_name if self.original_name is not None else None,
            'size': self.format_size(self.file_size) if self.file_size is not None else None,
            'totalRows': self.total_rows if self.total_rows is not None else None,
            'totalColumns': self.total_columns if self.total_columns is not None else None,
            'uploadTime': self.upload_time if self.upload_time is not None else None
        }

    # 静态方法：格式化文件大小
    @staticmethod
    def format_size(bytes):
        if bytes == 0:
            return '0 B'
        units = ['B', 'KB', 'MB', 'GB']
        i = 0
        while bytes >= 1024 and i < len(units) - 1:
            bytes /= 1024
            i += 1
        return f"{bytes:.2f} {units[i]}"
    
class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True, comment='用户唯一ID')
    username = db.Column(db.String(50), nullable=False, unique=True, comment='用户名')
    password_hash = db.Column(db.String(255), nullable=False, comment='密码哈希值')
    email = db.Column(db.String(100), nullable=True, unique=True, comment='邮箱')
    registration_time = db.Column(db.DateTime, default=datetime.now, comment='注册时间')
    
    
# 创建数据库表
with app.app_context():
    db.create_all()

# 首页路由
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/index')
def index_page():
    return render_template('index.html')

@app.route('/upload')
def upload():
    return render_template('uploade.html')

# 预览页路由
@app.route('/preview')
def preview():
    return render_template('preview.html')

@app.route('/history')
def history():
    return render_template('history.html')

@app.route('/auth')
def auth():
    return render_template('auth.html')

@app.route('/api/upload', methods=['POST'])
def api_upload():
    print("Received upload request")  # 调试输出
    # 这里写API文件处理逻辑
    if 'file' not in request.files:
        return jsonify({'error': 'missing file'}), 400

    file = request.files['file']
    if not file or file.filename == '':
        return jsonify({'error': 'empty filename'}), 400

    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    filename = secure_filename(file.filename)
    save_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(save_path)

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
        print(f"Failed to parse uploaded file stats: {e}")

    new_file = File(
        original_name=file.filename,
        save_name=filename,
        file_size=os.path.getsize(save_path),
        mime_type=file.mimetype,
        file_path='uploads/' + filename,
        total_rows=total_rows,
        total_columns=total_columns,
        upload_time=datetime.now(),
        last_modified=datetime.now()
    )
    db.session.add(new_file)
    db.session.commit()
    return jsonify({'message': 'uploaded', 'filename': filename, 'fileId': new_file.id}), 200


# 获取文件历史记录的API路由
@app.route('/api/files/history', methods=['GET'])
def get_file_history():
    files = File.query.all()
    print(f"Fetched {len(files)} files from database")  # 调试输出
    return jsonify({'data':[file.to_dict() for file in files]})


# 获取文件详情的API路由
@app.route('/api/files/history/<int:file_id>/preview', methods=['GET'])
def show_file_details(file_id):
    # 获取请求中的行数参数，默认为100
    row_count = request.args.get('rowCount', default=100, type=int)
    # 根据文件ID查询数据库获取文件路径
    file_record = db.session.get(File,file_id)
    print(f"Fetching details for file ID: {file_id}")  # 调试输出
    if not file_record:
        return jsonify({'error': 'file not found'}), 404
    file_path = os.path.join(app.root_path, file_record.file_path)
    try:
        with open(file_path, 'rb') as f:
            encoding = chardet.detect(f.read())['encoding']
        df = pd.read_csv(file_path, encoding=encoding)
        columns = df.columns.tolist()

        missing_df = df.replace('', pd.NA)
        nonecount = int(missing_df.isna().sum().sum())

        preview_df = df.head(row_count)
        rows = preview_df.fillna('').to_dict(orient='records')
        print(f"预览数据: {rows}")  # 调试输出
        print(f"空值总数: {nonecount}")  # 调试输出
        return jsonify({'data': rows, 'columns': columns, 'nonecount': nonecount})
    except Exception as e:
        print(f"读取文件时出错: {str(e)}")  # 调试输出
        return jsonify({'error': 'failed to read file'}), 500

# 用户登录API路由
@app.route('/api/user/login', methods=['POST'])
def api_login():
    print("收到登录请求")  # 调试输出
    try:
        data=request.get_json()
        username=data.get('username')
        password=data.get('password')
        print(f"登录数据 - 用户名: {username}, 密码: {password}")  # 调试输出
        user = User.query.filter_by(username=username).first()
        if user:
            print(f"找到用户: {user.username}, 存储的哈希密码: {user.password_hash}")  # 调试输出
        if user and password.encode('utf-8') == user.password_hash.encode('utf-8'):
            print("登录成功")  # 调试输出
            print(f"用户ID: {user.id}")  # 调试输出
            return jsonify({'message': '登录成功', 'userId': str(user.id)}), 200
    except Exception as e:
        print(f"解析登录请求时出错: {str(e)}")  # 调试输出
        return jsonify({'error': 'invalid request data'}), 400
    return jsonify({'error': '登录接口尚未实现'}), 200

# 用户注册API路由
@app.route('/api/user/register', methods=['POST'])
def api_register():
    print("收到注册请求")  # 调试输出
    data=request.get_json()
    username=data.get('username')
    password=data.get('password')
    email=data.get('email')
    print(f"注册数据 - 用户名: {username}, 密码: {password}, 邮箱: {email}")  # 调试输出
    if User.query.filter_by(username=username).first():
        return jsonify({'error': '用户名已存在'}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({'error': '邮箱已被注册'}), 400

    # 创建新用户
    new_user = User(username=username, email=email, password_hash=password)
    db.session.add(new_user)
    db.session.commit()

    return jsonify({'message': '注册成功'}), 200


# 测试数据库连接的路由
# 访问 http://localhost:5000/test-db 来测试数据库连接是否成功
@app.route('/test-db')
def test_db():
    try:
        # 执行一个简单的查询测试连接
        db.session.execute(text('SELECT 1'))
        return '✅ MySQL连接成功！'
    except Exception as e:
        return f'❌ MySQL连接失败：{str(e)}'
    

# 启动应用
if __name__ == '__main__':
    app.run(debug=True)