let analysisFiles = [];
let previewRows = [];
let columnList = [];
let numericColumns = [];
let chartInstances = [];
let toastTimer = null;

const chartSchemas = {
    line: {
        label: "折线图",
        fields: [
            { key: "x", label: "X 轴", type: "any", required: true },
            { key: "y", label: "Y 值", type: "numeric", required: true }
        ]
    },
    area: {
        label: "面积图",
        fields: [
            { key: "x", label: "X 轴", type: "any", required: true },
            { key: "y", label: "Y 值", type: "numeric", required: true }
        ]
    },
    bar: {
        label: "柱状图",
        fields: [
            { key: "x", label: "类别", type: "any", required: true },
            { key: "y", label: "数值(可选)", type: "numeric", required: false }
        ]
    },
    pie: {
        label: "饼图",
        fields: [
            { key: "label", label: "标签", type: "any", required: true },
            { key: "value", label: "数值(可选)", type: "numeric", required: false }
        ]
    },
    scatter: {
        label: "散点图",
        fields: [
            { key: "x", label: "X 值", type: "numeric", required: true },
            { key: "y", label: "Y 值", type: "numeric", required: true }
        ]
    },
    radar: {
        label: "雷达图",
        fields: [
            { key: "label", label: "标签", type: "any", required: true },
            { key: "value", label: "数值", type: "numeric", required: true }
        ]
    }
};

const chartPalette = [
    "#4fd1ff",
    "#f5b544",
    "#2de2a6",
    "#fca5a5",
    "#93c5fd",
    "#f97316"
];

const statusLabels = {
    load: "读取中",
    clean: "准备中",
    model: "构建中",
    render: "渲染完成"
};

function $(id) {
    return document.getElementById(id);
}

function showToast(message, tone = "info") {
    const toast = $("analysis-toast");
    if (!toast) {
        return;
    }
    toast.textContent = message;
    toast.className = `toast is-visible ${tone}`.trim();
    if (toastTimer) {
        clearTimeout(toastTimer);
    }
    toastTimer = setTimeout(() => {
        toast.className = "toast";
    }, 2600);
}

function formatUploadTime(value) {
    if (!value) {
        return "-";
    }
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
        return date.toLocaleString();
    }
    return String(value);
}

function setStatus(step) {
    const statusText = $("analysis-status");
    const canvasTag = $("analysis-canvas-tag");
    const track = Array.from(document.querySelectorAll(".status-step"));

    track.forEach((item) => {
        const itemIndex = Object.keys(statusLabels).indexOf(item.dataset.step);
        const stepIndex = Object.keys(statusLabels).indexOf(step);
        item.classList.toggle("is-active", stepIndex >= 0 && itemIndex <= stepIndex);
    });

    if (statusText) {
        statusText.textContent = statusLabels[step] || "待机";
    }
    if (canvasTag) {
        canvasTag.textContent = statusLabels[step] || "等待中";
    }
}

function resetStatus() {
    setStatus(null);
    const statusText = $("analysis-status");
    if (statusText) {
        statusText.textContent = "待机";
    }
}

function setResultVisible(visible) {
    const result = $("analysis-result");
    if (!result) {
        return;
    }
    result.classList.toggle("is-visible", visible);
}

function updateReport(items) {
    const list = $("analysis-report-list");
    if (!list) {
        return;
    }
    list.innerHTML = "";
    items.forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        list.appendChild(li);
    });
}

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
    if (file.totalRows !== null && file.totalRows !== undefined) {
        metaParts.push(`${file.totalRows} 行`);
    }
    if (file.totalColumns !== null && file.totalColumns !== undefined) {
        metaParts.push(`${file.totalColumns} 列`);
    }
    $("analysis-file-meta").textContent = metaParts.length ? `${file.name} · ${metaParts.join(" / ")}` : file.name;
    $("analysis-rows").textContent = file.totalRows ?? "-";
    $("analysis-columns").textContent = file.totalColumns ?? "-";
    $("analysis-size").textContent = file.size ?? "-";
    $("analysis-upload-time").textContent = formatUploadTime(file.uploadTime);
}

function updatePreviewLink(file) {
    const link = $("analysis-preview-link");
    if (!link) {
        return;
    }
    if (file && file.id) {
        link.setAttribute("href", `/preview?fileId=${encodeURIComponent(file.id)}`);
    } else {
        link.setAttribute("href", "/preview");
    }
}

function setFileOptions(files) {
    const select = $("analysis-file");
    if (!select) {
        return;
    }
    select.innerHTML = "";

    if (!files.length) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "暂无可用文件";
        option.disabled = true;
        option.selected = true;
        select.appendChild(option);
        return;
    }

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "请选择文件";
    placeholder.selected = true;
    select.appendChild(placeholder);

    files.forEach((file) => {
        const option = document.createElement("option");
        option.value = String(file.id);
        option.textContent = file.name;
        select.appendChild(option);
    });
}

function inferNumericColumns(rows, columns) {
    const numeric = [];
    columns.forEach((col) => {
        let numericCount = 0;
        let total = 0;
        rows.forEach((row) => {
            const value = row[col];
            if (value === null || value === undefined || value === "") {
                return;
            }
            total += 1;
            if (!Number.isNaN(Number(value))) {
                numericCount += 1;
            }
        });
        if (total > 0 && numericCount / total >= 0.8) {
            numeric.push(col);
        }
    });
    return numeric;
}

function populateSelect(select, options, allowEmpty) {
    const previous = select.value;
    select.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = allowEmpty ? "无" : "请选择字段";
    placeholder.disabled = !allowEmpty;
    placeholder.selected = true;
    select.appendChild(placeholder);

    options.forEach((optionValue) => {
        const option = document.createElement("option");
        option.value = optionValue;
        option.textContent = optionValue;
        select.appendChild(option);
    });

    if (previous && options.includes(previous)) {
        select.value = previous;
    } else if (allowEmpty) {
        select.value = "";
    }
}

function createConfigCard(index) {
    const card = document.createElement("div");
    card.className = "chart-config";
    card.dataset.chartId = `chart-${Date.now()}-${index}`;

    const head = document.createElement("div");
    head.className = "config-head";

    const title = document.createElement("div");
    title.className = "config-title";
    title.textContent = `图表 ${String(index).padStart(2, "0")}`;

    const remove = document.createElement("button");
    remove.className = "config-remove";
    remove.type = "button";
    remove.textContent = "移除";
    remove.addEventListener("click", () => {
        card.remove();
        updateConfigTitles();
    });

    head.appendChild(title);
    head.appendChild(remove);

    const typeRow = document.createElement("div");
    typeRow.className = "config-field";

    const typeLabel = document.createElement("label");
    typeLabel.textContent = "图表类型";

    const typeSelect = document.createElement("select");
    typeSelect.className = "config-type";
    Object.keys(chartSchemas).forEach((type) => {
        const option = document.createElement("option");
        option.value = type;
        option.textContent = chartSchemas[type].label;
        typeSelect.appendChild(option);
    });

    typeSelect.addEventListener("change", () => {
        renderConfigFields(card);
    });

    typeRow.appendChild(typeLabel);
    typeRow.appendChild(typeSelect);

    const fields = document.createElement("div");
    fields.className = "config-fields";

    card.appendChild(head);
    card.appendChild(typeRow);
    card.appendChild(fields);

    renderConfigFields(card);
    return card;
}

function renderConfigFields(card) {
    const typeSelect = card.querySelector(".config-type");
    const type = typeSelect ? typeSelect.value : "line";
    const fieldsContainer = card.querySelector(".config-fields");
    if (!fieldsContainer) {
        return;
    }

    fieldsContainer.innerHTML = "";
    const schema = chartSchemas[type];
    schema.fields.forEach((field) => {
        const wrapper = document.createElement("div");
        wrapper.className = "config-field";

        const label = document.createElement("label");
        label.textContent = field.label;

        const select = document.createElement("select");
        select.dataset.field = field.key;
        const options = field.type === "numeric" && numericColumns.length ? numericColumns : columnList;
        populateSelect(select, options, !field.required);

        wrapper.appendChild(label);
        wrapper.appendChild(select);
        fieldsContainer.appendChild(wrapper);
    });
}

function updateConfigTitles() {
    const cards = Array.from(document.querySelectorAll(".chart-config"));
    cards.forEach((card, index) => {
        const title = card.querySelector(".config-title");
        if (title) {
            title.textContent = `图表 ${String(index + 1).padStart(2, "0")}`;
        }
    });
}

function collectConfigs() {
    const cards = Array.from(document.querySelectorAll(".chart-config"));
    return cards.map((card) => {
        const type = card.querySelector(".config-type")?.value || "line";
        const fields = {};
        card.querySelectorAll("select[data-field]").forEach((select) => {
            fields[select.dataset.field] = select.value;
        });
        return { type, fields, card };
    });
}

function validateConfigs(configs) {
    let valid = true;
    configs.forEach((config) => {
        const schema = chartSchemas[config.type];
        schema.fields.forEach((field) => {
            const value = config.fields[field.key];
            const select = config.card.querySelector(`select[data-field="${field.key}"]`);
            if (field.required && !value) {
                valid = false;
                if (select) {
                    select.classList.add("is-invalid");
                }
            } else if (select) {
                select.classList.remove("is-invalid");
            }
        });
    });
    return valid;
}

function toNumber(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }
    const num = Number(value);
    return Number.isNaN(num) ? null : num;
}

function safeLabel(value, fallback = "未知") {
    if (value === null || value === undefined || value === "") {
        return fallback;
    }
    return String(value);
}

function sampleArray(items, limit) {
    if (items.length <= limit) {
        return items;
    }
    const step = items.length / limit;
    const sampled = [];
    for (let i = 0; i < limit; i += 1) {
        sampled.push(items[Math.floor(i * step)]);
    }
    return sampled;
}

function buildLineData(rows, xCol, yCol, filled) {
    const points = rows
        .map((row, index) => ({
            x: row[xCol] !== undefined ? row[xCol] : index + 1,
            y: toNumber(row[yCol])
        }))
        .filter((point) => point.y !== null);

    const sample = sampleArray(points, 80);
    const labels = sample.map((point) => safeLabel(point.x, ""));
    const data = sample.map((point) => point.y);

    return {
        type: "line",
        data: {
            labels,
            datasets: [
                {
                    label: `${yCol} by ${xCol}`,
                    data,
                    fill: filled,
                    borderColor: chartPalette[0],
                    backgroundColor: filled ? "rgba(79, 209, 255, 0.25)" : "rgba(79, 209, 255, 0.12)",
                    tension: 0.35
                }
            ]
        }
    };
}

function buildBarData(rows, xCol, yCol) {
    const bucket = new Map();
    rows.forEach((row) => {
        const key = safeLabel(row[xCol]);
        const value = yCol ? toNumber(row[yCol]) : 1;
        if (value === null) {
            return;
        }
        bucket.set(key, (bucket.get(key) || 0) + value);
    });

    const sorted = Array.from(bucket.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12);

    return {
        type: "bar",
        data: {
            labels: sorted.map(([label]) => label),
            datasets: [
                {
                    label: yCol ? `${yCol}（按${xCol}）` : `${xCol} 计数`,
                    data: sorted.map(([, value]) => value),
                    backgroundColor: chartPalette.slice(0, sorted.length)
                }
            ]
        }
    };
}

function buildPieData(rows, labelCol, valueCol) {
    const bucket = new Map();
    rows.forEach((row) => {
        const key = safeLabel(row[labelCol]);
        const value = valueCol ? toNumber(row[valueCol]) : 1;
        if (value === null) {
            return;
        }
        bucket.set(key, (bucket.get(key) || 0) + value);
    });

    const sorted = Array.from(bucket.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

    return {
        type: "pie",
        data: {
            labels: sorted.map(([label]) => label),
            datasets: [
                {
                    label: valueCol ? `${valueCol}（按${labelCol}）` : `${labelCol} 占比`,
                    data: sorted.map(([, value]) => value),
                    backgroundColor: chartPalette.slice(0, sorted.length)
                }
            ]
        }
    };
}

function buildScatterData(rows, xCol, yCol) {
    const points = rows
        .map((row) => ({
            x: toNumber(row[xCol]),
            y: toNumber(row[yCol])
        }))
        .filter((point) => point.x !== null && point.y !== null);

    const sample = sampleArray(points, 120);

    return {
        type: "scatter",
        data: {
            datasets: [
                {
                    label: `${xCol} 与 ${yCol}`,
                    data: sample,
                    backgroundColor: "rgba(45, 226, 166, 0.7)",
                    borderColor: "rgba(45, 226, 166, 0.9)"
                }
            ]
        }
    };
}

function buildRadarData(rows, labelCol, valueCol) {
    const bucket = new Map();
    const counts = new Map();
    rows.forEach((row) => {
        const key = safeLabel(row[labelCol]);
        const value = toNumber(row[valueCol]);
        if (value === null) {
            return;
        }
        bucket.set(key, (bucket.get(key) || 0) + value);
        counts.set(key, (counts.get(key) || 0) + 1);
    });

    const averaged = Array.from(bucket.entries()).map(([label, total]) => {
        const count = counts.get(label) || 1;
        return [label, total / count];
    });

    const sorted = averaged.sort((a, b) => b[1] - a[1]).slice(0, 6);

    return {
        type: "radar",
        data: {
            labels: sorted.map(([label]) => label),
            datasets: [
                {
                    label: `${valueCol} 均值`,
                    data: sorted.map(([, value]) => value),
                    backgroundColor: "rgba(245, 181, 68, 0.2)",
                    borderColor: "rgba(245, 181, 68, 0.8)",
                    pointBackgroundColor: "rgba(245, 181, 68, 0.9)"
                }
            ]
        }
    };
}

function buildChartConfig(config) {
    switch (config.type) {
        case "line":
            return buildLineData(previewRows, config.fields.x, config.fields.y, false);
        case "area":
            return buildLineData(previewRows, config.fields.x, config.fields.y, true);
        case "bar":
            return buildBarData(previewRows, config.fields.x, config.fields.y || null);
        case "pie":
            return buildPieData(previewRows, config.fields.label, config.fields.value || null);
        case "scatter":
            return buildScatterData(previewRows, config.fields.x, config.fields.y);
        case "radar":
            return buildRadarData(previewRows, config.fields.label, config.fields.value);
        default:
            return null;
    }
}

function clearCharts() {
    chartInstances.forEach((chart) => chart.destroy());
    chartInstances = [];
    const grid = $("analysis-chart-grid");
    if (grid) {
        grid.innerHTML = "";
    }
}

function renderCharts(configs) {
    const grid = $("analysis-chart-grid");
    if (!grid) {
        return;
    }

    if (!window.Chart) {
        showToast("图表库未加载", "error");
        return;
    }

    clearCharts();

    configs.forEach((config, index) => {
        const chartConfig = buildChartConfig(config);
        if (!chartConfig || !chartConfig.data || !chartConfig.data.labels && chartConfig.type !== "scatter") {
            return;
        }

        const card = document.createElement("div");
        card.className = "chart-card";

        const title = document.createElement("h4");
        title.textContent = `${String(index + 1).padStart(2, "0")} - ${chartSchemas[config.type].label}`;

        const canvas = document.createElement("canvas");
        canvas.className = "chart-canvas";

        card.appendChild(title);
        card.appendChild(canvas);
        grid.appendChild(card);

        const options = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: "#cbd5e1" }
                }
            }
        };

        if (chartConfig.type === "radar") {
            options.scales = {
                r: {
                    grid: { color: "rgba(255,255,255,0.08)" },
                    angleLines: { color: "rgba(255,255,255,0.12)" },
                    pointLabels: { color: "#cbd5e1" },
                    ticks: { color: "#94a3b8" }
                }
            };
        } else if (chartConfig.type !== "pie") {
            options.scales = {
                x: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(255,255,255,0.05)" } },
                y: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(255,255,255,0.05)" } }
            };
        }

        const chart = new Chart(canvas, {
            type: chartConfig.type,
            data: chartConfig.data,
            options
        });
        chartInstances.push(chart);
    });
}

function handleGenerate() {
    const fileId = $("analysis-file").value;
    if (!fileId) {
        showToast("请先选择文件", "error");
        return;
    }

    if (!previewRows.length) {
        showToast("预览数据为空", "error");
        return;
    }

    const configs = collectConfigs();
    if (!configs.length) {
        showToast("请至少添加一个图表", "error");
        return;
    }

    const isValid = validateConfigs(configs);
    if (!isValid) {
        showToast("请补全必选字段", "error");
        return;
    }

    setResultVisible(true);
    setStatus("load");

    setTimeout(() => setStatus("clean"), 200);
    setTimeout(() => setStatus("model"), 400);
    setTimeout(() => {
        setStatus("render");
        renderCharts(configs);
    }, 600);

    const chartNames = configs.map((config) => chartSchemas[config.type].label).join("、");
    updateReport([
        `图表：${chartNames}。`,
        `已载入行数：${previewRows.length}。`,
        `可用字段：${columnList.length}。`
    ]);

    showToast("图表已生成", "success");
}

async function loadFileHistory() {
    try {
        const response = await fetch("/api/files/history");
        if (!response.ok) {
            throw new Error("文件列表加载失败");
        }
        const data = await response.json();
        analysisFiles = Array.isArray(data.data) ? data.data : [];
        setFileOptions(analysisFiles);
    } catch (error) {
        showToast(error.message, "error");
    }
}

async function loadPreview(fileId) {
    if (!fileId) {
        previewRows = [];
        columnList = [];
        numericColumns = [];
        return;
    }
    try {
        const response = await fetch(`/api/files/history/${fileId}/preview?rowCount=200`);
        if (!response.ok) {
            throw new Error("预览加载失败");
        }
        const data = await response.json();
        previewRows = Array.isArray(data.data) ? data.data : [];
        columnList = Array.isArray(data.columns) ? data.columns : [];
        numericColumns = inferNumericColumns(previewRows, columnList);

        const cards = Array.from(document.querySelectorAll(".chart-config"));
        cards.forEach((card) => renderConfigFields(card));
    } catch (error) {
        showToast(error.message, "error");
    }
}

function bindEvents() {
    const fileSelect = $("analysis-file");
    const refreshBtn = $("analysis-refresh");
    const generateBtn = $("analysis-generate");
    const addBtn = $("chart-add");

    if (fileSelect) {
        fileSelect.addEventListener("change", async () => {
            const selected = analysisFiles.find((file) => String(file.id) === String(fileSelect.value));
            updateFileSummary(selected);
            updatePreviewLink(selected);
            clearCharts();
            setResultVisible(false);
            await loadPreview(selected?.id);
        });
    }

    if (refreshBtn) {
        refreshBtn.addEventListener("click", loadFileHistory);
    }

    if (generateBtn) {
        generateBtn.addEventListener("click", handleGenerate);
    }

    if (addBtn) {
        addBtn.addEventListener("click", () => {
            const list = $("chart-config-list");
            if (!list) {
                return;
            }
            const card = createConfigCard(list.children.length + 1);
            list.appendChild(card);
        });
    }
}

document.addEventListener("DOMContentLoaded", () => {
    resetStatus();
    setResultVisible(false);
    updateReport([
        "请选择文件开始。",
        "至少添加一个图表配置。",
        "点击“生成可视化”开始渲染。"
    ]);

    const list = $("chart-config-list");
    if (list) {
        list.appendChild(createConfigCard(1));
    }

    bindEvents();
    loadFileHistory();
});
