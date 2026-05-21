function initHistoryPage() {
    const tableBody = document.getElementById('history-table-body');
    if (!tableBody) {
        return;
    }

    const notify = window.showNotification || ((message) => console.log(message));
    const refreshBtn = document.getElementById('history-refresh');
    const sortBtn = document.getElementById('history-sort-btn');
    const totalCount = document.getElementById('history-total-count');
    const latestTime = document.getElementById('history-latest-time');
    const sortLabel = document.getElementById('history-sort-label');

    let sortOrder = sortBtn?.dataset.order === 'asc' ? 'asc' : 'desc';

    const parseUploadTime = (value) => {
        if (!value) {
            return 0;
        }
        const time = new Date(value).getTime();
        return Number.isFinite(time) ? time : 0;
    };

    const formatUploadTime = (value) => {
        if (!value) {
            return '-';
        }
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) {
            return date.toLocaleString();
        }
        return String(value);
    };

    const updateSummary = (files) => {
        if (totalCount) {
            totalCount.textContent = `${files.length}`;
        }
        if (latestTime) {
            if (files.length === 0) {
                latestTime.textContent = '-';
            } else {
                const latest = files.reduce((acc, current) => {
                    return parseUploadTime(current.uploadTime) > parseUploadTime(acc.uploadTime)
                        ? current
                        : acc;
                }, files[0]);
                latestTime.textContent = formatUploadTime(latest.uploadTime);
            }
        }
        if (sortLabel) {
            sortLabel.textContent = sortOrder === 'desc' ? '时间降序' : '时间升序';
        }
    };

    const renderRows = (files) => {
        tableBody.innerHTML = '';

        if (files.length === 0) {
            tableBody.innerHTML = `
                <tr class="empty-state">
                    <td colspan="6">
                        <div class="empty-content">
                            <span class="empty-icon">📭</span>
                            <p class="history-empty-text">暂无数据文件，请先上传</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        const rows = files.map((file) => {
            const previewUrl = file.id
                ? `/preview?fileId=${encodeURIComponent(file.id)}`
                : '/preview';

            const totalRows = file.totalRows !== null && file.totalRows !== undefined
                ? file.totalRows
                : '-';
            const totalColumns = file.totalColumns !== null && file.totalColumns !== undefined
                ? file.totalColumns
                : '-';

            return `
                <tr>
                    <td class="history-file-name">${file.name || '-'}</td>
                    <td>${file.size || '-'}</td>
                    <td>${formatUploadTime(file.uploadTime)}</td>
                    <td>${totalRows}</td>
                    <td>${totalColumns}</td>
                    <td>
                        <a class="history-action" href="${previewUrl}">
                            👁️ 预览
                        </a>
                    </td>
                </tr>
            `;
        });

        tableBody.innerHTML = rows.join('');
    };

    const loadHistory = async () => {
        try {
            const response = await fetch('/api/files/history');
            if (!response.ok) {
                throw new Error('Failed to fetch file history');
            }
            const data = await response.json();
            const files = Array.isArray(data.data) ? data.data : [];
            const sorted = files.slice().sort((a, b) => {
                const timeA = parseUploadTime(a.uploadTime);
                const timeB = parseUploadTime(b.uploadTime);
                return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
            });

            updateSummary(sorted);
            renderRows(sorted);
        } catch (error) {
            console.error('Error fetching history list:', error);
            notify('历史记录加载失败：' + error.message, 'error');
        }
    };

    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadHistory);
    }

    if (sortBtn) {
        sortBtn.addEventListener('click', () => {
            sortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
            sortBtn.dataset.order = sortOrder;
            loadHistory();
        });
    }

    loadHistory();
}

document.addEventListener('DOMContentLoaded', () => {
    initHistoryPage();
});
