import { format } from 'date-fns'

export async function generateGRCNumber(supabase) {
  const today = format(new Date(), 'yyyyMMdd')
  const prefix = `GRC-${today}-`

  const { data: existingGuests } = await supabase
    .from('guests')
    .select('grc_number')
    .like('grc_number', `${prefix}%`)
    .order('grc_number', { ascending: false })
    .limit(1)

  let sequence = 1
  if (existingGuests && existingGuests.length > 0) {
    const lastNumber = existingGuests[0].grc_number
    const lastSequence = parseInt(lastNumber.split('-')[2])
    sequence = lastSequence + 1
  }

  const sequenceStr = sequence.toString().padStart(4, '0')
  return `${prefix}${sequenceStr}`
}
