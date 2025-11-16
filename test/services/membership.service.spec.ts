import { Types } from "mongoose";
import { 
  isExpired, 
  getTierByClass,
  getTierRank,
  isSameShoppingClassType
} from "../../src/helpers/membership";
import Membership from "../../src/models/Membership";
import User from "../../src/models/User";
import { 
  mappiCreditOptions, 
  MappiCreditType, 
  MembershipClassType, 
  membershipTiers
} from "../../src/models/enums/membershipClassType";
import { 
  applyMembershipChange,
  buildMembershipList, 
  getSingleMembershipById, 
  getUserMembership, 
  addMappiBalance,
  deductMappiBalance
} from "../../src/services/membership.service";
import { IMembership, IUser } from "../../src/types";
import { MappiDeductionError } from "../../src/errors/MappiDeductionError";

jest.mock('../../src/helpers/membership');
jest.mock('../../src/models/Membership');
jest.mock('../../src/models/User');

describe('buildMembershipList function', () => {
  it('should include single Mappi purchase option at the top of the membership list', async () => {
    const membershipList = await buildMembershipList();

    expect(membershipList[0].value).toBe(MappiCreditType.SINGLE);
    expect(membershipList[0].cost).toBe(mappiCreditOptions.COST);
    expect(membershipList[0].duration).toBe(mappiCreditOptions.DURATION);
    expect(membershipList[0].mappi_allowance).toBe(mappiCreditOptions.MAPPI_ALLOWANCE);
  });

  it('should include all membership tiers except CASUAL', async () => {
    const membershipList = await buildMembershipList();

    const filteredMembershipTiers = Object.values(membershipTiers)
      .filter(tier => tier.CLASS !== MembershipClassType.CASUAL)
      .map(tier => tier.CLASS);
    
    const membershipClasses = membershipList.slice(1).map(item => item.value);

    expect(membershipClasses).toEqual(expect.arrayContaining(filteredMembershipTiers));
    expect(membershipClasses).not.toContain(MembershipClassType.CASUAL);
  });

  it('should sort membership tiers by rank', async () => {
    const membershipList = await buildMembershipList();

    const membershipRanks = membershipList.slice(1).map(item => {
      return Object.values(membershipTiers).find(t => t.CLASS === item.value)?.RANK ?? 0;
    });
    const sortedMembershipRanks = [...membershipRanks].sort((a, b) => a - b);
    expect(membershipRanks).toEqual(sortedMembershipRanks);
  });

  it('should assign correct data for applicable purchase options', async () => {
    const membershipList = await buildMembershipList();

    // Single Mappi
    expect(membershipList[0].value).toBe(mappiCreditOptions.CLASS);
    expect(membershipList[0].cost).toBe(mappiCreditOptions.COST);
    expect(membershipList[0].duration).toBe(mappiCreditOptions.DURATION ?? null);
    expect(membershipList[0].mappi_allowance).toBe(mappiCreditOptions.MAPPI_ALLOWANCE ?? 0);

    // Applicable Membership Tiers
    membershipList.slice(1).forEach(item => {
      const tier = Object.values(membershipTiers).find(t => t.CLASS === item.value);
      expect(item.value).toBe(tier?.CLASS ?? 0);
      expect(item.cost).toBe(tier?.COST ?? 0);
      expect(item.duration).toBe(tier?.DURATION ?? null);
      expect(item.mappi_allowance).toBe(tier?.MAPPI_ALLOWANCE ?? 0);
    });
  });

  it('should throw an error if building membership list fails', async () => {
    const mockError = new Error('Unexpected error');
    const original = Object.values;

    Object.values = jest.fn(() => { throw mockError; });

    await expect(buildMembershipList()).rejects.toThrow('Unexpected error');

    Object.values = original; // restore original
  });
});

describe('getUserMembership function', () => {
  const authUser = { pi_uid: 'piUID_TEST' } as any;
  const mockUser = { _id: '_id_TEST' } as any;

  it('should return the user membership if found', async () => {
    const mockMembership = { 
      user_id: new Types.ObjectId(),
      pi_uid: authUser.pi_uid,
      membership_class: MembershipClassType.GOLD,
      mappi_balance: 100,
      membership_expiry_date: new Date(),
      mappi_used_to_date: 50,
    } as unknown as IMembership;

    (Membership.findOne as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockMembership),
    });

    const result = await getUserMembership(authUser);

    expect(Membership.findOne).toHaveBeenCalledWith({ pi_uid: authUser.pi_uid });
    expect(User.findOne).not.toHaveBeenCalled();
    expect(result).toEqual(mockMembership);
  });

  it('should create a new membership [CASUAL] if no existing membership exists', async () => {
    (Membership.findOne as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });
    (User.findOne as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockUser),
    });

    const saveMock = jest.fn().mockResolvedValue({
      toObject: () => ({
        user_id: mockUser._id,
        pi_uid: authUser.pi_uid,
        membership_class: MembershipClassType.CASUAL,
        membership_expiry_date: null,
        mappi_balance: 0,
        mappi_used_to_date: 0,
      }),
    });
    (Membership as any).mockImplementation(() => ({ save: saveMock }));

    const result = await getUserMembership(authUser);

    expect(User.findOne).toHaveBeenCalledWith({ pi_uid: authUser.pi_uid });
    expect(Membership).toHaveBeenCalledWith({
      user_id: mockUser._id,
      pi_uid: authUser.pi_uid,
      membership_class: MembershipClassType.CASUAL,
      membership_expiry_date: null,
      mappi_balance: 0,
      mappi_used_to_date: 0,
    });
    expect(saveMock).toHaveBeenCalled();

    expect(result.user_id).toBe('_id_TEST');
    expect(result.pi_uid).toBe('piUID_TEST');
    expect(result.membership_class).toBe(MembershipClassType.CASUAL);
    expect(result.membership_expiry_date).toBe(null);
    expect(result.mappi_balance).toBe(0);
    expect(result.mappi_used_to_date).toBe(0);
  });

  it('should create a new membership [CASUAL] if no existing user exists', async () => {
    (Membership.findOne as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });
    (User.findOne as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });

    const saveMock = jest.fn().mockResolvedValue({
      toObject: () => ({
        user_id: undefined,
        pi_uid: authUser.pi_uid,
        membership_class: MembershipClassType.CASUAL,
        membership_expiry_date: null,
        mappi_balance: 0,
        mappi_used_to_date: 0,
      }),
    });
    (Membership as any).mockImplementation(() => ({ save: saveMock }));

    const result = await getUserMembership(authUser);

    expect(User.findOne).toHaveBeenCalledWith({ pi_uid: authUser.pi_uid });
    expect(Membership).toHaveBeenCalledWith({
      user_id: undefined,
      pi_uid: authUser.pi_uid,
      membership_class: MembershipClassType.CASUAL,
      membership_expiry_date: null,
      mappi_balance: 0,
      mappi_used_to_date: 0,
    });
    expect(saveMock).toHaveBeenCalled();

    expect(result.user_id).toBeUndefined();
    expect(result.pi_uid).toBe('piUID_TEST');
    expect(result.membership_class).toBe(MembershipClassType.CASUAL);
    expect(result.membership_expiry_date).toBe(null);
    expect(result.mappi_balance).toBe(0);
    expect(result.mappi_used_to_date).toBe(0);
  });

  it('should throw an error if getting user membership fails', async () => {
    const mockError = new Error('Mock database error');

    (Membership.findOne as jest.Mock).mockReturnValue({
      lean: jest.fn().mockRejectedValue(mockError),
    });

    await expect(getUserMembership(authUser)).rejects.toThrow('Mock database error');
    
    expect(User.findOne).not.toHaveBeenCalled();
  });
});

describe('getSingleMembershipById function', () => {
  const membership_id = 'membershipID_TEST';

  it('should return a single membership if found', async () => {
    const mockMembership = {
      _id: membership_id, 
      user_id: new Types.ObjectId(),
      pi_uid: 'piUID_TEST',
      membership_class: MembershipClassType.GOLD,
      mappi_balance: 100,
      membership_expiry_date: new Date(),
      mappi_used_to_date: 50,
    } as unknown as IMembership;

    (Membership.findById as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockMembership),
    });

    const result = await getSingleMembershipById(membership_id);

    expect(result).toEqual(mockMembership);
    expect(Membership.findById).toHaveBeenCalledWith(membership_id);
  });

  it('should return null when single membership not found', async () => {
    (Membership.findById as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });

    const result = await getSingleMembershipById(membership_id);

    expect(result).toBeNull();
    expect(Membership.findById).toHaveBeenCalledWith(membership_id);
  });

  it('should throw an error if getting single membership fails', async () => {
    const mockError = new Error('Database connection failed');

    (Membership.findById as jest.Mock).mockReturnValue({
      lean: jest.fn().mockRejectedValue(mockError),
    });

    await expect(getSingleMembershipById(membership_id))
      .rejects.toThrow('Database connection failed');
    
    expect(Membership.findById).toHaveBeenCalledWith(membership_id);
  });
});

describe('addMappiBalance function', () => {
  const pi_uid = 'piUID_TEST';

  const mockMembership = {
    user_id: new Types.ObjectId(),
    pi_uid,
    membership_class: MembershipClassType.GOLD,
    mappi_balance: 100,
    membership_expiry_date: new Date(),
    mappi_used_to_date: 50,
  } as unknown as IMembership;

  it('should add Mappi balance successfully', async () => {
    const amount = 5;

    (Membership.findOneAndUpdate as jest.Mock).mockReturnValue({
      exec: jest.fn().mockResolvedValue({ 
        ...mockMembership, 
        mappi_balance: mockMembership.mappi_balance + amount 
      }),
    });

    const result = await addMappiBalance(pi_uid, amount, 'refund');

    expect(result).toBe(amount);
    expect(Membership.findOneAndUpdate).toHaveBeenCalledWith(
      { pi_uid },
      { $inc: { mappi_balance: amount } },
      { new: true }
    );
  });

  it('should return 0 if amount is 0 or negative', async () => {
    const resultZero = await addMappiBalance(pi_uid, 0, 'refund');
    const resultNegative = await addMappiBalance(pi_uid, -5, 'purchase');

    expect(resultZero).toBe(0);
    expect(resultNegative).toBe(0);
    expect(Membership.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('should throw an error if membership not found', async () => {
    const amount = 10;
    const type = 'refund';

    // Simulate DB rejecting because membership not found
    (Membership.findOneAndUpdate as jest.Mock).mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });

    await expect(addMappiBalance(pi_uid, amount, type)).rejects.toThrow(
      `Membership not found or unable to ${type} ${amount} Mappi to balance for ${pi_uid}`
    );
    
    expect(Membership.findOneAndUpdate).toHaveBeenCalledWith(
      { pi_uid },
      { $inc: { mappi_balance: amount } },
      { new: true }
    );
  });

  it('should throw an error if adding Mappi to balance fails', async () => {
    const mockError = new Error('Database connection failed');

    (Membership.findOneAndUpdate as jest.Mock).mockReturnValue({
      exec: jest.fn().mockRejectedValue(mockError)
    });

    await expect(addMappiBalance(pi_uid, 10, 'refund')).rejects.toThrow(mockError);
  });
});

describe('deductMappiBalance function', () => {
  const pi_uid = 'piUID_TEST';

  const mockMembership = {
    user_id: new Types.ObjectId(),
    pi_uid,
    membership_class: MembershipClassType.GOLD,
    mappi_balance: 100,
    membership_expiry_date: new Date(),
    mappi_used_to_date: 50,
  } as unknown as IMembership;

  it('should deduct the Mappi balance successfully', async () => {
    const amount = 10;

    (Membership.findOneAndUpdate as jest.Mock).mockReturnValue({
      exec: jest.fn().mockResolvedValue({ 
        ...mockMembership, 
        mappi_balance: mockMembership.mappi_balance - amount 
      }),
    });

    const result = await deductMappiBalance(pi_uid, amount);

    expect(result).toBe(amount);
    expect(Membership.findOneAndUpdate).toHaveBeenCalledWith(
      { pi_uid, mappi_balance: { $gte: amount } },
      { $inc: { mappi_balance: -amount } },
      { new: true }
    );
  });

  it('should simulate concurrent deduction attempts and deduct accordingly', async () => {
    const execMock = jest
      .fn()
      // First deduction attempt call succeeds
      .mockResolvedValueOnce({ ...mockMembership, mappi_balance: 90 })
      // Second deduction attempt call fails due to insufficient balance
      .mockResolvedValueOnce(null);

    (Membership.findOneAndUpdate as jest.Mock).mockReturnValue({ exec: execMock });

    const firstAttempt = deductMappiBalance(pi_uid, 10);
    const secondAttempt = deductMappiBalance(pi_uid, 10);

    const [firstResult, secondError] = await Promise.allSettled([firstAttempt, secondAttempt]);

    expect(firstResult.status).toBe('fulfilled');
    expect((firstResult as PromiseFulfilledResult<number>).value).toBe(10);

    expect(secondError.status).toBe('rejected');
    expect((secondError as PromiseRejectedResult).reason).toBeInstanceOf(MappiDeductionError);
  });

  it('should return 0 if amount is 0', async () => {
    const result = await deductMappiBalance(pi_uid, 0);
    
    expect(result).toBe(0);
    expect(Membership.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('should throw MappiDeductionError if membership not found', async () => {
    const amount = 10;

    // Simulate DB rejecting because membership not found
    (Membership.findOneAndUpdate as jest.Mock).mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });

    await expect(deductMappiBalance(pi_uid, amount)).rejects.toThrow(MappiDeductionError);
    await expect(deductMappiBalance(pi_uid, amount)).rejects.toThrow(
      'Membership not found or insufficient balance'
    );
    
    expect(Membership.findOneAndUpdate).toHaveBeenCalledWith(
      { pi_uid, mappi_balance: { $gte: amount } },
      { $inc: { mappi_balance: -amount } },
      { new: true }
    );
  });

  it('should throw MappiDeductionError if insufficient balance', async () => {
    const amount = 200;

    // Simulate DB rejecting because balance < amount
    (Membership.findOneAndUpdate as jest.Mock).mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });

    await expect(deductMappiBalance(pi_uid, amount)).rejects.toThrow(MappiDeductionError);
    await expect(deductMappiBalance(pi_uid, amount)).rejects.toThrow(
      'Membership not found or insufficient balance'
    );
    
    expect(Membership.findOneAndUpdate).toHaveBeenCalledWith(
      { pi_uid, mappi_balance: { $gte: amount } },
      { $inc: { mappi_balance: -amount } },
      { new: true }
    );
  });

  it('should wrap unexpected errors into MappiDeductionError', async () => {
    const amount = 10;
    const mockError = new Error('Database connection failed');

    (Membership.findOneAndUpdate as jest.Mock).mockReturnValue({
      exec: jest.fn().mockRejectedValue(mockError),
    });

    await expect(deductMappiBalance(pi_uid, amount)).rejects.toThrow(MappiDeductionError);
    await expect(deductMappiBalance(pi_uid, amount)).rejects.toThrow(
      'Database connection failed'
    );
  });
});

describe('applyMembershipChange function', () => {
  const mockUser = { 
    _id: '_id_TEST',
    pi_uid: 'piUID_TEST' 
  } as unknown as IUser;

  it('throws an error if user not found', async () => {
    (User.findOne as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });

    await expect(applyMembershipChange(mockUser.pi_uid, MembershipClassType.CASUAL))
      .rejects.toThrow(`User with pi_uid ${ mockUser.pi_uid } not found`);

    expect(User.findOne).toHaveBeenCalledWith({ pi_uid: mockUser.pi_uid });
    expect(Membership.findOne).not.toHaveBeenCalled();
  });

  describe('handleSingleMappiPurchase helper function', () => {
    beforeEach(() => {
      (User.findOne as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockUser),
      });
    });

    it('should create a new base [CASUAL] membership if no existing membership found', async () => {
      const baseMembership = {
        user_id: mockUser._id,
        pi_uid: mockUser.pi_uid,
        membership_class: MembershipClassType.CASUAL,
        membership_expiry_date: null,
        mappi_balance: 1,
        mappi_used_to_date: 0
      } as unknown as IMembership;
      
      (Membership.findOne as jest.Mock).mockResolvedValue(null);
      (Membership.create as jest.Mock).mockResolvedValue(baseMembership);

      const result = await applyMembershipChange(mockUser.pi_uid, MappiCreditType.SINGLE);
      
      expect(result).toEqual(baseMembership);
      expect(User.findOne).toHaveBeenCalledWith({ pi_uid: mockUser.pi_uid });
      expect(Membership.findOne).toHaveBeenCalledWith({ user_id: mockUser._id });
      expect(Membership.create).toHaveBeenCalledWith(expect.objectContaining({
        user_id: mockUser._id,
        pi_uid: mockUser.pi_uid,
        membership_class: MembershipClassType.CASUAL,
        membership_expiry_date: null,
        mappi_balance: 1,
        mappi_used_to_date: 0
      }));
    });

    it('should reset expired membership to base [CASUAL] membership', async () => {
      const expiredMembership = {
        user_id: mockUser._id,
        pi_uid: mockUser.pi_uid,
        membership_class: MembershipClassType.TRIPLE_GOLD,
        membership_expiry_date: new Date(),
        mappi_balance: 100
      } as unknown as IMembership;
      
      (Membership.findOne as jest.Mock).mockResolvedValue(expiredMembership);
      (Membership.findOneAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ 
          ...expiredMembership,
          membership_class: MembershipClassType.CASUAL,
          membership_expiry_date: null, 
          mappi_balance: 1 
        })
      });

      // Force isExpired to return true
      (isExpired as jest.Mock).mockReturnValue(true);

      const result = await applyMembershipChange(mockUser.pi_uid, MappiCreditType.SINGLE);
      
      expect(result).toEqual({
        ...expiredMembership,
        membership_class: MembershipClassType.CASUAL,
        membership_expiry_date: null, 
        mappi_balance: 1 
      });
      expect(User.findOne).toHaveBeenCalledWith({ pi_uid: mockUser.pi_uid });
      expect(Membership.findOne).toHaveBeenCalledWith({ user_id: mockUser._id });
      expect(Membership.create).not.toHaveBeenCalled();
      expect(isExpired).toHaveBeenCalledWith(expiredMembership.membership_expiry_date);
      expect(Membership.findOneAndUpdate).toHaveBeenCalledWith(
        { pi_uid: mockUser.pi_uid },
        {
          membership_class: MembershipClassType.CASUAL,
          membership_expiry_date: null,
          mappi_balance: 1,
        },
        { new: true }
      );
    });

    it('should throw error if expired membership to reset [CASUAL] is unexpectedly not found', async () => {
      const expiredMembership = {
        user_id: mockUser._id,
        pi_uid: mockUser.pi_uid,
        membership_class: MembershipClassType.TRIPLE_GOLD,
        membership_expiry_date: new Date(),
        mappi_balance: 100
      } as unknown as IMembership;
      
      (Membership.findOne as jest.Mock).mockResolvedValue(expiredMembership);
      (Membership.findOneAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null)
      });

      // Force isExpired to return true
      (isExpired as jest.Mock).mockReturnValue(true);

      await expect(applyMembershipChange(mockUser.pi_uid, MappiCreditType.SINGLE))
        .rejects.toThrow(`Membership not found for update to base for piUID ${ mockUser.pi_uid}`);

      expect(User.findOne).toHaveBeenCalledWith({ pi_uid: mockUser.pi_uid });
      expect(Membership.findOne).toHaveBeenCalledWith({ user_id: mockUser._id });
      expect(Membership.create).not.toHaveBeenCalled();
      expect(isExpired).toHaveBeenCalledWith(expiredMembership.membership_expiry_date);
      expect(Membership.findOneAndUpdate).toHaveBeenCalledWith(
        { pi_uid: mockUser.pi_uid },
        {
          membership_class: MembershipClassType.CASUAL,
          membership_expiry_date: null,
          mappi_balance: 1,
        },
        { new: true }
      );
    });

    it('should increment mappi balance for non-expired memberships', async () => {
      const activeMembership = {
        user_id: mockUser._id,
        pi_uid: mockUser.pi_uid,
        membership_class: MembershipClassType.DOUBLE_GOLD,
        membership_expiry_date: new Date(),
        mappi_balance: 50
      } as unknown as IMembership;

      (Membership.findOne as jest.Mock).mockResolvedValue(activeMembership);
      (Membership.findOneAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ 
          ...activeMembership,
          mappi_balance: 51
        })
      });

      // Force isExpired to return false
      (isExpired as jest.Mock).mockReturnValue(false);

      const result = await applyMembershipChange(mockUser.pi_uid, MappiCreditType.SINGLE);

      expect(result).toEqual({
        ...activeMembership,
        mappi_balance: 51 
      });
      expect(User.findOne).toHaveBeenCalledWith({ pi_uid: mockUser.pi_uid });
      expect(Membership.findOne).toHaveBeenCalledWith({ user_id: mockUser._id });
      expect(Membership.create).not.toHaveBeenCalled();
      expect(isExpired).toHaveBeenCalledWith(activeMembership.membership_expiry_date);
      expect(Membership.findOneAndUpdate).toHaveBeenCalledWith(
        { pi_uid: mockUser.pi_uid },
        { $inc: { mappi_balance: 1 } },
        { new: true }
      );
    });

    it('should throw error if non-expired membership to update is unexpectedly not found', async () => {
      const activeMembership = {
        user_id: mockUser._id,
        pi_uid: mockUser.pi_uid,
        membership_class: MembershipClassType.DOUBLE_GOLD,
        membership_expiry_date: new Date(),
        mappi_balance: 50
      } as unknown as IMembership;
      
      (Membership.findOne as jest.Mock).mockResolvedValue(activeMembership);
      (Membership.findOneAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null)
      });

      // Force isExpired to return false
      (isExpired as jest.Mock).mockReturnValue(false);

      await expect(applyMembershipChange(mockUser.pi_uid, MappiCreditType.SINGLE))
        .rejects.toThrow(`Membership not found for update to increment for piUID ${ mockUser.pi_uid}`);

      expect(User.findOne).toHaveBeenCalledWith({ pi_uid: mockUser.pi_uid });
      expect(Membership.findOne).toHaveBeenCalledWith({ user_id: mockUser._id });
      expect(Membership.create).not.toHaveBeenCalled();
      expect(isExpired).toHaveBeenCalledWith(activeMembership.membership_expiry_date);
      expect(Membership.findOneAndUpdate).toHaveBeenCalledWith(
        { pi_uid: mockUser.pi_uid },
        { $inc: { mappi_balance: 1 } },
        { new: true }
      );
    });

    it('should throw error if handling single Mappi purchase unexpectedly fails', async () => {
      const mockError = new Error('Database connection failed');
      
      (Membership.findOne as jest.Mock).mockResolvedValue(null);
      (Membership.create as jest.Mock).mockRejectedValue(mockError);

      await expect(applyMembershipChange(mockUser.pi_uid, MappiCreditType.SINGLE))
          .rejects.toThrow('Database connection failed');
      
      expect(User.findOne).toHaveBeenCalledWith({ pi_uid: mockUser.pi_uid });
      expect(Membership.findOne).toHaveBeenCalledWith({ user_id: mockUser._id });
      expect(Membership.create).toHaveBeenCalledWith(expect.objectContaining({
        user_id: mockUser._id,
        pi_uid: mockUser.pi_uid,
        membership_class: MembershipClassType.CASUAL,
        membership_expiry_date: null,
        mappi_balance: 1,
        mappi_used_to_date: 0
      }));
      expect(isExpired).not.toHaveBeenCalled();
      expect(Membership.findOneAndUpdate).not.toHaveBeenCalled();
    });
  });

  describe('handleMembershipTierPurchase helper function', () => {
    const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;

    const membershipCases: [MembershipClassType, keyof typeof membershipTiers][] = [
      [MembershipClassType.CASUAL, 'tier0'],
      [MembershipClassType.WHITE, 'tier1'],
      [MembershipClassType.GREEN, 'tier2'],
      [MembershipClassType.GOLD, 'tier3'],
      [MembershipClassType.DOUBLE_GOLD, 'tier4'],
      [MembershipClassType.TRIPLE_GOLD, 'tier5'],
    ];

    beforeAll(() => {
      jest.useFakeTimers();
      // freeze the system time for predictable expiry date calculation
      jest.setSystemTime(new Date("2025-08-17T12:00:00Z"));
    });

    beforeEach(() => {
      (User.findOne as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockUser),
      });
    });

    afterAll(() => {
      jest.useRealTimers();
    })

    // Parameterized testing of membership class tiers 
    it.each(membershipCases)(
      'should create a new membership [%s] if no existing membership found',
      async (membershipClass, tierKey) => {     
        const membershipTier = membershipTiers[tierKey];
        let expectedExpiryDate: Date | null;
        
        if (membershipClass === MembershipClassType.CASUAL) { 
          expectedExpiryDate = null;
        } else {
          expectedExpiryDate = new Date(
            new Date("2025-08-17T12:00:00Z").getTime() + (membershipTier.DURATION ?? 0) * WEEK_IN_MS);
        }
      
        (Membership.findOne as jest.Mock).mockResolvedValue(null);
        (Membership.create as jest.Mock).mockResolvedValue({
          user_id: mockUser._id,
          pi_uid: mockUser.pi_uid,
          membership_class: membershipClass,
          membership_expiry_date: expectedExpiryDate,
          mappi_balance: membershipTier.MAPPI_ALLOWANCE,
          mappi_used_to_date: 0
        });
        (getTierByClass as jest.Mock).mockReturnValue(membershipTier);

        const result = await applyMembershipChange(mockUser.pi_uid, membershipClass);

        expect(result).toEqual({
          user_id: mockUser._id,
          pi_uid: mockUser.pi_uid,
          membership_class: membershipClass,
          membership_expiry_date: expectedExpiryDate,
          mappi_balance: membershipTier.MAPPI_ALLOWANCE,
          mappi_used_to_date: 0
        });
        expect(Membership.findOne).toHaveBeenCalledWith({ user_id: mockUser._id });
        expect(Membership.create).toHaveBeenCalledWith({
          user_id: mockUser._id,
          pi_uid: mockUser.pi_uid,
          membership_class: membershipClass,
          membership_expiry_date: expectedExpiryDate,
          mappi_balance: membershipTier.MAPPI_ALLOWANCE,
          mappi_used_to_date: 0
        });
      }
    );

    it('should handle different shopping class type (online vs offline)', async () => {
      const existingExpiryDate = new Date(
        new Date("2025-08-17T12:00:00Z").getTime() + (membershipTiers.tier1.DURATION ?? 0) * WEEK_IN_MS);
      const existingMembership = {
        user_id: mockUser._id,
        pi_uid: mockUser.pi_uid,
        membership_class: MembershipClassType.WHITE,
        membership_expiry_date: existingExpiryDate,
        mappi_balance: 5
      } as unknown as IMembership;
      const existingMembershipTier = membershipTiers.tier1;

      const newMembershipClass = MembershipClassType.TRIPLE_GOLD;
      const newMembershipTier = membershipTiers.tier5;
      const newExpiryDate = new Date(
        new Date("2025-08-17T12:00:00Z").getTime() + newMembershipTier.DURATION * WEEK_IN_MS);

      (Membership.findOne as jest.Mock).mockResolvedValue(existingMembership);
      (getTierByClass as jest.Mock).mockReturnValue(newMembershipTier);
      (getTierRank as jest.Mock).mockReturnValue(existingMembershipTier.RANK);
      (isExpired as jest.Mock).mockReturnValue(false);
      (isSameShoppingClassType as jest.Mock).mockReturnValue(false);
      (Membership.findOneAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...existingMembership,
          membership_class: newMembershipClass,
          membership_expiry_date: newExpiryDate,
          mappi_balance: newMembershipTier.MAPPI_ALLOWANCE
        })
      });

      const result = await applyMembershipChange(mockUser.pi_uid, newMembershipClass);

      expect(result).toEqual({
        user_id: mockUser._id,
        pi_uid: mockUser.pi_uid,
        membership_class: newMembershipClass,
        membership_expiry_date: newExpiryDate,
        mappi_balance: newMembershipTier.MAPPI_ALLOWANCE
      });
      expect(Membership.findOne).toHaveBeenCalledWith({ user_id: mockUser._id });
      expect(Membership.create).not.toHaveBeenCalled();
      expect(getTierRank).toHaveBeenCalledWith(existingMembership.membership_class);
      expect(isExpired).toHaveBeenCalledWith(existingMembership.membership_expiry_date);
      expect(isSameShoppingClassType).toHaveBeenCalledWith(
        existingMembership.membership_class, 
        newMembershipClass
      );
      expect(Membership.findOneAndUpdate).toHaveBeenCalledWith(
        { pi_uid: mockUser.pi_uid },
        {
          membership_class: newMembershipClass,
          membership_expiry_date: newExpiryDate,
          mappi_balance: newMembershipTier.MAPPI_ALLOWANCE
        },
        { new: true }
      )
    });

    it('should handle and extend same membership class if existing membership is not expired', async () => {
      const existingExpiryDate = new Date(
        new Date("2025-08-17T12:00:00Z").getTime() + 2 * WEEK_IN_MS); // not expired
      const existingMembership = {
        user_id: mockUser._id,
        pi_uid: mockUser.pi_uid,
        membership_class: MembershipClassType.GOLD,
        membership_expiry_date: existingExpiryDate,
        mappi_balance: 50
      } as unknown as IMembership;
      const existingMembershipTier = membershipTiers.tier3;

      const newMembershipClass = MembershipClassType.GOLD;
      const newMembershipTier = membershipTiers.tier3;
      const newExpiryDate = new Date(
        existingExpiryDate.getTime() + newMembershipTier.DURATION * WEEK_IN_MS);

      (Membership.findOne as jest.Mock).mockResolvedValue(existingMembership);
      (getTierByClass as jest.Mock).mockReturnValue(newMembershipTier);
      (getTierRank as jest.Mock).mockReturnValue(existingMembershipTier.RANK);
      (isExpired as jest.Mock).mockReturnValue(false);
      (isSameShoppingClassType as jest.Mock).mockReturnValue(true);
      (Membership.findOneAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...existingMembership,
          membership_class: newMembershipClass,
          membership_expiry_date: newExpiryDate,
          mappi_balance: existingMembership.mappi_balance + newMembershipTier.MAPPI_ALLOWANCE
        })
      });

      const result = await applyMembershipChange(mockUser.pi_uid, newMembershipClass);

      expect(result).toEqual({
        user_id: mockUser._id,
        pi_uid: mockUser.pi_uid,
        membership_class: newMembershipClass,
        membership_expiry_date: newExpiryDate,
        mappi_balance: existingMembership.mappi_balance + newMembershipTier.MAPPI_ALLOWANCE
      });
      expect(Membership.findOne).toHaveBeenCalledWith({ user_id: mockUser._id });
      expect(Membership.create).not.toHaveBeenCalled();
      expect(getTierRank).toHaveBeenCalledWith(existingMembership.membership_class);
      expect(isExpired).toHaveBeenCalledWith(existingMembership.membership_expiry_date);
      expect(isSameShoppingClassType).toHaveBeenCalledWith(
        existingMembership.membership_class, 
        newMembershipClass
      );
      expect(Membership.findOneAndUpdate).toHaveBeenCalledWith(
        { pi_uid: mockUser.pi_uid },
        {
          membership_expiry_date: newExpiryDate,
          $inc: { mappi_balance: newMembershipTier.MAPPI_ALLOWANCE }
        },
        { new: true }
      )
    });

    it('should handle and renew same membership class if existing membership is expired', async () => {
      const existingExpiryDate = new Date(
        new Date("2025-08-17T12:00:00Z").getTime() - 2 * WEEK_IN_MS); // expired
      
      const existingMembership = {
        user_id: mockUser._id,
        pi_uid: mockUser.pi_uid,
        membership_class: MembershipClassType.GREEN,
        membership_expiry_date: existingExpiryDate,
        mappi_balance: 5
      } as unknown as IMembership;
      const existingMembershipTier = membershipTiers.tier2;

      const newMembershipClass = MembershipClassType.GREEN;
      const newMembershipTier = membershipTiers.tier2;
      const newExpiryDate = new Date(
        new Date("2025-08-17T12:00:00Z").getTime() + newMembershipTier.DURATION * WEEK_IN_MS);

      (Membership.findOne as jest.Mock).mockResolvedValue(existingMembership);
      (getTierByClass as jest.Mock).mockReturnValue(newMembershipTier);
      (getTierRank as jest.Mock).mockReturnValue(existingMembershipTier.RANK);
      (isExpired as jest.Mock).mockReturnValue(true);
      (isSameShoppingClassType as jest.Mock).mockReturnValue(true);
      (Membership.findOneAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...existingMembership,
          membership_class: newMembershipClass,
          membership_expiry_date: newExpiryDate,
          mappi_balance: existingMembership.mappi_balance + newMembershipTier.MAPPI_ALLOWANCE
        })
      });

      const result = await applyMembershipChange(mockUser.pi_uid, newMembershipClass);

      expect(result).toEqual({
        user_id: mockUser._id,
        pi_uid: mockUser.pi_uid,
        membership_class: newMembershipClass,
        membership_expiry_date: newExpiryDate,
        mappi_balance: existingMembership.mappi_balance + newMembershipTier.MAPPI_ALLOWANCE
      });
      expect(Membership.findOne).toHaveBeenCalledWith({ user_id: mockUser._id });
      expect(Membership.create).not.toHaveBeenCalled();
      expect(getTierRank).toHaveBeenCalledWith(existingMembership.membership_class);
      expect(isExpired).toHaveBeenCalledWith(existingMembership.membership_expiry_date);
      expect(isSameShoppingClassType).toHaveBeenCalledWith(
        existingMembership.membership_class, 
        newMembershipClass
      );
      expect(Membership.findOneAndUpdate).toHaveBeenCalledWith(
        { pi_uid: mockUser.pi_uid },
        {
          membership_expiry_date: newExpiryDate,
          mappi_balance: newMembershipTier.MAPPI_ALLOWANCE
        },
        { new: true }
      )
    });

    it('should handle and extend different membership class (upgrade or downgrade)', async () => {
      const existingExpiryDate = new Date(
        new Date("2025-08-17T12:00:00Z").getTime() * WEEK_IN_MS);
      
      const existingMembership = {
        user_id: mockUser._id,
        pi_uid: mockUser.pi_uid,
        membership_class: MembershipClassType.GOLD,
        membership_expiry_date: existingExpiryDate,
        mappi_balance: 50
      } as unknown as IMembership;
      const existingMembershipTier = membershipTiers.tier3;

      const newMembershipClass = MembershipClassType.DOUBLE_GOLD;
      const newMembershipTier = membershipTiers.tier4;
      const newExpiryDate = new Date(
        new Date("2025-08-17T12:00:00Z").getTime() + newMembershipTier.DURATION * WEEK_IN_MS);

      (Membership.findOne as jest.Mock).mockResolvedValue(existingMembership);
      (getTierByClass as jest.Mock).mockReturnValue(newMembershipTier);
      (getTierRank as jest.Mock).mockReturnValue(existingMembershipTier.RANK);
      (isExpired as jest.Mock).mockReturnValue(false);
      (isSameShoppingClassType as jest.Mock).mockReturnValue(true);
      (Membership.findOneAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...existingMembership,
          membership_class: newMembershipClass,
          membership_expiry_date: newExpiryDate,
          mappi_balance: existingMembership.mappi_balance + newMembershipTier.MAPPI_ALLOWANCE
        })
      });

      const result = await applyMembershipChange(mockUser.pi_uid, newMembershipClass);

      expect(result).toEqual({
        user_id: mockUser._id,
        pi_uid: mockUser.pi_uid,
        membership_class: newMembershipClass,
        membership_expiry_date: newExpiryDate,
        mappi_balance: existingMembership.mappi_balance + newMembershipTier.MAPPI_ALLOWANCE
      });
      expect(Membership.findOne).toHaveBeenCalledWith({ user_id: mockUser._id });
      expect(Membership.create).not.toHaveBeenCalled();
      expect(getTierRank).toHaveBeenCalledWith(existingMembership.membership_class);
      expect(isExpired).toHaveBeenCalledWith(existingMembership.membership_expiry_date);
      expect(isSameShoppingClassType).toHaveBeenCalledWith(
        existingMembership.membership_class, 
        newMembershipClass
      );
      expect(Membership.findOneAndUpdate).toHaveBeenCalledWith(
        { pi_uid: mockUser.pi_uid },
        {
          membership_class: newMembershipClass,
          membership_expiry_date: newExpiryDate,
          $inc: { mappi_balance: newMembershipTier.MAPPI_ALLOWANCE }
        },
        { new: true }
      )
    });

    it('should throw error if membership not found and returned during update', async () => {
      const existingExpiryDate = new Date(
        new Date("2025-08-17T12:00:00Z").getTime() * WEEK_IN_MS);
      
      const existingMembership = {
        user_id: mockUser._id,
        pi_uid: mockUser.pi_uid,
        membership_class: MembershipClassType.DOUBLE_GOLD,
        membership_expiry_date: existingExpiryDate,
        mappi_balance: 100
      } as unknown as IMembership;
      const existingMembershipTier = membershipTiers.tier4;

      const newMembershipClass = MembershipClassType.TRIPLE_GOLD;
      const newMembershipTier = membershipTiers.tier5;
      const newExpiryDate = new Date(
        new Date("2025-08-17T12:00:00Z").getTime() + newMembershipTier.DURATION * WEEK_IN_MS);

      (Membership.findOne as jest.Mock).mockResolvedValue(existingMembership);
      (getTierByClass as jest.Mock).mockReturnValue(newMembershipTier);
      (getTierRank as jest.Mock).mockReturnValue(existingMembershipTier.RANK);
      (isExpired as jest.Mock).mockReturnValue(false);
      (isSameShoppingClassType as jest.Mock).mockReturnValue(true);
      (Membership.findOneAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null)
      });

      await expect(applyMembershipChange(mockUser.pi_uid, newMembershipClass))
        .rejects.toThrow(`Membership not found during update for ${ mockUser.pi_uid }`);

      expect(Membership.findOne).toHaveBeenCalledWith({ user_id: mockUser._id });
      expect(Membership.create).not.toHaveBeenCalled();
      expect(getTierRank).toHaveBeenCalledWith(existingMembership.membership_class);
      expect(isExpired).toHaveBeenCalledWith(existingMembership.membership_expiry_date);
      expect(isSameShoppingClassType).toHaveBeenCalledWith(
        existingMembership.membership_class, 
        newMembershipClass
      );
      expect(Membership.findOneAndUpdate).toHaveBeenCalledWith(
        { pi_uid: mockUser.pi_uid },
        {
          membership_class: newMembershipClass,
          membership_expiry_date: newExpiryDate,
          $inc: { mappi_balance: newMembershipTier.MAPPI_ALLOWANCE }
        },
        { new: true }
      )
    });

    it('should throw error if membership not found and returned during update', async () => {
      const mockError = new Error('Database connection failed');
      
      const existingExpiryDate = new Date(
        new Date("2025-08-17T12:00:00Z").getTime() * WEEK_IN_MS);
      
      const existingMembership = {
        user_id: mockUser._id,
        pi_uid: mockUser.pi_uid,
        membership_class: MembershipClassType.WHITE,
        membership_expiry_date: existingExpiryDate,
        mappi_balance: 10
      } as unknown as IMembership;
      const existingMembershipTier = membershipTiers.tier1;

      const newMembershipClass = MembershipClassType.TRIPLE_GOLD;
      const newMembershipTier = membershipTiers.tier5;
      const newExpiryDate = new Date(
        new Date("2025-08-17T12:00:00Z").getTime() + newMembershipTier.DURATION * WEEK_IN_MS);

      (Membership.findOne as jest.Mock).mockResolvedValue(existingMembership);
      (getTierByClass as jest.Mock).mockReturnValue(newMembershipTier);
      (getTierRank as jest.Mock).mockReturnValue(existingMembershipTier.RANK);
      (isExpired as jest.Mock).mockReturnValue(false);
      (isSameShoppingClassType as jest.Mock).mockReturnValue(false);
      (Membership.findOneAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockRejectedValue(mockError)
      });

      await expect(applyMembershipChange(mockUser.pi_uid, newMembershipClass))
        .rejects.toThrow('Database connection failed');

      expect(Membership.findOne).toHaveBeenCalledWith({ user_id: mockUser._id });
      expect(Membership.create).not.toHaveBeenCalled();
      expect(getTierRank).toHaveBeenCalledWith(existingMembership.membership_class);
      expect(isExpired).toHaveBeenCalledWith(existingMembership.membership_expiry_date);
      expect(isSameShoppingClassType).toHaveBeenCalledWith(
        existingMembership.membership_class, 
        newMembershipClass
      );
      expect(Membership.findOneAndUpdate).toHaveBeenCalledWith(
        { pi_uid: mockUser.pi_uid },
        {
          membership_class: newMembershipClass,
          membership_expiry_date: newExpiryDate,
          mappi_balance: newMembershipTier.MAPPI_ALLOWANCE
        },
        { new: true }
      )
    });
  });
});