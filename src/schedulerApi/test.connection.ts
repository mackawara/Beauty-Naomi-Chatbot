import axios from 'axios';
import { CONFIG } from '../config';
import { logger } from '../services/logger';

// Configure axios instance
const schedulerApi = axios.create({
  baseURL: CONFIG.BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': CONFIG.SCHEDULER_API_KEY
  }
});

// check the health of the scheduler API
async function apiHealthCheck() {
  try {
    const response = await schedulerApi.get('/health/live');
    logger.info('API Status live check:', response.data);
  } catch (error) {
    logger.error('Error fetching services:', error);
    throw error;
  }
}

//check if he scheduler is ready
async function apiHealthCheckReady() {
  try {
    const response = await schedulerApi.get('/health/ready');
    logger.info('API Status ready check:', response.data);
  } catch (error) {
    logger.error('Error fetching services:', error);
    throw error;
  }
}

// Retrieves all active services for the tenant
// Returns: List of services with id, name, description, duration, buffer time, resource type, and pricing
// Auth: Requires API key
async function apiServicesCheck() {
  try {
    const response = await schedulerApi.get('/api/services');
    logger.info('API scheduler services check:', response.data);
  } catch (error) {
    logger.error('Error fetching services:', error);
    throw error;
  }
}

// Retrieves all active staff members, optionally filtered by service
// Query params: serviceId (optional) - filters staff by resource type of the service
// Returns: List of staff with id, name, and resourceType
// Auth: Requires API key
async function apiStaffCheck(serviceId?: string) {
  try {
    const response = await schedulerApi.get('/api/staff', {
      params: serviceId ? { serviceId } : {}
    });
    logger.info('API scheduler staff check:', response.data);
  } catch (error) {
    logger.error('Error fetching staff:', error);
    throw error;
  }
}

// Gets available time slots for a specific staff member and service on a given date
// Query params: staffId (required), serviceId (required), date (required, ISO date format)
// Returns: List of available time slots
// Auth: Requires API key
async function apiAvailableSlotsCheck(staffId: string, serviceId: string, date: string) {
  try {
    const response = await schedulerApi.get('/api/slots/available', {
      params: { staffId, serviceId, date }
    });
    logger.info('API available slots check:', response.data);
  } catch (error) {
    logger.error('Error fetching available slots:', error);
    throw error;
  }
}

// Creates a temporary hold on a booking slot
// Body: staffId (required), serviceId (required), slotStartTime (required, ISO timestamp), customer object
// Headers: idempotency-key (required, 8-200 chars)
// Returns: Hold details with ID
// Auth: Requires API key
async function apiCreateHoldCheck(holdData: {
  staffId: string;
  serviceId: string;
  slotStartTime: string;
  customer: {
    name?: string;
    phone?: string;
    socialHandle?: string;
  };
  idempotencyKey: string;
}) {
  try {
    const response = await schedulerApi.post('/api/bookings/hold', holdData, {
      headers: {
        'idempotency-key': holdData.idempotencyKey
      }
    });
    logger.info('API create hold check:', response.data);
  } catch (error) {
    logger.error('Error creating hold:', error);
    throw error;
  }
}

// Confirms a held booking
// Body: holdId (required), paymentReference (optional), paymentToken (optional)
// Returns: Confirmed booking details
// Auth: Requires API key
async function apiConfirmBookingCheck(holdId: string, paymentReference?: string) {
  try {
    const response = await schedulerApi.post('/api/bookings/confirm', {
      holdId,
      paymentReference
    });
    logger.info('API confirm booking check:', response.data);
  } catch (error) {
    logger.error('Error confirming booking:', error);
    throw error;
  }
}

// Retrieves a specific booking by ID
// Params: id (booking ID)
// Returns: Booking details
// Auth: Requires API key
async function apiGetBookingCheck(bookingId: string) {
  try {
    const response = await schedulerApi.get(`/api/bookings/${bookingId}`);
    logger.info('API get booking check:', response.data);
  } catch (error) {
    logger.error('Error fetching booking:', error);
    throw error;
  }
}

// Requests an OTP for booking management operations
// Params: id (booking ID)
// Returns: 202 status with OTP request confirmation
// Auth: Requires API key
async function apiRequestOtpCheck(bookingId: string) {
  try {
    const response = await schedulerApi.post(`/api/bookings/${bookingId}/otp/request`);
    logger.info('API request OTP check:', response.data);
  } catch (error) {
    logger.error('Error requesting OTP:', error);
    throw error;
  }
}

// Verifies an OTP for booking management
// Params: id (booking ID)
// Body: code (6-digit OTP)
// Returns: Verification result
// Auth: Requires API key
async function apiVerifyOtpCheck(bookingId: string, code: string) {
  try {
    const response = await schedulerApi.post(`/api/bookings/${bookingId}/otp/verify`, { code });
    logger.info('API verify OTP check:', response.data);
  } catch (error) {
    logger.error('Error verifying OTP:', error);
    throw error;
  }
}

// Cancels a booking
// Params: id (booking ID)
// Body: reason (optional, max 300 chars)
// Auth: Requires API key + booking management auth
// Returns: Cancellation confirmation
async function apiCancelBookingCheck(bookingId: string, reason?: string) {
  try {
    const response = await schedulerApi.post(`/api/bookings/${bookingId}/cancel`, { reason });
    logger.info('API cancel booking check:', response.data);
  } catch (error) {
    logger.error('Error cancelling booking:', error);
    throw error;
  }
}

// Reschedules a booking to a new time slot
// Params: id (booking ID)
// Body: newSlotStartTime (ISO timestamp)
// Auth: Requires API key + booking management auth
// Returns: Updated booking details
async function apiRescheduleBookingCheck(bookingId: string, newSlotStartTime: string) {
  try {
    const response = await schedulerApi.patch(`/api/bookings/${bookingId}/reschedule`, {
      newSlotStartTime
    });
    logger.info('API reschedule booking check:', response.data);
  } catch (error) {
    logger.error('Error rescheduling booking:', error);
    throw error;
  }
}

// Adds a customer to the waitlist for a staff member
// Body: staffId (required), serviceId (optional), date (ISO date), customer object
// Returns: 201 with waitlist entry ID and status
// Auth: Requires API key
async function apiAddToWaitlistCheck(waitlistData: {
  staffId: string;
  serviceId?: string;
  date: string;
  customer: {
    name?: string;
    phone?: string;
    socialHandle?: string;
  };
}) {
  try {
    const response = await schedulerApi.post('/api/waitlist', waitlistData);
    logger.info('API add to waitlist check:', response.data);
  } catch (error) {
    logger.error('Error adding to waitlist:', error);
    throw error;
  }
}

//ADMIN ROUTES (AUTH REQUIRED)

// Authenticates admin user and returns access token
// Body: appSlug, email, password
// Returns: Access token and expiration time
// Auth: None (public endpoint)
async function adminLoginCheck(appSlug: string, email: string, password: string) {
  try {
    const response = await schedulerApi.post('/admin/login', {
      appSlug,
      email,
      password
    });
    logger.info('Admin login check:', response.data);
    return response.data.accessToken;
  } catch (error) {
    logger.error('Error logging in:', error);
    throw error;
  }
}

// Creates a new service
// Body: name, description, baseDurationMinutes, bufferDurationMinutes, resourceType, priceCents, currency
// Returns: 201 with service ID
// Auth: Requires admin token
async function adminCreateServiceCheck(serviceData: {
  name: string;
  description?: string;
  baseDurationMinutes: number;
  bufferDurationMinutes?: number;
  resourceType: string;
  priceCents?: number;
  currency?: string;
}, adminToken: string) {
  try {
    const response = await schedulerApi.post('/admin/services', serviceData, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    logger.info('Admin create service check:', response.data);
  } catch (error) {
    logger.error('Error creating service:', error);
    throw error;
  }
}

// Creates a new staff member
// Body: name, resourceType
// Returns: 201 with staff ID
// Auth: Requires admin token
async function adminCreateStaffCheck(staffData: {
  name: string;
  resourceType: string;
}, adminToken: string) {
  try {
    const response = await schedulerApi.post('/admin/staff', staffData, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    logger.info('Admin create staff check:', response.data);
  } catch (error) {
    logger.error('Error creating staff:', error);
    throw error;
  }
}

// Updates working hours for a staff member
// Params: id (staff ID)
// Body: array of working hours with dayOfWeek, startsAt, endsAt
// Returns: Updated working hours
// Auth: Requires admin token
async function adminUpdateWorkingHoursCheck(staffId: string, hours: Array<{
  dayOfWeek: number;
  startsAt: string;
  endsAt: string;
}>, adminToken: string) {
  try {
    const response = await schedulerApi.put(`/admin/staff/${staffId}/working-hours`, 
      { hours },
      { headers: { 'Authorization': `Bearer ${adminToken}` } }
    );
    logger.info('Admin update working hours check:', response.data);
  } catch (error) {
    logger.error('Error updating working hours:', error);
    throw error;
  }
}


// Creates a blocked time slot for a staff member
// Body: staffId, startsAt, endsAt, reason (optional)
// Returns: 201 with block ID
// Auth: Requires admin token
async function adminBlockSlotCheck(blockData: {
  staffId: string;
  startsAt: string;
  endsAt: string;
  reason?: string;
}, adminToken: string) {
  try {
    const response = await schedulerApi.post('/admin/block-slot', blockData, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    logger.info('Admin block slot check:', response.data);
  } catch (error) {
    logger.error('Error blocking slot:', error);
    throw error;
  }
}

// Removes a blocked time slot
// Params: id (block ID)
// Returns: 204 no content
// Auth: Requires admin token
async function adminDeleteBlockSlotCheck(blockId: string, adminToken: string) {
  try {
    const response = await schedulerApi.delete(`/admin/block-slot/${blockId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    logger.info('Admin delete block slot check:', response.status);
  } catch (error) {
    logger.error('Error deleting block slot:', error);
    throw error;
  }
}

// Retrieves bookings within a date range
// Query params: from (ISO timestamp), to (ISO timestamp), status (optional: HOLD, BOOKED, CANCELLED, EXPIRED)
// Returns: List of bookings with details
// Auth: Requires admin token
async function adminGetBookingsCheck(from: string, to: string, status?: string, adminToken?: string) {
  try {
    const response = await schedulerApi.get('/admin/bookings', {
      params: { from, to, ...(status ? { status } : {}) },
      headers: adminToken ? { 'Authorization': `Bearer ${adminToken}` } : {}
    });
    logger.info('Admin get bookings check:', response.data);
  } catch (error) {
    logger.error('Error fetching bookings:', error);
    throw error;
  }
}


export const testSchedulerApi = {
  // Health checks
  apiHealthCheck,
  apiHealthCheckReady,
  
  // Public/App endpoints
  apiServicesCheck,
  apiStaffCheck,
  apiAvailableSlotsCheck,
  apiCreateHoldCheck,
  apiConfirmBookingCheck,
  apiGetBookingCheck,
  apiRequestOtpCheck,
  apiVerifyOtpCheck,
  apiCancelBookingCheck,
  apiRescheduleBookingCheck,
  apiAddToWaitlistCheck,
  
  // Admin endpoints
  adminLoginCheck,
  adminCreateServiceCheck,
  adminCreateStaffCheck,
  adminUpdateWorkingHoursCheck,
  adminBlockSlotCheck,
  adminDeleteBlockSlotCheck,
  adminGetBookingsCheck
};