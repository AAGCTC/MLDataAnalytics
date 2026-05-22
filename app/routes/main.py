from flask import Blueprint, render_template

main_bp = Blueprint('main', __name__)

@main_bp.route('/')
@main_bp.route('/index')
def index():
    return render_template('index.html')

@main_bp.route('/upload')
def upload():
    return render_template('upload.html')

@main_bp.route('/preview')
def preview():
    return render_template('preview.html')

@main_bp.route('/analysis')
def analysis():
    return render_template('analysis.html')

@main_bp.route('/history')
def history():
    return render_template('history.html')

@main_bp.route('/auth')
def auth():
    return render_template('auth.html')

@main_bp.route('/clean')
def clean():
    return render_template('clean.html')