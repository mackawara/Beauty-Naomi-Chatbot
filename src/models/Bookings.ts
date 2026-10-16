const mongoose = require('mongoose');

// Item Details Sub-schema
const bookingItemSchema = new mongoose.Schema({
  productName: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  priceAtOrder: {
    type: Number,
    required: true,
    min: 0
  },
  productRetailerId: {
    type: String,
    required: true
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
}, { _id: true }); 


const bookingSchema = new mongoose.Schema({
  bookingId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  contact: {
    type: String,
    required: true,
  },
  
  // Array of items 
  items: [bookingItemSchema],
  
  totalAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  
  serviceName: {
    type: String,
  },
  
  bookingDate: {
    type: Date,
    default: null
  },
  bookingTime: {
    type: String,
    default: ""
  },
  notes: {
    type: String,
    default: "Order received via WhatsApp"
  },
  status: {
    type: String,
    enum: ["PENDING_SLOT", "CONFIRMED", "CANCELLED"],
    default: "PENDING_SLOT",
  },
  // In-house scheduler references
  schedulerServiceId: {
    type: String,
    default: null,
  },
  schedulerAppointmentId: {
    type: String,
    default: null,
    index: true,
  },
  },
 {
  timestamps: true
});


export const Booking = mongoose.model('Booking', bookingSchema);
