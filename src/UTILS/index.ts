import { FacebookAPIError } from "../types/types";
import { getNextAutoIncrementNumber } from "./getNextAutoIncrementNumber";

const isFacebookAPIError = (error: unknown): error is FacebookAPIError => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as FacebookAPIError).response === 'object' &&
    (error as FacebookAPIError).response !== null &&
    'data' in (error as FacebookAPIError).response &&
    // Non-JSON error bodies (e.g. from a proxy) arrive as strings
    typeof (error as FacebookAPIError).response.data === 'object' &&
    (error as FacebookAPIError).response.data !== null &&
    'error' in (error as FacebookAPIError).response.data
  );
};

const UTILS = {
    isFacebookAPIError,
    getNextAutoIncrementNumber
};

export default UTILS;