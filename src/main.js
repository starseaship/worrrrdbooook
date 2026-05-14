import { hasSupabaseEnv, supabase } from './supabaseClient.js'
import { speak } from './speech.js'

const masteryLabels = ['未学习', '学习中', '基本记得', '已掌握']
const statusByMastery = ['unmastered', 'uncertain', 'uncertain', 'mastered']
const tabs = [
  { id: 'words', label: '单词表' },
  { id: 'add', label: '录入单词' },
  { id: 'courses', label: '课程管理' },
  { id: 'spelling', label: '例句拼写' },
  { id: 'matching', label: '解释配对' },
  { id: 'stats', label: '学习统计' }
]

const state = {
  session: null,
  activeTab: 'words',
  courses: [],
  words: [],
  reviews: [],
  filters: {
    courseId: 'all',
    mastery: 'all',
    search: ''
  },
  editingWordId: null,
  message: null,
  practice: null
}

const app = document.querySelector('#app')

init()

async function init() {
  renderShell()

  if (!hasSupabaseEnv) {
    setMessage('请先复制 .env.example 为 .env.local，并填入 Supabase URL 与 anon key。', 'error')
    render()
    return
  }

  const { data } = await supabase.auth.getSession()
  state.session = data.session

  supabase.auth.onAuthStateChange(async (_event, session) => {
    state.session = session
    state.practice = null
    await loadAll()
    render()
  })

  if (state.session) {
    await loadAll()
  }

  render()
}

function renderShell() {
  app.innerHTML = `
    <main class="app-shell">
      <header class="app-header">
        <div>
          <h1 class="app-title">Light Vocabulary Book</h1>
          <p class="app-subtitle">按课程整理单词，用例句拼写和英文解释配对练习。</p>
        </div>
        <div class="user-panel" id="userPanel"></div>
      </header>
      <nav class="nav-tabs" id="tabs"></nav>
      <div id="message"></div>
      <section id="content"></section>
    </main>
  `
}

function render() {
  renderUserPanel()
  renderTabs()
  renderMessage()

  if (!hasSupabaseEnv) {
    document.querySelector('#content').innerHTML = renderSetupHelp()
    bindCommonEvents()
    return
  }

  if (!state.session) {
    document.querySelector('#content').innerHTML = renderLogin()
    bindLoginEvents()
    return
  }

  const renderers = {
    words: renderWords,
    add: renderWordForm,
    courses: renderCourses,
    spelling: () => renderPractice('spelling'),
    matching: () => renderPractice('matching'),
    stats: renderStats
  }

  document.querySelector('#content').innerHTML = renderers[state.activeTab]()
  bindCommonEvents()
  bindTabEvents()
}

function renderUserPanel() {
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

function renderTabs() {
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

function renderMessage() {
  const el = document.querySelector('#message')
  if (!state.message) {
    el.innerHTML = ''
    return
  }

  el.innerHTML = `<div class="alert ${state.message.type === 'error' ? 'error' : ''}">${escapeHtml(state.message.text)}</div>`
}

function renderSetupHelp() {
  return `
    <div class="card">
      <h2 class="card-title">环境变量未配置</h2>
      <p class="help-text">这个项目需要连接 Supabase。请在 Vercel 的 Environment Variables 里填写：</p>
      <pre class="alert">VITE_SUPABASE_URL=https://你的项目.supabase.co\nVITE_SUPABASE_ANON_KEY=你的 anon key</pre>
      <p class="help-text">部署后会通过 <code>/api/config</code> 读取 Vercel 环境变量。</p>
    </div>
  `
}

function renderLogin() {
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
        <p class="help-text">先注册一次账号。建议在 Supabase 的 Email 设置里关闭 Confirm email，这样注册后可以直接登录。</p>
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

function renderWords() {
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

function renderWordCard(word) {
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
        <button class="small-button" data-action="edit-word" data-id="${word.id}">编辑</button>
        <button class="danger-button" data-action="delete-word" data-id="${word.id}">删除</button>
      </div>
    </article>
  `
}

function renderWordForm() {
  const editing = state.editingWordId ? state.words.find(word => word.id === state.editingWordId) : null
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

function renderCourses() {
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
                  <button class="danger-button" data-action="delete-course" data-id="${course.id}">删除</button>
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

function renderPractice(mode) {
  const title = mode === 'spelling' ? '例句拼写练习' : '英文解释配对练习'
  if (state.practice?.mode === mode) {
    return renderPracticeSession()
  }

  return `
    <section class="card">
      <h2 class="card-title">${title}</h2>
      <form id="practiceSetup" class="form-grid" data-mode="${mode}">
        <div class="form-grid two">
          <div class="field">
            <label>课程范围</label>
            <select name="course_id">${renderCourseOptions('all', true)}</select>
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
        ${mode === 'matching' ? '<p class="help-text">六选一练习需要当前课程至少有 6 个带英文解释的单词。选项不会混入其他课程。</p>' : '<p class="help-text">系统会优先使用英文例句挖空目标单词。大小写和前后空格不影响判定。</p>'}
        <button class="primary-button" type="submit">开始练习</button>
      </form>
    </section>
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

  if (practice.mode === 'spelling') {
    return `
      <section class="card">
        <div class="word-meta">${practice.index + 1} / ${practice.questions.length} · ${escapeHtml(getCourseName(current.course_id))}</div>
        <h2 class="card-title">根据例句拼写单词</h2>
        <p class="practice-question">${renderBlankSentence(current)}</p>
        <p class="help-text">中文：${escapeHtml(current.meaning_zh || '未填写')}</p>
        ${practice.lastResult ? '' : `
          <form id="spellingAnswer" class="form-grid">
            <div class="field">
              <label>你的答案</label>
              <input name="answer" autocomplete="off" autofocus />
            </div>
            <button class="primary-button" type="submit">提交答案</button>
          </form>
        `}
        ${practice.lastResult ? renderLastResult(practice.lastResult) : ''}
      </section>
    `
  }

  return `
    <section class="card">
      <div class="word-meta">${practice.index + 1} / ${practice.questions.length} · ${escapeHtml(getCourseName(current.word.course_id))}</div>
      <h2 class="card-title">选择正确的单词</h2>
      <p class="practice-question">${escapeHtml(current.word.meaning_en || '')}</p>
      ${practice.lastResult ? '' : `
        <div class="option-grid">
          ${current.options.map(option => `<button class="option-button" data-action="choose-option" data-id="${option.id}">${escapeHtml(option.word)}</button>`).join('')}
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

function renderStats() {
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

function renderCourseStats(course) {
  const words = state.words.filter(word => word.course_id === course.id)
  const reviews = state.reviews.filter(review => review.course_id === course.id)
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

function bindCommonEvents() {
  document.querySelectorAll('[data-tab]').forEach(button => {
    button.addEventListener('click', () => {
      state.activeTab = button.dataset.tab
      state.message = null
      state.practice = null
      render()
    })
  })

  document.querySelectorAll('[data-speak]').forEach(button => {
    button.addEventListener('click', () => speak(button.dataset.speak))
  })

  document.querySelectorAll('[data-action="sign-out"]').forEach(button => {
    button.addEventListener('click', async () => {
      await supabase.auth.signOut()
    })
  })

  document.querySelectorAll('[data-action="reload"]').forEach(button => {
    button.addEventListener('click', async () => {
      await loadAll()
      setMessage('数据已刷新。')
      render()
    })
  })
}

function bindLoginEvents() {
  const loginForm = document.querySelector('#loginForm')
  if (loginForm) {
    loginForm.addEventListener('submit', async event => {
      event.preventDefault()
      const formData = new FormData(loginForm)
      const email = formData.get('email')?.trim()
      const password = formData.get('password')

      if (!email || !password) {
        setMessage('请输入邮箱和密码。', 'error')
        render()
        return
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        setMessage(error.message, 'error')
      } else {
        setMessage('登录成功。')
      }
      render()
    })
  }

  const signupForm = document.querySelector('#signupForm')
  if (signupForm) {
    signupForm.addEventListener('submit', async event => {
      event.preventDefault()
      const formData = new FormData(signupForm)
      const email = formData.get('email')?.trim()
      const password = formData.get('password')

      if (!email || !password) {
        setMessage('请输入邮箱和密码。', 'error')
        render()
        return
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password
      })

      if (error) {
        setMessage(error.message, 'error')
      } else if (data.session) {
        state.session = data.session
        await loadAll()
        setMessage('注册成功，已登录。')
      } else {
        setMessage('注册成功。若 Supabase 仍开启邮箱确认，请先确认邮箱后再登录。')
      }
      render()
    })
  }
}

function bindTabEvents() {
  document.querySelectorAll('[data-filter]').forEach(input => {
    input.addEventListener('input', () => {
      state.filters[input.dataset.filter] = input.value
      render()
    })
    input.addEventListener('change', () => {
      state.filters[input.dataset.filter] = input.value
      render()
    })
  })

  document.querySelectorAll('[data-action="go-add"]').forEach(button => {
    button.addEventListener('click', () => {
      state.editingWordId = null
      state.activeTab = 'add'
      render()
    })
  })

  const wordForm = document.querySelector('#wordForm')
  if (wordForm) {
    wordForm.addEventListener('submit', saveWord)
  }

  const courseForm = document.querySelector('#courseForm')
  if (courseForm) {
    courseForm.addEventListener('submit', saveCourse)
  }

  const practiceSetup = document.querySelector('#practiceSetup')
  if (practiceSetup) {
    practiceSetup.addEventListener('submit', startPractice)
  }

  const spellingAnswer = document.querySelector('#spellingAnswer')
  if (spellingAnswer) {
    spellingAnswer.addEventListener('submit', submitSpellingAnswer)
  }

  document.querySelectorAll('[data-action="edit-word"]').forEach(button => {
    button.addEventListener('click', () => {
      state.editingWordId = button.dataset.id
      state.activeTab = 'add'
      render()
    })
  })

  document.querySelectorAll('[data-action="delete-word"]').forEach(button => {
    button.addEventListener('click', () => deleteWord(button.dataset.id))
  })

  document.querySelectorAll('[data-action="delete-course"]').forEach(button => {
    button.addEventListener('click', () => deleteCourse(button.dataset.id))
  })

  document.querySelectorAll('[data-action="cancel-edit"]').forEach(button => {
    button.addEventListener('click', () => {
      state.editingWordId = null
      render()
    })
  })

  document.querySelectorAll('[data-action="choose-option"]').forEach(button => {
    button.addEventListener('click', () => submitMatchingAnswer(button.dataset.id))
  })

  document.querySelectorAll('[data-action="next-question"]').forEach(button => {
    button.addEventListener('click', nextQuestion)
  })

  document.querySelectorAll('[data-action="restart-practice"]').forEach(button => {
    button.addEventListener('click', () => {
      const mode = state.practice.mode
      const courseId = state.practice.courseId
      const count = state.practice.questions.length
      state.practice = null
      createPracticeSession(mode, courseId, count)
      render()
    })
  })

  document.querySelectorAll('[data-action="finish-practice"]').forEach(button => {
    button.addEventListener('click', () => {
      state.practice = null
      render()
    })
  })
}

async function loadAll() {
  if (!state.session || !supabase) return

  const [coursesResult, wordsResult, reviewsResult] = await Promise.all([
    supabase.from('courses').select('*').order('name'),
    supabase.from('vocabulary_items').select('*').order('created_at', { ascending: false }),
    supabase.from('vocabulary_reviews').select('*').order('reviewed_at', { ascending: false }).limit(500)
  ])

  if (coursesResult.error) setMessage(coursesResult.error.message, 'error')
  if (wordsResult.error) setMessage(wordsResult.error.message, 'error')
  if (reviewsResult.error) setMessage(reviewsResult.error.message, 'error')

  state.courses = coursesResult.data || []
  state.words = wordsResult.data || []
  state.reviews = reviewsResult.data || []
}

async function saveCourse(event) {
  event.preventDefault()
  const formData = new FormData(event.target)
  const payload = {
    user_id: state.session.user.id,
    name: formData.get('name')?.trim(),
    description: formData.get('description')?.trim() || null
  }

  const { error } = await supabase.from('courses').insert(payload)
  if (error) {
    setMessage(error.message, 'error')
  } else {
    setMessage('课程已保存。')
    event.target.reset()
    await loadAll()
  }
  render()
}

async function deleteCourse(id) {
  const wordCount = countWordsByCourse(id)
  if (wordCount > 0) {
    setMessage('这个课程下还有单词，不能直接删除。请先移动或删除这些单词。', 'error')
    render()
    return
  }

  if (!window.confirm('确定要删除这个课程吗？')) return
  const { error } = await supabase.from('courses').delete().eq('id', id)
  if (error) {
    setMessage(error.message, 'error')
  } else {
    setMessage('课程已删除。')
    await loadAll()
  }
  render()
}

async function saveWord(event) {
  event.preventDefault()
  const formData = new FormData(event.target)
  const mastery = Number(formData.get('mastery_level') || 0)
  const payload = {
    user_id: state.session.user.id,
    exam_category: 'TOEIC',
    course_id: formData.get('course_id'),
    word: formData.get('word')?.trim(),
    meaning_zh: formData.get('meaning_zh')?.trim() || null,
    meaning_en: formData.get('meaning_en')?.trim() || null,
    part_of_speech: formData.get('part_of_speech')?.trim() || null,
    ai_example_sentence: formData.get('ai_example_sentence')?.trim() || null,
    example_translation: formData.get('example_translation')?.trim() || null,
    tags: parseTags(formData.get('tags')),
    mastery_level: mastery,
    status: statusByMastery[mastery],
    note: formData.get('note')?.trim() || null,
    updated_at: new Date().toISOString()
  }

  let result
  if (state.editingWordId) {
    result = await supabase.from('vocabulary_items').update(payload).eq('id', state.editingWordId)
  } else {
    result = await supabase.from('vocabulary_items').insert(payload)
  }

  if (result.error) {
    setMessage(result.error.message, 'error')
  } else {
    setMessage(state.editingWordId ? '单词已更新。' : '单词已保存。')
    state.editingWordId = null
    state.activeTab = 'words'
    await loadAll()
  }
  render()
}

async function deleteWord(id) {
  if (!window.confirm('确定要删除这个单词吗？')) return
  const { error } = await supabase.from('vocabulary_items').delete().eq('id', id)
  if (error) {
    setMessage(error.message, 'error')
  } else {
    setMessage('单词已删除。')
    await loadAll()
  }
  render()
}

function startPractice(event) {
  event.preventDefault()
  const formData = new FormData(event.target)
  const mode = event.target.dataset.mode
  const courseId = formData.get('course_id') || 'all'
  const count = Number(formData.get('count') || 10)
  createPracticeSession(mode, courseId, count)
  render()
}

function createPracticeSession(mode, courseId, count) {
  const courseWords = state.words.filter(word => courseId === 'all' || word.course_id === courseId)

  if (mode === 'spelling') {
    const usable = courseWords.filter(word => word.word)
    if (!usable.length) {
      setMessage('当前课程范围内还没有可练习的单词。', 'error')
      return
    }
    state.message = null
    state.practice = {
      mode,
      courseId,
      index: 0,
      questions: shuffle(usable).slice(0, count),
      answers: [],
      lastResult: null,
      finished: false
    }
    return
  }

  const usable = courseWords.filter(word => word.word && word.meaning_en)
  if (usable.length < 6) {
    setMessage('英文解释配对需要当前课程至少有 6 个带英文解释的单词。系统不会混入其他课程。', 'error')
    return
  }

  const selected = shuffle(usable).slice(0, Math.min(count, usable.length))
  state.message = null
  state.practice = {
    mode,
    courseId,
    index: 0,
    questions: selected.map(word => ({
      word,
      options: shuffle([word, ...shuffle(usable.filter(item => item.id !== word.id)).slice(0, 5)])
    })),
    answers: [],
    lastResult: null,
    finished: false
  }
}

async function submitSpellingAnswer(event) {
  event.preventDefault()
  const answer = new FormData(event.target).get('answer')?.trim() || ''
  const word = state.practice.questions[state.practice.index]
  const isCorrect = normaliseAnswer(answer) === normaliseAnswer(word.word)
  await recordAnswer({ word, mode: 'spelling', userAnswer: answer, isCorrect })
}

async function submitMatchingAnswer(selectedId) {
  const question = state.practice.questions[state.practice.index]
  const selected = question.options.find(option => option.id === selectedId)
  const isCorrect = selectedId === question.word.id
  await recordAnswer({ word: question.word, mode: 'matching', userAnswer: selected?.word || '', isCorrect })
}

async function recordAnswer({ word, mode, userAnswer, isCorrect }) {
  const currentMastery = getMastery(word)
  const newMastery = isCorrect ? Math.min(currentMastery + 1, 3) : Math.max(currentMastery - 1, 0)
  const now = new Date().toISOString()

  const reviewPayload = {
    user_id: state.session.user.id,
    vocabulary_id: word.id,
    course_id: word.course_id,
    mode,
    user_answer: userAnswer,
    correct_answer: word.word,
    is_correct: isCorrect,
    reviewed_at: now
  }

  const updatePayload = {
    mastery_level: newMastery,
    status: statusByMastery[newMastery],
    review_count: (word.review_count || 0) + 1,
    last_reviewed_at: now,
    updated_at: now
  }

  const [reviewResult, updateResult] = await Promise.all([
    supabase.from('vocabulary_reviews').insert(reviewPayload),
    supabase.from('vocabulary_items').update(updatePayload).eq('id', word.id)
  ])

  if (reviewResult.error || updateResult.error) {
    setMessage(reviewResult.error?.message || updateResult.error?.message, 'error')
    render()
    return
  }

  const updatedWord = { ...word, ...updatePayload }
  state.practice.answers.push({ word: updatedWord, userAnswer, isCorrect })
  state.practice.lastResult = { word: updatedWord, userAnswer, isCorrect }

  state.words = state.words.map(item => item.id === word.id ? updatedWord : item)
  state.reviews.unshift(reviewPayload)
  render()
}

function nextQuestion() {
  if (!state.practice) return
  state.practice.lastResult = null
  if (state.practice.index + 1 >= state.practice.questions.length) {
    state.practice.finished = true
  } else {
    state.practice.index += 1
  }
  render()
}

function getFilteredWords() {
  const search = state.filters.search.trim().toLowerCase()
  return state.words.filter(word => {
    const matchesCourse = state.filters.courseId === 'all' || word.course_id === state.filters.courseId
    const matchesMastery = state.filters.mastery === 'all' || String(getMastery(word)) === state.filters.mastery
    const haystack = [word.word, word.meaning_zh, word.meaning_en, word.ai_example_sentence, word.example_translation, word.note, ...normaliseTags(word.tags)].join(' ').toLowerCase()
    const matchesSearch = !search || haystack.includes(search)
    return matchesCourse && matchesMastery && matchesSearch
  })
}

function renderCourseOptions(selectedId = 'all', includeAll = false) {
  return `${includeAll ? `<option value="all" ${selectedId === 'all' ? 'selected' : ''}>全部课程</option>` : ''}${state.courses.map(course => `<option value="${course.id}" ${course.id === selectedId ? 'selected' : ''}>${escapeHtml(course.name)}</option>`).join('')}`
}

function getCourseName(courseId) {
  return state.courses.find(course => course.id === courseId)?.name || '未分类'
}

function countWordsByCourse(courseId) {
  return state.words.filter(word => word.course_id === courseId).length
}

function getMastery(word) {
  if (!word) return 0
  const value = Number(word.mastery_level)
  if (Number.isFinite(value) && value >= 0 && value <= 3) return value
  if (word.status === 'mastered') return 3
  if (word.status === 'uncertain') return 1
  return 0
}

function renderBlankSentence(word) {
  const sentence = word.ai_example_sentence || `${word.meaning_zh || word.meaning_en || '这个单词'}：${word.word}`
  const escapedSentence = escapeHtml(sentence)
  const escapedWord = escapeRegExp(word.word)
  const regex = new RegExp(escapedWord, 'i')
  if (regex.test(escapedSentence)) {
    return escapedSentence.replace(regex, '<span class="blank">blank</span>')
  }
  return `${escapedSentence}<br><span class="blank">blank</span>`
}

function parseTags(value) {
  if (!value) return []
  return String(value).split(',').map(tag => tag.trim()).filter(Boolean)
}

function normaliseTags(tags) {
  if (!tags) return []
  if (Array.isArray(tags)) return tags.filter(Boolean)
  if (typeof tags === 'string') return parseTags(tags)
  return []
}

function normaliseAnswer(value) {
  return String(value || '').trim().toLowerCase()
}

function shuffle(items) {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function setMessage(text, type = 'info') {
  state.message = { text, type }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll('`', '&#096;')
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
