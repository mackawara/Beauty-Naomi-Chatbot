import { FacebookAPIError } from "../types/types";
import { getNextAutoIncrementNumber } from "./getNextAutoIncrementNumber";

const isFacebookAPIError = (error: unknown): error is FacebookAPIError => {
  return (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as FacebookAPIError).response === "object" &&
    "data" in (error as FacebookAPIError).response &&
    "error" in (error as FacebookAPIError).response.data
  );
};

const UTILS = {
  isFacebookAPIError,
  getNextAutoIncrementNumber,
};

export default UTILS;
