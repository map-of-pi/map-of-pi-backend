import mongoose, { Schema } from "mongoose";

import { IToggle } from "../../types";

const toggleSchema = new Schema<IToggle>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    enabled: {
      type: Boolean,
      required: true,
      default: false,
    },
    description: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: true, // Creates createdAt and updatedAt
    toJSON: {
      transform: function (doc, ret) {
        delete (ret as any)._id;
        delete (ret as any).__v;
        return ret;
      }
    }
  }
);

const Toggle = mongoose.model<IToggle>("Toggle", toggleSchema);

export default Toggle;
