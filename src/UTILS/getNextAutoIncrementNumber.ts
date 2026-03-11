import { AutoIncrementCounter } from "../models/AutoIncrementCounter";
import mongoose from "mongoose";

export const getNextAutoIncrementNumber = async (
  collectionName: string,
  session: mongoose.ClientSession | null = null
) => {
  const counter = await AutoIncrementCounter.findOneAndUpdate(
    { col: collectionName },
    { $inc: { cursor: 1 } },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
      runValidators: true,
      session: session !== null ? session : undefined,
    }
  );

  if (!counter) {
     throw new Error(
       `Failed to get or create auto-increment counter for collection "${collectionName}".`
     );
   }
  return counter.cursor;
};