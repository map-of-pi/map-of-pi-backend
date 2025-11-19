import mongoose, { Schema } from "mongoose";

import { IUserSettings } from "../types";
import { DeviceLocationType } from "./enums/deviceLocationType";
import { TrustMeterScale } from "./enums/trustMeterScale";

const userSettingsSchema = new Schema<IUserSettings>(
  {
    user_settings_id: {
      type: String,
      required: true,
      unique: true
    },
    user_name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: false,
      default: null, 
    },
    phone_number: {
      type: String,
      required: false,
      default: null,
    },
    image: {
      type: String,
      required: false,
      default: ''
    },
    findme: {
      type: String,
      enum: Object.values(DeviceLocationType).filter(value => typeof value === 'string'),
      required: true,
      default: DeviceLocationType.SearchCenter
    },
    trust_meter_rating: {
      type: Number,
      enum: Object.values(TrustMeterScale).filter(value => typeof value === 'number'),
      required: true,
      default: TrustMeterScale.HUNDRED
    },
    search_map_center: {
      type: {
        type: String,
        enum: ['Point'],
        required: false,
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        required: false,
        default: [0, 0]
      },
    },
    search_filters: {
      type: {
        include_active_sellers: { type: Boolean, default: true },
        include_inactive_sellers: { type: Boolean, default: false },
        include_test_sellers: { type: Boolean, default: false },
        include_trust_level_100: { type: Boolean, default: true },
        include_trust_level_80: { type: Boolean, default: true },
        include_trust_level_50: { type: Boolean, default: true },
        include_trust_level_0: { type: Boolean, default: false },
      },
      required: true,
      default: {},
    },
  }
);

// use GeoJSON format to store geographical data i.e., points using '2dsphere' index.
userSettingsSchema.index({ search_map_center: '2dsphere' });
userSettingsSchema.index({ user_name: "text", email: "text" });

const UserSettings = mongoose.model<IUserSettings>("User-Settings", userSettingsSchema);

export default UserSettings;
