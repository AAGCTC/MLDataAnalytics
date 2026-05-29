let historyFiles=[];
let selectedFile=null;
let cleanedFileId=null;
document.addEventListener('DOMContentLoaded', () => {
    initHistoryPage();
    initDetectButton();
    initTabSwitch();
    initCleanButton();
    initDownloadButton();
});

function initHistoryPage() {
    if (!localStorage.getItem('animeflowUserId')) {
        showNotification('用户未登录', 'warning');
        const option = document.createElement('option');
        option.value = '';
        option.textContent = '暂无文件数据';
        document.getElementById('clean-file').appendChild(option);
        return;
    } else {
        loadHistory();
    }
    document.getElementById("clean-file").addEventListener("change", async (event) => {
        const fileId = event.target.value;
        document.getElementById("detect-btn").disabled=true;
        if (!fileId) {
            return;
        }
        const file=historyFiles.find(f => f.id.toString() === fileId);
        if(!file){
            showNotification('文件数据异常', 'error');
            return;
        }
        selectedFile = file;
        UpdateInfo(file);
        document.getElementById("detect-btn").disabled=false;
    });
}

async function loadHistory() {
    const response = await fetch(`/api/files/${localStorage.getItem('animeflowUserId')}/history`);
    if (!response.ok) {
        showNotification('Failed to fetch file history', 'error');
        return;
    }
    const response_json = await response.json();
    const files = Array.isArray(response_json.data) ? response_json.data : [];
    historyFiles = files || [];
    const select = document.getElementById('clean-file');
    const option = document.createElement('option');
    option.value = '';
    option.textContent = '请选择文件';
    select.appendChild(option);
    files.forEach(file => {
        const option = document.createElement('option');
        option.value = file.id;
        option.textContent = file.name;
        select.appendChild(option);
    });
}

function UpdateInfo(file) {
    const info_rows=document.getElementById('clean-rows');
    const info_columns=document.getElementById('clean-columns');
    const info_size=document.getElementById('clean-size');
    const info_time=document.getElementById('clean-upload-time');
    info_rows.textContent=file.totalRows;
    info_columns.textContent=file.totalColumns;
    info_size.textContent=(file.size);
    info_time.textContent=file.uploadTime;
}

// 初始化检测按钮点击事件
function initDetectButton() {
    const detectBtn = document.getElementById('detect-btn');
    
    detectBtn.addEventListener('click', async () => {
        if (!selectedFile) {
            showNotification('请先选择一个文件', 'warning');
            return;
        }
        
        try {
            // 检测过程中禁用按钮，防止重复点击
            detectBtn.disabled = true;
            detectBtn.textContent = '检测中...';
            
            // 调用后端检测API
            const response = await fetch(`/api/files/${selectedFile.id}/detect`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: localStorage.getItem('animeflowUserId')
                })
            });
            
            if (!response.ok) {
                showNotification('检测请求失败', 'error');
            }
            
            const result = await response.json();
            showNotification('检测完成', 'success');
            
            // 这里可以添加跳转到结果页面或显示结果的逻辑
            console.log('检测结果:', result);
            UpdateDetectResult(result);
            document.getElementById('panel-file').style.display = 'none';
            document.getElementById('panel-detect').style.display = 'block';
            document.getElementById('panel-clean').style.display = 'block';
        } catch (error) {
            console.error('检测出错:', error);
            showNotification('检测失败: ' + error.message, 'error');
        } finally {
            // 恢复按钮状态
            detectBtn.disabled = false;
            detectBtn.textContent = '开始检测';
        }
    });
}


function UpdateDetectResult(result){
    // 更新质量统计卡片
    const totalRows = result.totalRows;
    const nullRows = result.nullRows || 0;
    const outlierRows = result.outlierRows || 0;
    const validRows = result.effectiveRows || 0;
    const qualityScore = Math.round(result.qualityScore || 0);

    // 更新总行数显示（确保与数据预览一致）
    document.getElementById('clean-rows').textContent = totalRows;

    document.getElementById('null-count').textContent = nullRows;
    document.getElementById('null-percent').textContent = `(${(nullRows/totalRows*100).toFixed(1)}%)`;

    document.getElementById('outlier-count').textContent = outlierRows;
    document.getElementById('outlier-percent').textContent = `(${(outlierRows/totalRows*100).toFixed(1)}%)`;

    document.getElementById('valid-count').textContent = validRows;
    document.getElementById('valid-percent').textContent = `(${(validRows/totalRows*100).toFixed(1)}%)`;

    document.getElementById('data-quality').textContent = `${qualityScore}%`;
    document.getElementById('quality-fill').style.width = `${qualityScore}%`;

    // 生成空值表格
    generateTable('null-table', result.nullHeaders || [], result.nullData || []);
    
    // 生成异常值表格
    generateTable('outlier-table', result.outlierHeaders || [], result.outlierData || []);
}

function generateTable(tableId, headers, data) {
    const table = document.getElementById(tableId);
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');
    thead.innerHTML = '';
    tbody.innerHTML = '';
    // 生成表头
    const headerRow = document.createElement('tr');
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    // 生成表格内容
    data.forEach(row => {
        const tr = document.createElement('tr');
        row.forEach(cell => {
            const td = document.createElement('td');
            td.textContent = cell;
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    if(data.length==0){
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.textContent = '无数据';
        td.colSpan = headers.length;
        td.style.textAlign = 'center';
        tr.appendChild(td);
        tbody.appendChild(tr);
    }
}  

// ==================== 标签页切换功能 ====================
function initTabSwitch() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // 移除所有激活状态
            tabButtons.forEach(btn => btn.classList.remove('is-active'));
            tabContents.forEach(content => content.classList.remove('is-active'));
            
            // 激活当前标签
            button.classList.add('is-active');
            const tabId = button.getAttribute('data-tab') + '-tab';
            document.getElementById(tabId).classList.add('is-active');
        });
    });
}

// ==================== 步骤3：数据清洗执行 ====================
function initCleanButton() {
    const cleanBtn = document.getElementById('clean-btn');
    const downloadBtn = document.getElementById('download-btn');
    
    cleanBtn.addEventListener('click', async () => {
        try {
            // 获取清洗规则
            const nullRule = document.getElementById('null-rule').value;
            const outlierRule = document.getElementById('outlier-rule').value;
            const duplicateRule = document.getElementById('duplicate-rule').value;
            
            // 更新状态
            cleanBtn.disabled = true;
            cleanBtn.innerHTML = '清洗中...';
            downloadBtn.disabled = true;
            document.getElementById('clean-progress').style.display = 'block';
            document.getElementById('clean-summary').style.display = 'none';
            
            // 调用后端清洗API
            const response = await fetch(`/api/files/${selectedFile.id}/clean`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: localStorage.getItem('animeflowUserId'),
                    rules: {
                        null: nullRule,
                        outlier: outlierRule,
                        duplicate: duplicateRule
                    }
                })
            });
            
            if (!response.ok) {
                showNotification('清洗请求失败', 'error');
            }
            
            const cleanResult = await response.json();
            console.log('清洗结果:', cleanResult);
            cleanedFileId = cleanResult.cleanedFileId; // 保存清洗后文件ID以供下载使用
            // 显示清洗结果摘要
            showCleanSummary(cleanResult.summary);
            document.getElementById('clean-summary').style.display = 'block';
            downloadBtn.disabled = false;
            
            showNotification('数据清洗完成', 'success');
            
        } catch (error) {
            console.error('清洗出错:', error);
            showNotification('清洗失败: ' + error.message, 'error');
        } finally {
            cleanBtn.disabled = false;
            cleanBtn.innerHTML = '执行清洗';
            document.getElementById('clean-progress').style.display = 'none';
        }
    });
}

function showCleanSummary(result) {
    document.getElementById('original-rows').textContent = result.originalRows;
    document.getElementById('cleaned-rows').textContent = result.cleanedRows;
    document.getElementById('deleted-nulls').textContent = result.deletedNulls;
    document.getElementById('handled-outliers').textContent = result.handledOutliers;
    document.getElementById('deleted-duplicates').textContent = result.deletedDuplicates;
}

// ==================== 下载清洗后文件 ====================
function initDownloadButton() {
    const downloadBtn = document.getElementById('download-btn');
    
    downloadBtn.addEventListener('click', async () => {
        try {
            downloadBtn.disabled = true;
            downloadBtn.innerHTML = '下载中...';
            
            // 调用下载API
            const response = await fetch(`/api/files/${cleanedFileId}/download`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('animeflowUserId')}`
                }
            });
            
            if (!response.ok) {
                showNotification('下载请求失败', 'error');
            }


            // 获取文件名并触发下载
            const blob = await response.blob();
            const contentDisposition = response.headers.get('Content-Disposition');
            // ==================== 修复后的文件名解析逻辑 ====================
            let fileName = `cleaned_${selectedFile.name}`; // 默认文件名
            
            if (contentDisposition) {
                // 优先处理标准的UTF-8文件名格式 filename*=UTF-8''
                const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
                if (utf8Match && utf8Match[1]) {
                    fileName = decodeURIComponent(utf8Match[1]);
                } else {
                    // 处理旧的 filename="文件名" 格式
                    const legacyMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
                    if (legacyMatch && legacyMatch[1]) {
                        fileName = legacyMatch[1];
                    }
                }
            }
            
            console.log('解析后的文件名:', fileName);
            
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            showNotification('文件下载成功', 'success');
            
        } catch (error) {
            console.error('下载出错:', error);
            showNotification('下载失败: ' + error.message, 'error');
        } finally {
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = '下载清洗后数据';
        }
    });
}