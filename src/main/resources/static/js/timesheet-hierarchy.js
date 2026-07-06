'use strict';
// timesheets-hierarchy: loadHierarchy, renderHierarchy, modal

const API_BASE = '/timesheets-hierarchy';
const TIMESHEETS_API = '/timesheets/api';

let hierarchyData = null;
let expandedNodes = new Set();
let isRestoringFilters = true;
let filterTimeout = null;

let modalDetailsData = [];
let modalPage = 1;
let modalPerPage = 10;
let currentModalAdLogin = null;
let currentModalEmployee = null;

document.addEventListener('DOMContentLoaded', function () {
    initFilters();
    initEventListeners();
    initTableHeader();
    loadHierarchy();
});

// --- Инициализация ---

function initFilters() {
    if (typeof $ === 'undefined') {
        console.warn('jQuery или Select2 не загружены.');
        return;
    }

    $('.select2-init').select2({
        language: 'ru',
        allowClear: true,
        width: 'resolve',
        minimumResultsForSearch: 10
    });

    $('.select2-simple').select2({
        minimumResultsForSearch: Infinity,
        allowClear: true
    });

    const urlParams = new URLSearchParams(window.location.search);
    loadFiltersData().then(function () {
        restoreFiltersFromURL(urlParams);
    });
}

function initEventListeners() {
    if (typeof flatpickr !== 'undefined') {
        flatpickr('#dateFrom', { locale: 'ru', dateFormat: 'Y-m-d' });
        flatpickr('#dateTo', { locale: 'ru', dateFormat: 'Y-m-d' });
    }

    if (typeof $ !== 'undefined') {
        $('.select2-init, .select2-simple').on('select2:select select2:clear', function () {
            isRestoringFilters = false;
            applyFilters();
        });

        $('#filterHoursFrom, #filterHoursTo').on('input', function () {
            isRestoringFilters = false;
            clearTimeout(filterTimeout);
            filterTimeout = setTimeout(applyFilters, 1200);
        });

        $('#clearFilters').on('click', function (e) {
            e.preventDefault();
            isRestoringFilters = true;
            $('.select2-init, .select2-simple').val(null).trigger('change.select2');
            $('#filterHoursFrom, #filterHoursTo, #timesheetsSearch').val('');

            const params = new URLSearchParams(window.location.search);
            const newParams = new URLSearchParams();
            if (params.get('dateFrom')) newParams.set('dateFrom', params.get('dateFrom'));
            if (params.get('dateTo')) newParams.set('dateTo', params.get('dateTo'));
            if (params.get('managerMode')) newParams.set('managerMode', params.get('managerMode'));
            window.location.href = window.location.pathname + '?' + newParams.toString();
        });
    }

    const modal = document.getElementById('detailsModal');
    if (modal) {
        window.addEventListener('click', function (e) {
            if (e.target === modal) closeModal();
        });
    }

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeModal();

        const openModal = document.getElementById('detailsModal');
        if (!openModal || !openModal.classList.contains('show')) return;
        if (e.key === 'ArrowLeft') changeModalPage(-1);
        if (e.key === 'ArrowRight') changeModalPage(1);
    });

    const btnPrev = document.getElementById('modalPrev');
    const btnNext = document.getElementById('modalNext');
    if (btnPrev) btnPrev.addEventListener('click', function () { changeModalPage(-1); });
    if (btnNext) btnNext.addEventListener('click', function () { changeModalPage(1); });

    const dateFilterForm = document.getElementById('dateFilterForm');
    if (dateFilterForm) {
        dateFilterForm.addEventListener('submit', function () {
            const dateFrom = document.getElementById('dateFrom')?.value;
            const dateTo = document.getElementById('dateTo')?.value;
            const currentDateFrom = document.getElementById('currentDateFrom');
            const currentDateTo = document.getElementById('currentDateTo');
            if (currentDateFrom && dateFrom) currentDateFrom.value = dateFrom;
            if (currentDateTo && dateTo) currentDateTo.value = dateTo;
        });
    }
}

function initTableHeader() {
    const thead = document.querySelector('#hierarchyTable thead');
    if (!thead || thead.querySelector('tr')) return;

    thead.innerHTML =
        '<tr>' +
        '<th class="name-column">Наименование</th>' +
        '<th class="total-column">Всего (часы)</th>' +
        '</tr>';
}

// --- Фильтры ---

function buildFilterParams() {
    const params = new URLSearchParams(window.location.search);

    const dateFrom = document.getElementById('dateFrom')?.value
        || document.getElementById('currentDateFrom')?.value;
    const dateTo = document.getElementById('dateTo')?.value
        || document.getElementById('currentDateTo')?.value;

    const query = new URLSearchParams();
    if (dateFrom) query.set('dateFrom', dateFrom);
    if (dateTo) query.set('dateTo', dateTo);

    const passthrough = [
        'managerLogin', 'sortBy', 'sortDir', 'managerMode', 'searchQuery',
        'filterDivision', 'filterManager', 'filterEmployee',
        'filterColor', 'filterHoursFrom', 'filterHoursTo'
    ];

    passthrough.forEach(function (key) {
        const val = params.get(key);
        if (val) query.set(key, val);
    });

    if (!query.get('sortBy')) query.set('sortBy', 'totalHours');
    if (!query.get('sortDir')) query.set('sortDir', 'desc');

    return query;
}

function applyFilters() {
    if (isRestoringFilters) return;

    clearTimeout(filterTimeout);
    filterTimeout = setTimeout(function () {
        const params = new URLSearchParams(window.location.search);

        const fDiv = $('#filterDivision').val();
        const fMgr = $('#filterManager').val();
        const fEmp = $('#filterEmployee').val();
        const fColor = $('#filterColor').val();
        const fFrom = $('#filterHoursFrom').val();
        const fTo = $('#filterHoursTo').val();
        const q = $('#timesheetsSearch').val();

        if (fDiv) params.set('filterDivision', fDiv); else params.delete('filterDivision');
        if (fMgr) params.set('filterManager', fMgr); else params.delete('filterManager');
        if (fEmp) params.set('filterEmployee', fEmp); else params.delete('filterEmployee');
        if (fColor) params.set('filterColor', fColor); else params.delete('filterColor');
        if (fFrom) params.set('filterHoursFrom', fFrom); else params.delete('filterHoursFrom');
        if (fTo) params.set('filterHoursTo', fTo); else params.delete('filterHoursTo');
        if (q) params.set('searchQuery', q); else params.delete('searchQuery');

        updateHiddenFilters();
        window.location.href = window.location.pathname + '?' + params.toString();
    }, 300);
}

async function loadFiltersData() {
    const dateFrom = document.getElementById('currentDateFrom')?.value;
    const dateTo = document.getElementById('currentDateTo')?.value;
    if (!dateFrom || !dateTo) return;

    try {
        const response = await fetch(
            TIMESHEETS_API + '/filters?dateFrom=' + encodeURIComponent(dateFrom) +
            '&dateTo=' + encodeURIComponent(dateTo)
        );
        if (!response.ok) return;
        const data = await response.json();
        populateSelect('#filterDivision', data.divisions || []);
        populateSelect('#filterManager', data.managers || []);
        populateSelect('#filterEmployee', data.employees || []);
    } catch (error) {
        console.error('Ошибка загрузки фильтров:', error);
    }
}

function populateSelect(selector, values) {
    const $sel = $(selector);
    $sel.find('option:not([value=""])').remove();
    values.forEach(function (val) {
        $sel.append(new Option(val, val, false, false));
    });
}

function restoreFiltersFromURL(urlParams) {
    if (urlParams.has('filterDivision')) {
        $('#filterDivision').val(urlParams.get('filterDivision')).trigger('change.select2');
    }
    if (urlParams.has('filterManager')) {
        $('#filterManager').val(urlParams.get('filterManager')).trigger('change.select2');
    }
    if (urlParams.has('filterEmployee')) {
        $('#filterEmployee').val(urlParams.get('filterEmployee')).trigger('change.select2');
    }
    if (urlParams.has('filterColor')) {
        $('#filterColor').val(urlParams.get('filterColor')).trigger('change.select2');
    }
    if (urlParams.has('filterHoursFrom')) {
        $('#filterHoursFrom').val(urlParams.get('filterHoursFrom'));
    }
    if (urlParams.has('filterHoursTo')) {
        $('#filterHoursTo').val(urlParams.get('filterHoursTo'));
    }
    if (urlParams.has('searchQuery')) {
        $('#timesheetsSearch').val(urlParams.get('searchQuery'));
    }

    setTimeout(function () {
        isRestoringFilters = false;
    }, 300);
}

// --- Иерархия ---

async function loadHierarchy() {
    const dateFrom = document.getElementById('dateFrom')?.value
        || document.getElementById('currentDateFrom')?.value;
    const dateTo = document.getElementById('dateTo')?.value
        || document.getElementById('currentDateTo')?.value;

    if (!dateFrom || !dateTo) {
        showEmptyState(true);
        return;
    }

    if (new Date(dateFrom) > new Date(dateTo)) {
        console.error('Дата начала должна быть раньше даты окончания');
        showEmptyState(true);
        return;
    }

    showLoading(true);
    showEmptyState(false);

    try {
        const params = buildFilterParams();
        const url = API_BASE + '/api/timesheet-hierarchy?' + params.toString();
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error('HTTP ' + response.status + ': ' + response.statusText);
        }

        hierarchyData = await response.json();
        expandedNodes.clear();

        if (!hierarchyData || isHierarchyEmpty(hierarchyData)) {
            showEmptyState(true);
            renderHierarchy();
        } else {
            showEmptyState(false);
            autoExpandRoot(hierarchyData);
            renderHierarchy();
        }
    } catch (err) {
        console.error('Ошибка загрузки иерархии:', err);
        hierarchyData = null;
        showEmptyState(true);
        renderHierarchy();
    } finally {
        showLoading(false);
    }
}

function isHierarchyEmpty(node) {
    if (!node) return true;
    if (node.adLogin || node.employeeName) return false;
    if (!node.children || node.children.length === 0) return true;
    return node.children.every(isHierarchyEmpty);
}

function autoExpandRoot(node) {
    if (!node) return;
    const nodeId = node.adLogin || 'root';
    if (node.children && node.children.length > 0) {
        expandedNodes.add(nodeId);
    }
}

function renderHierarchy() {
    const tbody = document.getElementById('hierarchyBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    let rowCount = 0;

    if (!hierarchyData || isHierarchyEmpty(hierarchyData)) {
        document.getElementById('rowCount').textContent = '0';
        return;
    }

    if (hierarchyData.adLogin || hierarchyData.employeeName) {
        rowCount += renderNode(hierarchyData, hierarchyData.level || 0, tbody, hierarchyData.adLogin || 'root');
    } else if (hierarchyData.children && hierarchyData.children.length) {
        hierarchyData.children.forEach(function (node, index) {
            rowCount += renderNode(node, node.level || 0, tbody, node.adLogin || 'root-' + index);
        });
    }

    document.getElementById('rowCount').textContent = String(rowCount);
}

function renderNode(node, level, container, nodeId) {
    let count = 0;
    const row = createHierarchyRow(node, level, nodeId);
    container.appendChild(row);
    count++;

    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(nodeId);

    if (hasChildren && isExpanded) {
        node.children.forEach(function (child, index) {
            const childId = child.adLogin || nodeId + '-' + index;
            count += renderNode(child, (child.level != null ? child.level : level + 1), container, childId);
        });
    }

    return count;
}

function createHierarchyRow(node, level, nodeId) {
    const tr = document.createElement('tr');
    tr.className = 'employee-row level-' + (node.level != null ? node.level : level);
    if (node.colorClass) tr.classList.add(node.colorClass);
    tr.dataset.adLogin = node.adLogin || '';
    tr.dataset.nodeId = nodeId;
    tr.dataset.level = String(level);

    const nameCell = document.createElement('td');
    nameCell.className = 'name-cell';

    const nameDiv = document.createElement('div');
    nameDiv.className = 'name-content';

    if (level > 0) {
        const indent = document.createElement('span');
        indent.className = 'indent';
        indent.style.width = (level * 24) + 'px';
        nameDiv.appendChild(indent);
    }

    const hasChildren = node.children && node.children.length > 0;
    if (hasChildren) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'expand-toggle ' + (expandedNodes.has(nodeId) ? 'expanded' : 'collapsed');
        btn.title = 'Развернуть / свернуть';
        btn.textContent = expandedNodes.has(nodeId) ? '▼' : '▶';
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            toggleChildren(nodeId);
        });
        nameDiv.appendChild(btn);
    } else {
        const placeholder = document.createElement('span');
        placeholder.className = 'expand-toggle placeholder';
        nameDiv.appendChild(placeholder);
    }

    const nameSpan = document.createElement('span');
    nameSpan.className = 'node-name';
    nameSpan.textContent = getNodeDisplayName(node);
    nameDiv.appendChild(nameSpan);

    if (node.divisionName) {
        const divisionSpan = document.createElement('span');
        divisionSpan.className = 'node-division';
        divisionSpan.textContent = ' (' + node.divisionName + ')';
        nameDiv.appendChild(divisionSpan);
    }

    nameCell.appendChild(nameDiv);
    tr.appendChild(nameCell);

    const totalCell = document.createElement('td');
    totalCell.className = 'total-cell time-spent';
    totalCell.dataset.totalHours = String(node.totalHours != null ? node.totalHours : 0);
    totalCell.textContent = formatHoursReadable(node.totalHours);
    tr.appendChild(totalCell);

    tr.addEventListener('dblclick', function (e) {
        if (e.target.closest('button, input, select')) return;
        if (!node.adLogin) return;
        openDetailsModal(node.adLogin, node.employeeName || node.adLogin);
    });

    return tr;
}

function getNodeDisplayName(node) {
    if (node.employeeName) return node.employeeName;
    if (node.adLogin) return node.adLogin;
    return '—';
}

function toggleChildren(nodeId) {
    if (expandedNodes.has(nodeId)) {
        expandedNodes.delete(nodeId);
    } else {
        expandedNodes.add(nodeId);
    }
    renderHierarchy();
}

function showLoading(show) {
    const el = document.getElementById('loading');
    if (el) el.style.display = show ? 'block' : 'none';
}

function showEmptyState(show) {
    const el = document.getElementById('emptyState');
    const table = document.getElementById('hierarchyTable');
    if (el) el.style.display = show ? 'block' : 'none';
    if (table) table.style.display = show ? 'none' : 'table';
}

// --- Модальное окно ---

function openDetailsModal(adLogin, employeeName) {
    currentModalAdLogin = adLogin;
    currentModalEmployee = employeeName;

    const modal = document.getElementById('detailsModal');
    if (!modal) return;

    document.getElementById('modalEmployeeName').textContent = 'Детали списаний: ' + employeeName;
    modal.classList.add('show');
    document.getElementById('modalLoading').style.display = 'block';
    document.getElementById('modalError').style.display = 'none';
    document.getElementById('modalDetails').style.display = 'none';
    document.getElementById('modalPagination').style.display = 'none';
    document.getElementById('syncStatus').textContent = '';
    document.getElementById('syncStatus').className = 'modal-sync_status';

    const dateFrom = document.getElementById('currentDateFrom')?.value;
    const dateTo = document.getElementById('currentDateTo')?.value;

    fetch(
        TIMESHEETS_API + '/details?adLogin=' + encodeURIComponent(adLogin) +
        '&dateFrom=' + encodeURIComponent(dateFrom) +
        '&dateTo=' + encodeURIComponent(dateTo)
    )
        .then(function (r) {
            if (!r.ok) throw new Error('Ошибка загрузки');
            return r.json();
        })
        .then(function (data) {
            modalDetailsData = (data || []).map(function (item) {
                return {
                    taskCode: item.code || item.taskCode || 'Нет данных',
                    taskName: item.taskName || item.name || 'Нет данных по имени',
                    taskCreationDate: item.taskCreated || item.creationDate || null,
                    timesheetDate: item.timesheetDate || item.tsCreationDate || null,
                    hours: parseFloat(item.hours ?? item.timespent ?? item.timeSpent ?? 0)
                };
            });
            modalPage = 1;
            displayModalPage();
        })
        .catch(function (err) {
            console.error(err);
            document.getElementById('modalLoading').style.display = 'none';
            document.getElementById('modalError').style.display = 'block';
        });
}

function closeModal() {
    const modal = document.getElementById('detailsModal');
    if (!modal) return;

    modal.classList.remove('show');
    modalDetailsData = [];
    currentModalAdLogin = null;
    currentModalEmployee = null;

    document.getElementById('detailsTableBody').innerHTML = '';
    document.getElementById('modalLoading').style.display = 'block';
    document.getElementById('modalDetails').style.display = 'none';
    document.getElementById('modalError').style.display = 'none';
    document.getElementById('modalPagination').style.display = 'none';
}

function changeModalPage(delta) {
    const totalPages = Math.max(1, Math.ceil(modalDetailsData.length / modalPerPage));
    const newPage = modalPage + delta;
    if (newPage < 1 || newPage > totalPages) return;
    modalPage = newPage;
    displayModalPage();
    document.querySelector('#detailsModal .modal-body')?.scrollTo(0, 0);
}

function displayModalPage() {
    const start = (modalPage - 1) * modalPerPage;
    const end = start + modalPerPage;
    const pageItems = modalDetailsData.slice(start, end);
    renderDetailsRows(pageItems);

    const totalPages = Math.max(1, Math.ceil(modalDetailsData.length / modalPerPage));
    document.getElementById('modalPageInfo').textContent =
        'Страница ' + modalPage + ' из ' + totalPages + ' — ' + modalDetailsData.length + ' записей';

    const prev = document.getElementById('modalPrev');
    const next = document.getElementById('modalNext');
    if (prev) prev.disabled = modalPage <= 1;
    if (next) next.disabled = modalPage >= totalPages;

    document.getElementById('modalPagination').style.display =
        modalDetailsData.length > modalPerPage ? 'flex' : 'none';
    document.getElementById('modalLoading').style.display = 'none';
    document.getElementById('modalDetails').style.display = 'block';
}

function renderDetailsRows(items) {
    const tbody = document.getElementById('detailsTableBody');
    tbody.innerHTML = '';

    if (!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#888;">Нет данных</td></tr>';
        return;
    }

    items.forEach(function (d) {
        const tr = document.createElement('tr');
        const jiraLink = d.taskCode && d.taskCode !== 'Нет данных'
            ? '<a href="https://jira/browse/' + escapeHtml(d.taskCode) + '" target="_blank" rel="noopener">' +
              escapeHtml(d.taskCode) + '</a>'
            : escapeHtml(d.taskCode || 'нет данных');

        tr.innerHTML =
            '<td>' + jiraLink + '</td>' +
            '<td>' + escapeHtml(d.taskName) + '</td>' +
            '<td>' + (d.taskCreationDate ? formatDate(d.taskCreationDate) : 'нет данных') + '</td>' +
            '<td>' + (d.timesheetDate ? formatDate(d.timesheetDate) : 'нет данных') + '</td>' +
            '<td style="text-align:right;font-weight:600;">' + formatHoursReadable(d.hours) + '</td>';

        tbody.appendChild(tr);
    });
}

async function syncEmployeeTimesheets() {
    if (!currentModalAdLogin) return;

    const days = parseInt(document.getElementById('syncDaysInput')?.value, 10) || 1;
    const status = document.getElementById('syncStatus');
    const btn = document.querySelector('.modal-sync .btn');

    const csrfToken = document.querySelector('meta[name="_csrf"]')?.content;
    const csrfHeader = document.querySelector('meta[name="_csrf_header"]')?.content;

    status.textContent = '⏳ Синхронизация...';
    status.className = 'modal-sync_status loading';
    if (btn) btn.disabled = true;

    try {
        const response = await fetch(TIMESHEETS_API + '/sync-employee-timesheets', {
            method: 'POST',
            headers: Object.assign(
                { 'Content-Type': 'application/json' },
                csrfHeader && csrfToken ? { [csrfHeader]: csrfToken } : {}
            ),
            body: JSON.stringify({
                adLogin: currentModalAdLogin,
                days: String(days)
            })
        });

        if (!response.ok) throw new Error('Ошибка ' + response.status);
        const data = await response.json();

        status.textContent = 'Готово (' + data.startDate + ' — ' + data.endDate + ')';
        status.className = 'modal-sync_status success';
        openDetailsModal(currentModalAdLogin, currentModalEmployee);
    } catch (err) {
        status.textContent = '✗ ' + err.message;
        status.className = 'modal-sync_status error';
    } finally {
        if (btn) btn.disabled = false;
    }
}

// --- Экспорт ---

async function exportSummaryToExcel() {
    const params = new URLSearchParams(window.location.search);
    const dateFrom = params.get('dateFrom') || document.getElementById('dateFrom')?.value;
    const dateTo = params.get('dateTo') || document.getElementById('dateTo')?.value;

    const filterParams = new URLSearchParams();
    filterParams.set('dateFrom', dateFrom);
    filterParams.set('dateTo', dateTo);

    ['filterDivision', 'filterManager', 'filterEmployee', 'filterColor', 'filterHoursFrom', 'filterHoursTo']
        .forEach(function (key) {
            const val = params.get(key);
            if (val) filterParams.set(key, val);
        });

    try {
        const response = await fetch(TIMESHEETS_API + '/export?' + filterParams.toString());
        if (!response.ok) throw new Error('Ошибка загрузки данных');

        const data = await response.json();
        if (!data.length) {
            alert('Нет данных для экспорта');
            return;
        }

        const rows = data.map(function (item) {
            return {
                'AD Login': item.adLogin || '',
                'Сотрудник': item.employeeName || '',
                'Руководитель': item.managerName || '',
                'Отдел': item.divisionName || '',
                'Всего часов': item.totalHours || 0,
                'Записей': item.entriesCount || 0
            };
        });

        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Сводка');
        const headerKeys = Object.keys(rows[0]);
        const headerRow = ws.addRow(headerKeys);
        headerRow.font = { bold: true };

        rows.forEach(function (row) {
            ws.addRow(headerKeys.map(function (k) { return row[k]; }));
        });

        ws.columns.forEach(function (col) {
            let maxLength = 10;
            col.eachCell({ includeEmpty: true }, function (cell) {
                const val = cell.value ? cell.value.toString() : '';
                if (val.length > maxLength) maxLength = val.length;
            });
            col.width = maxLength + 2;
        });

        const buf = await wb.xlsx.writeBuffer();
        saveAs(new Blob([buf]), 'timesheets_summary_' + formatDateForFile(new Date()) + '.xlsx');
    } catch (error) {
        console.error('Ошибка экспорта:', error);
        alert('Ошибка при экспорте данных');
    }
}

async function exportDetailsToExcel() {
    if (!modalDetailsData.length) {
        alert('Нет данных для экспорта');
        return;
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Детали');
    const headerRow = ws.addRow(['Номер задачи', 'Задача', 'Создана', 'Дата списания', 'Часы']);
    headerRow.font = { bold: true };

    modalDetailsData.forEach(function (d) {
        ws.addRow([
            d.taskCode || 'нет данных',
            d.taskName,
            d.taskCreationDate ? formatDate(d.taskCreationDate) : 'нет данных',
            d.timesheetDate ? formatDate(d.timesheetDate) : 'нет данных',
            d.hours
        ]);
    });

    ws.columns.forEach(function (col) {
        let maxLength = 10;
        col.eachCell({ includeEmpty: true }, function (cell) {
            const val = cell.value ? cell.value.toString() : '';
            if (val.length > maxLength) maxLength = val.length;
        });
        col.width = maxLength + 2;
    });

    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), 'timesheet_details_' + formatDateForFile(new Date()) + '.xlsx');
}

// --- Утилиты ---

function setCurrentWeek() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    document.getElementById('dateFrom').value = formatDateForInput(monday);
    document.getElementById('dateTo').value = formatDateForInput(sunday);
    document.getElementById('currentDateFrom').value = formatDateForInput(monday);
    document.getElementById('currentDateTo').value = formatDateForInput(sunday);
}

function updateHiddenFilters() {
    document.getElementById('hiddenFilterDivision').value = $('#filterDivision').val() || '';
    document.getElementById('hiddenFilterManager').value = $('#filterManager').val() || '';
    document.getElementById('hiddenFilterEmployee').value = $('#filterEmployee').val() || '';
    document.getElementById('hiddenFilterColor').value = $('#filterColor').val() || '';
    document.getElementById('hiddenFilterHoursFrom').value = $('#filterHoursFrom').val() || '';
    document.getElementById('hiddenFilterHoursTo').value = $('#filterHoursTo').val() || '';
}

function toggleManagerMode(cb) {
    const url = new URL(window.location.href);
    if (cb.checked) {
        url.searchParams.set('managerMode', 'true');
        if (!url.searchParams.get('dateFrom')) {
            url.searchParams.set('dateFrom', getMondayISO(new Date()));
        }
    } else {
        url.searchParams.delete('managerMode');
    }
    window.location.href = url.toString();
}

function getMondayISO(date) {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    return d.toISOString().split('T')[0];
}

function formatDateForInput(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
}

function formatDateForFile(date) {
    return formatDateForInput(date).replace(/-/g, '');
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return String(d.getDate()).padStart(2, '0') + '.' +
        String(d.getMonth() + 1).padStart(2, '0') + '.' +
        d.getFullYear();
}

function formatHoursReadable(hours) {
    if (hours == null || isNaN(hours)) return '0 ч';
    const totalMinutes = Math.round(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h && m) return h + ' ч ' + m + ' мин';
    if (h) return h + ' ч';
    if (m) return m + ' мин';
    return '0 мин';
}

function escapeHtml(s) {
    if (!s) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Глобальные функции для onclick в HTML
window.loadHierarchy = loadHierarchy;
window.renderHierarchy = renderHierarchy;
window.openDetailsModal = openDetailsModal;
window.closeModal = closeModal;
window.syncEmployeeTimesheets = syncEmployeeTimesheets;
window.exportSummaryToExcel = exportSummaryToExcel;
window.exportDetailsToExcel = exportDetailsToExcel;
window.setCurrentWeek = setCurrentWeek;
window.toggleManagerMode = toggleManagerMode;
window.updateHiddenFilters = updateHiddenFilters;
