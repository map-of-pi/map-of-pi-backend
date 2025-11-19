import mongoose from "mongoose";
import { 
  computeNewExpiryDate, 
  getChangeInWeeks, 
  getRemainingWeeks 
} from "../helpers/sellerItem";
import Membership from '../models/Membership';
import Seller from "../models/Seller";
import User from "../models/User";
import UserSettings from "../models/UserSettings";
import SellerItem from "../models/SellerItem";
import { MembershipClassType } from '../models/enums/membershipClassType';
import { SellerType } from "../models/enums/sellerType";
import { FulfillmentType } from "../models/enums/fulfillmentType";
import { StockLevelType } from '../models/enums/stockLevelType';
import { TrustMeterScale } from "../models/enums/trustMeterScale";
import { addMappiBalance, deductMappiBalance } from "./membership.service";
import { getUserSettingsById } from "./userSettings.service";
import { 
  IUser, 
  IUserSettings, 
  ISeller, 
  ISellerItem
} from "../types";
import logger from "../config/loggingConfig";
import { MappiDeductionError } from "../errors/MappiDeductionError";
import { PipelineStage } from "mongoose";

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

const buildTrustLevelCriteria = (searchFilters: any): Record<string, any> => {
  const criteria: Record<string, any> = {};

  const trustMap = [
    ["include_trust_level_100", TrustMeterScale.HUNDRED],
    ["include_trust_level_80", TrustMeterScale.EIGHTY],
    ["include_trust_level_50", TrustMeterScale.FIFTY],
    ["include_trust_level_0", TrustMeterScale.ZERO],
  ];

  const trustLevels = trustMap
    .filter(([flag]) => searchFilters[flag])
    .map(([, value]) => value);

  if (trustLevels.length > 0) {
    criteria["settings.trust_meter_rating"] = { $in: trustLevels };
  }

  return criteria;
};

export const getAllSellers = async (
  bounds?: { sw_lat: number; sw_lng: number; ne_lat: number; ne_lng: number },
  search_query?: string,
  userId?: string,
): Promise<any[]> => {
  try {
    const maxNumSellers = 50;
    const hasSearchQuery = !!(search_query && search_query.trim());

    const userSettings: any = userId ? (await getUserSettingsById(userId)) ?? {} : {};
    const searchFilters = userSettings.search_filters ?? buildDefaultSearchFilters();

    const baseCriteria = buildBaseCriteria(searchFilters);

    const trustCriteria = buildTrustLevelCriteria(searchFilters);
    if (bounds) {
      baseCriteria.sell_map_center = {
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
    }

    const pipeline: PipelineStage[] = [
      { $match: baseCriteria },
      {
        $lookup: {
          from: "memberships",
          localField: "seller_id",
          foreignField: "pi_uid",
          as: "membership",
        },
      },
      { $unwind: { path: "$membership", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "user-settings",
          localField: "seller_id",
          foreignField: "user_settings_id",
          as: "settings",
        },
      },
      { $unwind: { path: "$settings", preserveNullAndEmptyArrays: true } },
      { $match: trustCriteria },
    ];

    // 🔍 Hybrid search block
    if (hasSearchQuery) {
      const tokens = search_query.trim().split(/\s+/);

      pipeline.push(
        {
          $lookup: {
            from: "seller-items",
            let: { sid: "$seller_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$seller_id", "$$sid"] },
                      { $gt: ["$expired_by", new Date()] },
                      { $ne: ["$stock_level", StockLevelType.SOLD] },
                    ],
                  },
                },
              },
            ],
            as: "items",
          },
        },
        { $unwind: { path: "$items", preserveNullAndEmptyArrays: true } },
        {
          $match: {
            $or: [
              { name: { $regex: search_query, $options: "i" } },
              { description: { $regex: search_query, $options: "i" } },
              { address: { $regex: search_query, $options: "i" } },
              { "settings.user_name": { $regex: search_query, $options: "i" } },
              { "items.name": { $regex: search_query, $options: "i" } },
              { "items.description": { $regex: search_query, $options: "i" } },
              ...tokens.flatMap((token) => [
                { name: { $regex: token, $options: "i" } },
                { description: { $regex: token, $options: "i" } },
                { address: { $regex: token, $options: "i" } },
                { "settings.user_name": { $regex: token, $options: "i" } },
                { "items.name": { $regex: token, $options: "i" } },
                { "items.description": { $regex: token, $options: "i" } },
              ]),
            ],
          },
        },

        {
          $group: {
            _id: "$seller_id",
            doc: { $first: "$$ROOT" },
            items: { $push: "$items" },
          },
        },
        {
          $replaceRoot: {
            newRoot: {
              $mergeObjects: ["$doc", { items: "$items" }],
            },
          },
        },
      );
    }

    pipeline.push(
      {
        $addFields: {
          user_name: "$settings.user_name",
          trust_meter_rating: "$settings.trust_meter_rating",
          membership_class: "$membership.membership_class",
        },
      },
      { $sort: { updatedAt: -1 } },
      { $limit: maxNumSellers },
      {
        $project: {
          seller_id: 1,
          name: 1,
          image: 1,
          seller_type: 1,
          sell_map_center: 1,
          isRestricted: 1,
          lastSanctionUpdateAt: 1,
          items: 1,
          user_name: 1,
          trust_meter_rating: 1,
          membership_class: 1,
        },
      },
    );

    const sellers = await Seller.aggregate(pipeline).exec();
    logger.info(`Aggregated fetched sellers: ${sellers.length}`);
    return sellers;
  } catch (error: any) {
    throw new Error(`Failed to retrieve sellers: ${error.message}`);
  }
};


// Fetch a single seller by ID
export const getSingleSellerById = async (seller_id: string): Promise<ISeller | null> => {
  try {
    const [seller, userSettings, user, items, membership] = await Promise.all([
      Seller.findOne({ seller_id }).exec(),
      UserSettings.findOne({ user_settings_id: seller_id }).exec(),
      User.findOne({ pi_uid: seller_id }).exec(),
      SellerItem.find({ seller_id: seller_id }).exec(),
      Membership.findOne({ pi_uid: seller_id }).select('membership_class -_id').exec()
    ]);

    if (!seller && !userSettings && !user) {
      return null;
    }

    return {
      sellerShopInfo: seller as ISeller,
      sellerSettings: userSettings as IUserSettings,
      sellerInfo: user as IUser,
      sellerItems: items as ISellerItem[] || null,
      sellerMembership: membership?.membership_class as MembershipClassType || null,
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
): Promise<{ sellerItem: ISellerItem | null, consumedMappi: number }> => {
  try {
    logger.debug(`Seller data: ${seller.seller_id}`);

    // Find existing item by _id and seller_id
     const query = {
      _id: item._id || undefined,
      seller_id: seller.seller_id,
    };

    const existingItem = await SellerItem.findOne(query);

    let consumedMappi = 0;
    let savedItem: ISellerItem | null = null;

    if (existingItem) {
      // --- Update existing item ---
      const changeInWeeks = getChangeInWeeks(existingItem, item) ?? 0;
      logger.info(`Change in duration (weeks): ${changeInWeeks}`);

      if (changeInWeeks !== 0) {
        if (changeInWeeks > 0) {
          // Seller is extending listing; deduct Mappi
          await deductMappiBalance(seller.seller_id, changeInWeeks);
          consumedMappi = -changeInWeeks;
        } else if (changeInWeeks < 0) {
          // Seller is reducing listing; refund unused weeks
          await addMappiBalance(seller.seller_id, Math.abs(changeInWeeks), 'refund');
          consumedMappi = Math.abs(changeInWeeks);
        }
      }

      // Compute new expiry date
      const newExpiry = computeNewExpiryDate(existingItem, item);
      logger.debug(`Computed new expiry date: ${newExpiry}`);

      // Ensure duration is always valid and numeric
      const newDuration = Math.max(
        Number(existingItem.duration ?? 0) + Number(changeInWeeks ?? 0), 1);

      // Update fields
      existingItem.set({
        ...item,
        duration: newDuration,
        image: item.image || existingItem.image,
        price: item.price ?? existingItem.price,
        stock_level: item.stock_level ?? existingItem.stock_level,
        description: item.description ?? existingItem.description,
        name: item.name ?? existingItem.name,
        expired_by: newExpiry,
      });

      savedItem = await existingItem.save();
      logger.info('Seller item updated successfully', { id: savedItem._id });
    } else {
      // --- Create new item ---
      const now = new Date(Date.now());
      const duration = Math.max(Number(item.duration) || 1, 1);
      const expiredBy = new Date(now.getTime() + duration * 7 * 24 * 60 * 60 * 1000);

      // Deduct mappi for new item
      await deductMappiBalance(seller.seller_id, duration);
      consumedMappi = -duration;

      // Ensure item has a unique identifier for creation
      const newItemId = item._id || new mongoose.Types.ObjectId().toString();

      const newItem = new SellerItem({
        _id: newItemId,
        seller_id: seller.seller_id,
        name: item.name?.trim() ?? '',
        description: item.description?.trim() ?? '',
        price: item.price ?? 0.01,
        stock_level: item.stock_level ?? StockLevelType.AVAILABLE_1,
        duration,
        image: item.image ?? null,
        expired_by: expiredBy,
      });

      savedItem = await newItem.save();
      logger.info('Seller item created successfully', { id: savedItem._id });
    }

    return { sellerItem: savedItem, consumedMappi };
  } catch (error: any) {
    if (error instanceof MappiDeductionError) {
      logger.error(`MappiDeductionError for piUID ${error.pi_uid}: ${error.message}`);
      throw error;
    } else {
      logger.error(`Failed to add or update seller item for sellerID ${seller.seller_id}: ${error}`);
      throw error;
    }
  }
};

// Delete existing seller item
export const deleteSellerItem = async (id: string): Promise<ISellerItem | null> => {
  try {
    const item = await SellerItem.findById(id).exec();
    if (!item) {
      logger.warn(`Seller item with ID ${ id } not found for deletion.`);
      return null;
    }

    // refund mappi equivalent to remaining weeks if not 0
    const remweeks = getRemainingWeeks(item);
    await addMappiBalance(item.seller_id, remweeks, 'refund');
    
    const deletedSellerItem = await SellerItem.findByIdAndDelete(id).exec();
    return deletedSellerItem ? deletedSellerItem as ISellerItem : null;
  } catch (error) {
    logger.error(`Failed to delete seller item for itemID ${ id }: ${ error}`);
    throw error;
  }
};