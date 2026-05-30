// 历史文件列表（从后端加载）
let analysisFiles = [];
// 文件预览数据行（用于图表渲染）
let previewRows = [];
// 所有字段名列表
let columnList = [];
// 推断出的数值型字段（用于图表数值轴筛选）
let numericColumns = [];
// Chart.js 实例列表（用于销毁旧图表，避免内存泄漏）
let chartInstances = [];
let chartCount = 0; // 图表计数器，用于生成唯一ID
let chartsConfig = []; // 存储当前图表配置数据
let mlConfigCount = 0; // 机器学习配置计数器
let mlConfigs = []; // 存储机器学习配置数据
const chartSchemas = {
    line: { label: "折线图", fields: [{ key: "x", label: "X 轴", type: "any", required: true }, { key: "y", label: "Y 值", type: "numeric", required: true }] },
    area: { label: "面积图", fields: [{ key: "x", label: "X 轴", type: "any", required: true }, { key: "y", label: "Y 值", type: "numeric", required: true }] },
    bar: { label: "柱状图", fields: [{ key: "x", label: "类别", type: "any", required: true }, { key: "y", label: "数值(可选)", type: "numeric", required: false }] },
    pie: { label: "饼图", fields: [{ key: "label", label: "标签", type: "any", required: true }, { key: "value", label: "数值(可选)", type: "numeric", required: false }] },
    scatter: { label: "散点图", fields: [{ key: "x", label: "X 值", type: "numeric", required: true }, { key: "y", label: "Y 值", type: "numeric", required: true }] },
    radar: { label: "雷达图", fields: [{ key: "label", label: "标签", type: "any", required: true }, { key: "value", label: "数值", type: "numeric", required: true }] }
};

const mlSchemas = {
    regression: { label: "回归", targetRequired: true },
    classification: { label: "分类", targetRequired: true },
    clustering: { label: "聚类", targetRequired: false }
};

const chartPalette = ["#4fd1ff", "#f5b544", "#2de2a6", "#fca5a5", "#93c5fd", "#f97316"];

const statusLabels = { load: "读取中", clean: "准备中", model: "构建中", render: "渲染完成" };

// 简单的 DOM 查询助手
function $(id) {
    return document.getElementById(id);
}

// 格式化上传时间显示
function formatUploadTime(value) {
    if (!value) return "-";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

// 更新分析状态显示
function SetState(state) {
    const analysis_status = $("analysis-status");
    const track = Array.from(document.querySelectorAll(".status-step"));

    track.forEach((item) => {
        const step = Object.keys(statusLabels).indexOf(item.getAttribute("data-step"));
        const currentStep = Object.keys(statusLabels).indexOf(state);

        item.classList.toggle("is-active", step <= currentStep);
        console.log(`状态步骤 ${item.getAttribute("data-step")} ${step <= currentStep ? "激活" : "未激活"}`);
    })

    analysis_status.textContent = statusLabels[state] || "待机";
    console.log(`状态更新为: ${state}`);
}

// 显示或隐藏分析结果区域
function setResultVisible(visible) {
    const result = $("analysis-result");
    if (!result) {
        $("analysis-result").classList.remove("has-results");
        return;
    }
    $('analysis-result').classList.add('has-results');
    console.log(`分析结果区域 ${visible ? "显示" : "隐藏"}`);
}

// 更新文件摘要显示
function updateFileSummary(file) {
    if (!file) {
        $("analysis-file-meta").textContent = "未选择文件";
        $("analysis-rows").textContent = "-";
        $("analysis-columns").textContent = "-";
        $("analysis-size").textContent = "-";
        $("analysis-upload-time").textContent = "-";
        return;
    }

    const metaParts = [];
    if (file.totalRows !== null) metaParts.push(`${file.totalRows} 行`);
    if (file.totalColumns !== null) metaParts.push(`${file.totalColumns} 列`);
    $("analysis-file-meta").textContent = metaParts.length ? `${file.name} · ${metaParts.join(" / ")}` : file.name;
    $("analysis-rows").textContent = file.totalRows ?? "-";
    $("analysis-columns").textContent = file.totalColumns ?? "-";
    $("analysis-size").textContent = file.size ?? "-";
    $("analysis-upload-time").textContent = formatUploadTime(file.uploadTime);
}

// 更新预览链接地址
function updatePreviewLink(file) {
    const link = $("analysis-preview-link");
    if (!link) return;
    if (file && file.id) {
        link.setAttribute("href", `/preview?fileId=${encodeURIComponent(file.id)}`);
    } else {
        link.setAttribute("href", "/preview");
    }
}

// 设置文件选择下拉菜单选项
function setFileOptions(files) {
    const select = $("analysis-file");
    if (!select) return;
    select.innerHTML = "";

    // 无文件时显示禁用选项
    if (!files.length) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "暂无可用文件";
        option.disabled = true;
        option.selected = true;
        select.appendChild(option);
        return;
    }

    // 占位选项
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "请选择文件";
    placeholder.selected = true;
    select.appendChild(placeholder);

    // 遍历文件生成选项
    files.forEach((file) => {
        const option = document.createElement("option");
        option.value = String(file.id);
        option.textContent = file.name;
        select.appendChild(option);
    });
}

// 推断数值型字段（基于预览数据）
function inferNumericColumns(rows, columns) {
    const numeric = [];
    columns.forEach((col) => {
        let numericCount = 0; // 可转数值的行数
        let total = 0; // 非空行数
        rows.forEach((row) => {
            const value = row[col];
            if (value === null || value === undefined || value === "") return;
            total += 1;
            if (!Number.isNaN(Number(value))) numericCount += 1;
        });
        // 数值占比 ≥ 80% 则判定为数值型字段
        if (total > 0 && numericCount / total >= 0.8) numeric.push(col);
    });
    return numeric;
}

// 填充字段选择下拉菜单
function populateSelect(select, options, allowEmpty) {
    const previous = select.value;
    select.innerHTML = "";

    // 占位选项（allowEmpty=true 则显示「无」，否则显示「请选择字段」且禁用）
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = allowEmpty ? "无" : "请选择字段";
    placeholder.disabled = !allowEmpty;
    placeholder.selected = true;
    select.appendChild(placeholder);

    // 填充选项
    options.forEach((optionValue) => {
        const option = document.createElement("option");
        option.value = optionValue;
        option.textContent = optionValue;
        select.appendChild(option);
    });

    // 保留之前选中值（如果仍在选项中）
    if (previous && options.includes(previous)) {
        select.value = previous;
    } else if (allowEmpty) {
        select.value = "";
    }
}

// 创建图表配置卡片
function createConfigCard(index) {
    const card = document.createElement("div");
    card.className = "chart-config";
    card.dataset.chartId = `chart-${Date.now()}-${index}`; // 唯一ID
    const chartId = card.dataset.chartId;

    // 卡片头部（标题+移除按钮）
    const head = document.createElement("div");
    head.className = "config-head";
    const title = document.createElement("div");
    title.className = "config-title";
    title.textContent = `图表 ${String(index).padStart(2, "0")}`; // 补零，如「图表 01」
    const remove = document.createElement("button");
    remove.className = "config-remove";
    remove.type = "button";
    remove.textContent = "移除";
    remove.addEventListener("click", () => {
        RemoveChart(chartId);
        updateConfigTitles(); // 移除后更新所有卡片标题
    });
    head.appendChild(title);
    head.appendChild(remove);

    // 图表类型选择行
    const typeRow = document.createElement("div");
    typeRow.className = "config-field";
    const typeLabel = document.createElement("label");
    typeLabel.textContent = "图表类型";
    const typeSelect = document.createElement("select");
    typeSelect.className = "card";
    // 填充图表类型选项
    Object.keys(chartSchemas).forEach((type) => {
        const option = document.createElement("option");
        option.value = type;
        option.textContent = chartSchemas[type].label;
        typeSelect.appendChild(option);
    });
    // 类型变化时，重新渲染字段映射框
    typeSelect.addEventListener("change", () => {
        renderConfigFields(card);
    });
    typeRow.appendChild(typeLabel);
    typeRow.appendChild(typeSelect);

    // 字段映射容器（动态渲染）
    const fields = document.createElement("div");
    fields.className = "config-fields";

    // 组装卡片
    card.appendChild(head);
    card.appendChild(typeRow);
    card.appendChild(fields);

    // 初始化渲染字段映射框
    renderConfigFields(card);
    return card;
}

// 更新所有配置卡片的标题（如「图表 01」、「图表 02」...）
function renderConfigFields(card) {
    const typeSelect = card.querySelector(".card");
    const type = typeSelect ? typeSelect.value : "line";
    const fieldsContainer = card.querySelector(".config-fields");
    if (!fieldsContainer) return;

    fieldsContainer.innerHTML = ""; // 清空旧字段
    const schema = chartSchemas[type];
    // 遍历该图表类型的字段配置，生成选择框
    schema.fields.forEach((field) => {
        const wrapper = document.createElement("div");
        wrapper.className = "config-field";

        const label = document.createElement("label");
        label.textContent = field.label;

        const select = document.createElement("select");
        select.className = "viz-select";
        select.dataset.field = field.key; // 标记字段key（如x/y/label/value）
        // 数值型字段只显示numericColumns，否则显示所有字段
        const options = field.type === "numeric" && numericColumns.length ? numericColumns : columnList;
        // 填充选项（必填字段不允许空，可选字段允许空）
        populateSelect(select, options, !field.required);

        wrapper.appendChild(label);
        wrapper.appendChild(select);
        fieldsContainer.appendChild(wrapper);
    });
}

// 创建机器学习配置卡片
function createMlConfigCard(index) {
    const card = document.createElement("div");
    card.className = "chart-config ml-config";
    card.dataset.mlId = `ml-${Date.now()}-${index}`;
    const mlId = card.dataset.mlId;

    const head = document.createElement("div");
    head.className = "config-head";
    const title = document.createElement("div");
    title.className = "config-title";
    title.textContent = `模型 ${String(index).padStart(2, "0")}`;
    const remove = document.createElement("button");
    remove.className = "config-remove";
    remove.type = "button";
    remove.textContent = "移除";
    remove.addEventListener("click", () => {
        RemoveMlConfig(mlId);
        updateMlTitles();
    });
    head.appendChild(title);
    head.appendChild(remove);

    const typeRow = document.createElement("div");
    typeRow.className = "config-field";
    const typeLabel = document.createElement("label");
    typeLabel.textContent = "学习任务";
    const typeSelect = document.createElement("select");
    typeSelect.className = "card";
    Object.keys(mlSchemas).forEach((type) => {
        const option = document.createElement("option");
        option.value = type;
        option.textContent = mlSchemas[type].label;
        typeSelect.appendChild(option);
    });
    typeSelect.addEventListener("change", () => {
        renderMlFields(card);
    });
    typeRow.appendChild(typeLabel);
    typeRow.appendChild(typeSelect);

    const fields = document.createElement("div");
    fields.className = "config-fields";

    card.appendChild(head);
    card.appendChild(typeRow);
    card.appendChild(fields);

    renderMlFields(card);
    return card;
}

// 渲染机器学习字段配置
function renderMlFields(card) {
    const typeSelect = card.querySelector(".card");
    const type = typeSelect ? typeSelect.value : "regression";
    const fieldsContainer = card.querySelector(".config-fields");
    if (!fieldsContainer) return;

    fieldsContainer.innerHTML = "";
    const schema = mlSchemas[type] || mlSchemas.regression;
    const fields = [
        {
            key: "target",
            label: schema.targetRequired ? "目标列" : "目标列(可选)",
            required: schema.targetRequired
        },
        { key: "feature", label: "特征列", required: true }
    ];

    fields.forEach((field) => {
        const wrapper = document.createElement("div");
        wrapper.className = "config-field";

        const label = document.createElement("label");
        label.textContent = field.label;

        const select = document.createElement("select");
        select.className = "viz-select";
        select.dataset.field = field.key;
        populateSelect(select, columnList, !field.required);

        wrapper.appendChild(label);
        wrapper.appendChild(select);
        fieldsContainer.appendChild(wrapper);
    });
}

// 更新机器学习配置卡片标题
function updateMlTitles() {
    const cards = Array.from(document.querySelectorAll(".ml-config"));
    cards.forEach((card, index) => {
        const title = card.querySelector(".config-title");
        if (title) title.textContent = `模型 ${String(index + 1).padStart(2, "0")}`;
    });
}

// 移除机器学习配置卡片
function RemoveMlConfig(mlId) {
    if (!mlId) {
        mlConfigs.forEach((c) => c.card.remove());
        mlConfigs = [];
        mlConfigCount = 0;
        const empty = $("ml-config-empty");
        if (empty) empty.style.display = "block";
        return;
    }
    const card = mlConfigs.find((c) => c.id === mlId);
    if (card) {
        card.card.remove();
        mlConfigs.splice(mlConfigs.indexOf(card), 1);
        mlConfigCount -= 1;
    }
    if (mlConfigCount === 0) {
        const empty = $("ml-config-empty");
        if (empty) empty.style.display = "block";
    }
}

// 加载文件预览数据（从后端获取前200行数据），并推断数值型字段
async function loadPreview(fileId) {
    if (!fileId) {
        previewRows = [];
        columnList = [];
        numericColumns = [];
        return;
    }
    try {
        const userId = localStorage.getItem('animeflowUserId');
        const response = await fetch(`/api/files/${userId}/history/${fileId}/preview?rowCount=200`);
        if (!response.ok) showNotification("文件加载失败");
        const data = await response.json();
        previewRows = Array.isArray(data.data) ? data.data : [];
        columnList = Array.isArray(data.columns) ? data.columns : [];
        numericColumns = inferNumericColumns(previewRows, columnList); // 推断数值字段

        // 更新所有配置卡片的字段选择框
        const chartCards = Array.from(document.querySelectorAll(".chart-config:not(.ml-config)"));
        chartCards.forEach((card) => renderConfigFields(card));

        const mlCards = Array.from(document.querySelectorAll(".ml-config"));
        mlCards.forEach((card) => renderMlFields(card));
    } catch (error) {
        showNotification(error.message, "error");
    }
}
// 更新所有配置卡片的标题（如「图表 01」、「图表 02」...）
function updateConfigTitles() {
    const cards = Array.from(document.querySelectorAll(".chart-config:not(.ml-config)"));
    cards.forEach((card, index) => {
        const title = card.querySelector(".config-title");
        if (title) title.textContent = `图表 ${String(index + 1).padStart(2, "0")}`;
    });
}

// 移除图表配置卡片
function RemoveChart(chartid) {
    if (!chartid) {
        chartsConfig.forEach((c) => c.card.remove());
        chartsConfig = [];
        chartCount = 0;
    }
    const card = chartsConfig.find((c) => c.id === chartid);
    if (card) {
        card.card.remove();
        chartsConfig.splice(chartsConfig.indexOf(card), 1);
        chartCount -= 1;
    }
    if (chartCount === 0) {
        $("chart-config-empty").style.display = "block";
    }
}

// 收集当前所有图表配置数据
function handleGenerate() {
    // 1. 校验：是否选择文件
    const fileId = $("analysis-file").value;
    if (!fileId) {
        showNotification("请先选择文件", "error");
        return;
    }

    // 2. 校验：预览数据是否为空
    if (!previewRows.length) {
        showNotification("预览数据为空", "error");
        return;
    }

    // 3. 校验：是否添加图表配置
    const configs = chartsConfig.map((c) => {
        const type = c.card.querySelector(".card").value;
        const fieldSelects = c.card.querySelectorAll(".viz-select");
        const fields = {};
        fieldSelects.forEach((select) => {
            const key = select.dataset.field;
            const value = select.value;
            if (value) fields[key] = value;
        });
        return { type, fields };
    });
    

    
    const mlPayload = mlConfigs.map((c) => {
        const type = c.card.querySelector(".card").value;
        const fieldSelects = c.card.querySelectorAll(".viz-select");
        const fields = {};
        fieldSelects.forEach((select) => {
            const key = select.dataset.field;
            const value = select.value;
            if (value) fields[key] = value;
        });
        return { type, fields };
    });
    if (!configs.length&&!mlPayload.length) {
        showNotification("请至少添加一个图表", "error");
        return;
    }
    // 4. 校验：必填字段是否填写
    let isValid = true;
    configs.forEach((config) => {
        const schema = chartSchemas[config.type];
        if (schema && schema.fields) {
            schema.fields.forEach((field) => {
                if (field.required && (!config.fields[field.key] || config.fields[field.key] === "")) {
                    isValid = false;
                }
            });
        }
    });
    if (!isValid) {
        showNotification("请补全必选字段", "error");
        return;
    }
    showNotification("正在生成图表...", "info");
    // 5. 显示结果区域，更新状态（模拟处理流程）
    setResultVisible(true);
    SetState("load"); // 读取中
    setTimeout(() => SetState("clean"), 200); // 200ms后→准备中
    setTimeout(() => SetState("model"), 400); // 400ms后→构建中
    setTimeout(() => {
        SetState("render"); // 600ms后→渲染完成
        renderCharts(configs, mlPayload); // 渲染图表并提交机器学习配置
    }, 600);

    // 6. 更新分析报告
    //const chartNames = configs.map((config) => chartSchemas[config.type].label).join("、");
    //updateReport([
    //    `图表：${chartNames}。`,
    //    `已载入行数：${previewRows.length}。`,
    //    `可用字段：${columnList.length}。`
    //]);

    // 7. 提示成功
    showNotification("图表已生成", "success");
}

function clearCharts() {
    chartInstances.forEach((chart) => chart.destroy());
    chartInstances = [];
    const grid = $("analysis-chart-grid");
    if (grid) {
        grid.innerHTML = "";
    }
}

function hexToRgba(hex, alpha) {
    if (!hex || !hex.startsWith("#") || hex.length !== 7) return hex;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function buildCategorySeries(rows, labelKey, valueKey) {
    const map = new Map();
    rows.forEach((row) => {
        const label = row[labelKey];
        if (label === undefined || label === null || label === "") return;
        if (valueKey) {
            const value = Number(row[valueKey]);
            if (Number.isNaN(value)) return;
            map.set(label, (map.get(label) || 0) + value);
        } else {
            map.set(label, (map.get(label) || 0) + 1);
        }
    });
    const labels = Array.from(map.keys());
    const values = labels.map((label) => map.get(label));
    return { labels, values };
}

function buildXYSeries(rows, xKey, yKey) {
    const map = new Map();
    rows.forEach((row) => {
        const x = row[xKey];
        if (x === undefined || x === null || x === "") return;
        const y = Number(row[yKey]);
        if (Number.isNaN(y)) return;
        const key = String(x);
        map.set(key, (map.get(key) || 0) + y);
    });
    const labels = Array.from(map.keys());
    const values = labels.map((label) => map.get(label));
    return { labels, values };
}

function buildScatterSeries(rows, xKey, yKey) {
    const points = [];
    rows.forEach((row) => {
        const x = Number(row[xKey]);
        const y = Number(row[yKey]);
        if (Number.isNaN(x) || Number.isNaN(y)) return;
        points.push({ x, y });
    });
    return points;
}

function buildChartConfig(config, index, chartData) {
    if (!config || !config.type || !chartSchemas[config.type] || !chartData) return null;
    const schema = chartSchemas[config.type];
    if (!schema) return null;

    const accent = chartPalette[index % chartPalette.length];
    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { labels: { color: "#cbd5e1" } }
        }
    };

    if (config.type === "line" || config.type === "area") {
        options.scales = {
            x: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(255,255,255,0.05)" } },
            y: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(255,255,255,0.05)" } }
        };
        return {
            type: "line",
            data: {
                labels: chartData.labels,
                datasets: [{
                    label: config.fields.y,
                    data: chartData.values,
                    borderColor: accent,
                    backgroundColor: config.type === "area" ? hexToRgba(accent, 0.25) : "transparent",
                    fill: config.type === "area",
                    tension: 0.35,
                    pointRadius: 3
                }]
            },
            options
        };
    }

    if (config.type === "bar") {
        options.scales = {
            x: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(255,255,255,0.05)" } },
            y: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(255,255,255,0.05)" } }
        };
        return {
            type: "bar",
            data: {
                labels: chartData.labels,
                datasets: [{
                    label: config.fields.y || "数量",
                    data: chartData.values,
                    backgroundColor: chartData.labels.map((_, idx) => chartPalette[idx % chartPalette.length])
                }]
            },
            options
        };
    }

    if (config.type === "pie") {
        return {
            type: "pie",
            data: {
                labels: chartData.labels,
                datasets: [{
                    data: chartData.values,
                    backgroundColor: chartData.labels.map((_, idx) => chartPalette[idx % chartPalette.length])
                }]
            },
            options
        };
    }

    if (config.type === "scatter") {
        options.scales = {
            x: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(255,255,255,0.05)" } },
            y: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(255,255,255,0.05)" } }
        };
        return {
            type: "scatter",
            data: {
                datasets: [{
                    label: `${config.fields.x} vs ${config.fields.y}`,
                    data: chartData.points,
                    backgroundColor: hexToRgba(accent, 0.6)
                }]
            },
            options
        };
    }

    if (config.type === "radar") {
        options.scales = {
            r: {
                grid: { color: "rgba(255,255,255,0.08)" },
                angleLines: { color: "rgba(255,255,255,0.12)" },
                pointLabels: { color: "#cbd5e1" },
                ticks: { color: "#94a3b8" }
            }
        };
        return {
            type: "radar",
            data: {
                labels: chartData.labels,
                datasets: [{
                    label: config.fields.value,
                    data: chartData.values,
                    borderColor: accent,
                    backgroundColor: hexToRgba(accent, 0.2),
                    pointBackgroundColor: accent
                }]
            },
            options
        };
    }

    return null;
}

async function renderCharts(configs, mlConfig) {
    console.log("渲染图表配置：", configs);
    const grid = $("analysis-chart-grid");
    if (!grid) return;
    console.log(mlConfig);
    if (!window.Chart) {
        showNotification("图表库未加载", "error");
        return;
    }

    clearCharts();
    try {
        const userid= localStorage.getItem('animeflowUserId');
        const response = await fetch(`/api/files/${userid}/history/${$("analysis-file").value}/visualization`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ chartConfig: configs, mlConfig: mlConfig || [] })
        });
        const result = await response.json();
        if (!result.success) {
            showNotification("图表生成失败", "error");
            return;
        }
        if (!result.data) {
            showNotification("图表生成失败: " + (result.data && result.data.message ? result.data.error : "未知错误"), "error");
            return;
        }
        chartsData = result.data || [];
        console.log("后端返回的图表数据：", chartsData);
        configs.forEach((config, index) => {
            console.log(`正在渲染图表 ${index} / ${configs.length}...`);
            const chartData = chartsData[index];
            const chartConfig = buildChartConfig(config, index, chartData);
            if (!chartConfig) return;

            const card = document.createElement("div");
            card.className = "chart-card";

            const title = document.createElement("h4");
            title.textContent = `${String(index + 1).padStart(2, "0")} - ${chartSchemas[config.type].label}`;

            const canvas = document.createElement("canvas");
            canvas.className = "chart-canvas";

            const frame = document.createElement("div");
            frame.className = "chart-frame";
            frame.style.height = "270px";
            frame.style.width = "100%";
            frame.style.position = "relative";
            frame.appendChild(canvas);

            card.appendChild(title);
            card.appendChild(frame);
            grid.appendChild(card);

            const chart = new Chart(canvas, {
                type: chartConfig.type,
                data: chartConfig.data,
                options: chartConfig.options
            });
            chartInstances.push(chart);
        });
        $("analysis-canvas-tag").textContent = `生成完毕`;
    } catch (error) {
        console.error("生成图表时出错:", error);
        showNotification("图表生成失败", "error");
    }

}


document.addEventListener("DOMContentLoaded", () => {
    // 页面加载时从后端获取历史文件列表
    if (!localStorage.getItem('animeflowUserId')) {
        showNotification('请先登录后再加载文件列表', 'warning');
        setFileOptions([]); // 显示无文件选项
    } else {
        fetch(`/api/files/${localStorage.getItem('animeflowUserId')}/history`).then((response) => response.json()).then((data) => {
            analysisFiles = data.data || [];
            setFileOptions(analysisFiles);
            console.log("历史文件列表已加载:", analysisFiles);
        }).catch((error) => {
            console.error("加载历史文件列表失败:", error);
        });
    }
    $("analysis-file").addEventListener("change", (event) => {
        const fileId = event.target.value;
        const file = analysisFiles.find((f) => String(f.id) === fileId);
        updateFileSummary(file);
        updatePreviewLink(file);
        RemoveChart();
        RemoveMlConfig();
        loadPreview(fileId);
    });
    $("chart-add").addEventListener("click", () => {
        if ($("analysis-file").value === "") {
            showNotification("请先选择一个文件", "warning");
            return;
        }
        chartCount += 1;
        if (chartCount > 0) {
            $("chart-config-empty").style.display = "none";
        }
        const configArea = $("chart-config-list");
        if (!configArea) return;
        const newCard = createConfigCard(chartCount);
        chartsConfig.push({ id: newCard.dataset.chartId, card: newCard }); // 默认类型为折线图，字段映射为空
        configArea.appendChild(newCard);
    });
    const mlAddButton = $("ml-add");
    if (mlAddButton) {
        mlAddButton.addEventListener("click", () => {
            if ($("analysis-file").value === "") {
                showNotification("请先选择一个文件", "warning");
                return;
            }
            mlConfigCount += 1;
            if (mlConfigCount > 0) {
                const empty = $("ml-config-empty");
                if (empty) empty.style.display = "none";
            }
            const configArea = $("ml-config-list");
            if (!configArea) return;
            const newCard = createMlConfigCard(mlConfigCount);
            mlConfigs.push({ id: newCard.dataset.mlId, card: newCard });
            configArea.appendChild(newCard);
        });
    }
    $("analysis-generate").addEventListener("click", handleGenerate);
});