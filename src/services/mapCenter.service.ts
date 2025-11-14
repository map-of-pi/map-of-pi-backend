import { IMapCenter } from "../types";

import Seller from "../models/Seller";
import UserSettings from "../models/UserSettings";
import logger from "../config/loggingConfig";

export const getMapCenterById = async (map_center_id: string, type: string): Promise<IMapCenter | null> => {
  try {
    if (type === 'sell') {
      let seller = await Seller.findOne({ seller_id: map_center_id }).exec();
      return seller? seller.sell_map_center as IMapCenter : null;
    } else if (type === 'search') {
      let userSettings = await UserSettings.findOne({ user_settings_id: map_center_id }).exec();
      return userSettings? userSettings.search_map_center as IMapCenter : null;
    } else {
      return null;
    }
  } catch (error: any) {
    logger.error(`Failed to retrieve Map Center for mapCenterID ${ map_center_id }: ${ error }`);
    throw error;
  }
};

export const createOrUpdateMapCenter = async (
  map_center_id: string, 
  latitude: number,
  longitude: number, 
  type: 'search' | 'sell'
): Promise<IMapCenter | null> => {
  try {
    const setCenter: IMapCenter =  {
      type: 'Point',
      coordinates: [longitude, latitude],
    }
    if (type === 'search') {
      await UserSettings.findOneAndUpdate(
        { user_settings_id: map_center_id }, 
        { search_map_center: setCenter },
        { new: true }
      ).exec();
    
    } else if (type === 'sell') {
      const existingSeller = await Seller.findOneAndUpdate(
        { seller_id: map_center_id },
        { sell_map_center: setCenter },
        { new: true }
      ).exec();      
      if (!existingSeller) {
        await Seller.create({
          seller_id: map_center_id,
          sell_map_center: setCenter,
        })
      }
    }
    return setCenter;
  } catch (error: any) {
    logger.error(`Failed to create or update Map Center for ${ type }: ${ error }`);
    throw error;
  }
};
