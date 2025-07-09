import mongoose, { Types } from "mongoose";
import { getUpdatedStockLevel } from "../../src/helpers/updateStockLevel";
import Order from "../../src/models/Order";
import OrderItem from "../../src/models/OrderItem";
import Seller from "../../src/models/Seller";
import SellerItem from "../../src/models/SellerItem";
import User from "../../src/models/User";
import { FulfillmentType } from "../../src/models/enums/fulfillmentType";
import { OrderStatusType } from "../../src/models/enums/orderStatusType";
import { OrderItemStatusType } from "../../src/models/enums/orderItemStatusType";
import { NewOrder, PickedItems } from "../../src/types";
import { 
  createOrder,
  deleteOrderById,
  getBuyerOrdersById,
  getOrderItems,
  getSellerOrdersById,
  updateOrderStatus,
  updatePaidOrder
} from '../../src/services/order.service';

jest.mock('../../src/helpers/updateStockLevel');
jest.mock('../../src/models/Order');
jest.mock('../../src/models/OrderItem');
jest.mock('../../src/models/Seller');
jest.mock('../../src/models/SellerItem');
jest.mock('../../src/models/User');

describe('createOrder function', () => {
  const mockSession = {
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    abortTransaction: jest.fn(),
    endSession: jest.fn(),
  };  

  beforeEach(() => {
    jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession as any);
  });

  const orderData: NewOrder = {
    buyerId: 'buyerId_TEST',
    sellerId: 'sellerId_TEST',
    paymentId: 'paymentId_TEST',
    totalAmount: '100',
    status: OrderStatusType.Pending,
    fulfillmentMethod: FulfillmentType.DeliveredToBuyer,
    sellerFulfillmentDescription: 'Ships in 2 days',
    buyerFulfillmentDescription: 'Leave at door',
  };

  const orderItems: PickedItems[] = [
    { itemId: 'item1_TEST', quantity: 2 },
    { itemId: 'item2_TEST', quantity: 1 },
  ];

  it('should create an order and insert order items successfully', async () => {
    const mockSavedOrder = { 
      _id: 'orderId1_TEST',
      ...orderData,
      is_paid: false,
      is_fulfilled: false, 
    };

    // Mock Order.save()
    const mockSave = jest.fn().mockResolvedValue(mockSavedOrder);
    (Order as unknown as jest.Mock).mockImplementation(() => ({ save: mockSave }));

    // Mock SellerItem.find().session()
    (SellerItem.find as jest.Mock).mockReturnValueOnce({
      session: jest.fn().mockResolvedValue([
        { _id: 'item1_TEST', price: 10, stock_level: 10 },
        { _id: 'item2_TEST', price: 80, stock_level: 5 },
      ]),
    } as any);

    // Mock OrderItem.insertMany
    (OrderItem.insertMany as jest.Mock).mockResolvedValue([
      {
        _id: new Types.ObjectId(),
        order_id: mockSavedOrder._id,
        seller_item_id: 'item1_TEST',
        quantity: 2,
        subtotal: Types.Decimal128.fromString('20'),
        status: OrderItemStatusType.Pending
      },
      {
        _id: new Types.ObjectId(),
        order_id: mockSavedOrder._id,
        seller_item_id: 'item2_TEST',
        quantity: 1,
        subtotal: Types.Decimal128.fromString('80'),
        status: OrderItemStatusType.Pending,
      }
    ] as any); 

    const result = await createOrder(orderData, orderItems);

    expect(mongoose.startSession).toHaveBeenCalled();
    expect(mockSession.startTransaction).toHaveBeenCalled();
    expect(OrderItem.insertMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          order_id: 'orderId1_TEST',
          seller_item_id: 'item1_TEST',
          quantity: 2,
          subtotal: 20,
          status: OrderItemStatusType.Pending
        }),
        expect.objectContaining({
          order_id: 'orderId1_TEST',
          seller_item_id: 'item2_TEST',
          quantity: 1,
          subtotal: 80,
          status: OrderItemStatusType.Pending
        }),
      ]),
      { session: mockSession }
    );
    expect(mockSession.commitTransaction).toHaveBeenCalled();
    expect(result).toEqual(mockSavedOrder);
  });

  it('should throw an error if order.save() returns null', async () => {
    const mockSave = jest.fn().mockResolvedValue(null);
    (Order as unknown as jest.Mock).mockImplementation(() => ({ save: mockSave }));
  
    await expect(createOrder(orderData, orderItems)).rejects.toThrow('Failed to create order');
  
    expect(mockSession.abortTransaction).toHaveBeenCalled();
    expect(mockSession.endSession).toHaveBeenCalled();
  });

  it('should throw an error if a seller item is not found', async () => {
    const mockSavedOrder = { 
      _id: 'orderId2_TEST',
      ...orderData,
      is_paid: false,
      is_fulfilled: false, 
    };
  
    const mockSave = jest.fn().mockResolvedValue(mockSavedOrder);
    (Order as unknown as jest.Mock).mockImplementation(() => ({ save: mockSave }));
  
    // Return only one item even though two were expected
    (SellerItem.find as jest.Mock).mockReturnValueOnce({
      session: jest.fn().mockResolvedValue([
        { _id: 'item1_TEST', price: 10, stock_level: 10 },
        // item2_TEST is missing
      ]),
    } as any);
  
    await expect(createOrder(orderData, orderItems)).rejects.toThrow('Failed to find associated seller item');
  
    expect(mockSession.abortTransaction).toHaveBeenCalled();
    expect(mockSession.endSession).toHaveBeenCalled();
  });

  it('should abort transaction and throw if OrderItem.insertMany fails', async () => {
    const mockSavedOrder = { 
      _id: 'orderId3_TEST',
      ...orderData,
      is_paid: false,
      is_fulfilled: false, 
    };
  
    const mockSave = jest.fn().mockResolvedValue(mockSavedOrder);
    (Order as unknown as jest.Mock).mockImplementation(() => ({ save: mockSave }));
  
    (SellerItem.find as jest.Mock).mockReturnValueOnce({
      session: jest.fn().mockResolvedValue([
        { _id: 'item1_TEST', price: 10, stock_level: 10 },
        { _id: 'item2_TEST', price: 80, stock_level: 5 },
      ]),
    } as any);
  
    (OrderItem.insertMany as jest.Mock).mockRejectedValue(new Error('Mock database error'));
  
    await expect(createOrder(orderData, orderItems)).rejects.toThrow('Mock database error');
  
    expect(mockSession.abortTransaction).toHaveBeenCalled();
    expect(mockSession.endSession).toHaveBeenCalled();
  });
});

describe('updatePaidOrder function', () => {
  it('should update the order as paid and return the updated order', async () => {
    const paymentId = 'paymentId1_TEST';

    const mockUpdatedOrder = {
      _id: 'orderId1_TEST',
      is_paid: true,
      status: OrderStatusType.Pending,
      payment_id: paymentId,
    };

    // Mock Order.findOneAndUpdate
    (Order.findOneAndUpdate as jest.Mock).mockReturnValueOnce({
      exec: jest.fn().mockResolvedValueOnce(mockUpdatedOrder),
    } as any);

    const result = await updatePaidOrder(paymentId);

    expect(Order.findOneAndUpdate).toHaveBeenCalledWith(
      { payment_id: paymentId },
      {
        $set: {
          is_paid: true,
          status: OrderStatusType.Pending,
        },
      },
      { new: true }
    );
    expect(result).toEqual(mockUpdatedOrder);
  });

  it('should throw an error if no order is found for the paymentID', async () => {
    const paymentId = 'paymentId2_TEST';

    (Order.findOneAndUpdate as jest.Mock).mockReturnValueOnce({
      exec: jest.fn().mockResolvedValueOnce(null),
    } as any);

    await expect(updatePaidOrder(paymentId)).rejects.toThrow('Failed to update paid order');
  });

  it('should throw an error if updating paid order fails', async () => {
    const paymentId = 'paymentId2_TEST';
    const error = new Error('Mock database error');

    (Order.findOneAndUpdate as jest.Mock).mockReturnValueOnce({
      exec: jest.fn().mockRejectedValueOnce(error),
    } as any);

    await expect(updatePaidOrder(paymentId)).rejects.toThrow('Mock database error');
  });
});

describe('getSellerOrdersById function', () => {
  const mockSellerId = new Types.ObjectId();

  it('should return orders for an existing seller', async () => {
    const piUid = 'piUID1_TEST';

    const mockOrders = [
      {
        _id: new Types.ObjectId(),
        buyer_id: { pi_username: 'buyer1_TEST' },
        is_paid: true,
      },
    ];

    // Mock Seller.exists
    (Seller.exists as jest.Mock).mockResolvedValueOnce({ _id: mockSellerId });
    // Mock Order.find and nested attributes
    (Order.find as jest.Mock).mockReturnValueOnce({
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValueOnce(mockOrders),
    } as any);

    const result = await getSellerOrdersById(piUid);

    expect(Seller.exists).toHaveBeenCalledWith({ seller_id: piUid });
    expect(Order.find).toHaveBeenCalledWith({ seller_id: mockSellerId, is_paid: true });
    expect(result).toEqual(mockOrders);
  });

  it('should return an empty array if seller is not found', async () => {
    const piUid = 'piUID2_TEST';

    (Seller.exists as jest.Mock).mockResolvedValueOnce(null);

    const result = await getSellerOrdersById(piUid);

    expect(Seller.exists).toHaveBeenCalledWith({ seller_id: piUid });
    expect(result).toEqual([]);
  });

  it('should throw an error if fetching seller or orders fail', async () => {
    const piUid = 'piUID3_TEST';
    const error = new Error('Mock database error');

    (Seller.exists as jest.Mock).mockRejectedValueOnce(error);

    await expect(getSellerOrdersById(piUid)).rejects.toThrow('Mock database error');
  });

  describe('getBuyerOrdersById function', () => {
    const mockBuyerId = new Types.ObjectId();

    it('should return orders for an existing buyer', async () => {
      const piUid = 'piUID1_TEST';

      const mockOrders = [
        {
          _id: new Types.ObjectId(),
          buyer_id: { pi_username: 'buyer1_TEST' },
          is_paid: true,
        },
      ];

      // Mock User.exists
      (User.exists as jest.Mock).mockResolvedValueOnce({ _id: mockBuyerId });
      // Mock Order.find and nested attributes
      (Order.find as jest.Mock).mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValueOnce(mockOrders),
      } as any);

      const result = await getBuyerOrdersById(piUid);

      expect(User.exists).toHaveBeenCalledWith({ pi_uid: piUid });
      expect(Order.find).toHaveBeenCalledWith({ buyer_id: mockBuyerId, is_paid: true });
      expect(result).toEqual(mockOrders);
    });

    it('should return an empty array if seller is not found', async () => {
      const piUid = 'piUID2_TEST';
  
      (User.exists as jest.Mock).mockResolvedValueOnce(null);
  
      const result = await getBuyerOrdersById(piUid);
  
      expect(User.exists).toHaveBeenCalledWith({ pi_uid: piUid });
      expect(result).toEqual([]);
    });

    it('should throw an error if fetching buyer or orders fails', async () => {
      const piUid = 'piUID3_TEST';
      const error = new Error('Mock database error');
  
      (User.exists as jest.Mock).mockRejectedValueOnce(error);
  
      await expect(getBuyerOrdersById(piUid)).rejects.toThrow('Mock database error');
    });
  });
});

describe('deleteOrderById function', () => {
  const mockOrderId = 'order1_TEST'

  it('should delete the order and return the data', async () => {
    const mockDeletedOrder = { _id: mockOrderId, name: 'Test Order' };

    // Mock Order.findByIdAndDelete
    (Order.findByIdAndDelete as jest.Mock).mockResolvedValueOnce(mockDeletedOrder);

    const result = await deleteOrderById(mockOrderId);

    expect(Order.findByIdAndDelete).toHaveBeenCalledWith(mockOrderId);
    expect(result).toEqual(mockDeletedOrder);
  });

  it('should return null if order is not found', async () => {
    (Order.findByIdAndDelete as jest.Mock).mockResolvedValueOnce(null);

    const result = await deleteOrderById(mockOrderId);

    expect(Order.findByIdAndDelete).toHaveBeenCalledWith(mockOrderId);
    expect(result).toBeNull();
  });

  it('should throw an error if deleting order fails', async () => {
    const error = new Error('Mock database error');

    (Order.findByIdAndDelete as jest.Mock).mockRejectedValueOnce(error);

    await expect(deleteOrderById(mockOrderId)).rejects.toThrow('Mock database error');

    expect(Order.findByIdAndDelete).toHaveBeenCalledWith(mockOrderId);
  });
});

describe('getOrderItems function', () => {
  const mockOrderId = 'order1_TEST';

  it('should fetch order items associated with the order', async () => {
    const mockOrder = {
      _id: mockOrderId,
      buyer_id: 'buyer1_TEST',
      seller_id: { name: 'seller1_TEST' },
    };

    const mockUser = { pi_username: 'piUID1_TEST' };

    const mockOrderItems = [
      {
        _id: 'orderItem1_TEST',
        seller_item_id: { _id: 'item1_TEST', name: 'product1_TEST' },
      },
    ];

    // Expected result after transforming seller_item_id → seller_item
    const expectedOrderItems = [
      {
        ...mockOrderItems[0],
        seller_item: mockOrderItems[0].seller_item_id,
      },
    ];

    // Mock Order.findById and nested attributes
    (Order.findById as jest.Mock).mockReturnValueOnce({
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(mockOrder),
    } as any);

    // Mock User.findById
    (User.findById as jest.Mock).mockResolvedValue(mockUser);

    // Mock OrderItem.find
    (OrderItem.find as jest.Mock).mockReturnValueOnce({
      populate: jest.fn().mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue(mockOrderItems),
      }),
    } as any);

    const result = await getOrderItems(mockOrderId);

    expect(Order.findById).toHaveBeenCalledWith(mockOrderId);
    expect(User.findById).toHaveBeenCalledWith('buyer1_TEST', 'pi_username');
    expect(OrderItem.find).toHaveBeenCalledWith({ order_id: mockOrderId });
    expect(result).toEqual({
      order: mockOrder,
      orderItems: expectedOrderItems,
      pi_username: 'piUID1_TEST',
    });
  });

  it('should return null if order is not found', async () => {
    (Order.findById as jest.Mock).mockReturnValueOnce({
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(null),
    } as any);

    const result = await getOrderItems(mockOrderId);

    expect(result).toBeNull();
  });

  it('should throw an error if getting order items fails', async () => {
    (Order.findById as jest.Mock).mockReturnValueOnce({
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockImplementation(() => {
        throw new Error("Mock database error");
      }),
    } as any);

    await expect(getOrderItems(mockOrderId)).rejects.toThrow('Mock database error');

    expect(Order.findById).toHaveBeenCalledWith(mockOrderId);
  });
});

describe('updateOrderStatus function', () => {
  const mockOrderId = 'order1_TEST';

  it('should update order and mark items fulfilled if status is Completed', async () => {
    const mockOrderItems = [
      { _id: 'orderItem1_TEST' },
      { _id: 'orderItem2_TEST' },
    ];

    const mockUpdatedOrder = { 
      _id: mockOrderId, 
      status: OrderStatusType.Completed 
    };

    // Mock OrderItem.find
    (OrderItem.find as jest.Mock).mockReturnValue({ 
      exec: jest.fn().mockResolvedValue(mockOrderItems) 
    });

    // Mock OrderItem.updateMany
    (OrderItem.updateMany as jest.Mock).mockReturnValue({
      exec: jest.fn().mockResolvedValue({ modifiedCount: 2 }) 
    });

    // Mock.Order.findByIdAndUpdate
    (Order.findByIdAndUpdate as jest.Mock).mockReturnValue({ 
      exec: jest.fn().mockResolvedValue(mockUpdatedOrder) 
    });

    const result = await updateOrderStatus(mockOrderId, OrderStatusType.Completed);

    expect(OrderItem.find).toHaveBeenCalledWith({ order_id: mockOrderId });
    expect(OrderItem.updateMany).toHaveBeenCalledWith(
      { _id: { $in: ['orderItem1_TEST', 'orderItem2_TEST'] } },
      { status: OrderItemStatusType.Fulfilled }
    );
    expect(Order.findByIdAndUpdate).toHaveBeenCalledWith(
      mockOrderId,
      { status: OrderStatusType.Completed },
      { new: true }
    );
    expect(result).toEqual(mockUpdatedOrder);
  });

  it('should not update item statuses if no order items are found for Completed status', async () => {
    const mockUpdatedOrder = {
      _id: mockOrderId,
      status: OrderStatusType.Completed
    };

    // Mock OrderItem.find
    (OrderItem.find as jest.Mock).mockReturnValue({
      exec: jest.fn().mockResolvedValue([])
    });

    // Mock.Order.findByIdAndUpdate
    (Order.findByIdAndUpdate as jest.Mock).mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockUpdatedOrder)
    });

    const result = await updateOrderStatus(mockOrderId, OrderStatusType.Completed);

    expect(OrderItem.find).toHaveBeenCalledWith({ order_id: mockOrderId });
    expect(OrderItem.updateMany).not.toHaveBeenCalled();
    expect(result).toEqual(mockUpdatedOrder);
  });

  it('should handle unhandled status types accordingly', async () => {
    const mockUpdatedOrder = {
      _id: mockOrderId,
      status: OrderStatusType.Cancelled
    };

    // Mock.Order.findByIdAndUpdate
    (Order.findByIdAndUpdate as jest.Mock).mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockUpdatedOrder)
    });

    const result = await updateOrderStatus(mockOrderId, OrderStatusType.Cancelled);

    expect(OrderItem.find).not.toHaveBeenCalled();
    expect(OrderItem.updateMany).not.toHaveBeenCalled();
    expect(Order.findByIdAndUpdate).toHaveBeenCalledWith(
      mockOrderId,
      { status: OrderStatusType.Cancelled },
      { new: true }
    );
    expect(result).toEqual(mockUpdatedOrder);
  });

  it('should return null if order is not found or failed to update status', async () => {
    // Mock OrderItem.find
    (OrderItem.find as jest.Mock).mockReturnValue({
      exec: jest.fn().mockResolvedValue([])
    });
    
    // Mock.Order.findByIdAndUpdate
    (Order.findByIdAndUpdate as jest.Mock).mockReturnValue({
      exec: jest.fn().mockResolvedValue(null)
    });

    const result = await updateOrderStatus(mockOrderId, OrderStatusType.Completed);

    expect(result).toBeNull();
  });

  it('should throw an error if updating order status fails', async () => {
    const error = new Error('Mock database error');

    // Mock OrderItem.find
    (OrderItem.find as jest.Mock).mockReturnValue({
      exec: jest.fn().mockResolvedValue([])
    });

    // Mock.Order.findByIdAndUpdate
    (Order.findByIdAndUpdate as jest.Mock).mockReturnValue({
      exec: jest.fn().mockRejectedValue(error)
    });

    await expect(updateOrderStatus(mockOrderId, OrderStatusType.Completed))
      .rejects.toThrow('Mock database error');
  });
});
