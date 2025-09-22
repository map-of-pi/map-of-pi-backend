import UserSettings from "../models/UserSettings";
import User from "../models/User";
import { DeviceLocationType } from "../models/enums/deviceLocationType";
import { IUser, IUserSettings } from "../types";

import logger from "../config/loggingConfig";

export const getUserSettingsById = async (user_settings_id: string): Promise<IUserSettings | null> => {
  try {
    const userSettings = await UserSettings.findOne({ user_settings_id }).exec();
    return userSettings;
  } catch (error: any) {
    logger.error(`Failed to retrieve user settings for userSettingsID ${ user_settings_id }: ${ error}`);
    throw error;
  }
};

export const addOrUpdateUserSettings = async (
  authUser: IUser,
  formData: any,
  image: string
): Promise<IUserSettings> => {

  try {
    // Reinstate user_name update logic
    if (formData.user_name?.trim() === "") {
      formData.user_name = authUser.pi_username;

      await User.findOneAndUpdate(
        { pi_uid: authUser.pi_uid },
        { user_name: formData.user_name },
        { new: true }
      ).exec();
    }

    const existingUserSettings = await UserSettings.findOne({
      user_settings_id: authUser.pi_uid,
    }).exec();

    const updateData: any = {};

    updateData.user_name = formData.user_name;

    // Handle image if provided
    if (image && image.trim() !== '') {
      updateData.image = image.trim();
    }

    if (formData.email || formData.email?.trim() === '') {
      updateData.email = formData.email.trim();
    }

    if (formData.phone_number || formData.phone_number?.trim() === '') {
      updateData.phone_number = formData.phone_number.trim();
    }

    if (formData.findme) {
      updateData.findme = formData.findme;
    }

     
    if (formData.wallet_address) {
      updateData.wallet_address = formData.wallet_address;
    }

    if (formData.search_filters) {
      updateData.search_filters = JSON.parse(formData.search_filters);
    }

    if (existingUserSettings) {
      // Update existing settings
      const updatedUserSettings = await UserSettings.findOneAndUpdate(
        { user_settings_id: authUser.pi_uid },
        { $set: updateData },
        { new: true }
      ).exec();

      return updatedUserSettings as IUserSettings;
    } else {
      // Create new settings
      const newUserSettings = new UserSettings({
        ...updateData,
        user_settings_id: authUser.pi_uid,
        user_name: authUser.user_name || authUser.pi_username,
        trust_meter_rating: 100,
      });

      const savedUserSettings = await newUserSettings.save();
      return savedUserSettings as IUserSettings;
    }
  } catch (error: any) {
    logger.error(`Failed to add or update user settings: ${ error }`);
    throw error;
  }
};

// Delete existing user settings
export const deleteUserSettings = async (user_settings_id: string): Promise<IUserSettings | null> => {
  try {
    const deletedUserSettings = await UserSettings.findOneAndDelete({ user_settings_id: user_settings_id }).exec();
    return deletedUserSettings ? deletedUserSettings as IUserSettings : null;
  } catch (error: any) {
    logger.error(`Failed to delete user settings for userSettingsID ${ user_settings_id }: ${ error}`);
    throw error;
  }
};

// Get device location, first trying GPS and then falling back to IP-based geolocation
export const getDeviceLocation = async (): Promise<{ lat: number; lng: number } | null> => {
  if (navigator.geolocation) {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        })
      );
      return { lat: position.coords.latitude, lng: position.coords.longitude };
    } catch (error) {
      logger.warn("GPS location error:", (error as GeolocationPositionError).message);
      // Fall back to IP-based geolocation
    }
  }
  logger.warn("Unable to get device location by GPS");
  return null; 
};

// function to get location by IP address
export const getLocationByIP = async (): Promise<{ lat: number; lng: number } | null> => {
  try {
    const response = await fetch('https://ipapi.co/json/');
    const data = await response.json();

    if (data.latitude && data.longitude) {
      return { lat: data.latitude, lng: data.longitude };
    }
    logger.warn("New user search center from IP is null")
    return null;
  } catch (error: any) {
    logger.error('Failed to retrieve location by IP:', error);
    return null;
  }
};

// Function to check user search center and return appropriate location
export const userLocation = async (uid: string): Promise<{ lat: number; lng: number } | null> => {
  const userSettings = await UserSettings.findOne({ user_settings_id: uid }).exec();

  if (!userSettings) {
    logger.warn("User settings not found");
    return null;
  }

  if (userSettings.findme === DeviceLocationType.Automatic) {
    try {
      let location = await getDeviceLocation();
      logger.warn(`[GPS] from auto findme ${location}`);
      // set to search center if GPS not available
      if (!location && userSettings.search_map_center?.coordinates){
        const searchCenter = userSettings.search_map_center.coordinates;
        location = { lng: searchCenter[0], lat: searchCenter[1] };
        logger.warn(`[Search-Center] from auto findme ${location}`)
      }
      logger.warn(`[No] from auto findme ${location}`)
      return location;

    } catch (error) {
      logger.error('Failed to retrieve device location:', error);
      return null;
    }
  }

  if (userSettings.findme === DeviceLocationType.GPS) {
    try {
      const location = await getDeviceLocation();
      logger.info("User location from GPS:", location);
      return location;

    } catch (error) {
      logger.error("Failed to retrieve device location from GPS:", error);
      return null;
    }
  }

  if (userSettings.findme === DeviceLocationType.SearchCenter && userSettings.search_map_center?.coordinates) {
    const searchCenter = userSettings.search_map_center.coordinates;
    const location = { lng: searchCenter[0], lat: searchCenter[1] };
    logger.info("User location from search center:", location);
    return location as { lat: number; lng: number };
  }

  logger.warn("Location not found");
  return null;
};
