import {
  isExpired,
  isSameShoppingClassType,
  getTierByClass,
  getTierRank,
} from "../helpers/membership";
import Membership from "../models/Membership";
import User from "../models/User";
import { 
  MembershipClassType, 
  membershipTiers, 
  MappiCreditType, 
  mappiCreditOptions 
} from "../models/enums/membershipClassType";
import { IMembership, IUser, MembershipOption } from "../types";

import logger from "../config/loggingConfig";
import { MappiDeductionError } from "../errors/MappiDeductionError";

/* Helper functions */
const handleSingleMappiPurchase = async (
  existing: IMembership | null,
  user: IUser
): Promise<IMembership> => {
  logger.info(`Processing single mappi purchase for user ${user.pi_uid}`);
  try {
    if (!existing) {
      // If user doesn't have a membership, create the base membership with 1 mappi
      const baseMembership = await Membership.create({
        user_id: user._id,
        pi_uid: user.pi_uid,
        membership_class: MembershipClassType.CASUAL,
        membership_expiry_date: null,
        mappi_balance: 1,
        mappi_used_to_date: 0,
      });
      return baseMembership;
    }

    // If membership exists, check if it's expired
    const expired = isExpired(existing.membership_expiry_date);

    // If expired, reset to base membership with 1 mappi
    if (expired && existing.membership_class !== MembershipClassType.CASUAL) {
      logger.info(`Expired membership reset to casual for ${user.pi_uid}`);
      const updatedMembership = await Membership.findOneAndUpdate(
        { pi_uid: user.pi_uid },
        {
          membership_class: MembershipClassType.CASUAL,
          membership_expiry_date: null,
          mappi_balance: 1,
        },
        { new: true }
      ).exec();

      if (!updatedMembership) {
        throw new Error(`Membership not found for update to base for piUID ${ user.pi_uid }`);
      }
      return updatedMembership;
    } else {
      // Increment mappi balance atomically
      const updatedMembership = await Membership.findOneAndUpdate(
        { pi_uid: user.pi_uid },
        { $inc: { mappi_balance: 1 } },
        { new: true }
      ).exec();

      if (!updatedMembership) {
        throw new Error(`Membership not found for update to increment for piUID ${ user.pi_uid }`);
      }
      return updatedMembership;
    }
  } catch (error) {
    logger.error(`Failed to handle single mappi purchase for ${user.pi_uid}: ${error}`);
    throw error;
  }
};

const handleMembershipTierPurchase = async (
  existing: IMembership | null,
  user: IUser,
  membership_class: MembershipClassType
): Promise<IMembership> => {
  try {
    const tier = getTierByClass(membership_class as MembershipClassType);
    if (!tier) {
      throw new Error(`Invalid membership class: ${membership_class}`);
    }

    const today = new Date();
    const durationMs = (tier.DURATION ?? 0) * 7 * 24 * 60 * 60 * 1000; // weeks to ms
    const newExpiryDate = tier.DURATION ? new Date(today.getTime() + durationMs) : null;
    const mappiAllowance = tier.MAPPI_ALLOWANCE;
    const newRank = tier.RANK;

    // If no existing membership, create new membership
    if (!existing) {
      logger.info(`Creating new membership ${membership_class} for user ${user.pi_uid}`);
      return await Membership.create({
        user_id: user._id,
        pi_uid: user.pi_uid,
        membership_class,
        membership_expiry_date: newExpiryDate,
        mappi_balance: mappiAllowance,
        mappi_used_to_date: 0,
      });
    }

    const currentRank = getTierRank(existing.membership_class);
    const expired = isExpired(existing.membership_expiry_date);
    const sameClassType = isSameShoppingClassType(existing.membership_class, membership_class);

    let update: Partial<IMembership> = {};

    // Different class type (e.g., online shopping vs offline shopping)
    if (!sameClassType) {
      logger.info(`Switching membership type for ${user.pi_uid} to ${membership_class}`);
      update = {
        membership_class,
        membership_expiry_date: newExpiryDate,
        mappi_balance: mappiAllowance,
      };
    // No rank change
    } else if (newRank === currentRank) {
      // Same rank & not expired then extend membership & add Mappi
      if (!expired) {
        logger.info(`Extending membership ${membership_class} for ${user.pi_uid}`);
        update = {
          membership_expiry_date: new Date(
            (existing.membership_expiry_date?.getTime() ?? today.getTime()) + durationMs
          ),
          $inc: { mappi_balance: mappiAllowance } as any, // atomic increment
        };
      // Same rank & expired then reset expiry & Mappi
      } else {
        logger.info(`Renewing expired membership ${membership_class} for ${user.pi_uid}`);
        update = {
          membership_expiry_date: newExpiryDate,
          mappi_balance: mappiAllowance,
        };
      }
    // Rank change with upgrade or downgrade
    } else if (newRank !== currentRank) {
      logger.info(`Changing rank from ${existing.membership_class} to ${membership_class} for ${user.pi_uid}`);
      update = {
        membership_class,
        membership_expiry_date: newExpiryDate,
        $inc: { mappi_balance: mappiAllowance } as any,
      };
    }

    // Apply the update atomically
    const updatedMembership = await Membership.findOneAndUpdate(
      { pi_uid: user.pi_uid },
      update,
      { new: true }
    ).exec();

    if (!updatedMembership) {
      throw new Error(`Membership not found during update for ${user.pi_uid}`);
    }
    
    return updatedMembership;
  } catch (error) {
    logger.error(`Failed to handle membership tier purchase for ${user.pi_uid}: ${error}`);
    throw error;
  }
};

export const buildMembershipList = async (): Promise<MembershipOption[]> => {
  try {
    // Single class at the top
    const purchaseOptions: MembershipOption = {
      value: MappiCreditType.SINGLE as unknown as MembershipClassType, // Casting so type fits MembershipOption
      cost: mappiCreditOptions.COST,
      duration: mappiCreditOptions.DURATION ?? null,
      mappi_allowance: mappiCreditOptions.MAPPI_ALLOWANCE ?? 0,
    };

    // Membership tiers except CASUAL
    const membershipOptions = Object.values(membershipTiers)
      .filter(tier => tier.CLASS !== MembershipClassType.CASUAL) 
      .map((tier) => ({
        value: tier.CLASS as MembershipClassType,
        cost: tier.COST,
        duration: tier.DURATION ?? null,
        mappi_allowance: tier.MAPPI_ALLOWANCE ?? 0,
      }))
      .sort((a, b) => {
        const rankA = Object.values(membershipTiers).find(t => t.CLASS === a.value)?.RANK ?? 0;
        const rankB = Object.values(membershipTiers).find(t => t.CLASS === b.value)?.RANK ?? 0;
        return rankA - rankB;
      });

    return [purchaseOptions, ...membershipOptions]
  } catch (error) {
    logger.error('Failed to build membership list', { error });
    throw error; 
  }
};

export const getUserMembership = async (authUser: IUser): Promise<IMembership> => {
  try {
    const membership = await Membership.findOne({ pi_uid: authUser.pi_uid }).lean();
    
    if (!membership) {
      const user = await User.findOne({ pi_uid: authUser.pi_uid }).lean();
      const newMembership = await new Membership({
        user_id: user?._id,
        pi_uid: authUser.pi_uid,
        membership_class: MembershipClassType.CASUAL,
        membership_expiry_date:  null,
        mappi_balance: 0,
        mappi_used_to_date: 0,
      }).save()

      return newMembership.toObject()
    }
    return membership;
  } catch (error) {
    logger.error(`Failed to get user membership for piUID ${ authUser.pi_uid }: ${ error }`);
    throw error;
  }
};

export const getSingleMembershipById = async (membership_id: string) => {
  try {
    return await Membership.findById(membership_id).lean() ?? null;
  } catch (error) {
    logger.error(`Failed to get single membership with ID ${ membership_id }: ${ error }`);
    throw error;
  }
};

export const applyMembershipChange = async (
  piUid: string, 
  membership_class: MembershipClassType | MappiCreditType
): Promise<IMembership> => {
  try {
    // Get user first
    const user = await User.findOne({ pi_uid: piUid }).lean();
    if (!user) {
      throw new Error(`User with pi_uid ${piUid} not found`);
    }

    // Get existing membership if any
    const existing = await Membership.findOne({ user_id: user?._id });

    // Single Mappi purchase case 
    if (membership_class === MappiCreditType.SINGLE) {
      return await handleSingleMappiPurchase(existing, user);
    } 

    // Membership tier purchase case
    return await handleMembershipTierPurchase(
      existing, user, 
      membership_class as MembershipClassType
    )
  } catch (error) {
    logger.error(`Failed to apply membership change for ${ piUid }: ${ error }`);
    throw error;
  }
};

export const addMappiBalance = async (
  pi_uid: string, 
  amount: number,
  type: string
): Promise<number> => {
  if (amount <= 0) {
    logger.warn(`Attempted to ${type} non-positive Mappi amount for ${pi_uid}: ${amount}`);
    return 0;
  }

  try {
    const updatedMembership = await Membership.findOneAndUpdate(
      { pi_uid },
      { $inc: { mappi_balance: amount } },
      { new: true }
    ).exec();

    if (!updatedMembership) {
      throw new Error(`Membership not found or unable to ${type} ${amount} Mappi to balance for ${pi_uid}`);
    }
    logger.info(`Mappi added successfully`, {
      pi_uid,
      amount,
      type,
      new_balance: updatedMembership.mappi_balance,
    });

    return amount;
  } catch (error) {
    logger.error(`Failed to ${type} Mappi to balance for ${pi_uid}: ${error}`);
    throw error;
  }
};

export const deductMappiBalance = async (
  pi_uid: string, 
  amount: number
): Promise<number> => {
  
  if (amount === 0) return 0;
  
  try {
    // Atomic deduction: only succeeds if balance is sufficient
    const updatedMembership = await Membership.findOneAndUpdate(
      { pi_uid, mappi_balance: { $gte: amount } }, // only update if balance is sufficient
      { $inc: { mappi_balance: -amount } },
      { new: true }
    ).exec();

    if (!updatedMembership) {
      throw new MappiDeductionError(pi_uid, amount, 'Membership not found or insufficient balance');
    }

    logger.info(`Mappi deducted successfully`, {
      pi_uid,
      amount,
      remaining_balance: updatedMembership.mappi_balance,
    });

    return amount;
  } catch (err: any) {
    const message = err instanceof Error ? err.message : String(err);

    const errorToThrow =
      err instanceof MappiDeductionError
        ? err
        : new MappiDeductionError(pi_uid, amount, message || 'Unknown error');

    logger.error(`${errorToThrow.name} for piUID ${ pi_uid }: ${ message }`);
    throw errorToThrow;
  }
};