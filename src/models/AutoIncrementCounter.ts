import mongoose, { Schema } from "mongoose";

export enum EnumeratedCollectionType {
  appointments = "appointments"
}

export const EnumeratedCollectionTypeDbEnum = Object.freeze([
  EnumeratedCollectionType.appointments,
]);

interface ModelInterface {
  col: string;
  cursor: number;
}
const autoIncrementCounterSchema = new Schema({
  col: {
    type: String,
    enum: EnumeratedCollectionType,
    required: [true, "Collection name must be provided"],
    unique: true,
  },
  cursor: {
    type: Number,
    default: 0,
  },
});

const AutoIncrementCounter = mongoose.model<ModelInterface>(
  "autoincrementcounter",
  autoIncrementCounterSchema
);

export { AutoIncrementCounter };
