export function calculateRoomCharges(dateArrival, dateDeparture, numberOfRooms, pricePerNight) {
  const arrival = new Date(dateArrival)
  const departure = new Date(dateDeparture)
  const nights = Math.ceil((departure - arrival) / (1000 * 60 * 60 * 24))
  return nights * numberOfRooms * pricePerNight
}

export function calculateBillTotal(roomCharges, purchases, taxPercentage) {
  const purchasesTotal = purchases.reduce((sum, p) => sum + parseFloat(p.total_price || 0), 0)
  const subtotal = parseFloat(roomCharges || 0) + purchasesTotal
  const tax = subtotal * (parseFloat(taxPercentage) / 100)
  const total = subtotal + tax

  return {
    roomCharges: parseFloat(roomCharges || 0),
    purchasesTotal,
    subtotal,
    tax,
    total
  }
}

export function formatCurrency(amount, currency = 'LKR') {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  }).format(amount)
}
