let currentDate = new Date();
let currentQuestions = [];
let answerAttempts = {};
let attemptCounts = {};
let ignoreUnanswered = false;

async function showTaskDetail(date) {
    logger.log(`显示任务详情: ${formatDateKey(date)}`);
    currentDate = date;
    answerAttempts = {};
    attemptCounts = {};
    
    const dateKey = formatDateKey(date);
    let record = storage.get(dateKey) || { submitted: false };
    
    document.getElementById('taskDate').textContent = date.toLocaleDateString();
    document.getElementById('submitBtn').style.display = record.submitted ? 'none' : 'block';
    
    try {
        // 如果是已简化数据，显示简化提示
        if (record.simplified) {
            document.getElementById('questionsContainer').innerHTML = 
                `<div class="question-item">
                    <div class="question-title">该任务数据已简化归档。</div>
                    <div class="user-answer">
                        得分: ${record.correctCount}/${record.totalQuestions}
                    </div>
                </div>`;
            showView('taskDetail');
            return;
        }

        if (!record.questions) {
            await fetchQuestions(date);
            record = storage.get(dateKey) || { submitted: false };
        }
        currentQuestions = record.questions;
        if (!currentQuestions)
            throw new Error("No questions!")

        renderQuestions(record);
    } catch(e) {
        logger.log(`获取题目失败: ${e.message}`);
        document.getElementById('questionsContainer').innerHTML = 
            `<div class="error-hint">获取题目失败: ${e.message}</div>`;
    }

    showView('taskDetail');
}

function submitAnswers() {
    logger.log('提交答案');
    
    if (!confirm("确定要提交答案吗？提交后将无法修改。")) {
        return;
    }
    
    if (!currentQuestions || currentQuestions.length === 0) {
        alert('没有题目可提交');
        return;
    }
    
    // 检查所有问题是否已回答
    if (!ignoreUnanswered) {
        const unansweredQuestions = currentQuestions.filter(q => !answerAttempts[q.id]);
        if (unansweredQuestions.length > 0) {
            alert(`还有 ${unansweredQuestions.length} 道题目未完成，请完成所有题目后再提交。`);
            return;
        }
    } 

    const results = {};
    let correctCount = 0;
    
    currentQuestions.forEach(q => {
        const userAnswer = answerAttempts[q.id] || '';
        const isCorrect = userAnswer.toLowerCase() === q.answer.toLowerCase();
        
        results[q.id] = { 
            answer: userAnswer,
            correct: isCorrect
        };
        
        if (isCorrect) correctCount++;
    });

    const dateKey = formatDateKey(currentDate);
    const record = {
        submitted: true,
        correctCount,
        totalQuestions: currentQuestions.length,
        questions: currentQuestions, // 保存题目
        answers: results,
        submitTime: new Date().toISOString()
    };

    storage.set(dateKey, record);
    updateStats();
    generateCalendar();
    showTaskDetail(currentDate);
}

function refreshTaskList() {
    logger.log('刷新任务列表');
    const tasks = Object.keys(localStorage)
        .filter(k => k.match(/^\d{4}-\d{2}-\d{2}$/)) // 筛选日期格式的key
        .map(k => ({
            date: new Date(k),
            key: k,
            data: storage.get(k)
        }))
        .sort((a,b) => b.date - a.date); // 按日期从新到旧排序

    // 检查并确保今天的任务存在
    const today = new Date();
    const todayKey = formatDateKey(today);
    let todayTask = tasks.find(t => t.key === todayKey);
    
    if (!todayTask) {
        // 创建今天的任务
        storage.set(todayKey, {
            submitted: false,
            correctCount: 0,
            totalQuestions: 0
        });
        
        todayTask = {
            date: today,
            key: todayKey,
            data: storage.get(todayKey)
        };
        
        // 将今天的任务添加到列表
        tasks.unshift(todayTask);
    }

    const taskList = document.getElementById('taskList');
    taskList.innerHTML = '';

    // 当天任务
    const todayEl = document.createElement('div');
    todayEl.className = `task-item ${!todayTask.data.submitted ? 'urgent' : ''}`;
    todayEl.innerHTML = `
        <div onclick="showTaskDetail(new Date('${todayTask.date.toISOString()}'))">
            ${todayTask.date.toLocaleDateString()} 
            ${!todayTask.data.submitted ? '(今日未完成)' : '(已完成)'}
        </div>
        <button class="nav-button" onclick="refreshTask('${todayTask.key}')">重做</button>
    `;
    taskList.appendChild(todayEl);

    // 历史任务
    tasks.filter(t => t.key !== todayKey).forEach(t => {
        const taskEl = document.createElement('div');
        taskEl.className = 'task-item';
        taskEl.onclick = () => showTaskDetail(new Date(t.date));
        
        let statusText = '';
        if (t.data.submitted) {
            statusText = `(${t.data.correctCount}/${t.data.totalQuestions})`;
        } else {
            statusText = '(未完成)';
        }
        
        taskEl.innerHTML = `${t.date.toLocaleDateString()} ${statusText}`;
        taskList.appendChild(taskEl);
    });
}

function refreshTask(dateKey) {
    logger.log(`重做任务: ${dateKey}`);
    if (!confirm("您确定要重做吗？这将删除已有的答案数据。"))
        return;
    
    storage.remove(dateKey);
    storage.set(dateKey, {
        submitted: false,
        correctCount: 0,
        totalQuestions: 0
    });
    
    refreshTaskList();
    
    // 如果是当天的任务，直接显示
    const today = formatDateKey(new Date());
    if (dateKey === today) {
        showTaskDetail(new Date());
    }
}

function renderQuestions(record) {
    logger.log('渲染题目');
    const container = document.getElementById('questionsContainer');
    
    if (!currentQuestions || currentQuestions.length === 0) {
        container.innerHTML = '<div class="error-hint">暂无题目</div>';
        return;
    }
    
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
        return `<input class="form-control" value="${record.answers?.[q.id]?.answer || ''}" readonly>`;
    }
    
    const currentValue = answerAttempts[q.id] || '';
    
    if (q.type === 'select') {
        return `
            <select class="form-control" onchange="recordAnswer(${q.id}, this.value)">
                <option value="">请选择</option>
                ${(q.options || []).map(o => `
                    <option ${currentValue === o ? 'selected' : ''}>${o}</option>
                `).join('')}
            </select>
        `;
    } else {
        return `
            <input class="form-control" type="text" 
                value="${currentValue}"
                oninput="recordAnswer(${q.id}, this.value)"
                placeholder="${q.hint || '请输入答案'}">
        `;
    }
}

function renderResult(q, record) {
    const answer = record.answers?.[q.id] || {};
    const userAnswer = answer.answer || '未回答';
    const isCorrect = answer.correct;
    
    let html = `
        <div class="user-answer" style="color: ${isCorrect ? 'green' : 'red'}">
            你的答案: ${userAnswer} ${isCorrect ? '✓' : '✗'}
        </div>
    `;
    
    if (!isCorrect) {
        html += `
            <div class="correct-answer">
                正确答案: ${q.answer}
            </div>
        `;
    }
    
    if (q.thinking) {
        html += `
            <div>
                <div class="thinking-process">${q.thinking}</div>
            </div>
        `;
    }
    
    return html;
}

function recordAnswer(questionId, value) {
    logger.log(`记录答案 - 题目ID:${questionId}, 答案:${value}`);
    answerAttempts[questionId] = value;
}

function checkAnswer(qId) {
    const question = currentQuestions.find(q => q.id === qId);
    if (!question) {
        logger.log(`题目ID不存在: ${qId}`);
        return;
    }
    
    const input = document.querySelector(`#q${qId} input, #q${qId} select`);
    const userAnswer = input.value.trim();
    const hint = document.getElementById(`hint${qId}`);
    
    if(!userAnswer) {
        hint.textContent = '请输入答案';
        return;
    }
    
    logger.log(`检查答案 - 题目ID:${qId}, 用户答案:${userAnswer}, 正确答案:${question.answer}`);
    attemptCounts[qId] = (attemptCounts[qId] || 0) + 1;
    
    const answerMatch = userAnswer.toLowerCase() === question.answer.toLowerCase();
    
    if(answerMatch) {
        hint.textContent = '✓ 回答正确！';
        hint.style.color = 'green';
        input.disabled = true;

        // 显示正确答案和思考过程
        const container = document.getElementById(`q${qId}`);
        const answerDiv = document.createElement('div');
        answerDiv.className = 'correct-answer';
        answerDiv.innerHTML = `正确答案: ${question.answer}`;
        container.appendChild(answerDiv);
        
        if (question.thinking) {
            const thinkingDiv = document.createElement('div');
            thinkingDiv.innerHTML = `
                <div class="thinking-process">${question.thinking}</div>
            `;
            container.appendChild(thinkingDiv);
        }
    } else {
        if(attemptCounts[qId] >= 2) {
            hint.textContent = '✗ 答案不正确，已锁定';
            hint.style.color = 'red';
            input.disabled = true;
            
            // 显示正确答案和思考过程
            const container = document.getElementById(`q${qId}`);
            const answerDiv = document.createElement('div');
            answerDiv.className = 'correct-answer';
            answerDiv.innerHTML = `正确答案: ${question.answer}`;
            container.appendChild(answerDiv);
            
            if (question.thinking) {
                const thinkingDiv = document.createElement('div');
                thinkingDiv.innerHTML = `
                    <div class="thinking-process">${question.thinking}</div>
                `;
                container.appendChild(thinkingDiv);
            }
        } else {
            hint.textContent = '提示：' + (question.hint || '答案不正确，请再试一次');
            hint.style.color = '#856404';
        }
    }
}

// 获取默认题目
function getDefaultQuestions(date) {
    const weekday = ['日','一','二','三','四','五','六'][date.getDay()];
    const dateStr = formatDateKey(date);
    
    return [
        {
            id: 1,
            type: 'select',
            question: "今天的正确日期是？",
            options: [dateStr, "昨天", "明天"],
            answer: dateStr,
            hint: "查看当前日期",
            thinking: "这是一个关于日期的简单选择题，答案就是当前日期。"
        },
        {
            id: 2,
            type: 'input',
            question: `今天是星期${weekday}，用拼音表示（如xingqiyi）`,
            answer: `xingqi${['ri','yi','er','san','si','wu','liu'][date.getDay()]}`,
            hint: "格式：xingqi...",
            thinking: "拼音表示为：星期一(xingqiyi), 星期二(xingqier), 星期三(xingqisan), 星期四(xingqisi), 星期五(xingqiwu), 星期六(xingqiliu), 星期日(xingqiri)"
        },
        {
            id: 3,
            type: 'select',
            question: "下列哪个不是JavaScript的数据类型？",
            options: ["String", "Number", "Character", "Boolean"],
            answer: "Character",
            hint: "JavaScript有6种基本数据类型",
            thinking: "JavaScript的基本数据类型包括：String(字符串), Number(数字), Boolean(布尔), Undefined(未定义), Null(空), Symbol(符号,ES6新增)。其中没有Character(字符)类型，这是其他语言如Java中的类型。"
        },
        {
            id: 4,
            type: 'input',
            question: "HTML5的全称是什么？",
            answer: "HyperText Markup Language 5",
            hint: "超文本标记语言的第5版",
            thinking: "HTML是HyperText Markup Language(超文本标记语言)的缩写，HTML5是它的第5个主要版本，所以全称为HyperText Markup Language 5。"
        },
        {
            id: 5,
            type: 'input',
            question: "CSS中，使用什么选择器可以选择所有元素？",
            answer: "*",
            hint: "这是一个通配符",
            thinking: "在CSS中，通配选择器(Universal Selector)使用星号(*)表示，可以选择文档中的所有元素。"
        }
    ];
}

async function generateQuestions(apiUrl, apiKey, apiModel, qPrompt, qNum) {
    const prompt = 
`
1. 选择题有4个备选答案，其中一个是正确答案。
2. 填空题尽可能让答案是明确和唯一的，避免主观题导致不容易判断回答对错。
3. 每道题包括以下信息：
   a. 类型 (type): input/select
   b. 问题 (question)
   c. 备选答案 (options): 选择题的备选答案。
   d. 正确答案 (answer): 如果是选择题，正确答案应该和备选答案中的一个完全一致。
   e. 提示 (hint): 帮助用户解答题目，但是要避免直接透露答案本身。
   f. 解题思路 (thinking): 帮助用户理解答案，提高解决类似题目的能力。
4. 所有题目的信息用JSON格式返回。确保返回正确的json并且可以被javascript JSON.parse函数解析. 格式如下：
[
    {
        "type": "select",
        "question": "一星期有几天？",
        "options": ["1", "2", "7", "6"],
        "answer": "7",
        "hint": "查看下日历",
        "thinking": "这是一个关于日期的简单选择题，可以通过查看日历了解。"
    },
    {
        "type": "input",
        "question": "一年有几个月？（请用阿拉伯数字回答）",
        "answer": "12",
        "hint": "一年有365天，一个月大概有30天。",
        "thinking": "这是一个关于日期的简单选择题，可以通过查看日历了解。"
    }
]
`;
    const prompts = [];
    const qNumSelectQuery = 5;
    const qNumInputQuery = 0;
    const qNumQuery = qNumSelectQuery + qNumInputQuery;
    //const qNumQuery = qNum;
    for (let i = 0; i < qNum / qNumQuery; i++) {
        const randomSeed = Math.floor(10000000 + Math.random() * 90000000);
        prompts.push(
            "# 题目内容范围如下："  + "\n"
            + qPrompt + "\n"
            + "# 题目要求如下："  + "\n"
            + prompt + "\n"
            + `5. 根据随机数种子(${randomSeed})，生成随机数(000000-999999)。` + "\n"
            + "6. 完全随机的出题，每个问题无逻辑关联。" + "\n"
            + `7. 按${qNumSelectQuery}:${qNumInputQuery}的比例生成选择题和填空题。` + "\n"
            + `# 请返回${qNumQuery}个问题:`);
    }
    results = await llmChatJson(apiUrl, apiKey, apiModel, prompts, temperature=1.8);
    const questions = [].concat(...results.filter(Array.isArray));
    return questions;
}

async function fetchQuestions(date) {
    logger.log(`获取题目 - 日期:${formatDateKey(date)}`);
    const settings = storage.get('system_settings') || {};
    let questions = [];
    
    // 如果已经有存储的题目，直接返回
    const dateKey = formatDateKey(date);
    const existing = storage.get(dateKey);
    if (existing && existing.questions) {
        logger.log('使用缓存的题目');
        return existing.questions;
    }
    if (!settings.apiUrl || !settings.apiKey) {
        logger.log('使用默认测试数据');
        questions = getDefaultQuestions(date);
    } else {
        try {
            toggleLoading(true, '正在从API获取题目...');
            const questionCount = settings.questionCount || 30;
            questions = await generateQuestions(settings.apiUrl, settings.apiKey, settings.apiModel, settings.apiPrompt, questionCount)
            if (questions.length < (questionCount / 2))
                throw new Error(`题目个数错误: ${questions}`)
            questions.forEach((q, id) => {
                q.id = id;
            });
            console.log("questions:", questions);
            toggleLoading(false);
        } catch (e) {
            logger.log(`API请求失败: ${e.message}`);
            toggleLoading(false);
            throw new Error(`API请求失败: ${e.message}`)
        }
    }
    const record = storage.get(dateKey) || { submitted: false };
    record.questions = questions;
    record.totalQuestions = questions.length;
    storage.set(dateKey, record);
    return questions;
}
