from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class File(db.Model):
    __tablename__ = 'files'

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

    def to_dict(self):
        """转换为字典用于JSON返回"""
        return {
            'id': self.id,
            'name': self.original_name,
            'size': self.format_size(self.file_size),
            'totalRows': self.total_rows,
            'totalColumns': self.total_columns,
            'uploadTime': self.upload_time.isoformat() if self.upload_time else None
        }

    @staticmethod
    def format_size(bytes_val):
        """格式化文件大小显示"""
        if bytes_val == 0:
            return '0 B'
        units = ['B', 'KB', 'MB', 'GB']
        i = 0
        while bytes_val >= 1024 and i < len(units) - 1:
            bytes_val /= 1024
            i += 1
        return f"{bytes_val:.2f} {units[i]}"

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True, comment='用户唯一ID')
    username = db.Column(db.String(50), nullable=False, unique=True, comment='用户名')
    password_hash = db.Column(db.String(255), nullable=False, comment='密码哈希值')
    email = db.Column(db.String(100), nullable=True, unique=True, comment='邮箱')
    registration_time = db.Column(db.DateTime, default=datetime.now, comment='注册时间')

class UserFiles(db.Model):
    __tablename__ = 'user_files'

    id = db.Column(db.Integer, primary_key=True, comment='记录唯一ID')
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, comment='用户ID')
    file_id = db.Column(db.Integer, db.ForeignKey('files.id'), nullable=False, comment='文件ID')

    # 建立外键关联
    user = db.relationship('User', backref=db.backref('user_files', cascade='all, delete-orphan'))
    file = db.relationship('File', backref=db.backref('user_files', cascade='all, delete-orphan'))