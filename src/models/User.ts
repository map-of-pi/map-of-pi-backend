import mongoose, { Schema } from "mongoose";

import { IUser } from "../types";

const userSchema = new Schema<IUser>(
  {
    pi_uid: {
      type: String,
      required: true,
      unique: true,
    },
    pi_username: {
      type: String,
      required: true,
    },
    user_name: {
      type: String,
      required: true,
    }
  }
);

userSchema.index({ pi_username: "text" });

const User = mongoose.model<IUser>("User", userSchema);

export default User;
