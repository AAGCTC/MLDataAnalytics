let previewFileHistory = [];

function initPreviewPage() {
    const previewBtn = document.getElementById('preview-btn');
    if (previewBtn) {
        previewBtn.addEventListener('click', showFileDetails);
    }

    if (document.getElementById('history-file')) {
        fetchFileHistory();
    }
}

async function fetchFileHistory() {
    const fileSelect = document.getElementById('history-file');
    if (!fileSelect) {
        return;
    }
    if (!localStorage.getItem('animeflowUserId')) {
        showNotification('用户未登录', 'warning');
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = '暂无数据文件，请先上传';
        emptyOption.disabled = true;
        fileSelect.appendChild(emptyOption);
        return;
    }
    try {
        const response = await fetch(`/api/files/${localStorage.getItem('animeflowUserId')}/history`);
        if (!response.ok) {
            showNotification('Failed to fetch file history', 'error');
        }
        const data = await response.json();

        const files = Array.isArray(data.data) ? data.data : [];
        fileSelect.innerHTML = '';
        if (files.length === 0) {
            const emptyOption = document.createElement('option');
            emptyOption.value = '';
            emptyOption.textContent = '暂无数据文件，请先上传';
            emptyOption.disabled = true;
            fileSelect.appendChild(emptyOption);
            return;
        }

        previewFileHistory = files;
        files.forEach((file) => {
            const option = document.createElement('option');
            option.value = file.name;
            option.textContent = file.name;
            fileSelect.appendChild(option);
        });

        fileSelect.value = null;
        const params = new URLSearchParams(window.location.search);
        const fileIdParam = params.get('fileId');
        const fileNameParam = params.get('file') || params.get('filename');
        let targetFile = null;

        if (fileIdParam) {
            targetFile = files.find((file) => String(file.id) === String(fileIdParam));
        } else if (fileNameParam) {
            targetFile = files.find((file) => file.name === fileNameParam);
        }

        if (targetFile) {
            fileSelect.value = targetFile.name;
            const rowCountInput = document.getElementById('row-count');
            if (rowCountInput && !rowCountInput.value) {
                rowCountInput.value = '100';
            }
            showFileDetails();
        }
    } catch (error) {
        console.error('Error fetching file history:', error);
    }
}

function setPreviewState(state) {
    const emptyState = document.getElementById('empty-state');
    const loadingState = document.getElementById('loading-state');
    const tableContainer = document.getElementById('data-table-container');
    const chartsPreview = document.getElementById('charts-preview');
    const infoCard = document.getElementById('file-info-card');
    const quickActions = document.getElementById('quick-actions');

    if (!emptyState || !loadingState || !tableContainer) {
        return;
    }

    if (state === 'loading') {
        emptyState.style.display = 'none';
        loadingState.style.display = 'flex';
        tableContainer.style.display = 'none';
        if (chartsPreview) {
            chartsPreview.style.display = 'none';
        }
        return;
    }

    if (state === 'data') {
        emptyState.style.display = 'none';
        loadingState.style.display = 'none';
        tableContainer.style.display = 'block';
        if (chartsPreview) {
            chartsPreview.style.display = 'block';
        }
        return;
    }

    emptyState.style.display = 'flex';
    loadingState.style.display = 'none';
    tableContainer.style.display = 'none';
    if (chartsPreview) {
        chartsPreview.style.display = 'none';
    }
    if (infoCard) {
        infoCard.style.display = 'none';
    }
    if (quickActions) {
        quickActions.style.display = 'none';
    }
}

function renderPreviewTable(previewData, columns) {
    const head = document.getElementById('preview-data-head');
    const body = document.getElementById('preview-data-body');
    if (!head || !body) {
        return [];
    }

    head.innerHTML = '';
    body.innerHTML = '';

    if (!Array.isArray(previewData) || previewData.length === 0) {
        return [];
    }

    const headRow = document.createElement('tr');
    columns.forEach((col) => {
        const th = document.createElement('th');
        th.textContent = col;
        headRow.appendChild(th);
    });
    head.appendChild(headRow);

    const table = head.closest('table');
    if (table) {
        table.style.setProperty('--column-count', columns.length);
    }

    previewData.forEach((row) => {
        const tr = document.createElement('tr');
        columns.forEach((col) => {
            const td = document.createElement('td');
            const value = row[col];
            const cellContent = document.createElement('div');
            const textValue = value === null || value === undefined ? '' : String(value);
            cellContent.className = 'cell-content';
            cellContent.textContent = textValue;
            cellContent.setAttribute('data-full', textValue);
            cellContent.title = textValue;
            td.appendChild(cellContent);
            tr.appendChild(td);
        });
        body.appendChild(tr);
    });

    return columns;
}

function updatePreviewInfo(previewData, columns, filename, nonecount) {
    const infoCard = document.getElementById('file-info-card');
    const quickActions = document.getElementById('quick-actions');
    const currentFileName = document.getElementById('current-file-name');
    const currentFileMeta = document.getElementById('current-file-meta');
    const previewRowCount = document.getElementById('preview-row-count');
    const totalColumns = document.getElementById('total-columns');
    const missingValues = document.getElementById('missing-values');
    const dataQuality = document.getElementById('data-quality');
    const downloadBtn = document.getElementById('download-btn');
    const analyzeBtn = document.getElementById('analyze-btn');

    if (infoCard) {
        infoCard.style.display = 'block';
    }
    if (quickActions) {
        quickActions.style.display = 'block';
    }

    if (currentFileName) {
        currentFileName.textContent = filename || '';
    }

    if (currentFileMeta) {
        const fileInfo = previewFileHistory.find((file) => file.name === filename);
        const metaParts = [];
        if (fileInfo?.size) {
            metaParts.push(`大小 ${fileInfo.size}`);
        }
        if (fileInfo?.totalRows !== null && fileInfo?.totalRows !== undefined) {
            metaParts.push(`总行数 ${fileInfo.totalRows}`);
        }
        if (fileInfo?.totalColumns !== null && fileInfo?.totalColumns !== undefined) {
            metaParts.push(`列数 ${fileInfo.totalColumns}`);
        }
        if (fileInfo?.uploadTime) {
            const uploadDate = new Date(fileInfo.uploadTime);
            if (!Number.isNaN(uploadDate.getTime())) {
                metaParts.push(`上传 ${uploadDate.toLocaleString()}`);
            }
        }
        currentFileMeta.textContent = metaParts.join(' · ');
    }

    const rowCount = Array.isArray(previewData) ? previewData.length : 0;
    const columnCount = Array.isArray(columns) ? columns.length : 0;
    const fileInfo = previewFileHistory.find((file) => file.name === filename);
    const totalCells = fileInfo ? fileInfo.totalRows * fileInfo.totalColumns : 0;
    const qualityPercent = totalCells > 0
        ? Math.max(0, Math.min(100, Math.round((1 - nonecount / totalCells) * 100)))
        : 0;

    if (previewRowCount) {
        previewRowCount.textContent = `${rowCount}`;
    }
    if (totalColumns) {
        totalColumns.textContent = `${columnCount}`;
    }
    if (missingValues) {
        missingValues.textContent = `${nonecount}`;
    }
    if (dataQuality) {
        dataQuality.textContent = `${qualityPercent}%`;
    }

    if (downloadBtn) {
        downloadBtn.disabled = rowCount === 0;
    }
    if (analyzeBtn) {
        analyzeBtn.disabled = rowCount === 0;
    }
}

async function showFileDetails() {
    const notify = window.showNotification || ((message) => console.log(message));

    try {
        const fileSelect = document.getElementById('history-file');
        const rowCountInput = document.getElementById('row-count');
        if (!fileSelect || !rowCountInput) {
            return;
        }

        const filename = fileSelect.value;
        const fileId = previewFileHistory.find((file) => file.name === filename)?.id;
        const rowCount = Number(rowCountInput.value) || 100;

        if (!filename) {
            notify('请选择一个文件', 'error');
            return;
        }
        if (!fileId) {
            notify('无法找到文件记录', 'error');
            return;
        }
        if (rowCount <= 0) {
            notify('请输入有效的行数', 'error');
            return;
        }

        setPreviewState('loading');
        const response = await fetch(`/api/files/${localStorage.getItem('animeflowUserId')}/history/${fileId}/preview?rowCount=${rowCount}`, {
            method: 'GET'
        });
        if (!response.ok) {
            const errorText = await response.text();
            showNotification(`加载预览失败: ${errorText || response.statusText}`, 'error');
            setPreviewState('empty');
            return;
        }

        const data = await response.json();
        const columns = Array.isArray(data.columns) ? data.columns : [];
        const previewData = Array.isArray(data.data) ? data.data : [];
        const nonecount = data.nonecount || 0;

        if (previewData.length === 0) {
            setPreviewState('empty');
            updatePreviewInfo(previewData, [], filename, nonecount);
            return;
        }

        renderPreviewTable(previewData, columns);
        updatePreviewInfo(previewData, columns, filename, nonecount);
        setPreviewState('data');
    } catch (error) {
        console.error('Error fetching file details:', error);
        notify('加载预览失败：' + error.message, 'error');
        setPreviewState('empty');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initPreviewPage();
});
