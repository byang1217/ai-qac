let viewDate = new Date();

function setupWeekdayLabels() {
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const container = document.getElementById('weekdayLabels');
    container.innerHTML = '';
    
    weekdays.forEach(day => {
        const cell = document.createElement('div');
        cell.className = 'weekday-label';
        cell.textContent = day;
        container.appendChild(cell);
    });
}

function renderScoreIndicator(date) {
    const dateKey = formatDateKey(date);
    const record = storage.get(dateKey) || {};
    
    if (!record.submitted || !record.totalQuestions) return '';
    
    const percentage = record.correctCount / record.totalQuestions;
    let statusClass = 'medium-score';
    if (percentage >= 0.8) statusClass = 'high-score';
    else if (percentage < 0.6) statusClass = 'low-score';

    return `<div class="score-indicator ${statusClass}">
        ${record.correctCount}/${record.totalQuestions}
    </div>`;
}

function generateCalendar() {
    logger.log('生成日历');
    const calendar = document.getElementById('calendar');
    calendar.innerHTML = '';
    
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDay = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // 计算日历起始日期（上个月的部分日期）
    const startDate = new Date(year, month, 1 - startDay);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 生成日历单元格
    for (let i = 0; i < 42; i++) {
        const cellDate = new Date(startDate);
        cellDate.setDate(startDate.getDate() + i);
        
        const isCurrentMonth = cellDate.getMonth() === month;
        const isPastOrToday = cellDate <= today;
        const isWeekend = cellDate.getDay() === 0 || cellDate.getDay() === 6;
        
        const cell = document.createElement('div');
        cell.className = 'calendar-cell';
        
        if (isWeekend) cell.classList.add('weekend');
        if (!isCurrentMonth) cell.classList.add('other-month');
        if (cellDate.toDateString() === today.toDateString()) cell.classList.add('current-day');
        
        // 只有当月且不是未来日期的单元格可点击
        if (isCurrentMonth && isPastOrToday) {
            cell.classList.add('clickable');
            cell.onclick = () => showTaskDetail(cellDate);
        } else if (isCurrentMonth && !isPastOrToday) {
            cell.classList.add('future-date');
        }

        cell.innerHTML = `
            <div>${cellDate.getDate()}</div>
            ${isCurrentMonth ? renderScoreIndicator(cellDate) : ''}
        `;
        
        calendar.appendChild(cell);
    }

    document.getElementById('currentMonth').textContent = 
        `${year}年 ${month + 1}月`;
}

function changeMonth(offset) {
    logger.log(`切换月份: ${offset}`);
    viewDate.setMonth(viewDate.getMonth() + offset);
    generateCalendar();
}
