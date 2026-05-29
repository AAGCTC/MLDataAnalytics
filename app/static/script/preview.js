let previewFileHistory = [];
let previewCharts = []; // Chart.js 实例管理

function initPreviewPage() {
    const previewBtn = document.getElementById('preview-btn');
    if (previewBtn) {
        previewBtn.addEventListener('click', showFileDetails);
    }

    const analyzeBtn = document.getElementById('analyze-btn');
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', async () => {
            const notify = window.showNotification || ((message) => console.log(message));
            const fileSelect = document.getElementById('history-file');
            if (!fileSelect) {
                notify('未找到文件选择', 'error');
                return;
            }
            const filename = fileSelect.value;
            const fileInfo = previewFileHistory.find((f) => f.name === filename);
            if (!fileInfo) {
                notify('请选择要分析的文件', 'error');
                return;
            }
            notify('正在请求分析...', 'info');
            try {
                const resp = await fetch(`/api/files/history/${fileInfo.id}/analyze`, { method: 'GET' });
                if (!resp.ok) {
                    const text = await resp.text();
                    throw new Error(text || '分析接口返回错误');
                }
                const data = await resp.json();
                if (!data.success) {
                    notify('分析失败：' + (data.error || '未知错误'), 'error');
                    return;
                }
                // 在页面上渲染图表
                renderAnalysisCharts(data.charts || []);
                notify('分析完成', 'success');
            } catch (err) {
                console.error('Analyze error:', err);
                notify('分析请求失败：' + err.message, 'error');
            }
        });
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

function clearPreviewCharts() {
    try {
        previewCharts.forEach((c) => c && c.destroy && c.destroy());
    } catch (e) {
        console.error('Error destroying preview charts:', e);
    }
    previewCharts = [];
    const chartsPreview = document.getElementById('charts-preview');
    if (chartsPreview) {
        const cards = chartsPreview.querySelectorAll('.chart-card');
        cards.forEach((card) => {
            const placeholder = card.querySelector('.chart-placeholder');
            if (placeholder) {
                placeholder.innerHTML = `<div class="chart-icon">📊</div><p>点击生成票房曲线</p>`;
            }
            const canvas = card.querySelector('canvas');
            if (canvas) canvas.remove();
        });
    }
}

function renderAnalysisCharts(charts) {
    clearPreviewCharts();
    const chartsPreview = document.getElementById('charts-preview');
    if (!chartsPreview || !Array.isArray(charts) || charts.length === 0) return;

    const cards = chartsPreview.querySelectorAll('.chart-card');
    charts.forEach((chartData, idx) => {
        const card = cards[idx] || null;
        let targetContainer = null;
        if (card) {
            targetContainer = card.querySelector('.chart-placeholder');
        } else {
            // 如果占位卡片不足，追加新的卡片
            const grid = chartsPreview.querySelector('.charts-grid') || chartsPreview;
            const newCard = document.createElement('div');
            newCard.className = 'chart-card';
            newCard.innerHTML = `<div class="chart-header"><h4 class="chart-title">分析图 ${idx+1}</h4></div><div class="chart-placeholder"></div>`;
            grid.appendChild(newCard);
            targetContainer = newCard.querySelector('.chart-placeholder');
        }

        // 清空占位内容并插入canvas
        targetContainer.innerHTML = '';
        const canvas = document.createElement('canvas');
        targetContainer.appendChild(canvas);

        const cfg = { type: chartData.type === 'line' ? 'line' : chartData.type, data: chartData.data, options: { responsive: true, maintainAspectRatio: false } };

        try {
            const ctx = canvas.getContext('2d');
            const chart = new Chart(ctx, cfg);
            previewCharts.push(chart);
        } catch (e) {
            console.error('Failed to render preview chart:', e);
        }
    });
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
