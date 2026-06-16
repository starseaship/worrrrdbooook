import { hasSupabaseEnv, supabase } from './supabaseClient.js'
import { readingVocabulary } from './data/readingVocabulary.js'

const COURSE_NAME = '阅读课'
const COURSE_DESCRIPTION = 'IR Peace & Value book 2026 · Chapter 3 / Chapter 3.7 词汇'

let seedPromise = null

async function seedReadingVocabulary(session) {
  if (!hasSupabaseEnv || !supabase || !session?.user?.id) return { inserted: 0 }
  if (seedPromise) return seedPromise

  seedPromise = doSeedReadingVocabulary(session.user.id)
    .catch(error => {
      console.warn('Reading vocabulary seed failed:', error)
      return { inserted: 0, error }
    })
    .finally(() => {
      seedPromise = null
    })

  return seedPromise
}

async function doSeedReadingVocabulary(userId) {
  const course = await ensureReadingCourse(userId)
  if (!course?.id) return { inserted: 0 }

  const { data: existingWords, error: existingError } = await supabase
    .from('vocabulary_items')
    .select('word')
    .eq('user_id', userId)
    .eq('course_id', course.id)

  if (existingError) throw existingError

  const existingWordSet = new Set((existingWords || []).map(item => normalizeKey(item.word)))
  const rows = readingVocabulary
    .filter(item => !existingWordSet.has(normalizeKey(item.word)))
    .map(item => ({
      user_id: userId,
      exam_category: 'School',
      course_id: course.id,
      word: item.word,
      meaning_zh: item.meaning_zh,
      meaning_en: item.meaning_en,
      part_of_speech: item.part_of_speech,
      ai_example_sentence: item.ai_example_sentence,
      example_translation: item.example_translation,
      tags: item.tags,
      mastery_level: 0,
      status: 'unmastered',
      note: item.note,
      updated_at: new Date().toISOString()
    }))

  if (!rows.length) return { inserted: 0 }

  const { error: insertError } = await supabase.from('vocabulary_items').insert(rows)
  if (insertError) throw insertError
  return { inserted: rows.length }
}

async function ensureReadingCourse(userId) {
  const { data: existing, error: selectError } = await supabase
    .from('courses')
    .select('id, name')
    .eq('user_id', userId)
    .eq('name', COURSE_NAME)
    .limit(1)
    .maybeSingle()

  if (selectError) throw selectError
  if (existing) return existing

  const { data: inserted, error: insertError } = await supabase
    .from('courses')
    .insert({
      user_id: userId,
      name: COURSE_NAME,
      description: COURSE_DESCRIPTION
    })
    .select('id, name')
    .single()

  if (insertError) throw insertError
  return inserted
}

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase()
}

if (hasSupabaseEnv && supabase) {
  supabase.auth.onAuthStateChange(async (_event, session) => {
    await seedReadingVocabulary(session)
  })

  const { data } = await supabase.auth.getSession()
  await seedReadingVocabulary(data.session)
}
