import { getSellerItems, addOrUpdateSellerItem, deleteSellerItem } from '../../src/controllers/sellerController';
import * as sellerService from '../../src/services/seller.service';
import { uploadImage } from '../../src/services/misc/image.service';

jest.mock('../../src/services/seller.service', () => ({
  getAllSellerItems: jest.fn(),
  addOrUpdateSellerItem: jest.fn(),
  deleteSellerItem: jest.fn()
}));

jest.mock('../../src/services/misc/image.service', () => ({
  uploadImage: jest.fn(),
}));

describe('sellerController', () => {
  let req: any;
  let res: any;

  describe('getSellerItems function', () => {
    beforeEach(() => {
      req = { params: {} };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
    });

    it('should return appropriate [200] when the seller has items', async () => {
      req.params.seller_id = '0a0a0a-0a0a-0a0a';

      const expectedSellerItems = [
        {
          id: "24f5a0f2a86d1f9f3b7e4e81",
          seller_id: "0a0a0a-0a0a-0a0a",
          name: "Test Seller 1 Item 1",
          description: "Test Seller 1 Item 1 Description",
          price: 0.01,
          stock_level: "1 Available",
          image: "http://example.com/testSellerOneItemOne.jpg",
          duration: 1,
          created_at: "2025-01-08T00:00:00.000Z",
          updated_at: "2025-01-08T00:00:00.000Z",
          expired_by: "2025-01-15T00:00:00.000Z"
        },
        {
          _id: "24f5a0f2a86d1f9f3b7e4e82",
          seller_id: "0a0a0a-0a0a-0a0a",
          name: "Test Seller 1 Item 2",
          description: "Test Seller 1 Item 2 Description",
          price: 0.05,
          stock_level: "2 Available",
          image: "http://example.com/testSellerOneItemTwo.jpg",
          duration: 2,
          created_at: "2025-01-08T00:00:00.000Z",
          updated_at: "2025-01-08T00:00:00.000Z",
          expired_by: "2025-01-22T00:00:00.000Z"
        }
      ];
      
      (sellerService.getAllSellerItems as jest.Mock).mockResolvedValue(expectedSellerItems);
      
      await getSellerItems(req, res);

      expect(sellerService.getAllSellerItems).toHaveBeenCalledWith('0a0a0a-0a0a-0a0a');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expectedSellerItems);
    });

    it('should return appropriate [204] when the seller has no items', async () => {
      req.params.seller_id = '0b0b0b-0b0b-0b0b';
      
      (sellerService.getAllSellerItems as jest.Mock).mockResolvedValue([]);
      
      await getSellerItems(req, res);

      expect(sellerService.getAllSellerItems).toHaveBeenCalledWith('0b0b0b-0b0b-0b0b');
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.json).toHaveBeenCalledWith({ message: "Seller items not found" });
    });

    it('should return appropriate [500] when getting seller items fails', async () => {
      req.params.seller_id = '0a0a0a-0a0a-0a0a';

      const mockError = new Error('An error occurred while fetching seller Items; please try again later');

      (sellerService.getAllSellerItems as jest.Mock).mockRejectedValue(mockError);

      await getSellerItems(req, res);

      expect(sellerService.getAllSellerItems).toHaveBeenCalledWith('0a0a0a-0a0a-0a0a');
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: mockError.message });
    });
  });

  describe('addOrUpdateSellerItem function', () => {
    beforeEach(() => {
      req = { 
        body: {},
        file: {
          buffer: Buffer.from('testSellerThreeItemOne.jpg'),
          mimetype: 'image/jpeg'
        },
        currentSeller: {
          seller_id: '0c0c0c-0c0c-0c0c',
          name: "Test Vendor 3",
          seller_type: "activeSeller",
          description: "Test Vendor 3 Description",
          average_rating: 5.0,
          sell_map_center: {
              type: "Point",
              coordinates: [-87.6298, 41.8781]
          },
          order_online_enabled_pref: false,
          fulfillment_method: "Collection by buyer"
        }
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
    });

    it('should return appropriate [200] when the seller item is added/ updated successfully', async () => {
      req.body = {
        seller_id: '0c0c0c-0c0c-0c0c',
        name: 'Test Seller 3 Item 1',
        description: "Test Seller 3 Item 1 Description",
        price: 0.25,
        stock_level: "Made to order",
        duration: 1
      };
      const mockImageUrl = "http://example.com/testSellerThreeItemOne.jpg";
      const expectedNewSellerItem = {
        ...req.body,
        _id: "26f5a0f2a86d1f9f3b7e4e81",
        image: mockImageUrl,
        created_at: "2025-01-10T00:00:00.000Z",
        updated_at: "2025-01-10T00:00:00.000Z",
        expired_by: "2025-01-17T00:00:00.000Z"
      };
      
      (uploadImage as jest.Mock).mockResolvedValue(mockImageUrl);
      (sellerService.addOrUpdateSellerItem as jest.Mock).mockResolvedValue(expectedNewSellerItem);
      
      await addOrUpdateSellerItem(req, res);

      expect(uploadImage).toHaveBeenCalledWith('0c0c0c-0c0c-0c0c', req.file, 'seller-item');
      expect(sellerService.addOrUpdateSellerItem).toHaveBeenCalledWith(req.currentSeller, req.body);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expectedNewSellerItem);
    });

    it('should return appropriate [500] when adding/ updating seller item fails', async () => {
      const mockError = new Error('An error occurred while adding/ updating seller item; please try again later');
      
      (sellerService.addOrUpdateSellerItem as jest.Mock).mockRejectedValue(mockError);
      
      await addOrUpdateSellerItem(req, res);
  
      expect(uploadImage).toHaveBeenCalledWith('0c0c0c-0c0c-0c0c', req.file, 'seller-item');
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: mockError.message });
    });
  });

  describe('deleteSellerItem function', () => {
    beforeEach(() => {
      req = { 
        params: {
          item_id: '26f5a0f2a86d1f9f3b7e4e81'
        },
        currentSeller: {
          seller_id: '0b0b0b-0b0b-0b0b',
          name: "Test Vendor 2",
          seller_type: "activeSeller",
          description: "Test Vendor 2 Description",
          average_rating: 5.0,
          sell_map_center: {
              type: "Point",
              coordinates: [-87.6298, 41.8781]
          },
          order_online_enabled_pref: false,
          fulfillment_method: "Collection by Buyer"
        }
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
    });

    it('should return appropriate [200] when the seller item is deleted successfully', async () => {
      const expectedSellerItem = 
      {
        id: "25f5a0f2a86d1f9f3b7e4e82",
        seller_id: "0b0b0b-0b0b-0b0b",
        name: "Test Seller 2 Item 1",
        description: "Test Seller 2 Item 1 Description",
        price: 0.15,
        stock_level: "Sold",
        image: "http://example.com/testSellerTwoItemOne.jpg",
        duration: 1,
        created_at: "2025-01-09T00:00:00.000Z",
        updated_at: "2025-01-09T00:00:00.000Z",
        expired_by: "2025-01-16T00:00:00.000Z"
      };
      
      (sellerService.deleteSellerItem as jest.Mock).mockResolvedValue(expectedSellerItem);
      
      await deleteSellerItem(req, res);

      expect(sellerService.deleteSellerItem).toHaveBeenCalledWith('26f5a0f2a86d1f9f3b7e4e81');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: "Seller item deleted successfully", deletedSellerItem: expectedSellerItem });
    });

    it('should return appropriate [500] when deleting seller item fails', async () => {
      const mockError = new Error('An error occurred while deleting seller item; please try again later');
      
      (sellerService.deleteSellerItem as jest.Mock).mockRejectedValue(mockError);
      
      await deleteSellerItem(req, res);
  
      expect(sellerService.deleteSellerItem).toHaveBeenCalledWith('26f5a0f2a86d1f9f3b7e4e81');
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: mockError.message });
    });
  });
});