import User from "../../src/models/User";
import UserSettings from "../../src/models/UserSettings";
import Seller from "../../src/models/Seller";
import { MembershipClassType } from "../../src/models/enums/membershipClassType";
import { 
  authenticate, 
  deleteUser, 
  getUser 
} from "../../src/services/user.service";
import { getLocationByIP } from "../../src/services/userSettings.service";
import { getUserMembership } from "../../src/services/membership.service";
import { IMembership, ISeller, IUser, IUserSettings } from "../../src/types";

jest.mock('../../src/services/userSettings.service', () => ({
  getLocationByIP: jest.fn()
}));

jest.mock('../../src/services/membership.service', () => ({
  getUserMembership: jest.fn()
}));

jest.mock('../../src/models/User');
jest.mock('../../src/models/UserSettings');
jest.mock('../../src/models/Seller');

describe('authenticate function', () => {
  const currentUser = {
    pi_uid: '0a0a0a-0a0a-0a0a',
    pi_username: 'test_user',
    user_name: 'testUser'
  } as IUser;

  const currentUserSettings = {
    user_settings_id: currentUser.pi_uid,
    user_name: currentUser.user_name,
    search_map_center: {
      type: 'Point',
      coordinates: [100, -100]
    }
  } as Partial<IUserSettings>;

  const currentUserMembership = {
    membership_class: MembershipClassType.CASUAL,
    mappi_balance: 100
  } as Partial<IMembership>;

  it('should find and return authenticated user with existing user settings and membership_class', async () => {
    (User.findOne as jest.Mock).mockReturnValue({
      setOptions: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(currentUser)
      })
    });
    (UserSettings.findOne as jest.Mock).mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(currentUserSettings)
      })
    });
    (getUserMembership as jest.Mock).mockResolvedValue(currentUserMembership);

    const result = await authenticate(currentUser);

    expect(User.findOne).toHaveBeenCalledWith({ 
      pi_uid: currentUser.pi_uid, 
      pi_username: currentUser.pi_username
    });
    expect(UserSettings.create).not.toHaveBeenCalled();
    expect(getUserMembership).toHaveBeenCalledWith(currentUser);
    expect(result).toEqual({
      user: currentUser,
      membership_class: MembershipClassType.CASUAL
    });
  });

  it('should find and return authenticated user with new user settings and membership_class', async () => {
    (User.findOne as jest.Mock).mockReturnValue({
      setOptions: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(currentUser)
      })
    });
    (UserSettings.findOne as jest.Mock).mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null)
      })
    });
    (getLocationByIP as jest.Mock).mockReturnValue({ lat: -100, lng: 100 });
    (getUserMembership as jest.Mock).mockResolvedValue(currentUserMembership);

    const result = await authenticate(currentUser);

    expect(User.findOne).toHaveBeenCalledWith({ 
      pi_uid: currentUser.pi_uid, 
      pi_username: currentUser.pi_username
    });
    expect(getLocationByIP).toHaveBeenCalled();
    expect(UserSettings.create).toHaveBeenCalledWith(currentUserSettings);
    expect(getUserMembership).toHaveBeenCalledWith(currentUser);
    expect(result).toEqual({
      user: currentUser,
      membership_class: MembershipClassType.CASUAL
    });
  });

  it('should create and return new authenticated user with new user settings and membership_class w/ coordinates returned on the first attempt', async () => {
    (User.findOne as jest.Mock).mockReturnValue({
      setOptions: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null)
      })
    });
    (User.create as jest.Mock).mockReturnValue(currentUser);
    (UserSettings.findOne as jest.Mock).mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null)
      })
    });
    (getLocationByIP as jest.Mock).mockReturnValueOnce({ lat: -100, lng: 100 });
    (getUserMembership as jest.Mock).mockResolvedValue(currentUserMembership);

    const result = await authenticate(currentUser);

    expect(User.findOne).toHaveBeenCalledWith({ 
      pi_uid: currentUser.pi_uid, 
      pi_username: currentUser.pi_username
    });
    expect(User.create).toHaveBeenCalledWith({
      pi_uid: currentUser.pi_uid,
      pi_username: currentUser.pi_username,
      user_name: currentUser.user_name
    })
    expect(getLocationByIP).toHaveBeenCalledTimes(1);
    expect(UserSettings.create).toHaveBeenCalledWith(currentUserSettings);
    expect(getUserMembership).toHaveBeenCalledWith(currentUser);
    expect(result).toEqual({
      user: currentUser,
      membership_class: MembershipClassType.CASUAL
    });
  });

  it('should create and return new authenticated user with new user settings and membership_class w/ coordinates returned on subsequent attempts', async () => {
    (User.findOne as jest.Mock).mockReturnValue({
      setOptions: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null)
      })
    });
    (User.create as jest.Mock).mockReturnValue(currentUser);
    (UserSettings.findOne as jest.Mock).mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null)
      })
    });
    (getLocationByIP as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ lat: -100, lng: 100 });

    (getUserMembership as jest.Mock).mockResolvedValue(currentUserMembership);

    const result = await authenticate(currentUser);

    expect(User.findOne).toHaveBeenCalledWith({ 
      pi_uid: currentUser.pi_uid, 
      pi_username: currentUser.pi_username
    });
    expect(User.create).toHaveBeenCalledWith({
      pi_uid: currentUser.pi_uid,
      pi_username: currentUser.pi_username,
      user_name: currentUser.user_name
    })
    expect(getLocationByIP).toHaveBeenCalledTimes(3);
    expect(UserSettings.create).toHaveBeenCalledWith(currentUserSettings);
    expect(getUserMembership).toHaveBeenCalledWith(currentUser);
    expect(result).toEqual({
      user: currentUser,
      membership_class: MembershipClassType.CASUAL
    });
  });

  it('should throw an error if findOrCreateUser during the authentication fails', async () => {
    const mockError = new Error('Mock database error');

    (User.findOne as jest.Mock).mockReturnValue({
      setOptions: jest.fn().mockReturnValue({
        exec: jest.fn().mockRejectedValue(mockError)
      })
    });

    await expect(authenticate(currentUser)).rejects.toThrow(mockError);
  });

  it('should throw an error if getUserMembership during the authentication fails', async () => {
    const mockError = new Error('Mock database error');

    (User.findOne as jest.Mock).mockReturnValue({
      setOptions: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(currentUser)
      })
    });

    (UserSettings.findOne as jest.Mock).mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(currentUserSettings)
      })
    });

    (getUserMembership as jest.Mock).mockRejectedValue(mockError);

    await expect(authenticate(currentUser)).rejects.toThrow(mockError);
  });
});

describe('getUser function', () => {
  const currentUser = {
    pi_uid: '0a0a0a-0a0a-0a0a',
    pi_username: 'test_user',
    user_name: 'testUser'
  } as IUser;

  it('should return a user if found', async () => {
    (User.findOne as jest.Mock).mockReturnValue({
      exec: jest.fn().mockResolvedValue(currentUser)
    });

    const result = await getUser(currentUser.pi_uid);

    expect(User.findOne).toHaveBeenCalledWith({ pi_uid: '0a0a0a-0a0a-0a0a' });
    expect(result).toEqual(currentUser);
  });

  it('should return null if no user is found', async () => {
    (User.findOne as jest.Mock).mockReturnValue({
      exec: jest.fn().mockResolvedValue(null)
    });

    const result = await getUser('0x0x0x-0x0x-0x0x');

    expect(User.findOne).toHaveBeenCalledWith({ pi_uid: '0x0x0x-0x0x-0x0x' });
    expect(result).toBeNull();
  });

  it('should throw an error if getUser fails ', async () => {
    const mockError = new Error('Mock database error');

    (User.findOne as jest.Mock).mockReturnValue({
      exec: jest.fn().mockRejectedValue(mockError)
    });

    await expect(getUser(currentUser.pi_uid)).rejects.toThrow(mockError);
  });
});

describe('deleteUser function', () => {
  const currentUser = {
    pi_uid: '0a0a0a-0a0a-0a0a',
    pi_username: 'test_user',
    user_name: 'testUser'
  } as IUser;

  const currentUserSettings = {
    user_settings_id: currentUser.pi_uid,
    user_name: currentUser.user_name,
    search_map_center: {
      type: 'Point',
      coordinates: [100, -100]
    }
  } as Partial<IUserSettings>;

  const mockSellers = [
    { seller_id: currentUser.pi_uid, name: 'Test Seller' }
  ] as ISeller[];

  it('should delete user and associated seller and user settings data', async () => {
    (Seller.find as any).mockReturnValue({ exec: () => Promise.resolve(mockSellers) });
    (Seller.deleteMany as any).mockReturnValue({ exec: () => Promise.resolve({}) });
    (UserSettings.findOneAndDelete as any).mockReturnValue({ exec: () => Promise.resolve(currentUserSettings) });
    (User.findOneAndDelete as any).mockReturnValue({ exec: () => Promise.resolve(currentUser) });

    const result = await deleteUser(currentUser.pi_uid);

    expect(Seller.find).toHaveBeenCalledWith({ seller_id: '0a0a0a-0a0a-0a0a' });
    expect(Seller.deleteMany).toHaveBeenCalledWith({ seller_id: '0a0a0a-0a0a-0a0a' });
    expect(UserSettings.findOneAndDelete).toHaveBeenCalledWith({ user_settings_id: '0a0a0a-0a0a-0a0a' });
    expect(User.findOneAndDelete).toHaveBeenCalledWith({ pi_uid: currentUser.pi_uid });
    expect(result).toEqual({
      user: currentUser,
      sellers: mockSellers,
      userSetting: currentUserSettings
    });
  });

  it('should return null user and empty arrays if nothing found', async () => {
    (Seller.find as any).mockReturnValue({ exec: () => Promise.resolve([]) });
    (Seller.deleteMany as any).mockReturnValue({ exec: () => Promise.resolve({}) });
    (UserSettings.findOneAndDelete as any).mockReturnValue({ exec: () => Promise.resolve(null) });
    (User.findOneAndDelete as any).mockReturnValue({ exec: () => Promise.resolve(null) });

    const result = await deleteUser(currentUser.pi_uid);

    expect(result).toEqual({
      user: null,
      sellers: [],
      userSetting: null
    });
  });

  it('should throw an error if deleteUser fails', async () => {
    const mockError = new Error('Mock database error');

    (Seller.find as any).mockReturnValue({ exec: () => Promise.reject(mockError) });

    await expect(deleteUser('0a0a0a-0a0a-0a0a')).rejects.toThrow(mockError);
  });
});