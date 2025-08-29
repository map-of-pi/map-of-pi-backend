import { 
  MembershipClassType, 
  MappiCreditType,
  membershipTiers
} from '../models/enums/membershipClassType';

export const isExpired = (date?: Date | null): boolean => 
  date === undefined ? true : date === null ? false : date < new Date();

export const isOnlineShoppingClass = (tier: MembershipClassType): boolean =>
  [
    MembershipClassType.GREEN,
    MembershipClassType.GOLD,
    MembershipClassType.DOUBLE_GOLD,
    MembershipClassType.TRIPLE_GOLD,
  ].includes(tier);

export const isOfflineShoppingClass = (tier: MembershipClassType): boolean =>
  [
    MembershipClassType.CASUAL,
    MembershipClassType.WHITE,
  ].includes(tier);

export const isMappiCreditType = (credit: MappiCreditType): boolean =>
  [
    MappiCreditType.SINGLE 
  ].includes(credit);

export const isSameShoppingClassType = (a: MembershipClassType, b: MembershipClassType): boolean =>
  (isOnlineShoppingClass(a) && isOnlineShoppingClass(b)) || (isOfflineShoppingClass(a) && isOfflineShoppingClass(b));

export const getTierByClass = (tierClass: MembershipClassType) => {
  return Object.values(membershipTiers).find((tier) => tier.CLASS === tierClass);
};

export const getTierRank = (tierClass: MembershipClassType): number => {
  return getTierByClass(tierClass)?.RANK ?? -1;
};