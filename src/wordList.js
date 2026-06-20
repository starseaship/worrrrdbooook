import { masteryLabels } from './constants.js'
import { state } from './state.js'
import { escapeAttr, escapeHtml, getMastery, normaliseTags } from './utils.js'
import { getCourseName, renderCourseOptions } from './views.js'

const WORDS_PER_PAGE = 10

export function renderWords() {
  const visibleWords = getFilteredWords()
  const pageCount = Math.max(1, Math.ceil(visibleWords.length / WORDS_PER_PAGE))
  const currentPage = clampPage(Number(state.filters.page || 1), pageCount)
  state.filters.page = String(currentPage)

  const start = (currentPage - 1) * WORDS_PER_PAGE
  const pageWords = visibleWords.slice(start, start + WORDS_PER_PAGE)

  return `
    <section class="card">
      <div class="toolbar compact-toolbar">
        <div class="field search-field">
          <label>搜索</label>
          <input data-filter="search" value="${escapeAttr(state.filters.search)}" placeholder="输入单词、中文、英文解释或例句" />
        </div>
        <div class="field filter-field">
          <label>课程</label>
          <select data-filter="courseId">${renderCourseOptions(state.filters.courseId, true)}</select>
        </div>
        <div class="field filter-field">
          <label>掌握程度</label>
          <select data-filter="mastery">
            <option value="all" ${state.filters.mastery === 'all' ? 'selected' : ''}>全部</option>
            ${masteryLabels.map((label, index) => `<option value="${index}" ${String(index) === state.filters.mastery ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="button-row word-actions">
        <button class="primary-button" data-action="go-add">新增单词</button>
        <button class="secondary-button" data-action="reload">刷新数据</button>
      </div>
      ${visibleWords.length ? `
        <div class="word-list">${pageWords.map(renderWordCard).join('')}</div>
        ${renderWordPagination(currentPage, pageCount, visibleWords.length)}
      ` : '<div class="empty">当前筛选范围内还没有单词。</div>'}
    </section>
  `
}

function renderWordCard(word) {
  const courseName = getCourseName(word.course_id)
  const tags = normaliseTags(word.tags)
  return `
    <details class="word-card">
      <summary class="word-title">${escapeHtml(word.word)}</summary>
      <div class="word-top" style="margin-top: 12px;">
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
    </details>
  `
}

function renderWordPagination(currentPage, pageCount, total) {
  if (pageCount <= 1) {
    return `<p class="help-text word-count">共 ${total} 个单词。</p>`
  }

  const options = Array.from({ length: pageCount }, (_item, index) => {
    const page = index + 1
    return `<option value="${page}" ${page === currentPage ? 'selected' : ''}>第 ${page} 页</option>`
  }).join('')

  return `
    <div class="pagination-bar">
      <button class="secondary-button page-button" data-action="prev-word-page" ${currentPage === 1 ? 'disabled' : ''}>上一页</button>
      <div class="field page-select-field">
        <label>共 ${total} 个单词 · 每页 ${WORDS_PER_PAGE} 个</label>
        <select data-filter="page">${options}</select>
      </div>
      <button class="secondary-button page-button" data-action="next-word-page" ${currentPage === pageCount ? 'disabled' : ''}>下一页</button>
    </div>
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

function clampPage(page, pageCount) {
  if (!Number.isFinite(page)) return 1
  return Math.min(Math.max(Math.trunc(page), 1), pageCount)
}
