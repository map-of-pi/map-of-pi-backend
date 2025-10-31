import Seller from '../../src/models/Seller';
import SellerItem from '../../src/models/SellerItem';
import { addMappiBalance, deductMappiBalance } from '../../src/services/membership.service';
import { 
  getAllSellers,
  registerOrUpdateSeller,
  getAllSellerItems, 
  addOrUpdateSellerItem,
  deleteSellerItem
} from '../../src/services/seller.service';
import User from '../../src/models/User';
import UserSettings from '../../src/models/UserSettings';
import { 
  getChangeInWeeks,
  getRemainingWeeks, 
  computeNewExpiryDate 
} from '../../src/helpers/sellerItem';
import { IUser, ISeller, ISellerItem } from '../../src/types';

jest.mock('../../src/services/membership.service', () => ({
  addMappiBalance: jest.fn(),
  deductMappiBalance: jest.fn()
}));

jest.mock('../../src/helpers/sellerItem', () => ({
  getChangeInWeeks: jest.fn(),
  getRemainingWeeks: jest.fn(),
  computeNewExpiryDate: jest.fn()
}));

describe('getAllSellers function', () => {
  const mockBoundingBox = {
    sw_lat: 40.7000,
    sw_lng: -74.0060,
    ne_lat: 40.9000,
    ne_lng: -73.8000
  };

  it('should fetch all unrestricted sellers when all parameters are empty', async () => {
    const userData = await User.findOne({ pi_username: 'TestUser1' }) as IUser;
    const sellersData = await getAllSellers(undefined, undefined, userData.pi_uid);

    expect(sellersData).toHaveLength(
      await Seller.find({ 
        isRestricted: { $ne: true } 
      }).countDocuments()
    )
  });

  it('should fetch all unrestricted and applicable sellers when all parameters are empty and userSettings does not exist', async () => {
    const userData = await User.findOne({ pi_username: 'TestUser17' }) as IUser;
    const userSettings = await UserSettings.findOne({ user_settings_id: userData.pi_uid });
    expect(userSettings).toBeNull();

    const sellersData = await getAllSellers(undefined, undefined, userData.pi_uid);

    // filter out inactive + test sellers and sellers with trust level < 50.
    expect(sellersData).toHaveLength(1);
  });

  it('should fetch all unrestricted and applicable filtered sellers when all parameters are empty', async () => {
    const userData = await User.findOne({ pi_username: 'TestUser2' }) as IUser;
    const sellersData = await getAllSellers(undefined, undefined, userData.pi_uid);

    // filter out inactive sellers and sellers with trust level <= 50. 
    expect(sellersData).toHaveLength(2);
  });

  it('should fetch all unrestricted and applicable sellers when search query is provided and bounding box params are empty', async () => {
    const searchQuery = 'Vendor';
    const userData = await User.findOne({ pi_username: 'TestUser1' }) as IUser;
    
    const sellersData = await getAllSellers(undefined, searchQuery, userData.pi_uid);
    
    // filter seller records to include those with "Vendor"
    expect(sellersData).toHaveLength(
      await Seller.find({
        $text: { $search: searchQuery },
      }).countDocuments()
    ); // Ensure length matches expected sellers
  });

  it('should fetch all unrestricted and applicable sellers when bounding box params are provided and search query param is empty', async () => {
    const userData = await User.findOne({ pi_username: 'TestUser1' }) as IUser;
    const sellersData = await getAllSellers(mockBoundingBox, undefined, userData.pi_uid);
    
    // filter seller records to include those with sell_map_center within geospatial bounding box
    expect(sellersData).toHaveLength(
      await Seller.countDocuments({
        'sell_map_center.coordinates': {
          $geoWithin: {
            $box: [
              [mockBoundingBox.sw_lng, mockBoundingBox.sw_lat],
              [mockBoundingBox.ne_lng, mockBoundingBox.ne_lat]
            ]
          },
        },
      })
    ); // Ensure length matches expected sellers
  });

  it('should fetch all unrestricted and applicable sellers when all parameters are provided', async () => {
    const searchQuery = 'Seller';
    const userData = await User.findOne({ pi_username: 'TestUser1' }) as IUser;

    const sellersData = await getAllSellers(mockBoundingBox, searchQuery, userData.pi_uid);

    /* filter seller records to include those with "Vendor"
       + include those with sell_map_center within geospatial bounding box */
    expect(sellersData).toHaveLength(
      await Seller.countDocuments({
        $text: { $search: searchQuery },
        'sell_map_center.coordinates': {
          $geoWithin: {
            $box: [
              [mockBoundingBox.sw_lng, mockBoundingBox.sw_lat],
              [mockBoundingBox.ne_lng, mockBoundingBox.ne_lat]
            ]
          },
        },
      })
    ); // Ensure length matches expected sellers
  });

  it('should throw an error when an exception occurs', async () => { 
    const userData = await User.findOne({ pi_username: 'TestUser13' }) as IUser;
    
    // Mock the Seller model to throw an error
    jest.spyOn(Seller, 'find').mockImplementationOnce(() => {
      throw new Error('Mock database error');
    });

    await expect(getAllSellers(undefined, undefined, userData.pi_uid)).rejects.toThrow(
      'Mock database error'
    );
  });
});

describe('registerOrUpdateSeller function', () => {
  // Helper function to convert Mongoose document to a plain object and normalize values accordingly
  const convertToPlainObject = (seller: ISeller): any => {
    const plainObject = seller.toObject();

    if (plainObject.sell_map_center) {
      plainObject.sell_map_center = JSON.stringify(plainObject.sell_map_center);
    }

    if (plainObject.average_rating) {
      plainObject.average_rating = plainObject.average_rating.toString();
    }

    return plainObject;
  };

  const assertSeller = (actual: any, expected: any) => {
    const { _id, __v, createdAt, updatedAt, order_online_enabled_pref, ...filteredActual } = actual; // ignore DB values.
    expect(filteredActual).toEqual(expect.objectContaining(expected));
  };

  it('should add new seller if the seller does not exist', async () => {
    const userData = await User.findOne({ pi_username: 'TestUser13' }) as IUser;
    
    const formData = {
      seller_id: "0m0m0m-0m0m-0m0m",
      name: 'Test Seller 13',
      description: "Test Seller 13 Description",
      address: "Test Seller 13 Address",
      image: "http://example.com/testThirteen.jpg",
      seller_type: "activeSeller",
      sell_map_center: JSON.stringify({
        type: "Point",
        coordinates: [24.1234, 24.1234]
      }),
      average_rating: "5",
      fulfillment_method: "Delivered to buyer",
      fulfillment_description: "Test Seller 13 Fulfillment Description"
    } as unknown as ISeller;

    const sellerData = (await registerOrUpdateSeller(userData, formData)) as ISeller;

    // Convert `sellerData` to a plain object if it's a Mongoose document
    const plainObject = await convertToPlainObject(sellerData);

    assertSeller(plainObject, {
      seller_id: formData.seller_id,
      name: formData.name,
      description: formData.description,
      address: formData.address,
      image: formData.image,
      seller_type: formData.seller_type,
      sell_map_center: formData.sell_map_center,
      average_rating: formData.average_rating,
      fulfillment_method: formData.fulfillment_method,
      fulfillment_description: formData.fulfillment_description
    });
  });

  it('should update existing seller if the seller does exist', async () => {  
    const userData = await User.findOne({ pi_username: 'TestUser3' }) as IUser;
    
    const formData = {
      seller_id: "0c0c0c-0c0c-0c0c",
      name: 'Test Vendor 3 Updated',
      description: "Test Vendor 3 Description Updated",
      address: "Test Vendor 3 Address Updated",
      fulfillment_method: "Delivered to buyer",
      fulfillment_description: "Test Vendor 3 Fulfillment Description"
    } as unknown as ISeller;

    const sellerData = (await registerOrUpdateSeller(userData, formData)) as ISeller;

    // Convert `sellerData` to a plain object if it's a Mongoose document
    const plainObject = await convertToPlainObject(sellerData);

    assertSeller(plainObject, {
      seller_id: formData.seller_id,
      name: formData.name,
      description: formData.description,
      fulfillment_method: formData.fulfillment_method,
      fulfillment_description: formData.fulfillment_description
    });
  });

  it('should throw an error when an exception occurs', async () => { 
    const userData = await User.findOne({ pi_username: 'TestUser3' }) as IUser;
    
    const formData = {
      seller_id: "0c0c0c-0c0c-0c0c",
      name: 'Test Vendor 3 Updated',
      description: "Test Vendor 3 Description Updated",
      address: "Test Vendor 3 Address Updated",
      fulfillment_method: "Delivered to buyer",
      fulfillment_description: "Test Vendor 3 Fulfillment Description"
    } as unknown as ISeller;

    // Mock the Seller model to throw an error
    jest.spyOn(Seller, 'findOne').mockImplementationOnce(() => {
      throw new Error('Mock database error');
    });

    await expect(registerOrUpdateSeller(userData, formData)).rejects.toThrow(
      'Mock database error'
    );
  });
});

describe('getAllSellerItems function', () => {
  it('should return all existing seller items associated with the seller', async () => {  
    const sellerItemsData = await getAllSellerItems('0a0a0a-0a0a-0a0a');

    // filter and assert seller item records associated with the seller
    expect(sellerItemsData).toHaveLength(
      await SellerItem.countDocuments({ seller_id: '0a0a0a-0a0a-0a0a' })
    );
  });

  it('should return null when no seller items exist for the seller', async () => {
    const sellerItemsData = await getAllSellerItems('0c0c0c-0c0c-0c0c');
    
    expect(sellerItemsData).toBeNull();
  });

  it('should throw an error when an exception occurs', async () => {
    jest.spyOn(SellerItem, 'find').mockImplementationOnce(() => {
      throw new Error('Mock database error');
    });

    await expect(getAllSellerItems('0b0b0b-0b0b-0b0b')).rejects.toThrow(
      'Mock database error'
    );
  });
});

describe('addOrUpdateSellerItem function', () => {
  // Helper function to convert Mongoose document to a plain object and normalize values accordingly
  const convertToPlainObject = (sellerItem: ISellerItem): any => {
    const plainObject = sellerItem.toObject();

    if (plainObject.price) {
      plainObject.price = Number(plainObject.price);
    }
    
    if (plainObject.createdAt) {
      plainObject.createdAt = new Date(plainObject.createdAt);
      plainObject.createdAt.setUTCHours(0, 0, 0, 0);
    }

    if (plainObject.updatedAt) {
      plainObject.updatedAt = new Date(plainObject.updatedAt);
      plainObject.updatedAt.setUTCHours(0, 0, 0, 0);
    }

    if (plainObject.expired_by) {
      plainObject.expired_by = new Date(plainObject.expired_by);
      plainObject.expired_by.setUTCHours(0, 0, 0, 0);
    }
    return plainObject;
  };

  const assertNewSellerItem = (actual: any, expected: any) => {
    const { _id, __v, ...filteredActual } = actual; // ignore DB values.
    expect(filteredActual).toEqual(expect.objectContaining(expected));
  };

  const assertUpdatedSellerItem = (actual: any, expected: any) => {
    const { __v, createdAt, ...filteredActual } = actual; // ignore DB values.
    expect(filteredActual).toEqual(expect.objectContaining({ ...expected, _id: actual._id }));
  };

  it('should build new seller item if it does not exist for the seller', async () => {
    // Mock current time globally for predictable expiry date computation
    const fixedNow = new Date('2025-02-20T00:00:00.000Z');
    jest.spyOn(Date, 'now').mockReturnValue(fixedNow.getTime());
    
    const sellerItem = {
      seller_id: "0c0c0c-0c0c-0c0c",
      name: 'Test Seller 3 Item 1',
      description: "Test Seller 3 Item 1 Description",
      price: 0.50,
      stock_level: "Many available",
      duration: 2,
      image: 'http://example.com/testSellerThreeItemOne.jpg',
      createdAt: fixedNow.toISOString()
    } as unknown as ISellerItem;

    (deductMappiBalance as jest.Mock).mockResolvedValue(2);

    const result = await addOrUpdateSellerItem({ seller_id: "0c0c0c-0c0c-0c0c" } as ISeller, sellerItem);

    // Convert `sellerItemData` to a plain object if it's a Mongoose document
    const plainObject = await convertToPlainObject(result.sellerItem!);

    // Simulate same computation as implementation
    const duration = Math.max(Number(sellerItem.duration) || 1, 1);
    const expectedExpiredBy = new Date(fixedNow.getTime() + duration * 7 * 24 * 60 * 60 * 1000);

    // filter and assert seller item records associated with the seller
    assertNewSellerItem(plainObject, {
      seller_id: sellerItem.seller_id,
      name: sellerItem.name,
      description: sellerItem.description,
      price: sellerItem.price,
      stock_level: sellerItem.stock_level,
      duration: sellerItem.duration,
      image: sellerItem.image,
      expired_by: expectedExpiredBy,
    });
    expect(deductMappiBalance).toHaveBeenCalledWith(sellerItem.seller_id, 2);

    jest.restoreAllMocks(); // clean up mock
  });

  describe('addOrUpdateSellerItem | update existing seller item', () => {  
    it('should deduct Mappi and extend listing when changeInWeeks > 0', async () => {
      const sellerItem = {
        _id: "25f5a0f2a86d1f9f3b7e4e81",
        seller_id: "0b0b0b-0b0b-0b0b",
        name: 'Test Seller 2 Item 1 Updated',
        description: "Test Seller 2 Item 1 Description Updated",
        price: 0.50,
        stock_level: "Sold",
        duration: 3,
        image: 'http://example.com/testSellerTwoItemOneUpdated.jpg'
      } as unknown as ISellerItem;

      (getChangeInWeeks as jest.Mock).mockReturnValue(2);
      (computeNewExpiryDate as jest.Mock).mockReturnValue(new Date('2025-01-30T00:00:00.000Z'));
      (deductMappiBalance as jest.Mock).mockResolvedValue(2);

      const result = await addOrUpdateSellerItem({ seller_id: "0b0b0b-0b0b-0b0b" } as ISeller, sellerItem);

      // Convert `sellerItemData` to a plain object if it's a Mongoose document
      const plainObject = await convertToPlainObject(result.sellerItem!);

      const current_date = new Date();
      current_date.setUTCHours(0, 0, 0, 0);

      // In-memory DB' seeded value
      const existingExpiry = new Date('2025-01-16T00:00:00.000Z');
      // New duration = existing duration + changeInWeeks
      const expectedDuration = 1 + getChangeInWeeks(sellerItem as any, sellerItem as any);
      const expired_date = new Date(existingExpiry.getTime() + getChangeInWeeks(sellerItem as any, sellerItem as any) * 7 * 24 * 60 * 60 * 1000);
      expired_date.setUTCHours(0, 0, 0, 0);

      // filter and assert seller item records associated with the seller
      assertUpdatedSellerItem(plainObject, {
        _id: sellerItem._id,
        seller_id: sellerItem.seller_id,
        name: sellerItem.name,
        description: sellerItem.description,
        price: sellerItem.price,
        stock_level: sellerItem.stock_level,
        duration: expectedDuration,
        image: sellerItem.image,
        expired_by: expired_date,
        updatedAt: current_date
      });

      expect(deductMappiBalance).toHaveBeenCalledWith(sellerItem.seller_id, 2);
      expect(result.consumedMappi).toBe(-2);
      expect(result.sellerItem!.duration).toBe(3);
      expect(result.sellerItem!.expired_by).toEqual(new Date('2025-01-30T00:00:00.000Z'));
    });

    it('should refund Mappi and reduce listing when changeInWeeks < 0', async () => {
      const sellerItem = {
        _id: "25f5a0f2a86d1f9f3b7e4e82",
        seller_id: "0b0b0b-0b0b-0b0b",
        name: 'Test Seller 2 Item 2 Updated',
        description: "Test Seller 2 Item 2 Description Updated",
        price: 0.25,
        stock_level: "Ongoing service",
        duration: 2,
        image: 'http://example.com/testSellerTwoItemTwoUpdated.jpg'
      } as unknown as ISellerItem;

      (getChangeInWeeks as jest.Mock).mockReturnValue(-1);
      (computeNewExpiryDate as jest.Mock).mockReturnValue(new Date('2025-01-10T00:00:00.000Z'));
      (addMappiBalance as jest.Mock).mockResolvedValue(1);

      const result = await addOrUpdateSellerItem({ seller_id: "0b0b0b-0b0b-0b0b" } as ISeller, sellerItem);

      // Convert `sellerItemData` to a plain object if it's a Mongoose document
      const plainObject = await convertToPlainObject(result.sellerItem!);

      const current_date = new Date();
      current_date.setUTCHours(0, 0, 0, 0);

      // In-memory DB' seeded value
      const existingExpiry = new Date('2025-01-17T00:00:00.000Z');
      // New duration = existing duration + changeInWeeks
      const expectedDuration = 3 + getChangeInWeeks(sellerItem as any, sellerItem as any);
      const expired_date = new Date(existingExpiry.getTime() + getChangeInWeeks(sellerItem as any, sellerItem as any) * 7 * 24 * 60 * 60 * 1000);
      expired_date.setUTCHours(0, 0, 0, 0);

      // filter and assert seller item records associated with the seller
      assertUpdatedSellerItem(plainObject, {
        _id: sellerItem._id,
        seller_id: sellerItem.seller_id,
        name: sellerItem.name,
        description: sellerItem.description,
        price: sellerItem.price,
        stock_level: sellerItem.stock_level,
        duration: expectedDuration,
        image: sellerItem.image,
        expired_by: expired_date,
        updatedAt: current_date
      });
      expect(addMappiBalance).toHaveBeenCalledWith(sellerItem.seller_id, 1, 'refund');
      expect(result.consumedMappi).toBe(1);
      expect(result.sellerItem!.expired_by).toEqual(new Date('2025-01-10T00:00:00.000Z'));
    });

    it('should ignore Mappi when changeInWeeks = 0', async () => {
      const sellerItem = {
        _id: "24f5a0f2a86d1f9f3b7e4e81",
        seller_id: "0a0a0a-0a0a-0a0a",
        name: 'Test Seller 1 Item 1 Updated',
        description: "Test Seller 1 Item 1 Description Updated",
        price: 0.01,
        stock_level: "1 available",
        duration: 1,
        image: 'http://example.com/testSellerOneItemOneUpdated.jpg'
      } as unknown as ISellerItem;

      (getChangeInWeeks as jest.Mock).mockReturnValue(0);
      (computeNewExpiryDate as jest.Mock).mockReturnValue('2025-01-15T00:00:00.000Z');
  
      const result = await addOrUpdateSellerItem({ seller_id: "0a0a0a-0a0a-0a0a" } as ISeller, sellerItem);
  
      expect(deductMappiBalance).not.toHaveBeenCalled();
      expect(addMappiBalance).not.toHaveBeenCalled();
      expect(result.consumedMappi).toBe(0);
    });
  });

  it('should throw an error when an exception occurs', async () => {  
    const sellerItem = {
      _id: "25f5a0f2a86d1f9f3b7e4e81",
      seller_id: "0b0b0b-0b0b-0b0b",
      name: 'Test Seller 2 Item 1 Updated',
      description: "Test Seller 2 Item 1 Description Updated",
      price: 0.50,
      stock_level: "Ongoing service",
      duration: 2,
      image: 'http://example.com/testSellerThreeItemOneUpdated.jpg'
    } as unknown as ISellerItem;

    // Mock the SellerItem model to throw an error
    jest.spyOn(SellerItem, 'findOne').mockImplementationOnce(() => {
      throw new Error('Mock database error');
    });

    await expect(addOrUpdateSellerItem({ seller_id: "0b0b0b-0b0b-0b0b" } as ISeller, sellerItem)).rejects.toThrow(
      'Mock database error'
    );
  });
});

describe('deleteSellerItem function', () => {
  // Helper function to convert Mongoose document to a plain object and normalize values accordingly
  const convertToPlainObject = (sellerItem: ISellerItem): any => {
    const plainObject = sellerItem.toObject();

    if (plainObject.price) {
      plainObject.price = Number(plainObject.price);
    }

    // Normalize timestamps
    if (plainObject.createdAt instanceof Date) {
      plainObject.createdAt = plainObject.createdAt.toISOString();
    }
    if (plainObject.updatedAt instanceof Date) {
      plainObject.updatedAt = plainObject.updatedAt.toISOString();
    }
    if (plainObject.expired_by instanceof Date) {
      plainObject.expired_by = plainObject.expired_by.toISOString();
    }
    
    return plainObject;
  };

  const assertDeletedSellerItem = (actual: any, expected: any) => {
    const { __v, ...filteredActual } = actual; // ignore DB values.
    expect(filteredActual).toEqual(expect.objectContaining({ ...expected, _id: actual._id }));
  };

  it('should delete seller item if it does exist for the seller', async () => {
    const sellerItem = {
      _id: "24f5a0f2a86d1f9f3b7e4e82",
      seller_id: "0a0a0a-0a0a-0a0a",
      name: 'Test Seller 1 Item 2',
      description: "Test Seller 1 Item 2 Description",
      price: 0.05,
      stock_level: "2 available",
      duration: 2,
      image: 'http://example.com/testSellerOneItemTwo.jpg'
    } as unknown as ISellerItem;

    (getRemainingWeeks as jest.Mock).mockReturnValue(1);
    (addMappiBalance as jest.Mock).mockResolvedValue(1);

    const deletedItem = await deleteSellerItem(sellerItem._id) as ISellerItem;

    // Convert `sellerItemData` to a plain object if it's a Mongoose document
    const plainObject = await convertToPlainObject(deletedItem);
    
    // filter and assert seller item records associated with the seller
    assertDeletedSellerItem(plainObject, {
      _id: sellerItem._id,
      seller_id: sellerItem.seller_id,
      name: sellerItem.name,
      description: sellerItem.description,
      price: sellerItem.price,
      stock_level: sellerItem.stock_level,
      duration: sellerItem.duration,
      image: sellerItem.image
    })
  });

  it('should return null if seller item does not exist', async () => {
    jest.spyOn(SellerItem, 'findById').mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    } as any);

    const result = await deleteSellerItem('nonexistent-id');
    expect(result).toBeNull();
    expect(addMappiBalance).not.toHaveBeenCalled();
  });

  it('should throw an error when an exception occurs', async () => {  
    const sellerItem = { _id: "25f5a0f2a86d1f9f3b7e4e82" } as unknown as ISellerItem;

    jest.spyOn(SellerItem, 'findById').mockReturnValue({
      exec: jest.fn().mockResolvedValue(sellerItem)
    } as any);

    // Mock the SellerItem model to throw an error
    jest.spyOn(SellerItem, 'findByIdAndDelete').mockReturnValue({
      exec: jest.fn().mockRejectedValue(new Error('Mock database error'))
    } as any);

    await expect(deleteSellerItem(sellerItem._id)).rejects.toThrow(
      'Mock database error'
    );
  });
});