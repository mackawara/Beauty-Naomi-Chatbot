import { FacebookAPIError } from "../types/types";
import { getNextAutoIncrementNumber } from "./getNextAutoIncrementNumber";
import validator from "validator";
import { format, parse } from 'date-fns';

const isFacebookAPIError = (error: unknown): error is FacebookAPIError => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as FacebookAPIError).response === 'object' &&
    'data' in (error as FacebookAPIError).response &&
    'error' in (error as FacebookAPIError).response.data
  );
};


  // Validate email
const validateEmail = (email: string): boolean => {
  return validator.isEmail(email);
};

// Validate phone number
const validatePhoneNumber = (phone: string): boolean => {
  return validator.isMobilePhone(phone, 'any');
};

const convertToYYMMDD = (dateString: string): string => {
  const date = new Date(dateString);
  const year = date.getFullYear().toString().slice(-2); // Get last 2 digits of year
  const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Month (01-12)
  const day = date.getDate().toString().padStart(2, '0'); // Day (01-31)
  
  return `${year}-${month}-${day}`;
};

const UTILS = {
    isFacebookAPIError,
    getNextAutoIncrementNumber,
    validateEmail,
    validatePhoneNumber,
    convertToYYMMDD
};

export default UTILS;