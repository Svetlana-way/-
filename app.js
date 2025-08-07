const LAST_REPORT_DATE_KEY = 'last_report_date';
const REPORTS_BY_DATE_KEY = 'daily_reports_by_date';

// === КОНСТАНТЫ ЗАНЯТОСТИ МЕСТ ===
const TOTAL_SPACES = 89;
const FIXED_SPACES_TOTAL = 15;
const FLEXIBLE_SPACES_TOTAL = TOTAL_SPACES - FIXED_SPACES_TOTAL; // 74

// Daily Coworking Report Application
// Global variables
let formData = {};
let autosaveTimeout = null;
const AUTOSAVE_DELAY = 2000; // 2 seconds
// Target values from JSON
const TARGET_VALUES = {
    visitors: 50,
    fixed_spaces: 80,
    flexible_spaces: 75,
    meeting_rooms: 60,
    response_time: 15,
    complaints: 3,
    internet_uptime: 99,
    cleanliness: 4.5,
    conversion: 30,
    nps: 30
};

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const todayStr = getTodayString();
    const lastDate = localStorage.getItem(LAST_REPORT_DATE_KEY);

    if (lastDate && lastDate !== todayStr) {
        saveReportAsFinal(lastDate);
        sendReportToMail(lastDate);
        clearForm(true); // очистка без подтверждения
    }

    localStorage.setItem(LAST_REPORT_DATE_KEY, todayStr);

    initializeDate();
    attachEventListeners();
    loadOrResetFormByDate(todayStr);
    updateCalculatedFields();
    showToast('Заполните данные отчета и нажмите "Сформировать отчет"', 'success');
});

// Set default date to today
function initializeDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    document.getElementById('report-date').value = `${year}-${month}-${day}`;
}

// Attach event listeners to form elements
function attachEventListeners() {
    // Metric inputs for status indicators
    // Добавьте в тело attachEventListeners после существующих слушателей:

const fixedOccupiedInput = document.getElementById('fixed-spaces-occupied');
const flexibleOccupiedInput = document.getElementById('flexible-spaces-occupied');

if (fixedOccupiedInput) {
  fixedOccupiedInput.addEventListener('input', updateSpaceOccupancyPercentages);
}
if (flexibleOccupiedInput) {
  flexibleOccupiedInput.addEventListener('input', updateSpaceOccupancyPercentages);
}
    document.querySelectorAll('.metric-input').forEach(input => {
        input.addEventListener('input', function() {
            updateMetricStatus(this);
            triggerAutosave();
        });
    });
    
    // Inputs that trigger calculation updates
    document.getElementById('daily-revenue').addEventListener('input', function() {
        updateCalculatedFields();
        triggerAutosave();
    });
    
    document.getElementById('transactions').addEventListener('input', function() {
        updateCalculatedFields();
        triggerAutosave();
    });
    
    document.getElementById('tours-conducted').addEventListener('input', function() {
        updateConversionRate();
        triggerAutosave();
    });
    
    document.getElementById('new-registrations').addEventListener('input', function() {
        updateConversionRate();
        triggerAutosave();
    });
    
    // All form inputs should trigger autosave
    document.querySelectorAll('input, textarea, select').forEach(element => {
        element.addEventListener('change', triggerAutosave);
        element.addEventListener('input', triggerAutosave);
    });
    
    // Checkboxes
    document.getElementById('no-problems').addEventListener('change', function() {
        if (this.checked) {
            document.getElementById('technical-issues').disabled = true;
            document.getElementById('technical-issues').value = '';
        } else {
            document.getElementById('technical-issues').disabled = false;
        }
        triggerAutosave();
    });
    
    document.getElementById('no-conflicts').addEventListener('change', function() {
        if (this.checked) {
            document.getElementById('incident-description').disabled = true;
            document.getElementById('incident-description').value = '';
            document.getElementById('measures-taken').disabled = true;
            document.getElementById('measures-taken').value = '';
        } else {
            document.getElementById('incident-description').disabled = false;
            document.getElementById('measures-taken').disabled = false;
        }
        triggerAutosave();
    });
    
    // Button actions
    document.getElementById('clear-form').addEventListener('click', clearForm);
    document.getElementById('generate-report').addEventListener('click', generateReport);
    document.getElementById('save-draft').addEventListener('click', saveFormManually);
    document.getElementById('edit-report').addEventListener('click', returnToForm);
    document.getElementById('copy-report').addEventListener('click', copyReportToClipboard);
    document.getElementById('download-report').addEventListener('click', downloadReport);
}

// Update calculated fields
function updateCalculatedFields() {
    updateAverageCheck();
    updateSummary();
    updateOverallRating();
}

// Calculate average check amount
function updateAverageCheck() {
    const revenue = parseFloat(document.getElementById('daily-revenue').value) || 0;
    const transactions = parseInt(document.getElementById('transactions').value) || 0;
    
    const averageCheck = transactions > 0 ? revenue / transactions : 0;
    document.getElementById('average-check').value = averageCheck.toFixed(2);
}

// Calculate conversion rate from tours to registrations
function updateConversionRate() {
    const tours = parseInt(document.getElementById('tours-conducted').value) || 0;
    const registrations = parseInt(document.getElementById('new-registrations').value) || 0;
    
    const conversionRate = tours > 0 ? (registrations / tours) * 100 : 0;
    document.getElementById('conversion-rate').value = conversionRate.toFixed(1);
    
    updateMetricStatus(document.getElementById('conversion-rate'));
}

// Update status indicators for metrics
function updateMetricStatus(input) {
    const value = parseFloat(input.value) || 0;
    const targetValue = parseFloat(input.dataset.target) || 0;
    const statusElement = document.getElementById(`${input.id}-status`);
    
    if (!statusElement) return;

    // Clear previous status
    statusElement.className = 'status-indicator';
    statusElement.textContent = '';
    
    if (input.value === '') {
        statusElement.classList.add('status-empty');
        return;
    }
    
    let status = '';
    let icon = '';
    
    // Different handling for metrics (more is better vs. less is better)
    if (input.id === 'response-time' || input.id === 'complaints') {
        // For these metrics, less is better
        if (value <= targetValue * 0.8) {
            status = 'status-excellent';
            icon = '✅ Отлично';
        } else if (value <= targetValue) {
            status = 'status-good';
            icon = '✓ Хорошо';
        } else if (value <= targetValue * 1.2) {
            status = 'status-warning';
            icon = '⚠️ Внимание';
        } else {
            status = 'status-critical';
            icon = '❗ Критично';
        }
    } else {
        // For other metrics, more is better
        if (value >= targetValue * 1.1) {
            status = 'status-excellent';
            icon = '✅ Отлично';
        } else if (value >= targetValue) {
            status = 'status-good';
            icon = '✓ Хорошо';
        } else if (value >= targetValue * 0.9) {
            status = 'status-warning';
            icon = '⚠️ Внимание';
        } else {
            status = 'status-critical';
            icon = '❗ Критично';
        }
    }
    
    statusElement.classList.add(status);
    statusElement.textContent = icon;
}

// Update summary section with key metrics
function updateSummary() {
    const summaryGrid = document.getElementById('summary-grid');
    summaryGrid.innerHTML = '';
    
    // Collect key metrics
    const metrics = [
        {
            label: 'Посещаемость',
            value: `${document.getElementById('visitors').value || '0'} чел.`,
            target: TARGET_VALUES.visitors,
            actual: parseInt(document.getElementById('visitors').value) || 0,
            id: 'visitors'
        },
        {
            label: 'Загрузка фикс. мест',
            value: `${document.getElementById('fixed-spaces').value || '0'}%`,
            target: TARGET_VALUES.fixed_spaces,
            actual: parseInt(document.getElementById('fixed-spaces').value) || 0,
            id: 'fixed-spaces'
        },
        {
            label: 'Загрузка гибких мест',
            value: `${document.getElementById('flexible-spaces').value || '0'}%`,
            target: TARGET_VALUES.flexible_spaces,
            actual: parseInt(document.getElementById('flexible-spaces').value) || 0,
            id: 'flexible-spaces'
        },
        {
            label: 'Время отклика',
            value: `${document.getElementById('response-time').value || '0'} мин`,
            target: TARGET_VALUES.response_time,
            actual: parseInt(document.getElementById('response-time').value) || 0,
            id: 'response-time',
            inversed: true
        },
        {
            label: 'Жалобы',
            value: document.getElementById('complaints').value || '0',
            target: TARGET_VALUES.complaints,
            actual: parseInt(document.getElementById('complaints').value) || 0,
            id: 'complaints',
            inversed: true
        },
        {
            label: 'Конверсия экскурсий',
            value: `${document.getElementById('conversion-rate').value || '0'}%`,
            target: TARGET_VALUES.conversion,
            actual: parseFloat(document.getElementById('conversion-rate').value) || 0,
            id: 'conversion-rate'
        }
    ];
    
    // Create summary items
    metrics.forEach(metric => {
        const item = document.createElement('div');
        item.className = 'summary-item';
        
        let status = '';
        if (metric.actual) {
            if (metric.inversed) {
                // For inversed metrics (lower is better)
                if (metric.actual <= metric.target * 0.8) status = 'status-excellent';
                else if (metric.actual <= metric.target) status = 'status-good';
                else if (metric.actual <= metric.target * 1.2) status = 'status-warning';
                else status = 'status-critical';
            } else {
                // For normal metrics (higher is better)
                if (metric.actual >= metric.target * 1.1) status = 'status-excellent';
                else if (metric.actual >= metric.target) status = 'status-good';
                else if (metric.actual >= metric.target * 0.9) status = 'status-warning';
                else status = 'status-critical';
            }
            item.classList.add(status);
        }
        
        item.innerHTML = `
            <span class="label">${metric.label}</span>
            <span class="value">${metric.value}</span>
        `;
        
        summaryGrid.appendChild(item);
    });
}

// Update overall day rating based on critical metrics
function updateOverallRating() {
    const dayRating = document.getElementById('day-rating');
    const overallAssessment = document.getElementById('overall-assessment');
    
    // Get status for key metrics
    const criticalMetrics = ['visitors', 'fixed-spaces', 'flexible-spaces', 'response-time', 'complaints', 'conversion-rate'];
    let statuses = criticalMetrics.map(id => {
        const element = document.getElementById(`${id}-status`);
        if (!element) return null;
        
        if (element.classList.contains('status-critical')) return 'critical';
        if (element.classList.contains('status-warning')) return 'warning';
        if (element.classList.contains('status-good')) return 'good';
        if (element.classList.contains('status-excellent')) return 'excellent';
        return null;
    }).filter(status => status !== null);
    
    // Clear previous classes
    overallAssessment.className = 'overall-assessment';
    
    // Determine overall rating
    if (statuses.length === 0) {
        dayRating.textContent = 'Заполните показатели';
        return;
    }
    
    if (statuses.includes('critical')) {
        dayRating.textContent = '🔴 ТРЕБУЮТСЯ УЛУЧШЕНИЯ';
        overallAssessment.classList.add('critical');
    } else if (statuses.includes('warning')) {
        dayRating.textContent = '⚠️ ХОРОШИЙ ДЕНЬ';
        overallAssessment.classList.add('warning');
    } else if (statuses.includes('excellent')) {
        dayRating.textContent = '✅ ОТЛИЧНЫЙ ДЕНЬ';
        overallAssessment.classList.add('excellent');
    } else {
        dayRating.textContent = '✓ НОРМАЛЬНЫЙ ДЕНЬ';
        overallAssessment.classList.add('good');
    }
}

// Generate the formatted report
function generateReport() {
    // Validate required fields
    if (!validateRequiredFields()) {
        showToast('Пожалуйста, заполните обязательные поля', 'error');
        return;
    }
    
    // Collect all form data
    collectFormData();
    
    // Format the report
    const report = formatReport();
    
    // Display the report
    document.getElementById('formatted-report').textContent = report;
    document.getElementById('report-output').classList.remove('hidden');
    document.getElementById('daily-report-form').classList.add('hidden');
    
    // Scroll to top
    window.scrollTo(0, 0);
    
    showToast('Отчет успешно сформирован', 'success');
}

// Validate that required fields are filled
function validateRequiredFields() {
    const required = ['report-date', 'manager-name', 'coworking-name'];
    let valid = true;
    
    required.forEach(id => {
        const element = document.getElementById(id);
        if (!element.value) {
            element.classList.add('invalid');
            valid = false;
        } else {
            element.classList.remove('invalid');
        }
    });
    
    return valid;
}

// Collect all form data into an object
function collectFormData() {
    formData = {
        date: document.getElementById('report-date').value,
        manager: document.getElementById('manager-name').value,
        coworkingName: document.getElementById('coworking-name').value,
        metrics: {
            visitors: document.getElementById('visitors').value,
            newClients: document.getElementById('new-clients').value,
            returningClients: document.getElementById('returning-clients').value,
            fixedSpaces: document.getElementById('fixed-spaces').value,
            flexibleSpaces: document.getElementById('flexible-spaces').value,
            meetingRooms: document.getElementById('meeting-rooms').value,
        },
        financial: {
            dailyRevenue: document.getElementById('daily-revenue').value,
            averageCheck: document.getElementById('average-check').value,
            transactions: document.getElementById('transactions').value,
            meetingRevenue: document.getElementById('meeting-revenue').value,
        },
        space: {
            kitchenArea: document.getElementById('kitchen-area').checked,
            loungeArea: document.getElementById('lounge-area').checked,
            restArea: document.getElementById('rest-area').checked,
            phoneBooths: document.getElementById('phone-booths').checked,
            spaceComments: document.getElementById('space-comments').value,
        },
        clients: {
            toursConducted: document.getElementById('tours-conducted').value,
            newRegistrations: document.getElementById('new-registrations').value,
            conversionRate: document.getElementById('conversion-rate').value,
            subscriptionRenewals: document.getElementById('subscription-renewals').value,
        },
        operations: {
            internetStable: document.getElementById('internet-stable').checked,
            printersWorking: document.getElementById('printers-working').checked,
            coffeeMachines: document.getElementById('coffee-machines').checked,
            airConditioning: document.getElementById('air-conditioning').checked,
            lightingOk: document.getElementById('lighting-ok').checked,
            securityActive: document.getElementById('security-active').checked,
            morningCleaning: document.getElementById('morning-cleaning').checked,
            eveningCleaning: document.getElementById('evening-cleaning').checked,
            suppliesRefilled: document.getElementById('supplies-refilled').checked,
            trashRemoved: document.getElementById('trash-removed').checked,
        },
        service: {
            supportRequests: document.getElementById('support-requests').value,
            responseTime: document.getElementById('response-time').value,
            complaints: document.getElementById('complaints').value,
            serviceRating: document.getElementById('service-rating').value,
            clientFeedback: document.getElementById('client-feedback').value,
        },
        events: {
            eventsConducted: document.getElementById('events-conducted').value,
            eventParticipants: document.getElementById('event-participants').value,
            eventRevenue: document.getElementById('event-revenue').value,
            tomorrowEvents: document.getElementById('tomorrow-events').value,
        },
        issues: {
            noProblems: document.getElementById('no-problems').checked,
            technicalIssues: document.getElementById('technical-issues').value,
            noConflicts: document.getElementById('no-conflicts').checked,
            incidentDescription: document.getElementById('incident-description').value,
            measuresTaken: document.getElementById('measures-taken').value,
        },
        tomorrow: {
            priorityTasks: document.getElementById('priority-tasks').value,
            scheduledMeetings: document.getElementById('scheduled-meetings').value,
        },
        improvements: {
            shortTermImprovements: document.getElementById('short-term-improvements').value,
            longTermInitiatives: document.getElementById('long-term-initiatives').value,
            additionalComments: document.getElementById('additional-comments').value,
        },
    };
function updateSpaceOccupancyPercentages() {
  const fixedOccupiedInput = document.getElementById('fixed-spaces-occupied');
  const flexibleOccupiedInput = document.getElementById('flexible-spaces-occupied');
  const fixedPercentInput = document.getElementById('fixed-spaces');
  const flexiblePercentInput = document.getElementById('flexible-spaces');

  const fixedOccupied = fixedOccupiedInput ? parseInt(fixedOccupiedInput.value) || 0 : 0;
  const flexibleOccupied = flexibleOccupiedInput ? parseInt(flexibleOccupiedInput.value) || 0 : 0;

  let fixedPercent = FIXED_SPACES_TOTAL ? (fixedOccupied / FIXED_SPACES_TOTAL) * 100 : 0;
  let flexiblePercent = FLEXIBLE_SPACES_TOTAL ? (flexibleOccupied / FLEXIBLE_SPACES_TOTAL) * 100 : 0;

  fixedPercent = Math.min(fixedPercent, 100);
  flexiblePercent = Math.min(flexiblePercent, 100);

  if (fixedPercentInput) {
    fixedPercentInput.value = fixedPercent.toFixed(1);
    updateMetricStatus(fixedPercentInput);
  }
  if (flexiblePercentInput) {
    flexiblePercentInput.value = flexiblePercent.toFixed(1);
    updateMetricStatus(flexiblePercentInput);
  }

  updateSummary();
  updateOverallRating();
  triggerAutosave();
}
    function updateCalculatedFields() {
    updateAverageCheck();
    updateSummary();
    updateOverallRating();
    updateSpaceOccupancyPercentages();  
}
    
    return formData;
}

// Format collected data into text report
function formatReport() {
    // Format date for display
    let displayDate = '';
    if (formData.date) {
        const dateObj = new Date(formData.date);
        displayDate = dateObj.toLocaleDateString('ru-RU', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric' 
        });
    }

    let report = `# ЕЖЕДНЕВНЫЙ ОТЧЕТ УПРАВЛЯЮЩЕГО КОВОРКИНГОМ

**Дата:** ${displayDate}  
**Управляющий:** ${formData.manager}  
**Название коворкинга:** ${formData.coworkingName}

---

## 1. ОСНОВНЫЕ ПОКАЗАТЕЛИ ДНЯ

### Посещаемость
- **Общее количество посетителей:** ${formData.metrics.visitors || '0'} чел.
- **Новые клиенты:** ${formData.metrics.newClients || '0'} чел.
- **Возвращающиеся клиенты:** ${formData.metrics.returningClients || '0'} чел.
- **Загрузка фиксированных мест:** ${formData.metrics.fixedSpaces || '0'}% (цель: >80%)
- **Загрузка гибких мест:** ${formData.metrics.flexibleSpaces || '0'}% (цель: >75%)
- **Загрузка переговорных:** ${formData.metrics.meetingRooms || '0'}% (цель: >60%)

### Финансовые показатели
- **Выручка за день:** ${formData.financial.dailyRevenue || '0'} руб.
- **Количество транзакций:** ${formData.financial.transactions || '0'}
- **Средний чек:** ${formData.financial.averageCheck || '0'} руб.
- **Доход от переговорных:** ${formData.financial.meetingRevenue || '0'} руб.

---

## 2. ИСПОЛЬЗОВАНИЕ ПРОСТРАНСТВА

### Общественные зоны
- ${formData.space.kitchenArea ? '☑' : '☐'} Кухонная зона - чистота и порядок
- ${formData.space.loungeArea ? '☑' : '☐'} Лаунж-зона - состояние мебели и комфорт
- ${formData.space.restArea ? '☑' : '☐'} Зона отдыха - функциональность оборудования
- ${formData.space.phoneBooths ? '☑' : '☐'} Телефонные будки - техническое состояние

${formData.space.spaceComments ? '### Комментарии к пространству\n' + formData.space.spaceComments : ''}

---

## 3. ПРОДАЖИ И КЛИЕНТЫ

### Новые клиенты
- **Количество экскурсий проведено:** ${formData.clients.toursConducted || '0'}
- **Количество новых регистраций:** ${formData.clients.newRegistrations || '0'}
- **Конверсия экскурсий в продажи:** ${formData.clients.conversionRate || '0'}%
- **Продлили подписку:** ${formData.clients.subscriptionRenewals || '0'} чел.

---

## 4. ОПЕРАЦИОННАЯ ДЕЯТЕЛЬНОСТЬ

### Техническое состояние
- ${formData.operations.internetStable ? '☑' : '☐'} Интернет работает стабильно (скорость >50 Мбит/с)
- ${formData.operations.printersWorking ? '☑' : '☐'} Принтеры и сканеры исправны
- ${formData.operations.coffeeMachines ? '☑' : '☐'} Кофемашины работают исправно
- ${formData.operations.airConditioning ? '☑' : '☐'} Система кондиционирования функционирует
- ${formData.operations.lightingOk ? '☑' : '☐'} Освещение в норме во всех зонах
- ${formData.operations.securityActive ? '☑' : '☐'} Система безопасности активна

### Чистота и порядок
- ${formData.operations.morningCleaning ? '☑' : '☐'} Утренняя уборка выполнена
- ${formData.operations.eveningCleaning ? '☑' : '☐'} Вечерняя уборка запланирована
- ${formData.operations.suppliesRefilled ? '☑' : '☐'} Расходные материалы пополнены
- ${formData.operations.trashRemoved ? '☑' : '☐'} Мусор вынесен

---

## 5. ОБСЛУЖИВАНИЕ КЛИЕНТОВ

### Качество сервиса
- **Количество обращений в поддержку:** ${formData.service.supportRequests || '0'}
- **Среднее время отклика:** ${formData.service.responseTime || '0'} мин. (цель: <15 мин.)
- **Количество жалоб:** ${formData.service.complaints || '0'} (цель: <3 в день)
- **Оценка качества обслуживания (1-5):** ${formData.service.serviceRating || '-'}

${formData.service.clientFeedback ? '### Замечания от клиентов\n' + formData.service.clientFeedback : ''}

---

## 6. СОБЫТИЯ И АКТИВНОСТИ

${formData.events.eventsConducted ? '### Проведенные мероприятия\n' + formData.events.eventsConducted : '### Проведенные мероприятия\n- Мероприятий не было'}
- **Количество участников:** ${formData.events.eventParticipants || '0'}
- **Доходы от мероприятий:** ${formData.events.eventRevenue || '0'} руб.

${formData.events.tomorrowEvents ? '### События на завтра\n' + formData.events.tomorrowEvents : ''}

---

## 7. ПРОБЛЕМЫ И ИНЦИДЕНТЫ

### Технические проблемы
- ${formData.issues.noProblems ? '☑' : '☐'} Проблем не было
${!formData.issues.noProblems && formData.issues.technicalIssues ? formData.issues.technicalIssues : ''}

### Конфликтные ситуации
- ${formData.issues.noConflicts ? '☑' : '☐'} Конфликтов не было
${!formData.issues.noConflicts && formData.issues.incidentDescription ? '- **Описание инцидента:** ' + formData.issues.incidentDescription : ''}
${!formData.issues.noConflicts && formData.issues.measuresTaken ? '- **Принятые меры:** ' + formData.issues.measuresTaken : ''}

---

## 8. ПЛАНЫ НА ЗАВТРА

### Приоритетные задачи
${formData.tomorrow.priorityTasks || '- Нет приоритетных задач'}

### Запланированные встречи
${formData.tomorrow.scheduledMeetings || '- Нет запланированных встреч'}

---

## 9. ПРЕДЛОЖЕНИЯ ПО УЛУЧШЕНИЮ

### Краткосрочные улучшения (1-7 дней)
${formData.improvements.shortTermImprovements || '- Нет предложений по краткосрочным улучшениям'}

### Долгосрочные инициативы (1-3 месяца)
${formData.improvements.longTermInitiatives || '- Нет предложений по долгосрочным инициативам'}

---

## 10. ДОПОЛНИТЕЛЬНЫЕ КОММЕНТАРИИ
${formData.improvements.additionalComments || 'Без комментариев'}

---

**Подпись управляющего:** ${formData.manager} **Время заполнения:** ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}

---

## ЦВЕТОВАЯ МАРКИРОВКА ПОКАЗАТЕЛЕЙ

${getStatusSummary()}

**Общая оценка дня:** ${document.getElementById('day-rating').textContent}`;

    return report;
}

// Get summary of colored status indicators for the report
function getStatusSummary() {
    let excellent = [];
    let warning = [];
    let critical = [];
    
    // Check metrics
    if (document.getElementById('visitors-status').classList.contains('status-excellent'))
        excellent.push('Посещаемость: ' + document.getElementById('visitors').value + ' чел. (>50)');
    else if (document.getElementById('visitors-status').classList.contains('status-warning'))
        warning.push('Посещаемость: ' + document.getElementById('visitors').value + ' чел. (цель: >50)');
    else if (document.getElementById('visitors-status').classList.contains('status-critical'))
        critical.push('Посещаемость: ' + document.getElementById('visitors').value + ' чел. (цель: >50)');
    
    if (document.getElementById('fixed-spaces-status').classList.contains('status-excellent'))
        excellent.push('Загрузка фикс. мест: ' + document.getElementById('fixed-spaces').value + '% (>80%)');
    else if (document.getElementById('fixed-spaces-status').classList.contains('status-warning'))
        warning.push('Загрузка фикс. мест: ' + document.getElementById('fixed-spaces').value + '% (цель: >80%)');
    else if (document.getElementById('fixed-spaces-status').classList.contains('status-critical'))
        critical.push('Загрузка фикс. мест: ' + document.getElementById('fixed-spaces').value + '% (цель: >80%)');
    
    if (document.getElementById('response-time-status').classList.contains('status-excellent'))
        excellent.push('Время отклика: ' + document.getElementById('response-time').value + ' мин. (<15 мин.)');
    else if (document.getElementById('response-time-status').classList.contains('status-warning'))
        warning.push('Время отклика: ' + document.getElementById('response-time').value + ' мин. (цель: <15 мин.)');
    else if (document.getElementById('response-time-status').classList.contains('status-critical'))
        critical.push('Время отклика: ' + document.getElementById('response-time').value + ' мин. (цель: <15 мин.)');
    
    let summary = '';
    
    if (excellent.length > 0) {
        summary += '### ✅ Зеленый (отлично):\n';
        excellent.forEach(item => {
            summary += `- ${item}\n`;
        });
        summary += '\n';
    }
    
    if (warning.length > 0) {
        summary += '### ⚠️ Желтый (требует внимания):\n';
        warning.forEach(item => {
            summary += `- ${item}\n`;
        });
        summary += '\n';
    }
    
    if (critical.length > 0) {
        summary += '### 🔴 Красный (критично):\n';
        critical.forEach(item => {
            summary += `- ${item}\n`;
        });
        summary += '\n';
    }
    
    return summary;
}

// Return to form editing mode
function returnToForm() {
    document.getElementById('report-output').classList.add('hidden');
    document.getElementById('daily-report-form').classList.remove('hidden');
    window.scrollTo(0, 0);
}

// Copy report to clipboard
function copyReportToClipboard() {
    const report = document.getElementById('formatted-report').textContent;
    
    // Use the clipboard API
    navigator.clipboard.writeText(report).then(() => {
        showToast('Отчет скопирован в буфер обмена', 'success');
    }).catch(err => {
        showToast('Не удалось скопировать: ' + err, 'error');
    });
}

// Download report as text file
function downloadReport() {
    const report = document.getElementById('formatted-report').textContent;
    const filename = `daily_report_${formData.date || 'report'}.txt`;
    
    // Create blob and download
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 0);
    
    showToast('Отчет скачан', 'success');
}

// Clear the form
function clearForm() {
    if (!confirm('Вы уверены, что хотите очистить форму? Все введенные данные будут удалены.')) {
        return;
    }
    
    // Reset main form fields but keep date and manager info
    const keepFields = ['report-date', 'manager-name', 'coworking-name'];
    const fieldsToKeep = {};
    
    keepFields.forEach(id => {
        fieldsToKeep[id] = document.getElementById(id).value;
    });
    
    // Reset the form
    document.getElementById('daily-report-form').reset();
    
    // Restore kept fields
    keepFields.forEach(id => {
        document.getElementById(id).value = fieldsToKeep[id];
    });
    
    // Reset all status indicators
    document.querySelectorAll('.status-indicator').forEach(element => {
        element.className = 'status-indicator status-empty';
        element.textContent = '';
    });
    
    // Reset day rating
    document.getElementById('day-rating').textContent = 'Заполните показатели';
    document.getElementById('overall-assessment').className = 'overall-assessment';
    
    // Reset summary
    document.getElementById('summary-grid').innerHTML = '';
    
    // Clear form data
    formData = {};
    
    // Clear localStorage
    localStorage.removeItem('daily_report_form_data');
    
    showToast('Форма очищена', 'success');
}

// Auto-save functionality
function triggerAutosave() {
    // Clear previous timeout
    if (autosaveTimeout) {
        clearTimeout(autosaveTimeout);
    }
    
    // Set new timeout
    autosaveTimeout = setTimeout(() => {
        saveFormData();
    }, AUTOSAVE_DELAY);
}

// Save form data to localStorage
function saveFormData() {
    const data = collectFormData();
    
    try {
        localStorage.setItem('daily_report_form_data', JSON.stringify(data));
    } catch (e) {
        console.error('Error saving form data:', e);
    }
}

// Load form data from localStorage
function loadFormData() {
    try {
        const savedData = localStorage.getItem('daily_report_form_data');
        if (savedData) {
            formData = JSON.parse(savedData);
            populateForm(formData);
        }
    } catch (e) {
        console.error('Error loading form data:', e);
    }
}

// Save form manually (with feedback)
function saveFormManually() {
    saveFormData();
    showToast('Черновик сохранен', 'success');
}

// Populate form with saved data
function populateForm(data) {
    if (!data) return;
    
    // Basic info
    if (data.date) document.getElementById('report-date').value = data.date;
    if (data.manager) document.getElementById('manager-name').value = data.manager;
    if (data.coworkingName) document.getElementById('coworking-name').value = data.coworkingName;
    
    // metrics: {
    visitors: document.getElementById('visitors').value,
    newClients: document.getElementById('new-clients').value,
    returningClients: document.getElementById('returning-clients').value,

    fixedSpacesOccupied: document.getElementById('fixed-spaces-occupied') ? document.getElementById('fixed-spaces-occupied').value : '',
    flexibleSpacesOccupied: document.getElementById('flexible-spaces-occupied') ? document.getElementById('flexible-spaces-occupied').value : '',

    fixedSpaces: document.getElementById('fixed-spaces').value,
    flexibleSpaces: document.getElementById('flexible-spaces').value,
    meetingRooms: document.getElementById('meeting-rooms').value,
},
    
    // Financial
    if (data.financial) {
        if (data.financial.dailyRevenue) document.getElementById('daily-revenue').value = data.financial.dailyRevenue;
        if (data.financial.transactions) document.getElementById('transactions').value = data.financial.transactions;
        if (data.financial.meetingRevenue) document.getElementById('meeting-revenue').value = data.financial.meetingRevenue;
    }
    
    // Space
    if (data.space) {
        document.getElementById('kitchen-area').checked = data.space.kitchenArea;
        document.getElementById('lounge-area').checked = data.space.loungeArea;
        document.getElementById('rest-area').checked = data.space.restArea;
        document.getElementById('phone-booths').checked = data.space.phoneBooths;
        if (data.space.spaceComments) document.getElementById('space-comments').value = data.space.spaceComments;
    }
    
    // Clients
    if (data.clients) {
        if (data.clients.toursConducted) document.getElementById('tours-conducted').value = data.clients.toursConducted;
        if (data.clients.newRegistrations) document.getElementById('new-registrations').value = data.clients.newRegistrations;
        if (data.clients.subscriptionRenewals) document.getElementById('subscription-renewals').value = data.clients.subscriptionRenewals;
    }
    
    // Operations
    if (data.operations) {
        document.getElementById('internet-stable').checked = data.operations.internetStable;
        document.getElementById('printers-working').checked = data.operations.printersWorking;
        document.getElementById('coffee-machines').checked = data.operations.coffeeMachines;
        document.getElementById('air-conditioning').checked = data.operations.airConditioning;
        document.getElementById('lighting-ok').checked = data.operations.lightingOk;
        document.getElementById('security-active').checked = data.operations.securityActive;
        document.getElementById('morning-cleaning').checked = data.operations.morningCleaning;
        document.getElementById('evening-cleaning').checked = data.operations.eveningCleaning;
        document.getElementById('supplies-refilled').checked = data.operations.suppliesRefilled;
        document.getElementById('trash-removed').checked = data.operations.trashRemoved;
    }
    
    // Service
    if (data.service) {
        if (data.service.supportRequests) document.getElementById('support-requests').value = data.service.supportRequests;
        if (data.service.responseTime) document.getElementById('response-time').value = data.service.responseTime;
        if (data.service.complaints) document.getElementById('complaints').value = data.service.complaints;
        if (data.service.serviceRating) document.getElementById('service-rating').value = data.service.serviceRating;
        if (data.service.clientFeedback) document.getElementById('client-feedback').value = data.service.clientFeedback;
    }
    
    // Events
    if (data.events) {
        if (data.events.eventsConducted) document.getElementById('events-conducted').value = data.events.eventsConducted;
        if (data.events.eventParticipants) document.getElementById('event-participants').value = data.events.eventParticipants;
        if (data.events.eventRevenue) document.getElementById('event-revenue').value = data.events.eventRevenue;
        if (data.events.tomorrowEvents) document.getElementById('tomorrow-events').value = data.events.tomorrowEvents;
    }
    
    // Issues
    if (data.issues) {
        document.getElementById('no-problems').checked = data.issues.noProblems;
        if (!data.issues.noProblems && data.issues.technicalIssues) {
            document.getElementById('technical-issues').value = data.issues.technicalIssues;
            document.getElementById('technical-issues').disabled = false;
        } else {
            document.getElementById('technical-issues').disabled = data.issues.noProblems;
        }
        
        document.getElementById('no-conflicts').checked = data.issues.noConflicts;
        if (!data.issues.noConflicts) {
            if (data.issues.incidentDescription) document.getElementById('incident-description').value = data.issues.incidentDescription;
            if (data.issues.measuresTaken) document.getElementById('measures-taken').value = data.issues.measuresTaken;
            document.getElementById('incident-description').disabled = false;
            document.getElementById('measures-taken').disabled = false;
        } else {
            document.getElementById('incident-description').disabled = true;
            document.getElementById('measures-taken').disabled = true;
        }
    }
    
    // Tomorrow
    if (data.tomorrow) {
        if (data.tomorrow.priorityTasks) document.getElementById('priority-tasks').value = data.tomorrow.priorityTasks;
        if (data.tomorrow.scheduledMeetings) document.getElementById('scheduled-meetings').value = data.tomorrow.scheduledMeetings;
    }
    
    // Improvements
    if (data.improvements) {
        if (data.improvements.shortTermImprovements) document.getElementById('short-term-improvements').value = data.improvements.shortTermImprovements;
        if (data.improvements.longTermInitiatives) document.getElementById('long-term-initiatives').value = data.improvements.longTermInitiatives;
        if (data.improvements.additionalComments) document.getElementById('additional-comments').value = data.improvements.additionalComments;
    }
    
    // Update calculations and status indicators
    document.querySelectorAll('.metric-input').forEach(input => {
        updateMetricStatus(input);
    });
    
    updateCalculatedFields();
}

// Show toast message
function showToast(message, type = 'success') {
    // Create toast container if it doesn't exist
    let toast = document.querySelector('.toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    
    // Set toast message and type
    toast.textContent = message;
    toast.className = `toast ${type}`;
    
    // Show the toast
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // Hide toast after some time
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
function getTodayString() {
    const today = new Date();
    return today.toISOString().split('T')[0];
}

// Сохраняет текущий черновик как финальный отчёт за указанную дату
function saveReportAsFinal(dateStr) {
    const draft = localStorage.getItem('daily_report_form_data');
    if (!draft) return;
    let allReports = {};
    try {
        allReports = JSON.parse(localStorage.getItem(REPORTS_BY_DATE_KEY) || '{}');
    } catch {
        allReports = {};
    }
    allReports[dateStr] = JSON.parse(draft);
    localStorage.setItem(REPORTS_BY_DATE_KEY, JSON.stringify(allReports));
}

// Загрузка черновика или финального отчета по дате, иначе очистка формы
function loadOrResetFormByDate(dateStr) {
    let allReports = {};
    try {
        allReports = JSON.parse(localStorage.getItem(REPORTS_BY_DATE_KEY) || '{}');
    } catch {
        allReports = {};
    }
    if (localStorage.getItem('daily_report_form_data')) {
        loadFormData();
    } else if (allReports[dateStr]) {
        populateForm(allReports[dateStr]);
    } else {
        clearForm(true);
    }
}

// Отправка отчёта на серверный API для отправки по email
function sendReportToMail(dateStr) {
    let allReports = {};
    try {
        allReports = JSON.parse(localStorage.getItem(REPORTS_BY_DATE_KEY) || '{}');
    } catch {
        allReports = {};
    }
    if (!allReports[dateStr]) return;

    const formData = allReports[dateStr];
    const report = formatReportFromData(formData);

    fetch('/api/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            to: 'ssd-samoilova@mail.ru',
            subject: `Отчет коворкинга за ${formatRuDate(dateStr)}`,
            body: report,
        }),
    })
    .then(res => res.json())
    .then(data => {
        console.log('Отчет отправлен:', data.status);
        showToast('Вчерашний отчет отправлен на почту', 'success');
    })
    .catch(err => {
        console.error('Ошибка отправки:', err);
        showToast('Ошибка отправки отчета на почту', 'error');
    });
}

// Форматирует данные отчёта для отправки в текстовом виде (заполните по вашей структуре)
function formatReportFromData(data) {
    const displayDate = data.date
        ? new Date(data.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : '';

    // Пример формирования: подстройте под ваши реальные поля и формат вывода
    return `Ежедневный отчет
Дата: ${displayDate}
Управляющий: ${data.manager || ''}
Количество посетителей: ${data.metrics?.visitors || ''}
Выручка за день: ${data.financial?.dailyRevenue || ''}
... (Добавьте остальные поля отчёта по необходимости)
`;
}

function formatRuDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Обновленная очистка формы, принимает параметр silent - тихий режим без подтверждения
function clearForm(silent = false) {
    if (!silent && !confirm('Вы уверены, что хотите очистить форму? Все введенные данные будут удалены.')) {
        return;
    }
    const form = document.querySelector('form');
    if (form) form.reset();
    localStorage.removeItem('daily_report_form_data');
    // обновите прочие элементы интерфейса при необходимости
}
