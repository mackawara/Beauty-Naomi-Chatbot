import mongoose from "mongoose";

export type TContact = {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;

};


const contactSchema = new mongoose.Schema(
  {
    firstName: { type: String },
    lastName: { type: String },
    email: { type: String },
    phoneNumber: { type: String, required: true, unique: true },
  },
  { timestamps: true },
);

contactSchema.index(
  { email: "text", firstName: "text", lastName: "text", phoneNumber: "text" },
  {
    weights: {
      firstName: 2,
      lastName: 2,
      email: 5,
      phoneNumber: 10,
    },
  },
);
const Contact = mongoose.model("Contact", contactSchema);

export default Contact;
