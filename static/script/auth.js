document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.auth-tab');
    const forms = {
        login: document.getElementById('login-form'),
        register: document.getElementById('register-form')
    };
    const message = document.getElementById('auth-message');
    const login_identity = document.getElementById('login-identity');
    const login_password = document.getElementById('login-password');
    const register_password = document.getElementById('register-password');
    const register_confirm = document.getElementById('register-confirm');
    const register_nickname = document.getElementById('register-name');
    const register_email = document.getElementById('register-email');
    login_identity.value = '';
    login_password.value = '';
    register_nickname.value = '';
    register_email.value = '';
    register_password.value = '';
    register_confirm.value = '';
    if (tabs.length === 0) {
        return;
    }

    tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            tabs.forEach((item) => item.classList.remove('is-active'));
            tab.classList.add('is-active');
            tabs.forEach((item) => item.setAttribute('aria-selected', item === tab ? 'true' : 'false'));

            Object.values(forms).forEach((form) => form?.classList.remove('is-active'));
            const target = tab.dataset.tab;
            if (forms[target]) {
                forms[target].classList.add('is-active');
            }
        });
    });

    Object.values(forms).forEach((form) => {
        if (!form) {
            return;
        }
        if (form === forms.login) {
            console.log('Login form found');
            form.addEventListener('submit', async (event) => {
                console.log('Login form submitted');
                event.preventDefault();
                const identity = login_identity.value.trim();
                const password = login_password.value.trim();
                if (!identity || !password) {
                    message.textContent = '请输入用户名和密码';
                    message.classList.add('is-danger');
                    return;
                }
                try {
                    const response = await fetch('/api/user/login', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            username: identity,
                            password: password
                        })
                    })

                    if (!response.ok) {
                        const errorData = await response.json();
                        const errorMessage = errorData.error || '登录失败';
                        message.textContent = errorMessage;
                        showNotification(errorMessage, 'error');
                        return;
                    }
                    const data = await response.json();
                    if (data.error) {
                        message.textContent = data.error;
                        showNotification(data.error, 'error');
                        return;
                    }
                    if (data.message === '登录成功') {
                        message.textContent = '登录成功，正在跳转...';
                        showNotification('登录成功，正在跳转...', 'success');
                        console.log(data.userid);
                        setTimeout(() => {
                            window.location.href = '/?userid=' + data.userId;
                        }, 1500);
                    }
                }catch (error) {
                    console.error('Error during login:', error);
                    showNotification('登录请求失败：' + error.message, 'error');
                }
            });
        }
        if (form === forms.register) {
            console.log('Register form found');
            form.addEventListener('submit', async (event) => {
                console.log('Register form submitted');
                event.preventDefault();
                const nickname = register_nickname.value.trim();
                const email = register_email.value.trim();
                const password = register_password.value.trim();
                const confirm = register_confirm.value.trim();
                if (!nickname || !email || !password || !confirm) {
                    message.textContent = '请填写所有必填字段';
                    message.classList.add('is-danger');
                    return;
                }
                if (password !== confirm) {
                    message.textContent = '注册失败：密码和确认密码不匹配。';
                    showNotification('注册失败：密码和确认密码不匹配。', 'error');
                    message.classList.add('is-danger');
                    return;
                } else if (password.length < 8) {
                    message.textContent = '注册失败：密码长度必须在8-20个字符之间。';
                    showNotification('注册失败：密码长度必须在8-20个字符之间。', 'error');
                    message.classList.add('is-danger');
                    return;
                }

                try {
                    const response =await fetch('/api/user/register', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            username: nickname,
                            password: password,
                            email: email
                        })
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        const errorMessage = errorData.error || '注册失败';
                        message.textContent = errorMessage;
                        showNotification(errorMessage, 'error');
                        return;
                    }
                    data=await response.json();
                    if(data.message === '注册成功') {
                        message.textContent = '注册成功，正在跳转...';
                        showNotification('注册成功，正在跳转...', 'success');
                        setTimeout(() => {
                            window.location.href = '/auth';
                        }, 1000);
                    }
                } catch (error) {
                    console.error('Error during registration:', error);
                    showNotification('注册请求失败：' + error.message, 'error');
                }
            });
        }
    });
});
