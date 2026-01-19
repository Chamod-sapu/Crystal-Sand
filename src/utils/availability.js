import { eachDayOfInterval, isWithinInterval, parseISO, isBefore, isAfter, isEqual } from 'date-fns'

export function checkRoomAvailability(room, guests, checkInDate, checkOutDate) {
  if (!room || !checkInDate || !checkOutDate) return false
  
  const checkIn = new Date(checkInDate)
  const checkOut = new Date(checkOutDate)

  // Check room status first
  if (room.status !== 'available') return false

  const conflictingBookings = guests.filter(guest => {
    if (guest.status === 'cancelled') return false
    if (!guest.room_numbers || !Array.isArray(guest.room_numbers)) return false
    
    const guestCheckIn = new Date(guest.date_of_arrival)
    const guestCheckOut = new Date(guest.date_of_departure)

    const occupiesRoom = guest.room_numbers.includes(room.room_number)
    if (!occupiesRoom) return false

    // Check for date overlap (excluding same-day turnover)
    const hasOverlap = !(
      (isBefore(checkIn, guestCheckOut) && isBefore(checkOut, guestCheckIn)) || // No overlap
      (isAfter(checkIn, guestCheckOut) || isEqual(checkIn, guestCheckOut)) // New check-in after guest check-out
    )
    
    return hasOverlap
  })

  return conflictingBookings.length === 0
}

function isDateRangeOverlap(start1, end1, start2, end2) {
  return start1 < end2 && end1 > start2
}

export function getAvailableRoomsForDateRange(rooms, guests, checkInDate, checkOutDate, roomType = null) {
  if (!checkInDate || !checkOutDate) {
    console.log('Missing dates in getAvailableRoomsForDateRange')
    return []
  }
  
  // Validate dates
  const checkIn = parseISO(checkInDate)
  const checkOut = parseISO(checkOutDate)
  
  if (isAfter(checkIn, checkOut) || isEqual(checkIn, checkOut)) {
    console.warn('Invalid dates: check-in must be before check-out')
    return []
  }

  const filteredRooms = rooms.filter(room => {
    // Filter by room type if specified
    if (roomType && room.room_type !== roomType) return false
    
    // Exclude maintenance rooms
    if (room.status === 'maintenance') return false
    
    return true
  })

  if (filteredRooms.length === 0) {
    console.log(`No rooms found for type: ${roomType}`)
    return []
  }

  // Get all active reservations that overlap with the requested dates
  const conflictingGuests = guests.filter(guest => {
    if (guest.status === 'cancelled') return false
    if (!guest.room_numbers || !Array.isArray(guest.room_numbers)) return false
    
    const guestCheckIn = parseISO(guest.date_of_arrival)
    const guestCheckOut = parseISO(guest.date_of_departure)
    
    // Check for date overlap
    return !(
      (checkIn >= guestCheckOut) || // New check-in after guest check-out
      (checkOut <= guestCheckIn)    // New check-out before guest check-in
    )
  })

  // Get all occupied room numbers from conflicting reservations
  const occupiedRoomNumbers = new Set()
  conflictingGuests.forEach(guest => {
    guest.room_numbers.forEach(roomNumber => {
      occupiedRoomNumbers.add(roomNumber)
    })
  })

  // Filter available rooms
  const availableRooms = filteredRooms.filter(room => {
    return !occupiedRoomNumbers.has(room.room_number) && room.status === 'available'
  })

  console.log('Availability Results:', {
    roomType,
    checkInDate,
    checkOutDate,
    totalFilteredRooms: filteredRooms.length,
    conflictingReservations: conflictingGuests.length,
    occupiedRooms: occupiedRoomNumbers.size,
    availableRooms: availableRooms.length,
    occupiedRoomNumbers: Array.from(occupiedRoomNumbers)
  })

  return availableRooms
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
      // Consider both checked_in and checked_out guests for occupancy
      if (guest.status !== 'checked_in' && guest.status !== 'checked_out') return
      if (!guest.room_numbers || !Array.isArray(guest.room_numbers)) return

      const guestCheckIn = new Date(guest.date_of_arrival)
      const guestCheckOut = new Date(guest.date_of_departure)

      // Include the date if it's within the guest's stay
      // Excluding check-out day (guest leaves before check-out time)
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
  if (Object.keys(occupancyData).length === 0 || totalRooms === 0) return 0

  const avgOccupied = Object.values(occupancyData).reduce((sum, day) => sum + day.occupiedCount, 0) / Object.keys(occupancyData).length
  return Math.round((avgOccupied / totalRooms) * 100)
}

export function getUpcomingReservations(guests, daysFromNow = 30) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const futureDate = new Date(today)
  futureDate.setDate(futureDate.getDate() + daysFromNow)

  return guests
    .filter(guest => {
      // Skip cancelled reservations
      if (guest.status === 'cancelled') return false
      
      const checkIn = new Date(guest.date_of_arrival)
      checkIn.setHours(0, 0, 0, 0)

      // Return reservations with future check-in dates
      return checkIn >= today && checkIn <= futureDate
    })
    .sort((a, b) => new Date(a.date_of_arrival) - new Date(b.date_of_arrival))
}

// New helper function for room availability with time consideration
export function checkRoomAvailabilityWithTime(room, guests, checkInDate, checkOutDate, checkInTime, checkOutTime) {
  if (!room || !checkInDate || !checkOutDate) return false
  
  // Combine date and time for accurate comparison
  const newCheckIn = new Date(`${checkInDate}T${checkInTime || '14:00'}`)
  const newCheckOut = new Date(`${checkOutDate}T${checkOutTime || '12:00'}`)

  // Check room status
  if (room.status !== 'available') return false

  const conflictingBookings = guests.filter(guest => {
    if (guest.status === 'cancelled') return false
    if (!guest.room_numbers || !Array.isArray(guest.room_numbers)) return false
    
    const guestCheckIn = new Date(`${guest.date_of_arrival}T${guest.time_of_arrival || '14:00'}`)
    const guestCheckOut = new Date(`${guest.date_of_departure}T${guest.time_of_departure || '12:00'}`)
    
    const occupiesRoom = guest.room_numbers.includes(room.room_number)
    if (!occupiesRoom) return false

    // Check for overlap considering time
    return newCheckIn < guestCheckOut && newCheckOut > guestCheckIn
  })

  return conflictingBookings.length === 0
}

// Function to check availability for multiple rooms at once
export function checkMultipleRoomsAvailability(roomNumbers, rooms, guests, checkInDate, checkOutDate) {
  if (!roomNumbers || roomNumbers.length === 0) return false
  
  const selectedRooms = rooms.filter(room => roomNumbers.includes(room.room_number))
  
  // Check if all selected rooms exist
  if (selectedRooms.length !== roomNumbers.length) return false
  
  // Check availability for each room
  for (const room of selectedRooms) {
    if (!checkRoomAvailability(room, guests, checkInDate, checkOutDate)) {
      return false
    }
  }
  
  return true
}

// Function to get room occupancy timeline
export function getRoomOccupancyTimeline(roomNumber, guests, startDate, endDate) {
  const timeline = []
  const dateRange = eachDayOfInterval({
    start: new Date(startDate),
    end: new Date(endDate)
  })

  dateRange.forEach(date => {
    const dateStr = date.toISOString().split('T')[0]
    let isOccupied = false
    let occupant = null

    guests.forEach(guest => {
      if (guest.status === 'cancelled') return false
      if (!guest.room_numbers || !guest.room_numbers.includes(roomNumber)) return false
      
      const guestCheckIn = new Date(guest.date_of_arrival)
      const guestCheckOut = new Date(guest.date_of_departure)

      if (date >= guestCheckIn && date < guestCheckOut) {
        isOccupied = true
        occupant = guest.name_with_initials
      }
    })

    timeline.push({
      date: dateStr,
      isOccupied,
      occupant
    })
  })

  return timeline
}