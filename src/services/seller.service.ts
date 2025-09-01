import mongoose from 'mongoose';
import Seller from "../models/Seller";
import User from "../models/User";
import UserSettings from "../models/UserSettings";
import SellerItem from "../models/SellerItem";
import { SellerType } from '../models/enums/sellerType';
import { FulfillmentType } from "../models/enums/fulfillmentType";
import { StockLevelType } from '../models/enums/stockLevelType';
import { TrustMeterScale } from "../models/enums/trustMeterScale";
import { getUserSettingsById } from "./userSettings.service";
import { IUser, IUserSettings, ISeller, ISellerWithSettings, ISellerItem } from "../types";

import logger from "../config/loggingConfig";
import { computeNewExpiryDate, getChangeInWeeks } from '../helpers/sellerItem';
import { deductMappiBalance } from './membership.service';

/* Helper Functions */
const buildDefaultSearchFilters = () => {
  return {
    include_active_sellers: true,
    include_inactive_sellers: false,
    include_test_sellers: false,
    include_trust_level_100: true,
    include_trust_level_80: true,
    include_trust_level_50: true,
    include_trust_level_0: false,
  }
};

const buildBaseCriteria = (searchFilters: any): Record<string, any> => {
  const criteria: Record<string, any> = { isRestricted: { $ne: true } };

  // [Seller Type Filter]
  const sellerTypeFilters: SellerType[] = [];
  if (searchFilters.include_active_sellers) sellerTypeFilters.push(SellerType.Active);
  if (searchFilters.include_inactive_sellers) sellerTypeFilters.push(SellerType.Inactive);
  if (searchFilters.include_test_sellers) sellerTypeFilters.push(SellerType.Test);

  // include filtered seller types
  if (sellerTypeFilters.length > 0) {
    criteria.seller_type = { $in: sellerTypeFilters };
  }

  return criteria;
};

const buildTrustLevelFilters = (searchFilters: any): TrustMeterScale[] => {
  const trustLevels = [
    { key: "include_trust_level_100", value: TrustMeterScale.HUNDRED },
    { key: "include_trust_level_80", value: TrustMeterScale.EIGHTY },
    { key: "include_trust_level_50", value: TrustMeterScale.FIFTY },
    { key: "include_trust_level_0", value: TrustMeterScale.ZERO },
  ];
  return trustLevels
    .filter(({ key }) => searchFilters[key])
    .map(({ value }) => value);
};

const buildSearchQuery = async (
  baseCriteria: Record<string, any>, search_query?: string
): Promise<Record<string, any>> => {
  if (!search_query) return baseCriteria;

  // Match sellers via items
  const sellerIdsFromItems = await SellerItem.find({
    stock_level: { $ne: StockLevelType.SOLD },
    expired_by: { $gt: new Date() },
    $text: { $search: search_query },
  }).distinct("seller_id");

  // If any sellers matched via items, combine using $or
  if (sellerIdsFromItems.length > 0) {
    return { 
      ...baseCriteria,
      $or: [
        { $text: { $search: search_query, $caseSensitive: false } },
        { seller_id: { $in: sellerIdsFromItems } }
      ]
    };
  }

  // If no sellers matched via items, just search text at top level
  return {
    ...baseCriteria,
    $text: { $search: search_query, $caseSensitive: false }
  };
};

const addGeoFilter = (
  criteria: Record<string, any>, 
  bounds?: { sw_lat: number, sw_lng: number, ne_lat: number, ne_lng: number }
) => {
  if (!bounds) return;
  criteria.sell_map_center = {
    $geoWithin: {
      $geometry: {
        type: "Polygon",
        coordinates: [[
          [bounds.sw_lng, bounds.sw_lat],
          [bounds.ne_lng, bounds.sw_lat],
          [bounds.ne_lng, bounds.ne_lat],
          [bounds.sw_lng, bounds.ne_lat],
          [bounds.sw_lng, bounds.sw_lat],
        ]],
      },
    },
  };
}; 

// Helper function to get settings for all sellers and merge them into seller objects
const resolveSellerSettings = async (
  sellers: ISeller[],
  trustLevelFilters?: number[]
): Promise<ISellerWithSettings[]> => {

  if (!sellers.length) return [];

  const sellerIds = sellers.map(seller => seller.seller_id);

  // Batch fetch all relevant user settings in a single query
  const allUserSettings = await UserSettings.find({
    user_settings_id: { $in: sellerIds }
  }).exec();

  // Create a map for quick user settings lookup
  const settingsMap = new Map(
    allUserSettings.map(setting => [setting.user_settings_id, setting])
  );

  const sellersWithSettings = sellers.map((seller) => {
    const sellerObject = seller.toObject();
    const userSettings = settingsMap.get(seller.seller_id);

    // Check if the seller's trust level is allowed
    const trustMeterRating = userSettings?.trust_meter_rating ?? -1;
    if (trustLevelFilters && !trustLevelFilters.includes(trustMeterRating)) {
      return null; // Exclude this seller
    }

    try {
      return {
        ...sellerObject,
        trust_meter_rating: trustMeterRating,
        user_name: userSettings?.user_name,
        findme: userSettings?.findme,
        email: userSettings?.email ?? null,
        phone_number: userSettings?.phone_number ?? null,
        search_filters: userSettings?.search_filters ?? null,
      } as ISellerWithSettings;
    } catch (error) {
      logger.error(`Failed to resolve settings for sellerID ${seller.seller_id}:`, error);

      // Return a fallback seller object with minimal information
      return {
        ...sellerObject,
        trust_meter_rating: TrustMeterScale.ZERO,
        user_name: seller.name,
        findme: null,
        email: null,
        phone_number: null,
      } as unknown as ISellerWithSettings;
    }
  });

  return sellersWithSettings.filter(Boolean) as ISellerWithSettings[];
};

// Fetch all sellers or within a specific bounding box; optional search query.
export const getAllSellers = async (
  bounds?: { sw_lat: number, sw_lng: number, ne_lat: number, ne_lng: number },
  search_query?: string,
  userId?: string,
): Promise<ISellerWithSettings[]> => {
  try {
    const maxNumSellers = 50;

    // Load user settings with defaults
    const userSettings: any = userId ? await getUserSettingsById(userId) ?? {} : {};
    const searchFilters = userSettings.search_filters ?? buildDefaultSearchFilters();

    // Build criteria
    const baseCriteria = buildBaseCriteria(searchFilters);
    // [Geo Filter]
    addGeoFilter(baseCriteria, bounds);
    // [Trust Level Filters]
    const trustLevelFilters = buildTrustLevelFilters(searchFilters);

    // Build seller query
    const sellerQuery = await buildSearchQuery(baseCriteria, search_query);
    
    // Execute query
    const finalSellerDocs = await Seller.find(sellerQuery)
      .sort({ updatedAt: -1 })
      .limit(maxNumSellers)
      .exec();

    // Post-filter + merge settings
    return await resolveSellerSettings(finalSellerDocs, trustLevelFilters);
  } catch (error) {
    logger.error(`Failed to get all sellers: ${ error }`);
    throw error;
  }
};

// Fetch a single seller by ID
export const getSingleSellerById = async (seller_id: string): Promise<ISeller | null> => {
  try {
    const [seller, userSettings, user, items] = await Promise.all([
      Seller.findOne({ seller_id }).exec(),
      UserSettings.findOne({ user_settings_id: seller_id }).exec(),
      User.findOne({ pi_uid: seller_id }).exec(),
      SellerItem.find({ seller_id: seller_id }).exec()
    ]);

    if (!seller && !userSettings && !user) {
      return null;
    }

    return {
      sellerShopInfo: seller as ISeller,
      sellerSettings: userSettings as IUserSettings,
      sellerInfo: user as IUser,
      sellerItems: items as ISellerItem[] || null
    } as any;
  } catch (error) {
    logger.error(`Failed to get single seller for sellerID ${ seller_id }: ${ error }`);
    throw error;
  }
};

export const registerOrUpdateSeller = async (authUser: IUser, formData: any): Promise<ISeller> => {
  try {
    const existingSeller = await Seller.findOne({ seller_id: authUser.pi_uid }).exec();

    // Parse and validate sell_map_center from formData
    const sellMapCenter = (formData.sell_map_center && formData.sell_map_center !== 'undefined')
      ? JSON.parse(formData.sell_map_center)
      : existingSeller?.sell_map_center || { type: 'Point', coordinates: [0, 0] };

    // Construct seller object while merging with existing data if necessary
    const sellerData: Partial<ISeller> = {
      seller_id: authUser.pi_uid,
      name: formData.name || existingSeller?.name || authUser.user_name,
      description: formData.description || existingSeller?.description || '',
      seller_type: formData.seller_type || existingSeller?.seller_type || '',
      image: formData.image || existingSeller?.image || '',
      address: formData.address || existingSeller?.address || '',
      sell_map_center: sellMapCenter,
      order_online_enabled_pref: formData.order_online_enabled_pref || existingSeller?.order_online_enabled_pref || false,
      fulfillment_method: formData.fulfillment_method || existingSeller?.fulfillment_method || FulfillmentType.CollectionByBuyer,
      fulfillment_description: formData.fulfillment_description || existingSeller?.fulfillment_description || ''
    };

    // Update existing seller or create a new one
    if (existingSeller) {
      const updatedSeller = await Seller.findOneAndUpdate(
        { seller_id: authUser.pi_uid },
        { $set: sellerData },
        { new: true }
      ).exec();
      logger.debug('Seller updated in the database:', updatedSeller);
      return updatedSeller as ISeller;
    } else {
      const shopName = sellerData.name || authUser.user_name;
      const newSeller = new Seller({
        ...sellerData,
        name: shopName,
        average_rating: 5.0,
        order_online_enabled_pref: false,
      });
      const savedSeller = await newSeller.save();
      logger.info('New seller created in the database:', savedSeller);
      return savedSeller as ISeller;
    }
  } catch (error) {
    logger.error(`Failed to register or update seller: ${ error }`);
    throw error;
  }
};

// Delete existing seller
export const deleteSeller = async (seller_id: string | undefined): Promise<ISeller | null> => {
  try {
    const deletedSeller = await Seller.findOneAndDelete({ seller_id }).exec();
    return deletedSeller ? deletedSeller as ISeller : null;
  } catch (error) {
    logger.error(`Failed to delete seller for sellerID ${ seller_id }: ${ error }`);
    throw error;
  }
};

export const getAllSellerItems = async (
  seller_id: string,
): Promise<ISellerItem[] | null> => {
  try {
    const existingItems = await SellerItem.find({
      seller_id: seller_id,
    });

    if (!existingItems || existingItems.length == 0) {
      logger.warn('Item list is empty.');
      return null;
    }
    logger.info('fetched item list successfully');
    return existingItems as ISellerItem[];
  } catch (error) {
    logger.error(`Failed to get seller items for sellerID ${ seller_id }: ${ error }`);
    throw error;
  }
};

export const addOrUpdateSellerItem = async (
  seller: ISeller,
  item: ISellerItem
): Promise<{sellerItem: ISellerItem | null, consumedMappi: number} | null> => {
  try {
    logger.debug(`Seller data: ${ seller }`);

    // Ensure unique identifier is used for finding existing items
    const query = {
      _id: item._id || undefined,
      seller_id: seller.seller_id,
    };
    let consumedMappi = 0;
    let addedItem = null;

    // Attempt to find the existing item
    const existingItem = await SellerItem.findOne(query);

    if (existingItem) {
      const changeInDuration = getChangeInWeeks(existingItem, item);
      logger.debug(`Change in duration (weeks): ${ changeInDuration }`);

      const newExpiry = computeNewExpiryDate(existingItem, item);
      logger.debug(`Computed new expiry date: ${ newExpiry }`);

      // Update the existing item
      existingItem.set({
        ...item,
        duration: existingItem.duration + changeInDuration,
        expired_by: newExpiry,
        image: item.image || existingItem.image, // Use existing image if a new one isn't provided
      });
      addedItem = await existingItem.save();
      
      // logger.info('Item updated successfully:', { addedItem });
      consumedMappi = changeInDuration;
    } else {
      const now = new Date();

      // Calculate expiration date based on duration (defaults to 1 week)
      const duration = Number(item.duration) || 1;
      const expiredBy = new Date(now.getTime() + duration * 7 * 24 * 60 * 60 * 1000);

      // Ensure item has a unique identifier for creation
      const newItemId = item._id || new mongoose.Types.ObjectId().toString();

      // Create a new item
      const newItem = new SellerItem({
        _id: newItemId,
        seller_id: seller.seller_id,
        name: item.name ? item.name.trim() : '',
        description: item.description ? item.description.trim() : '',
        price: parseFloat(item.price?.toString() || '0.01'), // Ensure valid price
        stock_level: item.stock_level || StockLevelType.AVAILABLE_1,
        duration: parseInt(item.duration?.toString() || '1'), // Ensure valid duration
        image: item.image,
        expired_by: expiredBy,
      });

      addedItem = await newItem.save();

      logger.info('Item created successfully:', { newItem });
      consumedMappi = duration;
    }
    // Deduct consumed mappi
    consumedMappi > 0 ? deductMappiBalance(seller.seller_id, consumedMappi): null

    return {sellerItem: addedItem, consumedMappi: -consumedMappi}
  } catch (error) {
    logger.error(`Failed to add or update seller item for sellerID ${ seller.seller_id}: ${ error }`);
    throw error;
  }
};

// Delete existing seller item
export const deleteSellerItem = async (id: string): Promise<ISellerItem | null> => {
  try {
    const deletedSellerItem = await SellerItem.findByIdAndDelete(id).exec();
    return deletedSellerItem ? deletedSellerItem as ISellerItem : null;
  } catch (error) {
    logger.error(`Failed to delete seller item for itemID ${ id }: ${ error}`);
    throw error;
  }
};