import Seller from '../../src/models/Seller';
import SellerItem from '../../src/models/SellerItem';
import { 
  getAllSellers,
  registerOrUpdateSeller,
  getAllSellerItems, 
  addOrUpdateSellerItem,
  deleteSellerItem
} from '../../src/services/seller.service';
import User from '../../src/models/User';
import UserSettings from '../../src/models/UserSettings';
import { IUser, ISeller, ISellerItem } from '../../src/types';

jest.mock('../../src/services/membership.service', () => ({
  deductMappiBalance: jest.fn()
}))

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
      plainObject.createdAt.setHours(0, 0, 0, 0);
    }

    if (plainObject.updatedAt) {
      plainObject.updatedAt = new Date(plainObject.updatedAt);
      plainObject.updatedAt.setHours(0, 0, 0, 0);
    }

    if (plainObject.expired_by) {
      plainObject.expired_by = new Date(plainObject.expired_by);
      plainObject.expired_by.setHours(0, 0, 0, 0);
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
    const sellerItem = {
      seller_id: "0c0c0c-0c0c-0c0c",
      name: 'Test Seller 3 Item 1',
      description: "Test Seller 3 Item 1 Description",
      price: 0.50,
      stock_level: "Many available",
      duration: 2,
      image: 'http://example.com/testSellerThreeItemOne.jpg',
      createdAt: '2025-02-20T00:00:00.000Z'
    } as unknown as ISellerItem;

    const result = await addOrUpdateSellerItem({ seller_id: "0c0c0c-0c0c-0c0c" } as ISeller, sellerItem);

    // Convert `sellerItemData` to a plain object if it's a Mongoose document
    const plainObject = await convertToPlainObject(result.sellerItem!);

    const current_date = new Date();
    current_date.setHours(0, 0, 0, 0);

    // Calculate the expired_by date (current_date + duration in weeks)
    const durationInMs = (sellerItem.duration || 1) * 7 * 24 * 60 * 60 * 1000;
    const expired_date = new Date(current_date.getTime() + durationInMs)
    expired_date.setHours(0, 0, 0, 0);

    // filter and assert seller item records associated with the seller
    assertNewSellerItem(plainObject, {
      seller_id: sellerItem.seller_id,
      name: sellerItem.name,
      description: sellerItem.description,
      price: sellerItem.price,
      stock_level: sellerItem.stock_level,
      duration: sellerItem.duration,
      image: sellerItem.image,
      expired_by: expired_date,
      createdAt: current_date,
      updatedAt: current_date
    });
  });

  it('should update existing seller item if it does exist for the seller', async () => {  
    const sellerItem = {
      _id: "25f5a0f2a86d1f9f3b7e4e81",
      seller_id: "0b0b0b-0b0b-0b0b",
      name: 'Test Seller 2 Item 1 Updated',
      description: "Test Seller 2 Item 1 Description Updated",
      price: 0.50,
      stock_level: "Sold",
      duration: 2,
      image: 'http://example.com/testSellerThreeItemOneUpdated.jpg'
    } as unknown as ISellerItem;

    const result = await addOrUpdateSellerItem({ seller_id: "0b0b0b-0b0b-0b0b" } as ISeller, sellerItem);

    // Convert `sellerItemData` to a plain object if it's a Mongoose document
    const plainObject = await convertToPlainObject(result.sellerItem!);

    const current_date = new Date();
    current_date.setHours(0, 0, 0, 0);

    // Calculate the expired_by date (current_date + duration in weeks)
    const durationInMs = (sellerItem.duration || 1) * 7 * 24 * 60 * 60 * 1000;
    const expired_date = new Date(current_date.getTime() + durationInMs)
    expired_date.setHours(0, 0, 0, 0);

    // filter and assert seller item records associated with the seller
    assertUpdatedSellerItem(plainObject, {
      _id: sellerItem._id,
      seller_id: sellerItem.seller_id,
      name: sellerItem.name,
      description: sellerItem.description,
      price: sellerItem.price,
      stock_level: sellerItem.stock_level,
      duration: sellerItem.duration,
      image: sellerItem.image,
      expired_by: expired_date,
      updatedAt: current_date
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
      _id: "25f5a0f2a86d1f9f3b7e4e82",
      seller_id: "0b0b0b-0b0b-0b0b",
      name: 'Test Seller 2 Item 2',
      description: "Test Seller 2 Item 2 Description",
      price: 0.25,
      stock_level: "Ongoing service",
      duration: 1,
      image: 'http://example.com/testSellerTwoItemTwo.jpg',
      createdAt: '2025-01-10T00:00:00.000Z',
      updatedAt: '2025-01-10T00:00:00.000Z',
      expired_by: '2025-01-17T00:00:00.000Z'
    } as unknown as ISellerItem;

    const sellerItemData = await deleteSellerItem(sellerItem._id) as ISellerItem;

    // Convert `sellerItemData` to a plain object if it's a Mongoose document
    const plainObject = await convertToPlainObject(sellerItemData);
    
    // filter and assert seller item records associated with the seller
    assertDeletedSellerItem(plainObject, {
      _id: sellerItem._id,
      seller_id: sellerItem.seller_id,
      name: sellerItem.name,
      description: sellerItem.description,
      price: sellerItem.price,
      stock_level: sellerItem.stock_level,
      duration: sellerItem.duration,
      image: sellerItem.image,
      createdAt: sellerItem.createdAt,
      updatedAt: sellerItem.updatedAt,
      expired_by: sellerItem.expired_by
    });
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