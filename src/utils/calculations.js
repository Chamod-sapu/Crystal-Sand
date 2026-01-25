import { differenceInDays, format } from 'date-fns'

/**
 * Calculate room charges based on stay duration
 */
export function calculateRoomCharges(dateArrival, dateDeparture, numberOfRooms, pricePerNight) {
  const arrival = new Date(dateArrival)
  const departure = new Date(dateDeparture)
  const nights = differenceInDays(departure, arrival)
  return nights * numberOfRooms * pricePerNight
}

/**
 * Calculate discount information from guest data
 * Reverse calculates original room charge from discounted price
 */
export function calculateDiscountInfo(discountType, discountAmount, discountedRoomCharge) {
  if (!discountType || !discountAmount || discountAmount === 0) {
    return null
  }

  const discountedCharge = parseFloat(discountedRoomCharge) || 0
  let originalRoomCharge = discountedCharge
  let actualDiscountAmount = 0

  if (discountType === 'percentage') {
    // Reverse calculate: original = discounted / (1 - percentage/100)
    const discountPercent = parseFloat(discountAmount) || 0
    if (discountPercent > 0 && discountPercent < 100) {
      originalRoomCharge = discountedCharge / (1 - discountPercent / 100)
      actualDiscountAmount = originalRoomCharge - discountedCharge
    }
  } else if (discountType === 'fixed') {
    // Reverse calculate: original = discounted + fixed amount
    const fixedAmount = parseFloat(discountAmount) || 0
    originalRoomCharge = discountedCharge + fixedAmount
    actualDiscountAmount = fixedAmount
  }

  return {
    hasDiscount: true,
    discountType,
    discountValue: parseFloat(discountAmount),
    originalRoomCharge,
    discountAmount: actualDiscountAmount,
    discountedRoomCharge: discountedCharge,
    savingsPercentage: originalRoomCharge > 0 
      ? ((actualDiscountAmount / originalRoomCharge) * 100).toFixed(2)
      : 0
  }
}

/**
 * Calculate bill total with optional discount information
 */
export function calculateBillTotal(
  roomCharges, 
  purchases, 
  taxPercentage, 
  advancePayment = 0,
  discountInfo = null
) {
  const purchasesTotal = purchases.reduce((sum, p) => sum + parseFloat(p.total_price || 0), 0)
  const roomChargesAmount = parseFloat(roomCharges || 0)
  const subtotal = roomChargesAmount + purchasesTotal
  const tax = subtotal * (parseFloat(taxPercentage) / 100)
  const grandTotal = subtotal + tax
  const advancePaymentAmount = parseFloat(advancePayment || 0)
  const balanceDue = grandTotal - advancePaymentAmount

  const result = {
    roomCharges: roomChargesAmount,
    purchasesTotal,
    subtotal,
    tax,
    grandTotal,
    advancePayment: advancePaymentAmount,
    balanceDue: Math.max(0, balanceDue),
    total: grandTotal
  }

  // Add discount information if provided
  if (discountInfo && discountInfo.hasDiscount) {
    result.discount = {
      type: discountInfo.discountType,
      value: discountInfo.discountValue,
      amount: discountInfo.discountAmount,
      originalRoomCharge: discountInfo.originalRoomCharge,
      discountedRoomCharge: discountInfo.discountedRoomCharge,
      savingsPercentage: discountInfo.savingsPercentage
    }
  }

  return result
}

/**
 * Calculate bill total with guest discount from guest object
 */
export function calculateBillTotalWithDiscount(
  roomCharges,
  purchases,
  taxPercentage,
  advancePayment = 0,
  guest = null
) {
  let discountInfo = null

  // Calculate discount info if guest has discount
  if (guest && guest.discount_type && guest.discount_amount) {
    discountInfo = calculateDiscountInfo(
      guest.discount_type,
      guest.discount_amount,
      roomCharges
    )
  }

  return calculateBillTotal(
    roomCharges,
    purchases,
    taxPercentage,
    advancePayment,
    discountInfo
  )
}

/**
 * Format currency amount
 */
export function formatCurrency(amount, currency = 'LKR') {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  }).format(amount)
}

/**
 * Calculate stay extension details
 */
export function calculateStayExtension(
  arrival, 
  dateOfDeparture, 
  newDepartureDate, 
  pricePerNight, 
  numberOfRooms, 
  totalRoomCharge, 
  numberOfNights
) {
  const arrivalDate = new Date(arrival)
  const currentDeparture = new Date(dateOfDeparture)
  const newDeparture = new Date(newDepartureDate)
  const additionalNights = differenceInDays(newDeparture, currentDeparture)
  const additionalCharge = pricePerNight * additionalNights * numberOfRooms
  const newTotalRoomCharge = parseFloat(totalRoomCharge) + additionalCharge
  const newNights = differenceInDays(newDeparture, arrivalDate)

  return {
    currentDeparture: format(currentDeparture, 'MMM dd, yyyy'),
    newDeparture: format(newDeparture, 'MMM dd, yyyy'),
    currentNights: numberOfNights,
    newNights,
    additionalNights,
    pricePerNight,
    additionalCharge,
    currentRoomCharge: parseFloat(totalRoomCharge),
    newTotalRoomCharge
  }
}

/**
 * Apply discount to a base amount
 */
export function applyDiscount(baseAmount, discountType, discountValue) {
  const amount = parseFloat(baseAmount) || 0
  const discount = parseFloat(discountValue) || 0

  if (!discountType || discount === 0) {
    return {
      originalAmount: amount,
      discountAmount: 0,
      finalAmount: amount
    }
  }

  let discountAmount = 0
  let finalAmount = amount

  if (discountType === 'percentage') {
    if (discount > 0 && discount <= 100) {
      discountAmount = amount * (discount / 100)
      finalAmount = amount - discountAmount
    }
  } else if (discountType === 'fixed') {
    discountAmount = Math.min(discount, amount) // Can't discount more than the amount
    finalAmount = amount - discountAmount
  }

  return {
    originalAmount: amount,
    discountAmount,
    finalAmount: Math.max(0, finalAmount),
    discountType,
    discountValue: discount
  }
}

/**
 * Calculate total savings from discount
 */
export function calculateSavings(originalAmount, discountedAmount) {
  const original = parseFloat(originalAmount) || 0
  const discounted = parseFloat(discountedAmount) || 0
  const savings = original - discounted

  return {
    originalAmount: original,
    discountedAmount: discounted,
    savingsAmount: savings,
    savingsPercentage: original > 0 ? ((savings / original) * 100).toFixed(2) : 0
  }
}

/**
 * Format discount display text
 */
export function formatDiscountDisplay(discountType, discountValue) {
  if (!discountType || !discountValue) {
    return 'No Discount'
  }

  if (discountType === 'percentage') {
    return `${discountValue}% Off`
  } else if (discountType === 'fixed') {
    return `${formatCurrency(discountValue)} Off`
  }

  return 'No Discount'
}

/**
 * Validate discount values
 */
export function validateDiscount(discountType, discountValue, baseAmount) {
  const value = parseFloat(discountValue) || 0
  const amount = parseFloat(baseAmount) || 0

  if (!discountType || value === 0) {
    return { valid: true, error: null }
  }

  if (discountType === 'percentage') {
    if (value < 0 || value > 100) {
      return { valid: false, error: 'Percentage must be between 0 and 100' }
    }
  } else if (discountType === 'fixed') {
    if (value < 0) {
      return { valid: false, error: 'Fixed discount cannot be negative' }
    }
    if (value > amount) {
      return { 
        valid: false, 
        error: `Fixed discount cannot exceed base amount (${formatCurrency(amount)})` 
      }
    }
  } else {
    return { valid: false, error: 'Invalid discount type' }
  }

  return { valid: true, error: null }
}

/**
 * Calculate room charge breakdown with nights and rooms
 */
export function calculateRoomChargeBreakdown(
  dateArrival,
  dateDeparture,
  numberOfRooms,
  pricePerNight,
  discountType = null,
  discountValue = null
) {
  const nights = differenceInDays(new Date(dateDeparture), new Date(dateArrival))
  const baseChargePerNight = parseFloat(pricePerNight) || 0
  const rooms = parseInt(numberOfRooms) || 1

  // Calculate base charges
  const totalNightsCharge = nights * rooms * baseChargePerNight

  // Apply discount if any
  const discountResult = applyDiscount(totalNightsCharge, discountType, discountValue)

  return {
    nights,
    numberOfRooms: rooms,
    pricePerNight: baseChargePerNight,
    totalNightsCharge,
    discount: discountResult.discountAmount,
    finalCharge: discountResult.finalAmount,
    perNightPerRoom: baseChargePerNight,
    totalPerNight: baseChargePerNight * rooms,
    hasDiscount: discountResult.discountAmount > 0
  }
}

/**
 * Calculate refund amount for early checkout
 */
export function calculateRefund(
  dateArrival,
  originalDateDeparture,
  actualDateDeparture,
  totalRoomCharge,
  refundPercentage = 100
) {
  const arrival = new Date(dateArrival)
  const originalDeparture = new Date(originalDateDeparture)
  const actualDeparture = new Date(actualDateDeparture)

  const totalNights = differenceInDays(originalDeparture, arrival)
  const stayedNights = differenceInDays(actualDeparture, arrival)
  const unusedNights = totalNights - stayedNights

  if (unusedNights <= 0) {
    return {
      refundAmount: 0,
      unusedNights: 0,
      stayedNights,
      totalNights,
      refundPercentage: 0
    }
  }

  const chargePerNight = parseFloat(totalRoomCharge) / totalNights
  const unusedAmount = chargePerNight * unusedNights
  const refundAmount = unusedAmount * (parseFloat(refundPercentage) / 100)

  return {
    refundAmount,
    unusedNights,
    stayedNights,
    totalNights,
    chargePerNight,
    unusedAmount,
    refundPercentage: parseFloat(refundPercentage)
  }
}

/**
 * Calculate daily rate from total charge
 */
export function calculateDailyRate(totalCharge, numberOfNights, numberOfRooms = 1) {
  const total = parseFloat(totalCharge) || 0
  const nights = parseInt(numberOfNights) || 1
  const rooms = parseInt(numberOfRooms) || 1

  const ratePerNightPerRoom = total / (nights * rooms)
  const ratePerNight = total / nights

  return {
    totalCharge: total,
    numberOfNights: nights,
    numberOfRooms: rooms,
    ratePerNightPerRoom,
    ratePerNight
  }
}