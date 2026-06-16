import { deleteCourseById, deleteWordById, insertCourse, insertWord, loadAppData, updateWordById } from './api.js'
import { statusByMastery } from './constants.js'
import { createPracticeSession, nextQuestion, submitMatchingAnswer } from './practice.js'
import { speak } from './speech.js'
import { clearMessage, setMessage, state } from './state.js'
import { hasSupabaseEnv, supabase } from './supabaseClient.js'
import { clampMastery, parseTags } from './utils.js'
import {
  countWordsByCourse,
  renderCourses,
  renderLogin,
  renderMatchingPractice,
  renderMessage,
  renderSetupHelp,
  renderShell,
  renderStats,
  renderTabs,
  renderUserPanel,
  renderWordForm,
  renderWords
} from './views.js'

const app = document.querySelector('#app')

init()

async function init() {
  renderShell(app)

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

function render() {
  renderUserPanel(hasSupabaseEnv)
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
    matching: renderMatchingPractice,
    stats: renderStats
  }

  if (!renderers[state.activeTab]) {
    state.activeTab = 'words'
  }

  document.querySelector('#content').innerHTML = renderers[state.activeTab]()
  bindCommonEvents()
  bindTabEvents()
}

function bindCommonEvents() {
  document.querySelectorAll('[data-tab]').forEach(button => {
    button.addEventListener('click', () => {
      state.activeTab = button.dataset.tab
      clearMessage()
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

      const { error } = await supabase.auth.signInWithPassword({ email, password })

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

      const { data, error } = await supabase.auth.signUp({ email, password })

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

  document.querySelectorAll('[data-practice-filter]').forEach(input => {
    input.addEventListener('change', () => {
      state.practiceFilters[input.dataset.practiceFilter] = input.value
      if (input.dataset.practiceFilter === 'courseId') {
        state.practiceFilters.tag = 'all'
      }
      state.practice = null
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
  if (wordForm) wordForm.addEventListener('submit', saveWord)

  const courseForm = document.querySelector('#courseForm')
  if (courseForm) courseForm.addEventListener('submit', saveCourse)

  const practiceSetup = document.querySelector('#practiceSetup')
  if (practiceSetup) practiceSetup.addEventListener('submit', startPractice)

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
    button.addEventListener('click', async () => {
      await submitMatchingAnswer(button.dataset.id, getUserId())
      render()
    })
  })

  document.querySelectorAll('[data-action="next-question"]').forEach(button => {
    button.addEventListener('click', () => {
      nextQuestion()
      render()
    })
  })

  document.querySelectorAll('[data-action="restart-practice"]').forEach(button => {
    button.addEventListener('click', () => {
      const courseId = state.practice.courseId
      const tag = state.practice.tag || 'all'
      const count = state.practice.questions.length
      state.practice = null
      createPracticeSession(courseId, count, tag)
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

  const { courses, words, reviews, errors } = await loadAppData(getUserId())
  if (errors.length) setMessage(errors.join('；'), 'error')

  state.courses = courses
  state.words = words
  state.reviews = reviews
}

async function saveCourse(event) {
  event.preventDefault()
  const formData = new FormData(event.target)
  const name = formData.get('name')?.trim()

  if (!name) {
    setMessage('请输入课程名称。', 'error')
    render()
    return
  }

  const payload = {
    user_id: getUserId(),
    name,
    description: formData.get('description')?.trim() || null
  }

  const { error } = await insertCourse(payload)
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

  const { error } = await deleteCourseById(id, getUserId())
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
  const mastery = clampMastery(Number(formData.get('mastery_level') || 0))
  const word = formData.get('word')?.trim()
  const courseId = formData.get('course_id')

  if (!word || !courseId) {
    setMessage('请选择课程并填写英文单词。', 'error')
    render()
    return
  }

  const payload = {
    user_id: getUserId(),
    exam_category: 'TOEIC',
    course_id: courseId,
    word,
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

  const result = state.editingWordId
    ? await updateWordById(state.editingWordId, getUserId(), payload)
    : await insertWord(payload)

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

  const { error } = await deleteWordById(id, getUserId())
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
  const courseId = formData.get('course_id') || 'all'
  const tag = formData.get('tag') || 'all'
  const count = Number(formData.get('count') || 10)
  createPracticeSession(courseId, count, tag)
  render()
}

function getUserId() {
  return state.session.user.id
}
