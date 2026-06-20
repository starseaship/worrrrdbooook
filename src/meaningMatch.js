import { saveMatchingReview } from './api.js'
import { masteryLabels, statusByMastery } from './constants.js'
import { speak } from './speech.js'
import { clearMessage, setMessage, state } from './state.js'
import { escapeAttr, escapeHtml, getMastery, normaliseTags, shuffle } from './utils.js'

const MEANING_TAB = 'meaningMatching'

ensureMeaningState()
queueMicrotask(ensureMeaningTab)

const observer = new MutationObserver(() => {
  ensureMeaningTab()
  if (state.activeTab === MEANING_TAB && !document.querySelector('#meaningPracticePage')) {
    renderMeaningPage()
  }
})

observer.observe(document.body, { childList: true, subtree: true })

function ensureMeaningState() {
  if (!state.meaningPracticeFilters) {
    state.meaningPracticeFilters = {
      courseId: 'all',
      tag: 'all'
    }
  }

  if (typeof state.meaningPractice === 'undefined') {
    state.meaningPractice = null
  }
}

function ensureMeaningTab() {
  ensureMeaningState()
  const tabs = document.querySelector('#tabs')
  if (!tabs || !state.session) return

  let button = tabs.querySelector(`[data-meaning-tab="${MEANING_TAB}"]`)
  if (!button) {
    button = document.createElement('button')
    button.type = 'button'
    button.className = 'nav-button'
    button.dataset.meaningTab = MEANING_TAB
    button.textContent = '含义配对'
    button.addEventListener('click', event => {
      event.preventDefault()
      event.stopPropagation()
      openMeaningPractice()
    })

    const statsTab = tabs.querySelector('[data-tab="stats"]')
    tabs.insertBefore(button, statsTab || null)
  }

  updateMeaningTabState()
}

function openMeaningPractice() {
  ensureMeaningState()
  clearMessage()
  state.practice = null
  state.activeTab = MEANING_TAB
  state.meaningPractice = null
  renderMeaningPage()
}

function updateMeaningTabState() {
  const tabs = document.querySelector('#tabs')
  if (!tabs) return

  tabs.querySelectorAll('.nav-button').forEach(button => {
    const isMeaningButton = button.dataset.meaningTab === MEANING_TAB
    if (state.activeTab === MEANING_TAB) {
      button.classList.toggle('active', isMeaningButton)
    } else if (isMeaningButton) {
      button.classList.remove('active')
    }
  })
}

function renderMeaningPage() {
  ensureMeaningState()
  const content = document.querySelector('#content')
  if (!content) return

  updateMeaningTabState()
  content.innerHTML = state.meaningPractice ? renderMeaningPracticeSession() : renderMeaningPracticeSetup()
  bindMeaningEvents(content)
}

function renderMeaningPracticeSetup() {
  const filters = state.meaningPracticeFilters

  return `
    <section class="card" id="meaningPracticePage">
      <h2 class="card-title">中文含义配对练习</h2>
      <form id="meaningPracticeSetup" class="form-grid">
        <div class="form-grid two">
          <div class="field">
            <label>课程范围</label>
            <select name="course_id" data-meaning-practice-filter="courseId">${renderCourseOptions(filters.courseId, true)}</select>
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
        ${renderMeaningTagFilter()}
        <p class="help-text">看到中文意思后，选择正确的英文单词。六选一练习需要当前筛选范围至少有 6 个带中文解释的单词。</p>
        <button class="primary-button" type="submit">开始练习</button>
      </form>
    </section>
  `
}

function renderMeaningTagFilter() {
  const filters = state.meaningPracticeFilters
  if (filters.courseId === 'all') return ''

  const tags = getTagsForCourse(filters.courseId)
  if (!tags.length) {
    return '<p class="help-text">当前课程还没有可筛选的标签。</p>'
  }

  return `
    <div class="field">
      <label>标签 / 章节</label>
      <select name="tag" data-meaning-practice-filter="tag">
        <option value="all" ${filters.tag === 'all' ? 'selected' : ''}>全部标签</option>
        ${tags.map(tag => `<option value="${escapeAttr(tag)}" ${String(tag) === String(filters.tag) ? 'selected' : ''}>${escapeHtml(tag)}</option>`).join('')}
      </select>
    </div>
  `
}

function renderMeaningPracticeSession() {
  const practice = state.meaningPractice
  const current = practice.questions[practice.index]

  if (practice.finished) {
    const correctCount = practice.answers.filter(answer => answer.isCorrect).length
    const wrongAnswers = practice.answers.filter(answer => !answer.isCorrect)
    return `
      <section class="card" id="meaningPracticePage">
        <h2 class="card-title">练习完成</h2>
        <div class="stats-grid">
          <div class="stat-box"><p class="stat-number">${correctCount}/${practice.answers.length}</p><div class="stat-label">答对数量</div></div>
          <div class="stat-box"><p class="stat-number">${Math.round((correctCount / Math.max(practice.answers.length, 1)) * 100)}%</p><div class="stat-label">正确率</div></div>
          <div class="stat-box"><p class="stat-number">${wrongAnswers.length}</p><div class="stat-label">错词数量</div></div>
        </div>
        ${wrongAnswers.length ? `
          <h3 class="card-title" style="margin-top: 18px;">错词</h3>
          <div class="word-list">
            ${wrongAnswers.map(answer => renderMeaningWordCard(answer.word)).join('')}
          </div>
        ` : '<p class="alert" style="margin-top: 14px;">这一组没有错词。</p>'}
        <div class="button-row" style="margin-top: 16px;">
          <button class="primary-button" data-meaning-action="restart-practice">再练一组</button>
          <button class="secondary-button" data-meaning-action="finish-practice">回到设置</button>
        </div>
      </section>
    `
  }

  return `
    <section class="card" id="meaningPracticePage">
      <div class="word-meta">${practice.index + 1} / ${practice.questions.length} · ${escapeHtml(getCourseName(current.word.course_id))}${practice.tag && practice.tag !== 'all' ? ` · ${escapeHtml(practice.tag)}` : ''}</div>
      <h2 class="card-title">选择正确的英文单词</h2>
      <p class="practice-question">${escapeHtml(current.word.meaning_zh || '')}</p>
      ${practice.lastResult ? '' : `
        <div class="option-grid">
          ${current.options.map(option => `<button class="option-button" data-meaning-action="choose-option" data-id="${escapeAttr(option.id)}">${escapeHtml(option.word)}</button>`).join('')}
        </div>
      `}
      ${practice.lastResult ? renderMeaningLastResult(practice.lastResult) : ''}
    </section>
  `
}

function renderMeaningLastResult(result) {
  return `
    <div class="result-panel ${result.isCorrect ? 'correct' : 'wrong'}">
      <strong>${result.isCorrect ? '正确' : '错误'}</strong>
      <p>正确答案：${escapeHtml(result.word.word)} <button class="icon-button" data-meaning-speak="${escapeAttr(result.word.word)}">🔊</button></p>
      <p>中文：${escapeHtml(result.word.meaning_zh || '未填写')}</p>
      <p>English：${escapeHtml(result.word.meaning_en || 'No definition yet.')}</p>
      ${result.word.ai_example_sentence ? `<p>${escapeHtml(result.word.ai_example_sentence)} <button class="icon-button" data-meaning-speak="${escapeAttr(result.word.ai_example_sentence)}">🔊</button></p>` : ''}
      <button class="primary-button" data-meaning-action="next-question">下一题</button>
    </div>
  `
}

function renderMeaningWordCard(word) {
  const tags = normaliseTags(word.tags)

  return `
    <article class="word-card">
      <div class="word-top">
        <div>
          <h3 class="word-title">${escapeHtml(word.word)} <button class="icon-button" data-meaning-speak="${escapeAttr(word.word)}">🔊</button></h3>
          <div class="word-meta">${escapeHtml(getCourseName(word.course_id))} · ${escapeHtml(word.part_of_speech || '未设置词性')}</div>
        </div>
        <span class="status-pill">${masteryLabels[getMastery(word)]}</span>
      </div>
      <p class="word-meaning"><strong>中文：</strong>${escapeHtml(word.meaning_zh || '未填写')}</p>
      <p class="word-meaning"><strong>English：</strong>${escapeHtml(word.meaning_en || 'No definition yet.')}</p>
      ${word.ai_example_sentence ? `
        <div class="example-box">
          <div>${escapeHtml(word.ai_example_sentence)} <button class="icon-button" data-meaning-speak="${escapeAttr(word.ai_example_sentence)}">🔊</button></div>
          ${word.example_translation ? `<div class="example-translation">${escapeHtml(word.example_translation)}</div>` : ''}
        </div>
      ` : ''}
      ${tags.length ? `<div class="tag-row">${tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
    </article>
  `
}

function bindMeaningEvents(container) {
  container.querySelector('#meaningPracticeSetup')?.addEventListener('submit', event => {
    event.preventDefault()
    const formData = new FormData(event.target)
    const courseId = formData.get('course_id') || 'all'
    const tag = formData.get('tag') || 'all'
    const count = Number(formData.get('count') || 10)
    createMeaningPracticeSession(courseId, count, tag)
    renderMeaningPage()
  })

  container.querySelectorAll('[data-meaning-practice-filter]').forEach(input => {
    input.addEventListener('change', () => {
      const filters = state.meaningPracticeFilters
      filters[input.dataset.meaningPracticeFilter] = input.value
      if (input.dataset.meaningPracticeFilter === 'courseId') {
        filters.tag = 'all'
      }
      state.meaningPractice = null
      renderMeaningPage()
    })
  })

  container.querySelectorAll('[data-meaning-action="choose-option"]').forEach(button => {
    button.addEventListener('click', () => {
      const savePromise = submitMeaningMatchingAnswer(button.dataset.id, getUserId())
      renderMeaningPage()
      if (savePromise && typeof savePromise.then === 'function') {
        savePromise.then(saved => {
          if (saved === false || state.message?.type === 'error') renderMeaningPage()
        })
      }
    })
  })

  container.querySelectorAll('[data-meaning-action="next-question"]').forEach(button => {
    button.addEventListener('click', () => {
      nextMeaningQuestion()
      renderMeaningPage()
    })
  })

  container.querySelectorAll('[data-meaning-action="restart-practice"]').forEach(button => {
    button.addEventListener('click', () => {
      const practice = state.meaningPractice
      const courseId = practice.courseId
      const tag = practice.tag || 'all'
      const count = practice.questions.length
      state.meaningPractice = null
      createMeaningPracticeSession(courseId, count, tag)
      renderMeaningPage()
    })
  })

  container.querySelectorAll('[data-meaning-action="finish-practice"]').forEach(button => {
    button.addEventListener('click', () => {
      state.meaningPractice = null
      renderMeaningPage()
    })
  })

  container.querySelectorAll('[data-meaning-speak]').forEach(button => {
    button.addEventListener('click', () => speak(button.dataset.meaningSpeak))
  })
}

function createMeaningPracticeSession(courseId, count, tag = 'all') {
  const courseWords = state.words.filter(word => courseId === 'all' || String(word.course_id) === String(courseId))
  const taggedWords = tag === 'all'
    ? courseWords
    : courseWords.filter(word => normaliseTags(word.tags).some(item => String(item) === String(tag)))
  const usable = taggedWords.filter(word => word.word && word.meaning_zh)

  if (usable.length < 6) {
    setMessage('当前筛选范围至少需要 6 个带中文解释的单词。请换一个课程或标签。', 'error')
    return false
  }

  const selected = shuffle(usable).slice(0, Math.min(count, usable.length))
  state.message = null
  state.meaningPractice = {
    courseId,
    tag,
    index: 0,
    questions: selected.map(word => ({
      word,
      options: shuffle([word, ...shuffle(usable.filter(item => String(item.id) !== String(word.id))).slice(0, 5)])
    })),
    answers: [],
    lastResult: null,
    finished: false
  }

  return true
}

function submitMeaningMatchingAnswer(selectedId, userId) {
  if (!state.meaningPractice || state.meaningPractice.lastResult) return null

  const question = state.meaningPractice.questions[state.meaningPractice.index]
  const selected = question.options.find(option => String(option.id) === String(selectedId))
  const isCorrect = String(selectedId) === String(question.word.id)
  return recordMeaningAnswer({ word: question.word, userAnswer: selected?.word || '', isCorrect, userId })
}

function nextMeaningQuestion() {
  if (!state.meaningPractice) return
  state.meaningPractice.lastResult = null
  if (state.meaningPractice.index + 1 >= state.meaningPractice.questions.length) {
    state.meaningPractice.finished = true
  } else {
    state.meaningPractice.index += 1
  }
}

function recordMeaningAnswer({ word, userAnswer, isCorrect, userId }) {
  const currentMastery = getMastery(word)
  const newMastery = isCorrect ? Math.min(currentMastery + 1, 3) : Math.max(currentMastery - 1, 0)
  const now = new Date().toISOString()

  const reviewPayload = {
    user_id: userId,
    vocabulary_id: word.id,
    course_id: word.course_id,
    mode: 'matching',
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

  const updatedWord = { ...word, ...updatePayload }
  state.meaningPractice.answers.push({ word: updatedWord, userAnswer, isCorrect })
  state.meaningPractice.lastResult = { word: updatedWord, userAnswer, isCorrect }
  state.words = state.words.map(item => String(item.id) === String(word.id) ? updatedWord : item)

  return saveMatchingReview({
    reviewPayload,
    updatePayload,
    wordId: word.id,
    userId
  })
    .then(({ reviewResult, updateResult }) => {
      const noUpdatedWord = Array.isArray(updateResult.data) && updateResult.data.length === 0
      if (reviewResult.error || updateResult.error || noUpdatedWord) {
        setMessage(reviewResult.error?.message || updateResult.error?.message || '没有找到可以更新的单词。请刷新数据后再试。', 'error')
        return false
      }
      state.reviews.unshift(reviewPayload)
      return true
    })
    .catch(error => {
      setMessage(error?.message || '保存练习记录失败，请检查网络后刷新重试。', 'error')
      return false
    })
}

function renderCourseOptions(selectedId = 'all', includeAll = false) {
  const allOption = includeAll ? `<option value="all" ${selectedId === 'all' ? 'selected' : ''}>全部课程</option>` : ''
  return `${allOption}${state.courses.map(course => `<option value="${escapeAttr(course.id)}" ${String(course.id) === String(selectedId) ? 'selected' : ''}>${escapeHtml(course.name)}</option>`).join('')}`
}

function getCourseName(courseId) {
  return state.courses.find(course => String(course.id) === String(courseId))?.name || '未分类'
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

function getUserId() {
  return state.session.user.id
}
