import mongoose from "mongoose";
import { MembershipClassType } from "./enums/membershipClassType";
import { IMembership } from "../types";

const membershipSchema = new mongoose.Schema<IMembership>(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User',
      required: true,
      unique: true
    },
    pi_uid: {
      type: String,
      required: true,
      unique: true,
      ref: 'User',
    },
    membership_class: {
      type: String,
      required: true,
      default: MembershipClassType.CASUAL,
      enum: Object.values(MembershipClassType)
    },
    mappi_balance: {
      type: Number,
      required: true,
      default: 0,
      validate: {
        validator: (value: number) => value >= 0,
        message: "mappi_balance must be a non-negative number.",
      },
    },
    membership_expiry_date: {
      type: Date,
      required: false,
      default: null
    },
    mappi_used_to_date: {
      type: Number,
      required: true,
      default: 0
    },
  },
  { timestamps: true }
);

const Membership = mongoose.model<IMembership>('Membership', membershipSchema);

export default Membership;