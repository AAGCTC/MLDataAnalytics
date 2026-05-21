from flask import Flask
from flask_cors import CORS
from sqlalchemy import text
from app.config import Config
from app.models import db
from app.routes.main import main_bp
from app.routes.auth import auth_bp
from app.routes.files import files_bp

def create_app(config_class=Config):
    """应用工厂函数"""
    app = Flask(__name__)
    app.config.from_object(config_class)

    # 初始化扩展
    CORS(app)
    db.init_app(app)

    # 注册蓝图
    app.register_blueprint(main_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(files_bp)

    # 数据库连接测试路由
    @app.route('/test-db')
    def test_db():
        try:
            db.session.execute(text('SELECT 1'))
            return '✅ MySQL连接成功！'
        except Exception as e:
            return f'❌ MySQL连接失败：{str(e)}'

    # 创建数据库表
    with app.app_context():
        db.create_all()

    return app