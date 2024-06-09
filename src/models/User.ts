import mongoose, { Schema } from "mongoose";

import { IUser } from "../types";

const userSchema = new Schema<IUser>(
  {
    user_id: {
      type: String,
      required: false,
    },
    username: {
      type: String,
      required: true,
    }
  }
);

const User = mongoose.model<IUser>("User", userSchema);

export default User;
