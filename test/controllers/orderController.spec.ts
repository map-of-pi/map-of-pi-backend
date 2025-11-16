import { 
  getSellerOrders, 
  getBuyerOrders,
  getSingleOrder,
  createOrder, 
  deleteOrder, 
  getOrderItems,
  updateOrderStatus,
  updateOrderItemStatus, 
} from '../../src/controllers/orderController';
import { OrderStatusType } from '../../src/models/enums/orderStatusType';
import { OrderItemStatusType } from '../../src/models/enums/orderItemStatusType';
import * as orderService from '../../src/services/order.service';

jest.mock('../../src/services/order.service', () => ({
  getSellerOrdersById: jest.fn(),
  getBuyerOrdersById: jest.fn(),
  createOrder: jest.fn(),
  deleteOrderById: jest.fn(),
  getOrderItems: jest.fn(),
  updateOrderStatus: jest.fn(),
  updateOrderItemStatus: jest.fn(),
  markAsPaidOrder: jest.fn()
}));

describe('orderController', () => {
  let req: any;
  let res: any;

  describe('getSellerOrders function', () => {
    const mockSellerId = '0a0a0a-0a0a-0a0a';
    const mockOrders = [
      { id: 'mock-order-1', item: 'Item 1' },
      { id: 'mock-order-2', item: 'Item 2' },
    ];

    beforeEach(() => {
      req = {
        currentSeller: { seller_id: mockSellerId },
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
    });

    it('should return [200] and seller orders on success', async () => {
      (orderService.getSellerOrdersById as jest.Mock).mockResolvedValue(mockOrders);
  
      await getSellerOrders(req, res);
  
      expect(orderService.getSellerOrdersById).toHaveBeenCalledWith(mockSellerId);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockOrders);
    });

    it('should return [500] if order service throws error', async () => {
      const mockError = new Error('An error occurred while getting seller orders; please try again later');
      (orderService.getSellerOrdersById as jest.Mock).mockRejectedValue(mockError);
  
      await getSellerOrders(req, res);
  
      expect(orderService.getSellerOrdersById).toHaveBeenCalledWith(mockSellerId);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: mockError.message });
    });
  });

  describe('getBuyerOrders function', () => {
    const mockUserId = '0b0b0b-0b0b-0b0b';
    const mockOrders = [
      { id: 'mock-order-1', item: 'Item 1' },
      { id: 'mock-order-2', item: 'Item 2' },
    ];

    beforeEach(() => {
      req = {
        currentUser: { pi_uid: mockUserId },
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
    });

    it('should return [200] and buyer orders on success', async () => {
      (orderService.getBuyerOrdersById as jest.Mock).mockResolvedValue(mockOrders);
  
      await getBuyerOrders(req, res);
  
      expect(orderService.getBuyerOrdersById).toHaveBeenCalledWith(mockUserId);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockOrders);
    });

    it('should return [500] if order service throws error', async () => {
      const mockError = new Error('An error occurred while getting buyer orders; please try again later');
      (orderService.getBuyerOrdersById as jest.Mock).mockRejectedValue(mockError);
  
      await getBuyerOrders(req, res);
  
      expect(orderService.getBuyerOrdersById).toHaveBeenCalledWith(mockUserId);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: mockError.message });
    });
  });

  describe('getSingleOrder function', () => {
    const mockOrderId = '24f5a0f2a86d1f9f3b7e4e81';
    const mockOrder = { id: 'mock-order-3', items: ['Item 3'] };

    beforeEach(() => {
      req = {
        params: { order_id: mockOrderId }
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
    });

    it('should return [200] and single order on success', async () => {
      (orderService.getOrderItems as jest.Mock).mockResolvedValue(mockOrder);
  
      await getSingleOrder(req, res);
  
      expect(orderService.getOrderItems).toHaveBeenCalledWith(mockOrderId);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockOrder);
    });

    it('should return [404] if single order is not found', async () => {
      (orderService.getOrderItems as jest.Mock).mockResolvedValue(null);
  
      await getSingleOrder(req, res);
  
      expect(orderService.getOrderItems).toHaveBeenCalledWith(mockOrderId);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Order not found' });
    });

    it('should return [500] if order service throws error', async () => {
      const mockError = new Error('An error occurred while getting single order; please try again later');
      (orderService.getOrderItems as jest.Mock).mockRejectedValue(mockError);
  
      await getSingleOrder(req, res);
  
      expect(orderService.getOrderItems).toHaveBeenCalledWith(mockOrderId);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: mockError.message });
    });
  });

  describe('createOrder function', () => {
    const mockBuyerPiUid = '0a0a0a-0a0a-0a0a';
    const mockOrderId = '24f5a0f2a86d1f9f3b7e4e82';
    const mockOrderData = { status: OrderStatusType.Initialized };
    const mockOrderItems = [{ itemId: 'item-1' }];

    beforeEach(() => {
      req = { 
        body: {
          orderData: mockOrderData,
          orderItems: mockOrderItems
        },
        currentUser: {
          pi_uid: mockBuyerPiUid
        }    
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
    });

    it('should return [200] and the created order (marked as paid) on success', async () => {
      const mockOrder = {
        _id: mockOrderId,
        status: OrderStatusType.Initialized,
        paymentId: null,
        buyerPiUid: mockBuyerPiUid,
        orderItems: mockOrderItems,
      };
      
      const mockPaidOrder = {
        ...mockOrder,
        status: OrderStatusType.Pending,
      };

      (orderService.createOrder as jest.Mock).mockResolvedValue(mockOrder);
      (orderService.markAsPaidOrder as jest.Mock).mockResolvedValue(mockPaidOrder);
  
      await createOrder(req, res);
  
      expect(orderService.createOrder).toHaveBeenCalledWith({
        ...mockOrderData,
        paymentId: null,
        orderItems: mockOrderItems,
        buyerPiUid: mockBuyerPiUid,
      });
      expect(orderService.markAsPaidOrder).toHaveBeenCalledWith(mockOrderId);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockPaidOrder);
    });

    it('should return [400] if createOrder service returns null', async () => {
      (orderService.createOrder as jest.Mock).mockResolvedValue(null);
  
      await createOrder(req, res);
  
      expect(orderService.createOrder).toHaveBeenCalledWith({
        ...mockOrderData,
        paymentId: null,
        orderItems: mockOrderItems,
        buyerPiUid: mockBuyerPiUid,
      });
      expect(orderService.markAsPaidOrder).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid order data' });
    });

    it('should return [500] if createOrder service throws an error', async () => {
      const mockError = new Error('createOrder service layer error');
      (orderService.createOrder as jest.Mock).mockRejectedValue(mockError);
  
      await createOrder(req, res);
  
      expect(orderService.createOrder).toHaveBeenCalledWith({
        ...mockOrderData,
        paymentId: null,
        orderItems: mockOrderItems,
        buyerPiUid: mockBuyerPiUid,
      });
      expect(orderService.markAsPaidOrder).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ 
        message: 'An error occurred while creating order; please try again later'
      });
    });

    it('should return [500] if markAsPaidOrder service throws an error', async () => {
      const mockError = new Error('markAsPaidOrder service layer error');
      const mockOrder = {
        _id: mockOrderId,
        status: OrderStatusType.Initialized,
        paymentId: null,
        buyerPiUid: mockBuyerPiUid,
        orderItems: mockOrderItems,
      };
  
      (orderService.createOrder as jest.Mock).mockResolvedValue(mockOrder);
      (orderService.markAsPaidOrder as jest.Mock).mockRejectedValue(mockError);
  
      await createOrder(req, res);
  
      expect(orderService.createOrder).toHaveBeenCalledWith({
        ...mockOrderData,
        paymentId: null,
        orderItems: mockOrderItems,
        buyerPiUid: mockBuyerPiUid,
      });
      expect(orderService.markAsPaidOrder).toHaveBeenCalledWith(mockOrderId);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'An error occurred while creating order; please try again later'
      });
    });
  });

  describe('deleteOrder function', () => {
    beforeEach(() => {
      req = { 
        params: { order_id: '26f5a0f2a86d1f9f3b7e4e83' }
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
    });

    it('should return [200] and deletedOrder on success', async () => {
      const deletedOrder = { order_id: "25f5a0f2a86d1f9f3b7e4e83" };
      
      (orderService.deleteOrderById as jest.Mock).mockResolvedValue(deletedOrder);
      
      await deleteOrder(req, res);

      expect(orderService.deleteOrderById).toHaveBeenCalledWith('26f5a0f2a86d1f9f3b7e4e83');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ 
        message: "Order deleted successfully",
        deletedOrder: deletedOrder 
      });
    });

    it('should return [404] if order to delete is not found', async () => {
      (orderService.deleteOrderById as jest.Mock).mockResolvedValue(null);
  
      await deleteOrder(req, res);
  
      expect(orderService.deleteOrderById).toHaveBeenCalledWith('26f5a0f2a86d1f9f3b7e4e83');
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Order not found' });
    });

    it('should return [500] if order service throws error', async () => {
      const mockError = new Error('An error occurred while deleting order; please try again later');
      
      (orderService.deleteOrderById as jest.Mock).mockRejectedValue(mockError);
      
      await deleteOrder(req, res);
  
      expect(orderService.deleteOrderById).toHaveBeenCalledWith('26f5a0f2a86d1f9f3b7e4e83');
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: mockError.message });
    });
  });

  describe('getOrderItems function', () => {
    const mockOrderId = '24f5a0f2a86d1f9f3b7e4e84';

    beforeEach(() => {
      req = { 
        params: { orderId: mockOrderId }
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
    });

    it('should return [200] and order items on success', async () => {
      const mockOrderItems = {
        orderItems: [{ itemId: 'item-2' }],
      };
      
      (orderService.getOrderItems as jest.Mock).mockResolvedValue(mockOrderItems);
      
      await getOrderItems(req, res);

      expect(orderService.getOrderItems).toHaveBeenCalledWith(mockOrderId);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockOrderItems);
    });

    it('should return [404] if order item is not found', async () => {
      (orderService.getOrderItems as jest.Mock).mockResolvedValue(null);
  
      await getOrderItems(req, res);
  
      expect(orderService.getOrderItems).toHaveBeenCalledWith(mockOrderId);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "No items found for this order" });
    });

    it('should return [500] if order service throws error', async () => {
      const mockError = new Error('An error occurred while getting order items; please try again later');
      
      (orderService.getOrderItems as jest.Mock).mockRejectedValue(mockError);
      
      await getOrderItems(req, res);
  
      expect(orderService.getOrderItems).toHaveBeenCalledWith(mockOrderId);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: mockError.message });
    });
  });

  describe('updateOrderStatus function', () => {
    const mockOrderId = '24f5a0f2a86d1f9f3b7e4e85';

    beforeEach(() => {
      req = { 
        params: { order_id: mockOrderId },
        body: { orderStatus: OrderStatusType.Completed }
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
    });

    it('should return [200] and updated order on success', async () => {
      const mockOrder = { order_id: mockOrderId, status: OrderStatusType.Completed };
      
      (orderService.updateOrderStatus as jest.Mock).mockResolvedValue(mockOrder);
      
      await updateOrderStatus(req, res);

      expect(orderService.updateOrderStatus).toHaveBeenCalledWith(mockOrderId, req.body.orderStatus);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockOrder);
    });

    it('should return [404] if updated order is not found', async () => {
      (orderService.updateOrderStatus as jest.Mock).mockResolvedValue(null);
  
      await updateOrderStatus(req, res);
  
      expect(orderService.updateOrderStatus).toHaveBeenCalledWith(mockOrderId, req.body.orderStatus);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Order not found or could not be updated' });
    });

    it('should return [500] if order service throws error', async () => {
      const mockError = new Error('An error occurred while updating order status; please try again later');
      
      (orderService.updateOrderStatus as jest.Mock).mockRejectedValue(mockError);
      
      await updateOrderStatus(req, res);
  
      expect(orderService.updateOrderStatus).toHaveBeenCalledWith(mockOrderId, req.body.orderStatus);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: mockError.message });
    });
  });

  describe('updateOrderItemStatus function', () => {
    const mockOrderItemId = '24f5a0f2a86d1f9f3b7e4e86';

    beforeEach(() => {
      req = { 
        params: { orderitem_id: mockOrderItemId },
        body: { orderItemStatus: OrderItemStatusType.Fulfilled }
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
    });

    it('should return [200] and updated order item on success', async () => {
      const mockOrderItem = { orderitem_id: mockOrderItemId, status: OrderItemStatusType.Fulfilled };
      
      (orderService.updateOrderItemStatus as jest.Mock).mockResolvedValue(mockOrderItem);
      
      await updateOrderItemStatus(req, res);

      expect(orderService.updateOrderItemStatus).toHaveBeenCalledWith(mockOrderItemId, req.body.orderItemStatus);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockOrderItem);
    });

    it('should return [400] if id or orderItemStatus is missing', async () => {
      req.params = {};
  
      await updateOrderItemStatus(req, res);
  
      expect(orderService.updateOrderItemStatus).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Order item ID and order item status are required' });
    });

    it('should return [400] if orderItemStatus is invalid', async () => {
      req.body = { orderItemStatus: 'InvalidOrderItemStatus' };
  
      await updateOrderItemStatus(req, res);
  
      expect(orderService.updateOrderItemStatus).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid order item status' });
    });

    it('should return [404] if updated order item is not found', async () => {
      (orderService.updateOrderItemStatus as jest.Mock).mockResolvedValue(null);
  
      await updateOrderItemStatus(req, res);
  
      expect(orderService.updateOrderItemStatus).toHaveBeenCalledWith(mockOrderItemId, req.body.orderItemStatus);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Order item not found or could not be updated' });
    });

    it('should return [500] if order service throws error', async () => {
      const mockError = new Error('An error occurred while updating order item status; please try again later');
      
      (orderService.updateOrderItemStatus as jest.Mock).mockRejectedValue(mockError);
      
      await updateOrderItemStatus(req, res);
  
      expect(orderService.updateOrderItemStatus).toHaveBeenCalledWith(mockOrderItemId, req.body.orderItemStatus);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: mockError.message });
    });
  });
});