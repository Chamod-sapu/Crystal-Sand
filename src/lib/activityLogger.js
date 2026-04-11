import { supabase } from './supabase'

/**
 * Log a user activity to the database.
 * Call this after any significant action (create, update, delete, login, etc.)
 *
 * @param {object} userProfile - The current user's profile from AuthContext
 * @param {string} action - The action taken: 'create' | 'update' | 'delete' | 'login' | 'logout' | 'view' | 'generate'
 * @param {string} entityType - What was affected: 'guest' | 'room' | 'booking' | 'fb_item' | 'user' | 'system' | 'bill'
 * @param {string} description - Human-readable description of what happened
 * @param {string} [entityId] - Optional ID of the affected entity
 * @param {object} [metadata] - Optional additional data to store
 */
export async function logActivity(userProfile, action, entityType, description, entityId = null, metadata = {}) {
  if (!userProfile) return

  try {
    await supabase.from('user_activity_log').insert([{
      user_id: userProfile.id,
      user_name: userProfile.full_name,
      user_role: userProfile.role,
      action,
      entity_type: entityType,
      entity_id: entityId ? String(entityId) : null,
      description,
      metadata
    }])
  } catch (error) {
    // Activity logging is non-critical — don't break the app if it fails
    console.warn('Activity log failed (non-critical):', error.message)
  }
}
