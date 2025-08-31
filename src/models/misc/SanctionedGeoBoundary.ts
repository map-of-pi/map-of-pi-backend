import mongoose, {Schema} from "mongoose";
import {ISanctionedGeoBoundary} from "../../types";

const sanctionedGeoBoundarySchema = new Schema<ISanctionedGeoBoundary>(
  {
    type: {
      type: String,
      enum: ["Feature"],
      required: true,
    },
    geometry: {
      type: {
        type: String,
        enum: ["Polygon"],
        required: true,
      },
      coordinates: {
        type: [[[Number]]], // 3D array for Polygon
        required: true,
      },
    },
    properties: {
      shapeName: { type: String, required: true },
      shapeISO: { type: String, required: true },
      shapeID: { type: String, required: true },
      shapeGroup: { type: String, required: true },
      shapeType: { type: String, required: true },
    },
  },
  {
    collection: "sanctioned-geo-boundaries", // 👈 This ensures it uses the correct collection
  }
);

// Add 2dsphere index for geospatial queries
sanctionedGeoBoundarySchema.index({ geometry: "2dsphere" });

const SanctionedGeoBoundary = mongoose.model<ISanctionedGeoBoundary>(
  "SanctionedGeoBoundary",
  sanctionedGeoBoundarySchema
);

export default SanctionedGeoBoundary;