import { masteryLabels, tabs } from './constants.js'
import { state } from './state.js'
import { escapeAttr, escapeHtml, getMastery, normaliseTags } from './utils.js'

export function renderShell(app) {
  app.innerHTML = `
    <main class="app-shell">
      <header class="app-header">
        <div>
          <h1 class="app-title">Light Vocabulary Book</h1>
          <p class="app-subtitle">按课程整理单词，用英文解释配对练习。</p>
        </div>
        <div class="user-panel" id="userPanel"></div>
      </header>
      <nav class="nav-tabs" id="tabs"></nav>
      <div id="message"></div>
      <section id="content"></section>
    </main>
  `
}

export function renderUserPanel(hasSupabaseEnv) {
  const el = document.querySelector('#userPanel')
  if (!hasSupabaseEnv) {
    el.innerHTML = ''
    return
  }

  if (!state.session) {
    el.innerHTML = '<p class="user-email">未登录</p>'
    return
  }

  el.innerHTML = `
    <div class="user-email">${escapeHtml(state.session.user.email || '已登录')}</div>
    <button class="secondary-button" data-action="sign-out">退出登录</button>
  `
}

export function renderTabs() {
  const el = document.querySelector('#tabs')
  if (!state.session) {
    el.innerHTML = ''
    return
  }

  el.innerHTML = tabs.map(tab => `
    <button class="nav-button ${state.activeTab === tab.id ? 'active' : ''}" data-tab="${tab.id}">
      ${tab.label}
    </button>
  `).join('')
}

export function renderMessage() {
  const el = document.querySelector('#message')
  if (!state.message) {
    el.innerHTML = ''
    return
  }

  el.innerHTML = `<div class="alert ${state.message.type === 'error' ? 'error' : ''}">${escapeHtml(state.message.text)}</div>`
}

export function renderSetupHelp() {
  return `
    <div class="card">
      <h2 class="card-title">环境变量未配置</h2>
      <p class="help-text">这个项目需要连接 Supabase。请在 Vercel 的 Environment Variables 里填写：</p>
      <pre class="alert">VITE_SUPABASE_URL=https://你的项目.supabase.co\nVITE_SUPABASE_ANON_KEY=你的 anon key</pre>
      <p class="help-text">部署后会通过 <code>/api/config</code> 读取 Vercel 环境变量。</p>
    </div>
  `
}

export function renderLogin() {
  return `
    <div class="grid two">
      <section class="card">
        <h2 class="card-title">登录</h2>
        <p class="help-text">使用邮箱和密码登录。这个模式不依赖 Magic Link 邮件。</p>
        <form id="loginForm" class="form-grid">
          <div class="field">
            <label for="loginEmail">邮箱</label>
            <input id="loginEmail" name="email" type="email" placeholder="you@example.com" autocomplete="email" required />
          </div>
          <div class="field">
            <label for="loginPassword">密码</label>
            <input id="loginPassword" name="password" type="password" autocomplete="current-password" minlength="6" required />
          </div>
          <button class="primary-button" type="submit">登录</button>
        </form>
      </section>
      <section class="card soft">
        <h2 class="card-title">第一次使用</h2>
        <p class="help-text">先注册一次账号。若 Supabase 仍开启邮箱确认，请先确认邮箱后再登录。</p>
        <form id="signupForm" class="form-grid">
          <div class="field">
            <label for="signupEmail">邮箱</label>
            <input id="signupEmail" name="email" type="email" placeholder="you@example.com" autocomplete="email" required />
          </div>
          <div class="field">
            <label for="signupPassword">密码</label>
            <input id="signupPassword" name="password" type="password" autocomplete="new-password" minlength="6" required />
          </div>
          <button class="secondary-button" type="submit">注册账号</button>
        </form>
      </section>
    </div>
  `
}

export function renderWords() {
  const visibleWords = getFilteredWords()
  return `
    <section class="card">
      <div class="toolbar">
        <div class="field">
          <label>搜索</label>
          <input data-filter="search" value="${escapeAttr(state.filters.search)}" placeholder="输入单词、中文、英文解释或例句" />
        </div>
        <div class="field">
          <label>课程</label>
          <select data-filter="courseId">${renderCourseOptions(state.filters.courseId, true)}</select>
        </div>
        <div class="field">
          <label>掌握程度</label>
          <select data-filter="mastery">
            <option value="all" ${state.filters.mastery === 'all' ? 'selected' : ''}>全部</option>
            ${masteryLabels.map((label, index) => `<option value="${index}" ${String(index) === state.filters.mastery ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="button-row" style="margin-bottom: 14px;">
        <button class="primary-button" data-action="go-add">新增单词</button>
        <button class="secondary-button" data-action="reload">刷新数据</button>
      </div>
      ${visibleWords.length ? `<div class="word-list">${visibleWords.map(renderWordCard).join('')}</div>` : '<div class="empty">当前筛选范围内还没有单词。</div>'}
    </section>
  `
}

export function renderWordCard(word) {
  const courseName = getCourseName(word.course_id)
  const tags = normaliseTags(word.tags)
  return `
    <article class="word-card">
      <div class="word-top">
        <div>
          <h3 class="word-title">${escapeHtml(word.word)} <button class="icon-button" data-speak="${escapeAttr(word.word)}">🔊</button></h3>
          <div class="word-meta">${escapeHtml(courseName)} · ${escapeHtml(word.part_of_speech || '未设置词性')}</div>
        </div>
        <span class="status-pill">${masteryLabels[getMastery(word)]}</span>
      </div>
      <p class="word-meaning"><strong>中文：</strong>${escapeHtml(word.meaning_zh || '未填写')}</p>
      <p class="word-meaning"><strong>English：</strong>${escapeHtml(word.meaning_en || 'No definition yet.')}</p>
      ${word.ai_example_sentence ? `
        <div class="example-box">
          <div>${escapeHtml(word.ai_example_sentence)} <button class="icon-button" data-speak="${escapeAttr(word.ai_example_sentence)}">🔊</button></div>
          ${word.example_translation ? `<div class="example-translation">${escapeHtml(word.example_translation)}</div>` : ''}
        </div>
      ` : ''}
      ${tags.length ? `<div class="tag-row">${tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
      ${word.note ? `<p class="help-text">备注：${escapeHtml(word.note)}</p>` : ''}
      <div class="button-row" style="margin-top: 12px;">
        <button class="small-button" data-action="edit-word" data-id="${escapeAttr(word.id)}">编辑</button>
        <button class="danger-button" data-action="delete-word" data-id="${escapeAttr(word.id)}">删除</button>
      </div>
    </article>
  `
}

export function renderWordForm() {
  const editing = state.editingWordId ? state.words.find(word => String(word.id) === String(state.editingWordId)) : null
  return `
    <section class="card">
      <h2 class="card-title">${editing ? '编辑单词' : '录入单词'}</h2>
      ${state.courses.length ? '' : '<div class="alert">还没有课程。请先去“课程管理”新增课程。</div>'}
      <form id="wordForm" class="form-grid">
        <div class="form-grid two">
          <div class="field">
            <label>课程</label>
            <select name="course_id" required>
              <option value="">请选择课程</option>
              ${renderCourseOptions(editing?.course_id || '', false)}
            </select>
          </div>
          <div class="field">
            <label>英文单词</label>
            <input name="word" value="${escapeAttr(editing?.word || '')}" required placeholder="pollution" />
          </div>
        </div>
        <div class="form-grid two">
          <div class="field">
            <label>中文解释</label>
            <input name="meaning_zh" value="${escapeAttr(editing?.meaning_zh || '')}" placeholder="污染" />
          </div>
          <div class="field">
            <label>词性</label>
            <input name="part_of_speech" value="${escapeAttr(editing?.part_of_speech || '')}" placeholder="noun / verb / adjective" />
          </div>
        </div>
        <div class="field">
          <label>英文解释</label>
          <textarea name="meaning_en" placeholder="harmful substances in air, water, or land">${escapeHtml(editing?.meaning_en || '')}</textarea>
        </div>
        <div class="field">
          <label>英文例句</label>
          <textarea name="ai_example_sentence" placeholder="Air pollution is a serious problem in many cities.">${escapeHtml(editing?.ai_example_sentence || '')}</textarea>
        </div>
        <div class="field">
          <label>例句中文翻译</label>
          <textarea name="example_translation" placeholder="空气污染是许多城市的严重问题。">${escapeHtml(editing?.example_translation || '')}</textarea>
        </div>
        <div class="form-grid two">
          <div class="field">
            <label>标签，用逗号分隔</label>
            <input name="tags" value="${escapeAttr(normaliseTags(editing?.tags).join(', '))}" placeholder="environment, reading" />
          </div>
          <div class="field">
            <label>掌握程度</label>
            <select name="mastery_level">
              ${masteryLabels.map((label, index) => `<option value="${index}" ${getMastery(editing) === index ? 'selected' : ''}>${label}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="field">
          <label>备注</label>
          <textarea name="note" placeholder="可以写老师讲解、易错点、相似词等。">${escapeHtml(editing?.note || '')}</textarea>
        </div>
        <div class="button-row">
          <button class="primary-button" type="submit">${editing ? '保存修改' : '保存单词'}</button>
          ${editing ? '<button class="secondary-button" type="button" data-action="cancel-edit">取消编辑</button>' : ''}
        </div>
      </form>
    </section>
  `
}

export function renderCourses() {
  return `
    <div class="grid two">
      <section class="card">
        <h2 class="card-title">新增课程</h2>
        <form id="courseForm" class="form-grid">
          <div class="field">
            <label>课程名称</label>
            <input name="name" required placeholder="阅读课" />
          </div>
          <div class="field">
            <label>备注</label>
            <textarea name="description" placeholder="例如：每周阅读课单词"></textarea>
          </div>
          <button class="primary-button" type="submit">保存课程</button>
        </form>
      </section>
      <section class="card">
        <h2 class="card-title">课程列表</h2>
        ${state.courses.length ? `
          <div class="word-list">
            ${state.courses.map(course => `
              <article class="word-card">
                <div class="word-top">
                  <div>
                    <h3 class="word-title">${escapeHtml(course.name)}</h3>
                    <div class="word-meta">${countWordsByCourse(course.id)} 个单词</div>
                  </div>
                  <button class="danger-button" data-action="delete-course" data-id="${escapeAttr(course.id)}">删除</button>
                </div>
                ${course.description ? `<p class="help-text">${escapeHtml(course.description)}</p>` : ''}
              </article>
            `).join('')}
          </div>
        ` : '<div class="empty">还没有课程。</div>'}
      </section>
    </div>
  `
}

export function renderMatchingPractice() {
  if (state.practice) return renderPracticeSession()

  return `
    <section class="card">
      <h2 class="card-title">英文解释配对练习</h2>
      <form id="practiceSetup" class="form-grid">
        <div class="form-grid two">
          <div class="field">
            <label>课程范围</label>
            <select name="course_id" data-practice-filter="courseId">${renderCourseOptions(state.practiceFilters.courseId, true)}</select>
          </div>
          <div class="field">
            <label>题目数量</label>
            <select name="count">
              <option value="5">5 题</option>
              <option value="10" selected>10 题</option>
              <option value="15">15 题</option>
              <option value="20">20 题</option>
            </select>
          </div>
        </div>
        ${renderPracticeTagFilter()}
        <p class="help-text">六选一练习需要当前筛选范围至少有 6 个带英文解释的单词。选择课程后可以再按标签或章节筛选。</p>
        <button class="primary-button" type="submit">开始练习</button>
      </form>
    </section>
  `
}

export function renderStats() {
  const total = state.words.length
  const byMastery = masteryLabels.map((_label, index) => state.words.filter(word => getMastery(word) === index).length)
  const reviewCount = state.reviews.length

  return `
    <section class="card">
      <h2 class="card-title">学习统计</h2>
      <div class="stats-grid">
        <div class="stat-box"><p class="stat-number">${total}</p><div class="stat-label">总单词数</div></div>
        <div class="stat-box"><p class="stat-number">${reviewCount}</p><div class="stat-label">练习记录</div></div>
        <div class="stat-box"><p class="stat-number">${byMastery[3]}</p><div class="stat-label">已掌握</div></div>
      </div>
      <h3 class="card-title" style="margin-top: 18px;">按课程统计</h3>
      <div class="word-list">
        ${state.courses.map(course => renderCourseStats(course)).join('') || '<div class="empty">还没有课程。</div>'}
      </div>
    </section>
  `
}

function renderPracticeTagFilter() {
  if (state.practiceFilters.courseId === 'all') return ''

  const tags = getTagsForCourse(state.practiceFilters.courseId)
  if (!tags.length) {
    return '<p class="help-text">当前课程还没有可筛选的标签。</p>'
  }

  return `
    <div class="field">
      <label>标签 / 章节</label>
      <select name="tag" data-practice-filter="tag">
        <option value="all" ${state.practiceFilters.tag === 'all' ? 'selected' : ''}>全部标签</option>
        ${tags.map(tag => `<option value="${escapeAttr(tag)}" ${String(tag) === String(state.practiceFilters.tag) ? 'selected' : ''}>${escapeHtml(tag)}</option>`).join('')}
      </select>
    </div>
  `
}

function renderPracticeSession() {
  const practice = state.practice
  const current = practice.questions[practice.index]

  if (practice.finished) {
    const correctCount = practice.answers.filter(answer => answer.isCorrect).length
    const wrongAnswers = practice.answers.filter(answer => !answer.isCorrect)
    return `
      <section class="card">
        <h2 class="card-title">练习完成</h2>
        <div class="stats-grid">
          <div class="stat-box"><p class="stat-number">${correctCount}/${practice.answers.length}</p><div class="stat-label">答对数量</div></div>
          <div class="stat-box"><p class="stat-number">${Math.round((correctCount / Math.max(practice.answers.length, 1)) * 100)}%</p><div class="stat-label">正确率</div></div>
          <div class="stat-box"><p class="stat-number">${wrongAnswers.length}</p><div class="stat-label">错词数量</div></div>
        </div>
        ${wrongAnswers.length ? `
          <h3 class="card-title" style="margin-top: 18px;">错词</h3>
          <div class="word-list">
            ${wrongAnswers.map(answer => renderWordCard(answer.word)).join('')}
          </div>
        ` : '<p class="alert" style="margin-top: 14px;">这一组没有错词。</p>'}
        <div class="button-row" style="margin-top: 16px;">
          <button class="primary-button" data-action="restart-practice">再练一组</button>
          <button class="secondary-button" data-action="finish-practice">回到设置</button>
        </div>
      </section>
    `
  }

  return `
    <section class="card">
      <div class="word-meta">${practice.index + 1} / ${practice.questions.length} · ${escapeHtml(getCourseName(current.word.course_id))}${practice.tag && practice.tag !== 'all' ? ` · ${escapeHtml(practice.tag)}` : ''}</div>
      <h2 class="card-title">选择正确的单词</h2>
      <p class="practice-question">${escapeHtml(current.word.meaning_en || '')}</p>
      ${practice.lastResult ? '' : `
        <div class="option-grid">
          ${current.options.map(option => `<button class="option-button" data-action="choose-option" data-id="${escapeAttr(option.id)}">${escapeHtml(option.word)}</button>`).join('')}
        </div>
      `}
      ${practice.lastResult ? renderLastResult(practice.lastResult) : ''}
    </section>
  `
}

function renderLastResult(result) {
  return `
    <div class="result-panel ${result.isCorrect ? 'correct' : 'wrong'}">
      <strong>${result.isCorrect ? '正确' : '错误'}</strong>
      <p>正确答案：${escapeHtml(result.word.word)} <button class="icon-button" data-speak="${escapeAttr(result.word.word)}">🔊</button></p>
      <p>中文：${escapeHtml(result.word.meaning_zh || '未填写')}</p>
      <p>English：${escapeHtml(result.word.meaning_en || 'No definition yet.')}</p>
      ${result.word.ai_example_sentence ? `<p>${escapeHtml(result.word.ai_example_sentence)} <button class="icon-button" data-speak="${escapeAttr(result.word.ai_example_sentence)}">🔊</button></p>` : ''}
      <button class="primary-button" data-action="next-question">下一题</button>
    </div>
  `
}

function renderCourseStats(course) {
  const words = state.words.filter(word => String(word.course_id) === String(course.id))
  const reviews = state.reviews.filter(review => String(review.course_id) === String(course.id))
  const mastered = words.filter(word => getMastery(word) === 3).length
  const learning = words.filter(word => getMastery(word) === 1 || getMastery(word) === 2).length
  const correct = reviews.filter(review => review.is_correct).length
  const accuracy = reviews.length ? Math.round((correct / reviews.length) * 100) : 0

  return `
    <article class="word-card">
      <h3 class="word-title">${escapeHtml(course.name)}</h3>
      <div class="stats-grid" style="margin-top: 12px;">
        <div class="stat-box"><p class="stat-number">${words.length}</p><div class="stat-label">单词数</div></div>
        <div class="stat-box"><p class="stat-number">${mastered}</p><div class="stat-label">已掌握</div></div>
        <div class="stat-box"><p class="stat-number">${learning}</p><div class="stat-label">学习中</div></div>
        <div class="stat-box"><p class="stat-number">${reviews.length}</p><div class="stat-label">练习次数</div></div>
        <div class="stat-box"><p class="stat-number">${accuracy}%</p><div class="stat-label">正确率</div></div>
      </div>
    </article>
  `
}

function getFilteredWords() {
  const search = state.filters.search.trim().toLowerCase()
  return state.words.filter(word => {
    const matchesCourse = state.filters.courseId === 'all' || String(word.course_id) === String(state.filters.courseId)
    const matchesMastery = state.filters.mastery === 'all' || String(getMastery(word)) === state.filters.mastery
    const haystack = [word.word, word.meaning_zh, word.meaning_en, word.ai_example_sentence, word.example_translation, word.note, ...normaliseTags(word.tags)]
      .join(' ')
      .toLowerCase()
    const matchesSearch = !search || haystack.includes(search)
    return matchesCourse && matchesMastery && matchesSearch
  })
}

function getTagsForCourse(courseId) {
  const tags = new Set()
  state.words
    .filter(word => String(word.course_id) === String(courseId))
    .forEach(word => {
      normaliseTags(word.tags).forEach(tag => tags.add(tag))
    })
  return [...tags].sort((a, b) => String(a).localeCompare(String(b)))
}

export function renderCourseOptions(selectedId = 'all', includeAll = false) {
  const allOption = includeAll ? `<option value="all" ${selectedId === 'all' ? 'selected' : ''}>全部课程</option>` : ''
  return `${allOption}${state.courses.map(course => `<option value="${escapeAttr(course.id)}" ${String(course.id) === String(selectedId) ? 'selected' : ''}>${escapeHtml(course.name)}</option>`).join('')}`
}

export function getCourseName(courseId) {
  return state.courses.find(course => String(course.id) === String(courseId))?.name || '未分类'
}

export function countWordsByCourse(courseId) {
  return state.words.filter(word => String(word.course_id) === String(courseId)).length
}
