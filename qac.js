// localStorage操作封装
const storage = {
    set: (key, value) => localStorage.setItem(key, JSON.stringify(value)),
    get: (key) => {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : null;
    },
    remove: (key) => localStorage.removeItem(key)
};

// 系统状态
let currentDate = new Date();
let viewDate = new Date();
let currentQuestions = [];
let answerAttempts = {};
let attemptCounts = {};

function init() {
    // 初始化当天任务
    const todayKey = new Date().toDateString();
    if (!storage.get(todayKey)) {
        storage.set(todayKey, {
            submitted: false,
            correctCount: 0,
            totalQuestions: 2
        });
    }
    
    loadSettings();
    generateCalendar();
    updateStats();
    showView('calendar');
}

function showView(viewName) {
    document.querySelectorAll('.main-container > div').forEach(el => el.classList.add('hidden'));
    document.getElementById(viewName+'View').classList.remove('hidden');
    if(viewName === 'tasks') refreshTaskList();
}

function generateCalendar() {
    const calendar = document.getElementById('calendar');
    calendar.innerHTML = '';
    
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDay = firstDay.getDay();
    const startDate = new Date(year, month, 1 - startDay);
    
    for (let i = 0; i < 42; i++) {
        const cellDate = new Date(startDate);
        cellDate.setDate(startDate.getDate() + i);
        
        const cell = document.createElement('div');
        cell.className = 'calendar-cell';
        if (cellDate.getMonth() !== month) {
            cell.classList.add('other-month');
        }
        if (cellDate.toDateString() === new Date().toDateString()) {
            cell.classList.add('current-day');
        }

        cell.innerHTML = `
            <div>${cellDate.getDate()}</div>
            ${renderScoreIndicator(cellDate)}
        `;

        if (cellDate.getMonth() === month) {
            cell.onclick = () => showTaskDetail(cellDate);
        }
        calendar.appendChild(cell);
    }

    document.getElementById('currentMonth').textContent = 
        `${year}年 ${month + 1}月`;
}

function renderScoreIndicator(date) {
    const record = storage.get(date.toDateString()) || {};
    if (!record.submitted || !record.totalQuestions) return '';
    
    const percentage = record.correctCount / record.totalQuestions;
    let statusClass = 'medium-score';
    if (percentage >= 0.8) statusClass = 'high-score';
    else if (percentage < 0.6) statusClass = 'low-score';

    return `<div class="score-indicator ${statusClass}">
        ${record.correctCount}/${record.totalQuestions}
    </div>`;
}

async function showTaskDetail(date) {
    currentDate = date;
    answerAttempts = {};
    attemptCounts = {};
    const record = storage.get(date.toDateString()) || {};
    
    try {
        const response = await fetchQuestions(date);
        currentQuestions = response.questions;
        renderQuestions(record);
    } catch(e) {
        alert('获取题目失败');
        return;
    }

    document.getElementById('taskDate').textContent = date.toLocaleDateString();
    document.getElementById('submitBtn').style.display = record.submitted ? 'none' : 'block';
    //document.getElementById('taskDetailView').classList.remove('hidden');
    showView('taskDetail')
}

function renderQuestions(record) {
    const container = document.getElementById('questionsContainer');
    container.innerHTML = currentQuestions.map((q, i) => `
        <div class="question-item ${record.submitted ? 'locked' : ''}" id="q${q.id}">
            <div class="question-title">题目 ${i+1}: ${q.question}</div>
            ${renderInput(q, record)}
            ${record.submitted ? renderResult(q, record) : ''}
            ${!record.submitted ? `<button class="nav-button" style="margin-top:8px;" onclick="checkAnswer(${q.id})">确定</button>` : ''}
            <div class="error-hint" id="hint${q.id}"></div>
        </div>
    `).join('');
}

function renderInput(q, record) {
    if (record.submitted) {
        return `<input class="form-control" value="${q.answer}" readonly>`;
    }
    
    const currentValue = answerAttempts[q.id] || '';
    return q.type === 'select' ? `
        <select class="form-control" onchange="recordAnswer(${q.id}, this.value)">
            <option value="">请选择</option>
            ${q.options.map(o => `
                <option ${currentValue === o ? 'selected' : ''}>${o}</option>
            `).join('')}
        </select>
    ` : `
        <input class="form-control" type="text" 
            value="${currentValue}"
            oninput="recordAnswer(${q.id}, this.value)"
            placeholder="${q.hint}">
    `;
}

function renderResult(q, record) {
    const userAnswer = record.answers?.[q.id]?.answer || '未回答';
    const isCorrect = record.answers?.[q.id]?.correct;
    
    return `
        <div class="user-answer" style="color: ${isCorrect ? 'green' : 'red'}">
            你的答案: ${userAnswer} ${isCorrect ? '✓' : '✗'}
        </div>
        ${!isCorrect ? `
            <div class="correct-answer" style="color: green">
                正确答案: ${q.answer}
            </div>
        ` : ''}
    `;
}

function recordAnswer(questionId, value) {
    answerAttempts[questionId] = value;
}

function checkAnswer(qId) {
    const question = currentQuestions.find(q => q.id === qId);
    const input = document.querySelector(`#q${qId} input, #q${qId} select`);
    const userAnswer = input.value.trim();
    const hint = document.getElementById(`hint${qId}`);
    
    if(!userAnswer) return;
    
    attemptCounts[qId] = (attemptCounts[qId] || 0) + 1;
    
    if(userAnswer === question.answer) {
        hint.textContent = '✓ 回答正确！';
        hint.style.color = 'green';
        input.disabled = true;
    } else {
        if(attemptCounts[qId] >= 2) {
            hint.textContent = '✗ 已锁定，请提交后查看答案';
            input.disabled = true;
        } else {
            hint.textContent = '提示：' + (question.hint || '答案不正确，请再试一次');
        }
    }
}

function submitAnswers() {
    const results = currentQuestions.map(q => {
        const userAnswer = answerAttempts[q.id] || '';
        return { 
            questionId: q.id,
            answer: userAnswer,
            correct: userAnswer === q.answer
        };
    });

    const correctCount = results.filter(r => r.correct).length;
    const record = {
        submitted: true,
        correctCount,
        totalQuestions: currentQuestions.length,
        answers: Object.fromEntries(results.map(r => [r.questionId, r])),
        submitTime: new Date().toISOString()
    };

    storage.set(currentDate.toDateString(), record);
    updateStats();
    generateCalendar();
    showTaskDetail(currentDate);
}

function refreshTaskList() {
    const tasks = Object.keys(localStorage)
        .filter(k => Date.parse(k))
        .map(k => ({
            date: new Date(k),
            data: storage.get(k)
        }))
        .sort((a,b) => b.date - a.date);

    const today = new Date();
    let html = '';
    
    // 当天任务
    const todayTask = tasks.find(t => t.date.toDateString() === today.toDateString());
    if (todayTask) {
        html += `
        <div class="task-item ${!todayTask.data.submitted ? 'urgent' : ''}">
            <div onclick="showTaskDetail(new Date('${todayTask.date.toISOString()}'))">
                ${todayTask.date.toLocaleDateString()} 
                ${!todayTask.data.submitted ? '(今日未完成)' : '(已完成)'}
            </div>
            <button class="nav-button" onclick="refreshTask('${todayTask.date.toISOString()}')">重做</button>
        </div>`;
    }

    // 历史任务
    tasks.filter(t => t.date.toDateString() !== today.toDateString()).forEach(t => {
        html += `
        <div class="task-item" onclick="showTaskDetail(new Date('${t.date.toISOString()}'))">
            ${t.date.toLocaleDateString()} 
            (${t.data.correctCount}/${t.data.totalQuestions})
        </div>`;
    });

    document.getElementById('taskList').innerHTML = html;
}

function refreshTask(dateString) {
    if (!confirm("您确定要重做吗？"))
        return;
    const date = new Date(dateString);
    storage.remove(date.toDateString());
    storage.set(date.toDateString(), {
        submitted: false,
        correctCount: 0,
        totalQuestions: 0
    });
    refreshTaskList();
}

function loadSettings() {
    const settings = storage.get('system_settings') || {};
    document.getElementById('apiUrl').value = settings.apiUrl || '';
    document.getElementById('apiKey').value = settings.apiKey || '';
}

function saveSettings() {
    const settings = {
        apiUrl: document.getElementById('apiUrl').value,
        apiKey: document.getElementById('apiKey').value
    };
    storage.set('system_settings', settings);
}

function updateStats() {
    const completed = Object.keys(localStorage)
        .filter(k => Date.parse(k))
        .map(k => storage.get(k))
        .filter(data => data.submitted)
        .length;
    document.getElementById('completedCount').textContent = completed;
}

async function fetchQuestions(date) {
    const settings = storage.get('system_settings') || {};
    // 模拟API响应
    const weekday = ['日','一','二','三','四','五','六'][date.getDay()];
    return {
        questions: [
            {
                id: 1,
                type: 'select',
                question: "今天的正确日期是？",
                options: [date.toLocaleDateString('zh'), "昨天", "明天"],
                answer: date.toLocaleDateString('zh'),
                hint: "查看当前日期"
            },
            {
                id: 2,
                type: 'input',
                question: `今天是星期${weekday}，用拼音表示（如xingqiyi）`,
                answer: `xingqi${['ri','yi','er','san','si','wu','liu'][date.getDay()]}`,
                hint: "格式：xingqi..."
            }
        ]
    };
}

function changeMonth(offset) {
    viewDate.setMonth(viewDate.getMonth() + offset);
    generateCalendar();
}

function hideTask() {
    //document.getElementById('taskDetailView').classList.add('hidden');
    showView('calendar')
    generateCalendar();
}

// 初始化应用
init();
