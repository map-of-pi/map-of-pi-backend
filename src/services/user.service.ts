import User from "../models/User";
import UserSettings from "../models/UserSettings";
import Seller from "../models/Seller";
import { getLocationByIP } from "./userSettings.service";
import { getUserMembership } from "./membership.service";
import { ISeller, IUser, IUserSettings } from "../types";
import logger from "../config/loggingConfig";

/* Helper functions */
const getCoordinatesWithRetry = async (
  // Retries up to 3 times with 1s delay to get user's coordinates via IP
  retries: number = 3,
  delay: number = 1000 // Delay in milliseconds
): Promise<{ lat: number; lng: number } | null> => {
  let attempt = 0;
  while (attempt < retries) {
    const coordinates = await getLocationByIP();
    if (coordinates) {
      return coordinates;
    }
    attempt++;
    logger.warn(`Retrying IP location fetch (${attempt}/${retries})...`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  logger.warn('Failed to fetch IP coordinates after maximum retries');
  return null;
};

const findOrCreateUser = async (currentUser: IUser): Promise<IUser> => {
  const existingUser = await User.findOne({
    pi_uid: currentUser.pi_uid,
    pi_username: currentUser.pi_username
  }).setOptions({ 
    readPreference: 'primary' 
  }).exec();

  if (existingUser) return existingUser;

  return User.create({
    pi_uid: currentUser.pi_uid,
    pi_username: currentUser.pi_username,
    user_name: currentUser.user_name
  });
};

const createUserSettings = async (currentUser: IUser): Promise<void> => {
  const coordinates = await getCoordinatesWithRetry(3, 1000);

  const settings: Partial<IUserSettings> = {
    user_settings_id: currentUser.pi_uid,
    user_name: currentUser.user_name,
  };

  if (coordinates) {
    settings.search_map_center = {
      type: 'Point',
      coordinates: [coordinates.lng, coordinates.lat],
    };
  }

  await UserSettings.create(settings);
};

export const authenticate = async (
  currentUser: IUser
): Promise<{ user: IUser, membership_class: string }> => {
  try {
    const user = await findOrCreateUser(currentUser);

    // Optional: detect newly created user if needed
    const userSettings = await UserSettings.findOne({user_settings_id: currentUser.pi_uid}).lean().exec();
    if (!userSettings) {
      await createUserSettings(currentUser);
    }

    const userMembership = await getUserMembership(user);

    return {
      user: user,
      membership_class: userMembership.membership_class
    };
  } catch (error) {
    logger.error(`Failed to authenticate user: ${ error }`);
    throw error;
  }
};

export const getUser = async (pi_uid: string): Promise<IUser | null> => {
  try {
    const user = await User.findOne({ pi_uid }).exec();
    return user ? user as IUser : null;
  } catch (error) {
    logger.error(`Failed to retrieve user for piUID ${ pi_uid }: ${ error }`);
    throw error;
  }
};

export const deleteUser = async (pi_uid: string | undefined): Promise<{ user: IUser | null, sellers: ISeller[], userSetting: IUserSettings }> => {
  try {
    // delete any association with Seller
    const deletedSellers = await Seller.find({ seller_id: pi_uid }).exec();
    await Seller.deleteMany({ seller_id: pi_uid }).exec();

    // delete any association with User Settings
    const deletedUserSettings = await UserSettings.findOneAndDelete({ user_settings_id: pi_uid }).exec();

    // delete the user
    const deletedUser = await User.findOneAndDelete({ pi_uid }).exec();
    return {
      user: deletedUser ? deletedUser as IUser : null,
      sellers: deletedSellers as ISeller[],
      userSetting: deletedUserSettings as IUserSettings
    }
  } catch (error) {
    logger.error(`Failed to delete user or user association for piUID ${ pi_uid }: ${ error }`);
    throw error;
  }
};