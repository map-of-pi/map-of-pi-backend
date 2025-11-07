import { addOrUpdateUserSettings } from '../../src/services/userSettings.service';
import User from '../../src/models/User';
import { DeviceLocationType } from '../../src/models/enums/deviceLocationType';
import { IUser, IUserSettings } from '../../src/types';

const formData = {
  user_name: 'test-user-1-updated',
  email: 'example-new@test.com',
  phone_number: '123-456-7890',
  image: 'http://example.com/image_new.jpg',
  findme: DeviceLocationType.GPS,
  search_map_center: { type: 'Point', coordinates: [-83.856077, 50.848447] }
}

describe('addOrUpdateUserSettings function', () => {
  it('should add new user settings when user_name is not empty', async () => {
    const userData = await User.findOne({ pi_username: 'TestUser1' }) as IUser;

    const userSettingsData = await addOrUpdateUserSettings(userData, formData, formData.image ?? '');
    
    expect(userSettingsData).toEqual(expect.objectContaining({
      user_settings_id: userData.pi_uid,
      user_name: formData.user_name,
      email: formData.email,
      phone_number: formData.phone_number,
      image: formData.image,
      findme: formData.findme,
      search_map_center: formData.search_map_center
    }));
  });

  it('should add new user settings when user_name is empty', async () => {
    const userData = await User.findOne({ pi_username: 'TestUser1' }) as IUser;

    const userSettingsData = await addOrUpdateUserSettings(
    userData, { 
      ...formData, user_name: ""
    } as IUserSettings, formData.image ?? '');

    expect(userSettingsData).toEqual(expect.objectContaining({
      user_settings_id: userData.pi_uid,
      user_name: userData.pi_username,
      email: formData.email,
      phone_number: formData.phone_number,
      image: formData.image,
      findme: formData.findme,
      search_map_center: formData.search_map_center
    }));
  });

  it('should update existing user settings', async () => {
    const userData = await User.findOne({ pi_username: 'TestUser1' }) as IUser;

    const updatedUserSettingsData = {
      user_name: formData.user_name,
      email: formData.email,
      phone_number: formData.phone_number,
      image: formData.image,
      findme: formData.findme,
      search_map_center: formData.search_map_center
    } as IUserSettings;

    const userSettingsData = await addOrUpdateUserSettings(userData, updatedUserSettingsData, updatedUserSettingsData.image ?? '');

    expect(userSettingsData).toEqual(expect.objectContaining({
      user_settings_id: userData.pi_uid,
      user_name: updatedUserSettingsData.user_name,
      email: updatedUserSettingsData.email,
      phone_number: updatedUserSettingsData.phone_number,
      image: updatedUserSettingsData.image,
      findme: updatedUserSettingsData.findme,
      search_map_center: updatedUserSettingsData.search_map_center
    }));
  });

  describe('Additional wallet_address field validation', () => {
    it('should save wallet_address when a valid address is provided', async () => {
      const userData = await User.findOne({ pi_username: 'TestUser1' }) as IUser;

      const userSettingsData = await addOrUpdateUserSettings(
        userData,
        { ...formData, wallet_address: 'GARXTFND5IQK5BFQPGQXUGLXOINQJJKQMEUX7KQYEPFLDPRG6B5I36XX' },
        formData.image ?? ''
      );

      expect(userSettingsData.wallet_address).toBe('GARXTFND5IQK5BFQPGQXUGLXOINQJJKQMEUX7KQYEPFLDPRG6B5I36XX');
    });

    it('should trim wallet_address before saving', async () => {
      const userData = await User.findOne({ pi_username: 'TestUser1' }) as IUser;

      const userSettingsData = await addOrUpdateUserSettings(
        userData,
        { ...formData, wallet_address: ' GARXTFND5IQK5BFQPGQXUGLXOINQJJKQMEUX7KQYEPFLDPRG6B5I36XX ' },
        formData.image ?? ''
      );

      expect(userSettingsData.wallet_address).toBe('GARXTFND5IQK5BFQPGQXUGLXOINQJJKQMEUX7KQYEPFLDPRG6B5I36XX');
    });

    it('should clear wallet_address when empty string is provided', async () => {
      const userData = await User.findOne({ pi_username: 'TestUser1' }) as IUser;

      const userSettingsData = await addOrUpdateUserSettings(
        userData,
        { ...formData, wallet_address: '' },
        formData.image ?? ''
      );

      expect(userSettingsData.wallet_address).toBeNull();
    });

    it('should not save wallet_address and throw an error when an invalid address is provided', async () => {
      const userData = await User.findOne({ pi_username: 'TestUser1' }) as IUser;

      await expect(addOrUpdateUserSettings(
        userData,
        { ...formData, wallet_address: 'INVALID_WALLET_ADDRESS' },
        formData.image ?? ''
      )).rejects.toThrow();
    });
  });
});