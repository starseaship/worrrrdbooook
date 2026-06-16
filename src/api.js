import { supabase } from './supabaseClient.js'

export async function loadAppData(userId) {
  const [coursesResult, wordsResult, reviewsResult] = await Promise.all([
    supabase.from('courses').select('*').eq('user_id', userId).order('name'),
    supabase.from('vocabulary_items').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('vocabulary_reviews').select('*').eq('user_id', userId).order('reviewed_at', { ascending: false }).limit(500)
  ])

  const errors = [coursesResult.error, wordsResult.error, reviewsResult.error]
    .map(error => error?.message)
    .filter(Boolean)

  return {
    courses: coursesResult.data || [],
    words: wordsResult.data || [],
    reviews: reviewsResult.data || [],
    errors
  }
}

export function insertCourse(payload) {
  return supabase.from('courses').insert(payload)
}

export function deleteCourseById(id, userId) {
  return supabase
    .from('courses')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
}

export function insertWord(payload) {
  return supabase.from('vocabulary_items').insert(payload)
}

export function updateWordById(id, userId, payload) {
  return supabase
    .from('vocabulary_items')
    .update(payload)
    .eq('id', id)
    .eq('user_id', userId)
    .select('id')
}

export function deleteWordById(id, userId) {
  return supabase
    .from('vocabulary_items')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
}

export async function saveMatchingReview({ reviewPayload, updatePayload, wordId, userId }) {
  const [reviewResult, updateResult] = await Promise.all([
    supabase.from('vocabulary_reviews').insert(reviewPayload),
    updateWordById(wordId, userId, updatePayload)
  ])

  return { reviewResult, updateResult }
}
