import { 
  isExpired,
  isOnlineShoppingClass,
  isOfflineShoppingClass,
  isSameShoppingClassType,
  getTierByClass,
  getTierRank,
  isMappiCreditType
} from  '../../src/helpers/membership';
import { 
  MembershipClassType, 
  MappiCreditType, 
  membershipTiers 
} from '../../src/models/enums/membershipClassType';

describe('isExpired function ', () => {
  it('should return true if the date is undefined', () => {
    expect(isExpired(undefined)).toBe(true);
  });

  it('should return false if the date is null', () => {
    expect(isExpired(null)).toBe(false);
  });

  it('should return true if the date is in the past', () => {
    const today = new Date();
    today.setMonth(today.getMonth() - 1); // 1 month in the past
    expect(isExpired(today)).toBe(true);
  });

  it('should return false if the date is in the future', () => {
    const today = new Date();
    today.setMonth(today.getMonth() + 1); // 1 month in the future
    expect(isExpired(today)).toBe(false);
  });

  it('should return true if the date is today and slightly in the past', () => {
    const today = new Date(Date.now() - 10); // 10 ms in past
    expect(isExpired(today)).toBe(true);
  });

  it('should return false if the date is today and slightly in the future', () => {
    const today = new Date(Date.now() + 10); // 10 ms in future
    expect(isExpired(today)).toBe(false);
  });
});

describe('isOnlineShoppingClass function', () => {
  it('should return true for GREEN membership tier', () => {
    expect(isOnlineShoppingClass(MembershipClassType.GREEN)).toBe(true);
  });

  it('should return true for GOLD membership tier', () => {
    expect(isOnlineShoppingClass(MembershipClassType.GOLD)).toBe(true);
  });

  it('should return true for DOUBLE_GOLD membership tier', () => {
    expect(isOnlineShoppingClass(MembershipClassType.DOUBLE_GOLD)).toBe(true);
  });

  it('should return true for TRIPLE_GOLD membership tier', () => {
    expect(isOnlineShoppingClass(MembershipClassType.TRIPLE_GOLD)).toBe(true);
  });

  it('should return false for WHITE membership tier', () => {
    expect(isOnlineShoppingClass(MembershipClassType.WHITE)).toBe(false);
  });

  it('should return false for CASUAL membership tier', () => {
    expect(isOnlineShoppingClass(MembershipClassType.CASUAL)).toBe(false);
  });
});

describe('isOfflineShoppingClass function', () => {
  it('should return true for CASUAL membership tier', () => {
    expect(isOfflineShoppingClass(MembershipClassType.CASUAL)).toBe(true);
  });

  it('should return true for WHITE membership tier', () => {
    expect(isOfflineShoppingClass(MembershipClassType.WHITE)).toBe(true);
  });

  it('should return false for GREEN membership tier', () => {
    expect(isOfflineShoppingClass(MembershipClassType.GREEN)).toBe(false);
  });

  it('should return false for GOLD membership tier', () => {
    expect(isOfflineShoppingClass(MembershipClassType.GOLD)).toBe(false);
  });

  it('should return false for DOUBLE_GOLD membership tier', () => {
    expect(isOfflineShoppingClass(MembershipClassType.DOUBLE_GOLD)).toBe(false);
  });

  it('should return false for TRIPLE_GOLD membership tier', () => {
    expect(isOfflineShoppingClass(MembershipClassType.TRIPLE_GOLD)).toBe(false);
  });
});

describe('isMappiCreditType function', () => {
  it('should return true for SINGLE credit type', () => {
    expect(isMappiCreditType(MappiCreditType.SINGLE)).toBe(true);
  });
});

describe('isSameShoppingClassType function', () => {
  it('should return true for two online shopping class tiers', () => {
    expect(isSameShoppingClassType(MembershipClassType.GREEN, MembershipClassType.GOLD)).toBe(true);
    expect(isSameShoppingClassType(MembershipClassType.GREEN, MembershipClassType.DOUBLE_GOLD)).toBe(true);
    expect(isSameShoppingClassType(MembershipClassType.GREEN, MembershipClassType.TRIPLE_GOLD)).toBe(true);
    expect(isSameShoppingClassType(MembershipClassType.GOLD, MembershipClassType.DOUBLE_GOLD)).toBe(true);
    expect(isSameShoppingClassType(MembershipClassType.GOLD, MembershipClassType.TRIPLE_GOLD)).toBe(true);
    expect(isSameShoppingClassType(MembershipClassType.DOUBLE_GOLD, MembershipClassType.TRIPLE_GOLD)).toBe(true);
  });

  it('should return true for two offline shopping class tiers', () => {
    expect(isSameShoppingClassType(MembershipClassType.CASUAL, MembershipClassType.WHITE)).toBe(true);
  });

  it('should return false for online shopping class vs offline shopping class tiers', () => {
    expect(isSameShoppingClassType(MembershipClassType.CASUAL, MembershipClassType.GREEN)).toBe(false);
    expect(isSameShoppingClassType(MembershipClassType.CASUAL, MembershipClassType.GOLD)).toBe(false);
    expect(isSameShoppingClassType(MembershipClassType.CASUAL, MembershipClassType.DOUBLE_GOLD)).toBe(false);
    expect(isSameShoppingClassType(MembershipClassType.CASUAL, MembershipClassType.TRIPLE_GOLD)).toBe(false);
    expect(isSameShoppingClassType(MembershipClassType.WHITE, MembershipClassType.GREEN)).toBe(false);
    expect(isSameShoppingClassType(MembershipClassType.WHITE, MembershipClassType.GOLD)).toBe(false);
    expect(isSameShoppingClassType(MembershipClassType.WHITE, MembershipClassType.DOUBLE_GOLD)).toBe(false);
    expect(isSameShoppingClassType(MembershipClassType.WHITE, MembershipClassType.TRIPLE_GOLD)).toBe(false);
  });

  it('should return true for identical shopping class tiers', () => {
    expect(isSameShoppingClassType(MembershipClassType.CASUAL, MembershipClassType.CASUAL)).toBe(true);
    expect(isSameShoppingClassType(MembershipClassType.WHITE, MembershipClassType.WHITE)).toBe(true);
    expect(isSameShoppingClassType(MembershipClassType.GREEN, MembershipClassType.GREEN)).toBe(true);
    expect(isSameShoppingClassType(MembershipClassType.GOLD, MembershipClassType.GOLD)).toBe(true);
    expect(isSameShoppingClassType(MembershipClassType.DOUBLE_GOLD, MembershipClassType.DOUBLE_GOLD)).toBe(true);
    expect(isSameShoppingClassType(MembershipClassType.TRIPLE_GOLD, MembershipClassType.TRIPLE_GOLD)).toBe(true);
  });
});

describe('getTierByClass function', () => {
  it('should return the correct tier object for CASUAL membership', () => {
    const result = getTierByClass(MembershipClassType.CASUAL);
    expect(result).toEqual(membershipTiers.tier0);
  });

  it('should return the correct tier object for WHITE membership', () => {
    const result = getTierByClass(MembershipClassType.WHITE);
    expect(result).toEqual(membershipTiers.tier1);
  });

  it('should return the correct tier object for GREEN membership', () => {
    const result = getTierByClass(MembershipClassType.GREEN);
    expect(result).toEqual(membershipTiers.tier2);
  });

  it('should return the correct tier object for GOLD membership', () => {
    const result = getTierByClass(MembershipClassType.GOLD);
    expect(result).toEqual(membershipTiers.tier3);
  });

  it('should return the correct tier object for DOUBLE GOLD membership', () => {
    const result = getTierByClass(MembershipClassType.DOUBLE_GOLD);
    expect(result).toEqual(membershipTiers.tier4);
  });

  it('should return the correct tier object for TRIPLE GOLD membership', () => {
    const result = getTierByClass(MembershipClassType.TRIPLE_GOLD);
    expect(result).toEqual(membershipTiers.tier5);
  });

  it('should return undefined for an invalid membership tier', () => {
    const unknownClass = 'UNKNOWN' as MembershipClassType;
    const result = getTierByClass(unknownClass);
    expect(result).toBeUndefined();
  });
});

describe('getTierRank function', () => {
  it('should return the correct tier rank for CASUAL membership', () => {
    expect(getTierRank(MembershipClassType.CASUAL)).toBe(0);
  });

  it('should return the correct tier rank for WHITE membership', () => {
    expect(getTierRank(MembershipClassType.WHITE)).toBe(1);
  });

  it('should return the correct tier rank for GREEN membership', () => {
    expect(getTierRank(MembershipClassType.GREEN)).toBe(2);
  });

  it('should return the correct tier rank for GOLD membership', () => {
    expect(getTierRank(MembershipClassType.GOLD)).toBe(3);
  });

  it('should return the correct tier rank for DOUBLE GOLD membership', () => {
    expect(getTierRank(MembershipClassType.DOUBLE_GOLD)).toBe(4);
  });

  it('should return the correct tier rank for TRIPLE GOLD membership', () => {
    expect(getTierRank(MembershipClassType.TRIPLE_GOLD)).toBe(5);
  });

  it('should return -1 for an unknown membership class', () => {
    const result = getTierRank('UNKNOWN' as MembershipClassType);
    expect(result).toBe(-1);
  });
});