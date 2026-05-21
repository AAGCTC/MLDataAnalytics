import bcrypt
from flask import Blueprint, request, jsonify
from app.models import db, User

auth_bp = Blueprint('auth', __name__, url_prefix='/api/user')

@auth_bp.route('/login', methods=['POST'])
def login():
    """用户登录接口（修复了明文密码验证问题）"""
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')

        if not username or not password:
            return jsonify({'error': '用户名和密码不能为空'}), 400

        user = User.query.filter_by(username=username).first()
        if not user:
            return jsonify({'error': '用户不存在'}), 401

        # 使用bcrypt验证密码哈希
        if bcrypt.checkpw(password.encode('utf-8'), user.password_hash.encode('utf-8')):
            return jsonify({'message': '登录成功', 'userId': str(user.id)}), 200
        else:
            return jsonify({'error': '密码错误'}), 401

    except Exception as e:
        return jsonify({'error': f'请求处理失败: {str(e)}'}), 400

@auth_bp.route('/register', methods=['POST'])
def register():
    """用户注册接口（修复了明文密码存储问题）"""
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        email = data.get('email')

        if not username or not password:
            return jsonify({'error': '用户名和密码不能为空'}), 400

        if User.query.filter_by(username=username).first():
            return jsonify({'error': '用户名已存在'}), 400

        if email and User.query.filter_by(email=email).first():
            return jsonify({'error': '邮箱已被注册'}), 400

        # 使用bcrypt加密密码
        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        new_user = User(
            username=username,
            email=email,
            password_hash=password_hash
        )
        db.session.add(new_user)
        db.session.commit()

        return jsonify({'message': '注册成功'}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'注册失败: {str(e)}'}), 500