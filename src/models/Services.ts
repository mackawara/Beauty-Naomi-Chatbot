import mongoose from "mongoose";

const servicesSchema = new mongoose.Schema({
    serviceName: {
        type: String,
        required: true,
    },
    productRetailerId: {
        type: String,
    },
    catalogId: {
        type: String,
    },
    price: {
        type: Number,
    },
    duration: {
        type: String,
        required: true,
    },
    eventTypeId: {
        type: String,
        required: true,
        unique: true,
    }

});

export const Service = mongoose.model("Service", servicesSchema);