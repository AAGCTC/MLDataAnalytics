function initFileUpload() {
    const fileInput = document.getElementById('file-input');
    const uploadBox = document.getElementById('upload-box');
    const defaultState = document.getElementById('default-state');
    const dragState = document.getElementById('drag-state');
    const progressState = document.getElementById('progress-state');
    const successState = document.getElementById('success-state');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const uploadTip = document.getElementById('upload-tip');
    const countdown = document.getElementById('countdown');

    if (!fileInput || !uploadBox || !defaultState || !dragState || !progressState || !successState) {
        return;
    }

    const notify = window.showNotification || ((message) => console.log(message));
    let dragCounter = 0;
    let countdownTimer = null;

    const setUploadState = (state) => {
        const isDefault = state === 'default';
        const isDrag = state === 'drag';
        const isProgress = state === 'progress';
        const isSuccess = state === 'success';

        defaultState.style.display = isDefault ? 'block' : 'none';
        dragState.style.display = isDrag ? 'block' : 'none';
        progressState.style.display = isProgress ? 'block' : 'none';
        successState.style.display = isSuccess ? 'block' : 'none';
    };

    const updateProgress = (percent) => {
        if (progressFill) {
            progressFill.style.width = `${percent}%`;
        }
        if (progressText) {
            progressText.textContent = `${percent}%`;
        }
        if (uploadTip) {
            if (percent < 90) {
                uploadTip.textContent = '正在上传文件...';
            } else if (percent < 100) {
                uploadTip.textContent = '正在校验数据...';
            } else {
                uploadTip.textContent = '即将完成...';
            }
        }
    };

    const startCountdown = (seconds, redirectUrl) => {
        if (!countdown) {
            return;
        }
        if (countdownTimer) {
            clearInterval(countdownTimer);
        }
        let remaining = seconds;
        countdown.textContent = `${remaining}`;
        countdownTimer = setInterval(() => {
            remaining -= 1;
            countdown.textContent = `${Math.max(0, remaining)}`;
            if (remaining <= 0) {
                clearInterval(countdownTimer);
                window.location.href = redirectUrl || '/preview';
            }
        }, 1000);
    };

    const uploadFile = (file) => new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/upload', true);

        xhr.upload.addEventListener('progress', (event) => {
            if (!event.lengthComputable) {
                return;
            }
            const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
            updateProgress(percent);
        });

        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const data = JSON.parse(xhr.responseText || '{}');
                    resolve(data);
                } catch (error) {
                    reject(new Error('服务器响应解析失败'));
                }
            } else {
                reject(new Error(xhr.responseText || '上传失败'));
            }
        });

        xhr.addEventListener('error', () => {
            reject(new Error('网络错误，上传中断'));
        });

        const formData = new FormData();
        formData.append('file', file);
        xhr.send(formData);
    });

    const handleFile = async (file) => {
        if (!file) {
            return;
        }

        setUploadState('progress');
        updateProgress(0);
        notify('正在处理文件: ' + file.name, 'info');

        try {
            const responseData = await uploadFile(file);
            if (responseData.message === 'uploaded') {
                updateProgress(100);
                setUploadState('success');
                const redirectUrl = responseData.fileId
                    ? `/preview?fileId=${encodeURIComponent(responseData.fileId)}`
                    : '/preview';
                startCountdown(3, redirectUrl);
                return;
            }
            throw new Error('上传失败');
        } catch (error) {
            notify('上传失败：' + error.message, 'error');
            console.error('Error uploading file:', error);
            setUploadState('default');
        } finally {
            fileInput.value = '';
        }
    };

    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        handleFile(file);
    });

    uploadBox.addEventListener('dragenter', (event) => {
        event.preventDefault();
        dragCounter += 1;
        setUploadState('drag');
    });

    uploadBox.addEventListener('dragover', (event) => {
        event.preventDefault();
    });

    uploadBox.addEventListener('dragleave', (event) => {
        event.preventDefault();
        dragCounter = Math.max(0, dragCounter - 1);
        if (dragCounter === 0) {
            setUploadState('default');
        }
    });

    uploadBox.addEventListener('drop', (event) => {
        event.preventDefault();
        dragCounter = 0;
        const files = event.dataTransfer?.files || [];
        if (files.length === 0) {
            setUploadState('default');
            return;
        }
        handleFile(files[0]);
    });

    window.addEventListener('dragover', (event) => {
        event.preventDefault();
    });

    window.addEventListener('drop', (event) => {
        event.preventDefault();
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initFileUpload();
});
