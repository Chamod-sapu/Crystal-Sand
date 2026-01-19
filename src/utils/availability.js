import { eachDayOfInterval, isWithinInterval } from 'date-fns'

export function checkRoomAvailability(room, guests, checkInDate, checkOutDate) {
  const checkIn = new Date(checkInDate)
  const checkOut = new Date(checkOutDate)

  const conflictingBookings = guests.filter(guest => {
    if (guest.status === 'cancelled') return false

    const guestCheckIn = new Date(guest.date_of_arrival)
    const guestCheckOut = new Date(guest.date_of_departure)

    return (
      guest.room_numbers.includes(room.room_number) &&
      isDateRangeOverlap(checkIn, checkOut, guestCheckIn, guestCheckOut)
    )
  })

  return conflictingBookings.length === 0
}

function isDateRangeOverlap(start1, end1, start2, end2) {
  return start1 < end2 && end1 > start2
}

export function getAvailableRoomsForDateRange(rooms, guests, checkInDate, checkOutDate, roomType = null) {
  return rooms.filter(room => {
    if (roomType && room.room_type !== roomType) return false
    if (room.status === 'maintenance') return false

    return checkRoomAvailability(room, guests, checkInDate, checkOutDate)
  })
}

export function generateCalendarOccupancy(guests, startDate, endDate) {
  const dateRange = eachDayOfInterval({
    start: new Date(startDate),
    end: new Date(endDate)
  })

  const occupancyData = {}

  dateRange.forEach(date => {
    const dateStr = date.toISOString().split('T')[0]
    const occupiedRooms = new Set()

    guests.forEach(guest => {
      if (guest.status !== 'checked_in' && guest.status !== 'checked_out') return

      const guestCheckIn = new Date(guest.date_of_arrival)
      const guestCheckOut = new Date(guest.date_of_departure)

      if (date >= guestCheckIn && date < guestCheckOut) {
        guest.room_numbers.forEach(room => {
          occupiedRooms.add(room)
        })
      }
    })

    occupancyData[dateStr] = {
      date: dateStr,
      occupiedCount: occupiedRooms.size
    }
  })

  return occupancyData
}

export function getOccupancyPercentage(occupancyData, totalRooms) {
  if (Object.keys(occupancyData).length === 0) return 0

  const avgOccupied = Object.values(occupancyData).reduce((sum, day) => sum + day.occupiedCount, 0) / Object.keys(occupancyData).length
  return Math.round((avgOccupied / totalRooms) * 100)
}

export function getUpcomingReservations(guests, daysFromNow = 30) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const futureDate = new Date(today)
  futureDate.setDate(futureDate.getDate() + daysFromNow)

  return guests.filter(guest => {
    const checkIn = new Date(guest.date_of_arrival)
    checkIn.setHours(0, 0, 0, 0)

    return guest.status !== 'cancelled' &&
           checkIn >= today &&
           checkIn <= futureDate
  }).sort((a, b) => new Date(a.date_of_arrival) - new Date(b.date_of_arrival))
}
