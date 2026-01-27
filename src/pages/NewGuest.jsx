import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { generateGRCNumber } from '../utils/grcGenerator'
import { calculateRoomCharges, formatCurrency } from '../utils/calculations'
import { getAvailableRoomsForDateRange } from '../utils/availability'
import { format } from 'date-fns'
import { Save, ArrowLeft, Plus, X, AlertCircle, Upload, FileText, Trash2 } from 'lucide-react'

export default function NewGuest() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [allRooms, setAllRooms] = useState([])
  const [availableRooms, setAvailableRooms] = useState([])
  const [guests, setGuests] = useState([])
  const [error, setError] = useState('')
  const [validationErrors, setValidationErrors] = useState({})
  const [uploadedFile, setUploadedFile] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [countries, setCountries] = useState([
    'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola',
    'Antigua and Barbuda', 'Argentina', 'Armenia', 'Australia', 'Austria',
    'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados',
    'Belarus', 'Belgium', 'Belize', 'Benin', 'Bhutan',
    'Bolivia', 'Bosnia and Herzegovina', 'Botswana', 'Brazil', 'Brunei',
    'Bulgaria', 'Burkina Faso', 'Burundi', 'Cabo Verde', 'Cambodia',
    'Cameroon', 'Canada', 'Central African Republic', 'Chad', 'Chile',
    'China', 'Colombia', 'Comoros', 'Congo', 'Costa Rica',
    'Croatia', 'Cuba', 'Cyprus', 'Czech Republic', 'Denmark',
    'Djibouti', 'Dominica', 'Dominican Republic', 'Ecuador', 'Egypt',
    'El Salvador', 'Equatorial Guinea', 'Eritrea', 'Estonia', 'Eswatini',
    'Ethiopia', 'Fiji', 'Finland', 'France', 'Gabon',
    'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece',
    'Grenada', 'Guatemala', 'Guinea', 'Guinea-Bissau', 'Guyana',
    'Haiti', 'Honduras', 'Hungary', 'Iceland', 'India',
    'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel',
    'Italy', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan',
    'Kenya', 'Kiribati', 'Korea, North', 'Korea, South', 'Kosovo',
    'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon',
    'Lesotho', 'Liberia', 'Libya', 'Liechtenstein', 'Lithuania',
    'Luxembourg', 'Madagascar', 'Malawi', 'Malaysia', 'Maldives',
    'Mali', 'Malta', 'Marshall Islands', 'Mauritania', 'Mauritius',
    'Mexico', 'Micronesia', 'Moldova', 'Monaco', 'Mongolia',
    'Montenegro', 'Morocco', 'Mozambique', 'Myanmar', 'Namibia',
    'Nauru', 'Nepal', 'Netherlands', 'New Zealand', 'Nicaragua',
    'Niger', 'Nigeria', 'North Macedonia', 'Norway', 'Oman',
    'Pakistan', 'Palau', 'Palestine', 'Panama', 'Papua New Guinea',
    'Paraguay', 'Peru', 'Philippines', 'Poland', 'Portugal',
    'Qatar', 'Romania', 'Russia', 'Rwanda', 'Saint Kitts and Nevis',
    'Saint Lucia', 'Saint Vincent and the Grenadines', 'Samoa', 'San Marino',
    'Sao Tome and Principe', 'Saudi Arabia', 'Senegal', 'Serbia', 'Seychelles',
    'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia', 'Solomon Islands',
    'Somalia', 'South Africa', 'South Sudan', 'Spain', 'Sri Lanka',
    'Sudan', 'Suriname', 'Sweden', 'Switzerland', 'Syria',
    'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand', 'Timor-Leste',
    'Togo', 'Tonga', 'Trinidad and Tobago', 'Tunisia', 'Turkey',
    'Turkmenistan', 'Tuvalu', 'Uganda', 'Ukraine', 'United Arab Emirates',
    'United Kingdom', 'United States', 'Uruguay', 'Uzbekistan', 'Vanuatu',
    'Vatican City', 'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe'
  ])
  
  const [formData, setFormData] = useState({
    name_with_initials: '',
    passport_nic: '',
    nationality: 'Sri Lanka',
    mobile_number: '',
    reservation_number: '',
    voucher_number: '',
    room_numbers: [],
    room_type: 'DBL',
    number_of_rooms: 1,
    number_of_adults: 2,
    number_of_children: 0,
    children_ages: [],
    meal_plan: 'BB',
    date_of_arrival: format(new Date(), 'yyyy-MM-dd'),
    date_of_departure: format(new Date(Date.now() + 86400000), 'yyyy-MM-dd'),
    time_of_arrival: '14:00',
    time_of_departure: '12:00',
    advance_payment_amount: 0,
    advance_payment_date: format(new Date(), 'yyyy-MM-dd'),
    advance_payment_method: '',
    remarks: '',
    passport_nic_document_url: '',
    discount_type: '',
    discount_amount: 0
  })

  useEffect(() => {
    loadData()
    generateReservationNumber()
  }, [])

  useEffect(() => {
    updateAvailableRooms()
  }, [formData.room_type, formData.date_of_arrival, formData.date_of_departure, allRooms, guests])

  useEffect(() => {
    if (formData.mobile_number) {
      validateField('mobile_number', formData.mobile_number)
    }
  }, [formData.nationality])

  async function loadData() {
    try {
      setError('')
      
      const { data: roomsData, error: roomsError } = await supabase
        .from('rooms')
        .select('*')
        .order('room_number')

      if (roomsError) throw roomsError

      const today = format(new Date(), 'yyyy-MM-dd')
      const { data: guestsData, error: guestsError } = await supabase
        .from('guests')
        .select('*')
        .eq('status', 'checked_in')
        .gte('date_of_departure', today)

      if (guestsError) throw guestsError

      setAllRooms(roomsData || [])
      setGuests(guestsData || [])
    } catch (error) {
      console.error('Error loading data:', error)
      setError('Failed to load data. Please refresh the page.')
    }
  }

  function generateReservationNumber() {
    const now = new Date()
    const year = now.getFullYear().toString().slice(-2)
    const month = (now.getMonth() + 1).toString().padStart(2, '0')
    const day = now.getDate().toString().padStart(2, '0')
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
    const reservationNumber = `RES${year}${month}${day}${random}`
    
    setFormData(prev => ({
      ...prev,
      reservation_number: reservationNumber
    }))
  }

  async function handleFileUpload(event) {
    const file = event.target.files[0]
    
    if (!file) return

    // Validate file type
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file only')
      event.target.value = ''
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB')
      event.target.value = ''
      return
    }

    setError('')
    
    // Store file temporarily (will be uploaded with GRC number during form submission)
    setUploadedFile({
      name: file.name,
      file: file,
      size: file.size
    })
  }

  async function handleRemoveFile() {
    if (!uploadedFile) return

    setUploadedFile(null)
    setFormData(prev => ({
      ...prev,
      passport_nic_document_url: ''
    }))
    setUploadProgress(0)
    
    // Reset file input
    const fileInput = document.getElementById('passport-upload')
    if (fileInput) fileInput.value = ''
  }

  function validateField(name, value) {
    const errors = { ...validationErrors }
    
    switch (name) {
      case 'name_with_initials':
        if (!value.trim()) {
          errors[name] = 'Name is required'
        } else if (value.trim().length < 3) {
          errors[name] = 'Name must be at least 3 characters'
        } else {
          delete errors[name]
        }
        break
        
      case 'passport_nic':
        if (!value.trim()) {
          errors[name] = 'Passport/NIC is required'
        } else {
          const passportRegex = /^[A-Z][A-Z0-9]{6,12}$/
          const nicRegex = /^([0-9]{9}[VXvx]|[0-9]{12})$/
          
          if (!passportRegex.test(value) && !nicRegex.test(value.toUpperCase())) {
            errors[name] = 'Invalid Passport/NIC format. Use format: A1234567 or 123456789V'
          } else {
            delete errors[name]
          }
        }
        break
        
      case 'nationality':
        if (!value.trim()) {
          errors[name] = 'Nationality is required'
        } else {
          delete errors[name]
        }
        break
        
      case 'mobile_number':
        if (!value.trim()) {
          errors[name] = 'Mobile number is required'
        } else {
          let phoneRegex
          
          switch (formData.nationality) {
            case 'Sri Lanka':
              phoneRegex = /^(\+94|0)(7[0-9]|8[1-8])[0-9]{7}$/
              break
            case 'India':
              phoneRegex = /^(\+91|0)?[6789]\d{9}$/
              break
            case 'United States':
            case 'Canada':
              phoneRegex = /^(\+1)?[2-9]\d{2}[2-9]\d{2}\d{4}$/
              break
            case 'United Kingdom':
              phoneRegex = /^(\+44|0)7\d{9}$/
              break
            case 'Australia':
              phoneRegex = /^(\+61|0)4\d{8}$/
              break
            default:
              phoneRegex = /^(\+)?[1-9]\d{1,14}$/
          }
          
          const cleanedNumber = value.replace(/\s+/g, '')
          if (!phoneRegex.test(cleanedNumber)) {
            errors[name] = `Invalid ${formData.nationality} mobile number format`
          } else {
            delete errors[name]
          }
        }
        break
        
      case 'number_of_adults':
        const maxAdults = formData.room_type === 'SGL' ? 1 : 
                         formData.room_type === 'DBL' ? 2 : 
                         formData.room_type === 'TPL' ? 3 : 4
        if (value < 1 || value > maxAdults) {
          errors[name] = `Must be between 1 and ${maxAdults} for ${formData.room_type} room`
        } else {
          delete errors[name]
        }
        break
        
      case 'number_of_children':
        const maxChildren = formData.room_type === 'SGL' ? 0 : 
                           formData.room_type === 'DBL' ? 1 : 
                           formData.room_type === 'TPL' ? 2 : 3
        if (value < 0 || value > maxChildren) {
          errors[name] = `Must be between 0 and ${maxChildren} for ${formData.room_type} room`
        } else {
          delete errors[name]
        }
        break
        
      default:
        delete errors[name]
    }
    
    setValidationErrors(errors)
    return !errors[name]
  }

  function updateAvailableRooms() {
    if (!formData.date_of_arrival || !formData.date_of_departure) {
      setAvailableRooms([])
      return
    }

    const arrival = new Date(formData.date_of_arrival)
    const departure = new Date(formData.date_of_departure)
    
    if (departure <= arrival) {
      setError('Departure date must be after arrival date')
      setAvailableRooms([])
      return
    }

    setError('')

    try {
      const available = getAvailableRoomsForDateRange(
        allRooms,
        guests,
        formData.date_of_arrival,
        formData.date_of_departure,
        formData.room_type
      )

      const sortedRooms = available.sort((a, b) => {
        const numA = parseInt(a.room_number.replace(/\D/g, ''))
        const numB = parseInt(b.room_number.replace(/\D/g, ''))
        return numA - numB
      })

      setAvailableRooms(sortedRooms)
    } catch (err) {
      console.error('Error in updateAvailableRooms:', err)
      setAvailableRooms([])
    }
  }

  const handleChange = (e) => {
    const { name, value, type } = e.target
    const newValue = type === 'number' ? (value === '' ? '' : parseFloat(value) || 0) : value
    
    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }))

    validateField(name, newValue)

    if (name.includes('date')) {
      setError('')
    }
  }

  const handleRoomSelection = (roomNumber) => {
    setFormData(prev => {
      const isSelected = prev.room_numbers.includes(roomNumber)
      let newRooms
      
      if (isSelected) {
        newRooms = prev.room_numbers.filter(r => r !== roomNumber)
      } else {
        if (formData.room_type === 'SGL' && prev.room_numbers.length >= 1) {
          newRooms = [roomNumber]
        } else {
          newRooms = [...prev.room_numbers, roomNumber]
        }
      }
      
      return {
        ...prev,
        room_numbers: newRooms,
        number_of_rooms: newRooms.length
      }
    })
  }

  const addChildAge = () => {
    setFormData(prev => ({
      ...prev,
      children_ages: [...prev.children_ages, 0]
    }))
  }

  const updateChildAge = (index, age) => {
    setFormData(prev => {
      const newAges = [...prev.children_ages]
      newAges[index] = parseInt(age) || 0
      return { ...prev, children_ages: newAges }
    })
  }

  const removeChildAge = (index) => {
    setFormData(prev => ({
      ...prev,
      children_ages: prev.children_ages.filter((_, i) => i !== index)
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    const requiredFields = ['name_with_initials', 'passport_nic', 'nationality', 'mobile_number']
    let isValid = true
    
    requiredFields.forEach(field => {
      if (!validateField(field, formData[field])) {
        isValid = false
      }
    })
    
    if (!isValid) {
      setError('Please fix the validation errors before submitting.')
      return
    }
    
    if (formData.room_numbers.length === 0) {
      setError('Please select at least one room')
      return
    }

    setLoading(true)
    setError('')

    try {
      const grcNumber = await generateGRCNumber(supabase)
      let documentUrl = ''

      // Upload file with GRC number if file is selected
      if (uploadedFile && uploadedFile.file) {
        setIsUploading(true)
        setUploadProgress(0)

        try {
          const timestamp = Date.now()
          // Format: GRC-20260125-0003_1769340249244.pdf
          const fileName = `${grcNumber}_${timestamp}.pdf`
          const filePath = `documents/${fileName}`

          const { data, error: uploadError } = await supabase.storage
            .from('guest-documents')
            .upload(filePath, uploadedFile.file, {
              cacheControl: '3600',
              upsert: false
            })

          if (uploadError) throw uploadError

          documentUrl = data.path
          setUploadProgress(100)
        } catch (uploadError) {
          console.error('Error uploading file:', uploadError)
          setError('Failed to upload document, but continuing with registration.')
          // Continue with registration even if upload fails
        } finally {
          setIsUploading(false)
        }
      }

      const selectedRooms = allRooms.filter(r => formData.room_numbers.includes(r.room_number))
      const totalRoomCharge = selectedRooms.reduce((total, room) => {
        const roomCharge = calculateRoomCharges(
          formData.date_of_arrival,
          formData.date_of_departure,
          1,
          room.base_price || 0
        )
        return total + roomCharge
      }, 0)

      const { data: guest, error: guestError } = await supabase
        .from('guests')
        .insert([{
          grc_number: grcNumber,
          ...formData,
          // Convert empty strings to null for optional fields
          advance_payment_method: formData.advance_payment_method || null,
          discount_type: formData.discount_type || null,
          voucher_number: formData.voucher_number || null,
          passport_nic_document_url: documentUrl || null,
          total_room_charge: totalRoomCharge,
          status: 'checked_in',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single()

      if (guestError) throw guestError

      for (const roomNumber of formData.room_numbers) {
        const { error: roomError } = await supabase
          .from('rooms')
          .update({ 
            status: 'occupied',
            updated_at: new Date().toISOString()
          })
          .eq('room_number', roomNumber)

        if (roomError) {
          console.error(`Failed to update room ${roomNumber}:`, roomError)
        }
      }

      navigate(`/guests/${guest.id}`, { 
        state: { 
          message: 'Guest registered successfully!',
          guestName: formData.name_with_initials
        } 
      })

    } catch (error) {
      console.error('Error creating guest:', error)
      setError(error.message || 'Failed to create guest registration. Please try again.')
      setLoading(false)
    }
  }

  const handleDateChange = (e) => {
    const { name, value } = e.target
    handleChange(e)
    
    if (name === 'date_of_arrival' && formData.date_of_departure) {
      const newArrival = new Date(value)
      const currentDeparture = new Date(formData.date_of_departure)
      
      if (newArrival >= currentDeparture) {
        const nextDay = new Date(newArrival)
        nextDay.setDate(nextDay.getDate() + 1)
        setFormData(prev => ({
          ...prev,
          date_of_departure: format(nextDay, 'yyyy-MM-dd')
        }))
      }
    }
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  // Calculate room charges for display
  const calculateDisplayCharges = () => {
    if (formData.room_numbers.length === 0 || !formData.date_of_arrival || !formData.date_of_departure) {
      return { originalRate: 0, discountAmount: 0, finalRate: 0 }
    }

    const selectedRooms = allRooms.filter(r => formData.room_numbers.includes(r.room_number))
    const originalRate = selectedRooms.reduce((total, room) => {
      const roomCharge = calculateRoomCharges(
        formData.date_of_arrival,
        formData.date_of_departure,
        1,
        room.base_price || 0
      )
      return total + roomCharge
    }, 0)

    let discountAmount = 0
    let finalRate = originalRate

    if (formData.discount_type && formData.discount_amount > 0) {
      if (formData.discount_type === 'percentage') {
        discountAmount = (originalRate * formData.discount_amount) / 100
      } else if (formData.discount_type === 'fixed') {
        discountAmount = formData.discount_amount
      }
      finalRate = Math.max(0, originalRate - discountAmount)
    }

    return { originalRate, discountAmount, finalRate }
  }

  const displayCharges = calculateDisplayCharges()

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
          disabled={loading}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-white">New Guest Registration</h1>
          <p className="text-gray-400 mt-1">Fill in guest details for check-in</p>
        </div>
      </div>

      {error && (
        <div className="card p-4 border-red-800 bg-red-900/20">
          <div className="flex items-center space-x-2 text-red-400">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card p-6">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center space-x-2">
            <span className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-sm">1</span>
            <span>Guest Details</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="label">Name with Initials <span className="text-red-500">*</span></label>
              <input
                type="text"
                name="name_with_initials"
                value={formData.name_with_initials}
                onChange={handleChange}
                className={`input-field ${validationErrors.name_with_initials ? 'border-red-500' : ''}`}
                required
                placeholder="Mr. A.B. Silva"
                disabled={loading}
              />
              {validationErrors.name_with_initials && (
                <p className="text-red-500 text-xs mt-1">{validationErrors.name_with_initials}</p>
              )}
            </div>
            <div>
              <label className="label">Passport / NIC Number <span className="text-red-500">*</span></label>
              <input
                type="text"
                name="passport_nic"
                value={formData.passport_nic}
                onChange={handleChange}
                className={`input-field ${validationErrors.passport_nic ? 'border-red-500' : ''}`}
                required
                placeholder="N1234567V or 200012345678"
                disabled={loading}
              />
              {validationErrors.passport_nic && (
                <p className="text-red-500 text-xs mt-1">{validationErrors.passport_nic}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Format: NIC (123456789V or 200012345678) or Passport (A1234567)
              </p>
            </div>
            <div>
              <label className="label">Nationality <span className="text-red-500">*</span></label>
              <select
                name="nationality"
                value={formData.nationality}
                onChange={handleChange}
                className={`input-field ${validationErrors.nationality ? 'border-red-500' : ''}`}
                required
                disabled={loading}
              >
                <option value="">Select Nationality</option>
                {countries.map(country => (
                  <option key={country} value={country}>{country}</option>
                ))}
              </select>
              {validationErrors.nationality && (
                <p className="text-red-500 text-xs mt-1">{validationErrors.nationality}</p>
              )}
            </div>
            <div>
              <label className="label">Mobile Number <span className="text-red-500">*</span></label>
              <input
                type="tel"
                name="mobile_number"
                value={formData.mobile_number}
                onChange={handleChange}
                className={`input-field ${validationErrors.mobile_number ? 'border-red-500' : ''}`}
                required
                placeholder={formData.nationality === 'Sri Lanka' ? '+94 77 123 4567' : 'Enter mobile number'}
                disabled={loading}
              />
              {validationErrors.mobile_number && (
                <p className="text-red-500 text-xs mt-1">{validationErrors.mobile_number}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                {formData.nationality === 'Sri Lanka' 
                  ? 'Format: +94771234567 or 0771234567' 
                  : 'Enter valid mobile number for ' + formData.nationality}
              </p>
            </div>
          </div>

          {/* Passport/NIC Document Upload */}
          <div className="mt-6 pt-6 border-t border-dark-700">
            <label className="label mb-3">Passport / NIC Document (PDF)</label>
            
            {!uploadedFile ? (
              <div>
                <label
                  htmlFor="passport-upload"
                  className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                    isUploading 
                      ? 'border-gray-600 bg-gray-800/50 cursor-not-allowed' 
                      : 'border-dark-600 hover:border-primary-500 hover:bg-dark-800'
                  }`}
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    {isUploading ? (
                      <>
                        <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mb-3" />
                        <p className="text-sm text-gray-400">Uploading... {uploadProgress}%</p>
                      </>
                    ) : (
                      <>
                        <Upload className="w-10 h-10 mb-3 text-gray-400" />
                        <p className="mb-2 text-sm text-gray-400">
                          <span className="font-semibold">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-gray-500">PDF only (MAX. 5MB)</p>
                      </>
                    )}
                  </div>
                  <input
                    id="passport-upload"
                    type="file"
                    className="hidden"
                    accept="application/pdf"
                    onChange={handleFileUpload}
                    disabled={isUploading || loading}
                  />
                </label>
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 bg-dark-800 rounded-lg border border-dark-700">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-primary-600/20 rounded-lg">
                    <FileText className="w-6 h-6 text-primary-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">{uploadedFile.name}</p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(uploadedFile.size)} • Will be saved with GRC number
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="p-2 hover:bg-dark-700 rounded-lg text-red-400 transition-colors"
                  disabled={loading}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            )}
            <p className="text-xs text-gray-500 mt-2">
              Upload a clear copy of the guest's passport or NIC for verification
            </p>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center space-x-2">
            <span className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-sm">2</span>
            <span>Reservation Details</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="label">Reservation Number</label>
              <input
                type="text"
                name="reservation_number"
                value={formData.reservation_number}
                onChange={handleChange}
                className="input-field bg-gray-800"
                readOnly
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-1">Auto-generated reservation number</p>
            </div>
            <div>
              <label className="label">Voucher Number</label>
              <input
                type="text"
                name="voucher_number"
                value={formData.voucher_number}
                onChange={handleChange}
                className="input-field"
                placeholder="Optional"
                disabled={loading}
              />
            </div>
            <div>
              <label className="label">Meal Plan</label>
              <select
                name="meal_plan"
                value={formData.meal_plan}
                onChange={handleChange}
                className="input-field"
                disabled={loading}
              >
                <option value="RO">Room Only</option>
                <option value="BB">Bed & Breakfast (BB)</option>
                <option value="HB">Half Board (HB)</option>
                <option value="FB">Full Board (FB)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Room Selection Section */}
        <div className="card p-6">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center space-x-2">
            <span className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-sm">3</span>
            <span>Room Selection</span>
          </h2>
          
          <div className="mb-6">
            <label className="label">Room Type <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
              {[
                { code: 'SGL', name: 'Single', desc: '1 Adult', maxAdults: 1, maxChildren: 0 },
                { code: 'DBL', name: 'Double', desc: '2 Adults', maxAdults: 2, maxChildren: 1 },
                { code: 'TPL', name: 'Triple', desc: '3 Adults', maxAdults: 3, maxChildren: 2 },
                { code: 'QUAD', name: 'Quad', desc: '4 Adults', maxAdults: 4, maxChildren: 2 },
                { code: 'FAMILY', name: 'Family', desc: '4+3 Children', maxAdults: 4, maxChildren: 3 }
              ].map(type => (
                <button
                  key={type.code}
                  type="button"
                  onClick={() => {
                    setFormData(prev => { 
                      let newAdults = prev.number_of_adults
                      if (prev.number_of_adults > type.maxAdults) {
                        newAdults = type.maxAdults
                      }
                      
                      let newChildren = prev.number_of_children
                      if (prev.number_of_children > type.maxChildren) {
                        newChildren = type.maxChildren
                      }
                      
                      let newChildrenAges = prev.children_ages
                      if (newChildren < prev.children_ages.length) {
                        newChildrenAges = prev.children_ages.slice(0, newChildren)
                      }
                      
                      return {
                        ...prev, 
                        room_type: type.code, 
                        room_numbers: [],
                        number_of_adults: newAdults,
                        number_of_children: newChildren,
                        children_ages: newChildrenAges
                      }
                    })
                  }}
                  className={`p-4 rounded-lg border-2 transition-all text-center ${
                    formData.room_type === type.code
                      ? 'border-primary-600 bg-primary-600/10 text-white'
                      : 'border-dark-700 hover:border-dark-600 text-gray-400 hover:bg-dark-800'
                  }`}
                  disabled={loading}
                >
                  <div className="font-bold text-lg">{type.code}</div>
                  <div className="text-xs mt-1">{type.name}</div>
                  <div className="text-xs opacity-75">{type.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Room Selection Grid */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <label className="label">Select Room(s) <span className="text-red-500">*</span></label>
              <div className="text-sm text-gray-500">
                {formData.room_numbers.length > 0 && (
                  <span className="text-primary-400">
                    Selected: {formData.room_numbers.sort().join(', ')}
                  </span>
                )}
              </div>
            </div>
            
            {!formData.date_of_arrival || !formData.date_of_departure ? (
              <div className="card p-4 text-center text-yellow-400 border-yellow-800 bg-yellow-900/20">
                Please select both check-in and check-out dates to see available rooms
              </div>
            ) : availableRooms.length > 0 ? (
              <>
                <p className="text-sm text-gray-500 mb-3">
                  Showing {availableRooms.length} available {formData.room_type} room(s)
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {availableRooms.map(room => (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => handleRoomSelection(room.room_number)}
                      className={`p-4 rounded-lg border-2 transition-all relative ${
                        formData.room_numbers.includes(room.room_number)
                          ? 'border-primary-600 bg-primary-600/20 text-white shadow-lg shadow-primary-600/20'
                          : 'border-dark-700 hover:border-primary-500/50 text-gray-400 hover:bg-dark-800'
                      }`}
                      disabled={loading}
                    >
                      <div className="font-bold text-lg">{room.room_number}</div>
                      <div className="text-xs mt-1">Floor {room.floor || 1}</div>
                      <div className="text-xs opacity-75 mt-1">
                        LKR {room.base_price?.toLocaleString() || '0'}
                      </div>
                      {formData.room_numbers.includes(room.room_number) && (
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center animate-pulse">
                          <div className="w-3 h-3 bg-white rounded-full" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="card p-6 text-center">
                <div className="text-red-400 mb-2">
                  <AlertCircle className="inline mr-2" size={20} />
                  No available {formData.room_type} rooms for the selected dates
                </div>
                <p className="text-sm text-gray-500">
                  Try adjusting your dates or selecting a different room type
                </p>
              </div>
            )}
          </div>

          {/* Occupancy Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="label">Number of Adults <span className="text-red-500">*</span></label>
              <input
                type="number"
                name="number_of_adults"
                value={formData.number_of_adults}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 1
                  const maxAdults = formData.room_type === 'SGL' ? 1 : 
                                  formData.room_type === 'DBL' ? 2 : 
                                  formData.room_type === 'TPL' ? 3 : 4
                  const adjustedValue = Math.min(Math.max(1, value), maxAdults)
                  setFormData(prev => ({ ...prev, number_of_adults: adjustedValue }))
                  validateField('number_of_adults', adjustedValue)
                }}
                className={`input-field ${validationErrors.number_of_adults ? 'border-red-500' : ''}`}
                min="1"
                max={formData.room_type === 'SGL' ? 1 : formData.room_type === 'DBL' ? 2 : formData.room_type === 'TPL' ? 3 : 4}
                required
                disabled={loading}
              />
              {validationErrors.number_of_adults && (
                <p className="text-red-500 text-xs mt-1">{validationErrors.number_of_adults}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Max: {formData.room_type === 'SGL' ? 1 : formData.room_type === 'DBL' ? 2 : formData.room_type === 'TPL' ? 3 : 4} adults for {formData.room_type} room
              </p>
            </div>
            <div>
              <label className="label">Number of Children</label>
              <input
                type="number"
                name="number_of_children"
                value={formData.number_of_children}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 0
                  const maxChildren = formData.room_type === 'SGL' ? 0 : 
                                     formData.room_type === 'DBL' ? 1 : 
                                     formData.room_type === 'TPL' ? 2 : 3
                  const adjustedValue = Math.min(Math.max(0, value), maxChildren)
                  setFormData(prev => ({ 
                    ...prev, 
                    number_of_children: adjustedValue,
                    children_ages: adjustedValue < prev.children_ages.length 
                      ? prev.children_ages.slice(0, adjustedValue)
                      : [...prev.children_ages]
                  }))
                  validateField('number_of_children', adjustedValue)
                }}
                className={`input-field ${validationErrors.number_of_children ? 'border-red-500' : ''}`}
                min="0"
                max={formData.room_type === 'SGL' ? 0 : formData.room_type === 'DBL' ? 1 : formData.room_type === 'TPL' ? 2 : 3}
                disabled={loading}
              />
              {validationErrors.number_of_children && (
                <p className="text-red-500 text-xs mt-1">{validationErrors.number_of_children}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Max: {formData.room_type === 'SGL' ? 0 : formData.room_type === 'DBL' ? 1 : formData.room_type === 'TPL' ? 2 : 3} children for {formData.room_type} room
              </p>
            </div>
          </div>

          {/* Children Ages */}
          {formData.number_of_children > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <label className="label">Children Ages (0-17 years)</label>
                <button
                  type="button"
                  onClick={addChildAge}
                  className="btn-secondary text-sm py-1 px-3"
                  disabled={formData.children_ages.length >= formData.number_of_children || loading}
                >
                  <Plus size={16} className="inline mr-1" />
                  Add Age
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {formData.children_ages.map((age, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <input
                      type="number"
                      value={age}
                      onChange={(e) => updateChildAge(index, e.target.value)}
                      className="input-field"
                      min="0"
                      max="17"
                      placeholder="Age"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => removeChildAge(index)}
                      className="p-2 hover:bg-dark-800 rounded-lg text-red-400 disabled:opacity-50"
                      disabled={loading}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center space-x-2">
            <span className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-sm">4</span>
            <span>Check-in & Check-out</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="label">Date of Arrival <span className="text-red-500">*</span></label>
              <input
                type="date"
                name="date_of_arrival"
                value={formData.date_of_arrival}
                onChange={handleDateChange}
                className="input-field"
                min={format(new Date(), 'yyyy-MM-dd')}
                required
                disabled={loading}
              />
            </div>
            <div>
              <label className="label">Time of Arrival</label>
              <input
                type="time"
                name="time_of_arrival"
                value={formData.time_of_arrival}
                onChange={handleChange}
                className="input-field"
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-1">Standard check-in: 14:00 hrs</p>
            </div>
            <div>
              <label className="label">Date of Departure <span className="text-red-500">*</span></label>
              <input
                type="date"
                name="date_of_departure"
                value={formData.date_of_departure}
                onChange={handleDateChange}
                className="input-field"
                min={formData.date_of_arrival}
                required
                disabled={loading}
              />
            </div>
            <div>
              <label className="label">Time of Departure</label>
              <input
                type="time"
                name="time_of_departure"
                value={formData.time_of_departure}
                onChange={handleChange}
                className="input-field"
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-1">Standard check-out: 12:00 hrs</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center space-x-2">
            <span className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-sm">5</span>
            <span>Advance Payment (Optional)</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="label">Advance Amount (LKR)</label>
              <input
                type="number"
                name="advance_payment_amount"
                value={formData.advance_payment_amount}
                onChange={handleChange}
                className="input-field"
                min="0"
                step="100"
                disabled={loading}
              />
            </div>
            <div>
              <label className="label">Payment Date</label>
              <input
                type="date"
                name="advance_payment_date"
                value={formData.advance_payment_date}
                onChange={handleChange}
                className="input-field"
                max={format(new Date(), 'yyyy-MM-dd')}
                disabled={loading}
              />
            </div>
            <div>
              <label className="label">Payment Method</label>
              <select
                name="advance_payment_method"
                value={formData.advance_payment_method}
                onChange={handleChange}
                className="input-field"
                disabled={loading}
              >
                <option value="">Select method</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="online">Online Transfer</option>
              </select>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center space-x-2">
            <span className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-sm">6</span>
            <span>Discount (Optional)</span>
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="label">Discount Type</label>
              <select
                name="discount_type"
                value={formData.discount_type}
                onChange={handleChange}
                className="input-field"
                disabled={loading}
              >
                <option value="">No Discount</option>
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount (LKR)</option>
              </select>
            </div>
            <div>
              <label className="label">Discount Amount</label>
              <input
                type="number"
                name="discount_amount"
                value={formData.discount_amount}
                onChange={handleChange}
                className="input-field"
                min="0"
                step={formData.discount_type === 'percentage' ? "0.1" : "100"}
                max={formData.discount_type === 'percentage' ? "100" : undefined}
                disabled={!formData.discount_type || loading}
                placeholder={formData.discount_type === 'percentage' ? '0-100' : '0'}
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.discount_type === 'percentage' ? 'Enter percentage (0-100)' : formData.discount_type === 'fixed' ? 'Enter fixed amount in LKR' : 'Select discount type first'}
              </p>
            </div>
          </div>

          {/* Pricing Summary */}
          {formData.room_numbers.length > 0 && formData.date_of_arrival && formData.date_of_departure && (
            <div className="mt-6 pt-6 border-t border-dark-700">
              <h3 className="text-lg font-semibold text-white mb-4">Pricing Summary</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-dark-800 rounded-lg">
                  <span className="text-gray-400">Original Room Rate</span>
                  <span className="text-white font-bold text-lg">
                    {formatCurrency(displayCharges.originalRate)}
                  </span>
                </div>
                
                {formData.discount_type && formData.discount_amount > 0 && (
                  <>
                    <div className="flex items-center justify-between p-3 bg-dark-800 rounded-lg">
                      <span className="text-gray-400">
                        Discount ({formData.discount_type === 'percentage' ? `${formData.discount_amount}%` : 'Fixed'})
                      </span>
                      <span className="text-red-400 font-bold">
                        - {formatCurrency(displayCharges.discountAmount)}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between p-4 bg-primary-600/10 border border-primary-600/20 rounded-lg">
                      <span className="text-white font-semibold text-lg">Final Amount</span>
                      <span className="text-primary-400 font-bold text-2xl">
                        {formatCurrency(displayCharges.finalRate)}
                      </span>
                    </div>
                  </>
                )}
                
                {(!formData.discount_type || formData.discount_amount === 0) && (
                  <div className="flex items-center justify-between p-4 bg-primary-600/10 border border-primary-600/20 rounded-lg">
                    <span className="text-white font-semibold text-lg">Total Amount</span>
                    <span className="text-primary-400 font-bold text-2xl">
                      {formatCurrency(displayCharges.originalRate)}
                    </span>
                  </div>
                )}
              </div>
              
              <p className="text-xs text-gray-500 mt-4">
                * Room rate calculated for {formData.room_numbers.length} room(s) from {format(new Date(formData.date_of_arrival), 'MMM dd')} to {format(new Date(formData.date_of_departure), 'MMM dd, yyyy')}
              </p>
            </div>
          )}
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center space-x-2">
            <span className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-sm">7</span>
            <span>Special Requests & Remarks</span>
          </h2>
          <div>
            <label className="label">Guest Remarks</label>
            <textarea
              name="remarks"
              value={formData.remarks}
              onChange={handleChange}
              className="input-field"
              rows="4"
              placeholder="Late check-in, special meals, accessibility requests, etc."
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-2">For informational purposes only - does not affect billing</p>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn-secondary"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary flex items-center space-x-2"
            disabled={loading || formData.room_numbers.length === 0 || Object.keys(validationErrors).length > 0}
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Save size={20} />
                <span>Register Guest</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}