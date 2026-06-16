import { saveMatchingReview } from './api.js'
import { statusByMastery } from './constants.js'
import { setMessage, state } from './state.js'
import { getMastery, normaliseTags, shuffle } from './utils.js'

export function createPracticeSession(courseId, count, tag = 'all') {
  const courseWords = state.words.filter(word => courseId === 'all' || String(word.course_id) === String(courseId))
  const taggedWords = tag === 'all'
    ? courseWords
    : courseWords.filter(word => normaliseTags(word.tags).some(item => String(item) === String(tag)))
  const usable = taggedWords.filter(word => word.word && word.meaning_en)

  if (usable.length < 6) {
    setMessage('当前筛选范围至少需要 6 个带英文解释的单词。请换一个课程或标签。', 'error')
    return false
  }

  const selected = shuffle(usable).slice(0, Math.min(count, usable.length))
  state.message = null
  state.practice = {
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

export async function submitMatchingAnswer(selectedId, userId) {
  if (!state.practice) return

  const question = state.practice.questions[state.practice.index]
  const selected = question.options.find(option => String(option.id) === String(selectedId))
  const isCorrect = String(selectedId) === String(question.word.id)
  await recordAnswer({ word: question.word, userAnswer: selected?.word || '', isCorrect, userId })
}

export function nextQuestion() {
  if (!state.practice) return
  state.practice.lastResult = null
  if (state.practice.index + 1 >= state.practice.questions.length) {
    state.practice.finished = true
  } else {
    state.practice.index += 1
  }
}

async function recordAnswer({ word, userAnswer, isCorrect, userId }) {
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

  const { reviewResult, updateResult } = await saveMatchingReview({
    reviewPayload,
    updatePayload,
    wordId: word.id,
    userId
  })

  if (reviewResult.error || updateResult.error) {
    setMessage(reviewResult.error?.message || updateResult.error?.message, 'error')
    return
  }

  const updatedWord = { ...word, ...updatePayload }
  state.practice.answers.push({ word: updatedWord, userAnswer, isCorrect })
  state.practice.lastResult = { word: updatedWord, userAnswer, isCorrect }
  state.words = state.words.map(item => String(item.id) === String(word.id) ? updatedWord : item)
  state.reviews.unshift(reviewPayload)
}
