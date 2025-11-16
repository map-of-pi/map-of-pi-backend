import axios from "axios";
import { Types } from "mongoose";
import { platformAPIClient } from "../../src/config/platformAPIclient";
import * as paymentModule from "../../src/helpers/payment";
import { FulfillmentType } from "../../src/models/enums/fulfillmentType";
import { OrderStatusType } from "../../src/models/enums/orderStatusType";
import { MembershipClassType } from "../../src/models/enums/membershipClassType";
import { PaymentType } from "../../src/models/enums/paymentType";
import { applyMembershipChange } from "../../src/services/membership.service";
import { 
  cancelOrder,
  createOrder, 
  updatePaidOrder 
} from "../../src/services/order.service";
import {
  cancelPayment, 
  completePayment, 
  createPayment, 
  getPayment 
} from "../../src/services/payment.service";
import { 
  IOrder,
  IPayment, 
  NewPayment, 
  PaymentDTO, 
  PaymentInfo, 
  U2AMetadata
} from "../../src/types";

jest.mock('axios');
jest.mock('../../src/config/platformAPIclient', () => ({
  platformAPIClient: {
    get: jest.fn(),
    post: jest.fn()
  },
}));
jest.mock('../../src/models/Seller');
jest.mock('../../src/models/Order');
jest.mock('../../src/models/User');
jest.mock('../../src/services/membership.service');
jest.mock('../../src/services/payment.service');
jest.mock('../../src/services/order.service');

function initializePayments(
  payment: IPayment, 
  paymentDTO: PaymentDTO, 
  metadata: U2AMetadata = {} as U2AMetadata
) {
  (getPayment as jest.Mock).mockResolvedValue(payment);

  (axios.create as jest.Mock).mockReturnValue({
    get: jest.fn().mockResolvedValue({ data: { memo: payment.pi_payment_id } }),
  });

  (platformAPIClient.get as jest.Mock).mockResolvedValue({ data: { ...paymentDTO, metadata } });
}

describe('processIncompletePayment function', () => {
  const mockPaymentInfo: PaymentInfo = {
    identifier: 'paymentInfo_TEST',
    transaction: {
      txid: 'txid_TEST',
      _link: 'https://api.blockchain.pi/payment_TEST/',
    },
  };

  const mockPayment: IPayment = {
    user_id: new Types.ObjectId() as any,
    pi_payment_id: mockPaymentInfo.identifier,
    amount: Types.Decimal128.fromString("100.00"),
    paid: false,
    memo: "paymentInfo_TEST", // pi_payment_id
    txid: "txid_TEST",
    cancelled: false,
    createdAt: new Date()
  } as unknown as IPayment;

  const mockPaymentDTO: PaymentDTO = {
    amount: 100,
    user_uid: "userUid_TEST",
    created_at: new Date().toISOString(),
    identifier: mockPaymentInfo.identifier,
    memo: "paymentInfo_TEST", // pi_payment_id
    status: {
      developer_approved: true,
      transaction_verified: true,
      developer_completed: false,
      cancelled: false,
      user_cancelled: false,
    },
    to_address: "Test Pi Address",
    transaction: {
      txid: "txid_TEST",
      verified: true,
      _link: "https://example.com",
    },
  } as unknown as PaymentDTO;

  it('should throw error if no corresponding incomplete payment is found', async () => {
    (getPayment as jest.Mock).mockResolvedValue(null);

    await expect(paymentModule.processIncompletePayment(mockPaymentInfo))
      .rejects.toThrow("Finding incomplete payment failed");

    expect(getPayment).toHaveBeenCalledWith(mockPaymentInfo.identifier);
    expect(axios.create).not.toHaveBeenCalled();
  });

  it('should throw error if blockchain memo does not match the internal paymentID', async () => {
    (getPayment as jest.Mock).mockResolvedValue(mockPayment);

    (axios.create as jest.Mock).mockReturnValue({
      get: jest.fn().mockResolvedValue({ data: { memo: 'unmatched memo' } }),
    });

    await expect(paymentModule.processIncompletePayment(mockPaymentInfo))
      .rejects.toThrow("Unable to find payment on the Pi Blockchain");

    expect(getPayment).toHaveBeenCalledWith(mockPaymentInfo.identifier);
    expect(axios.create).toHaveBeenCalled();
  });

  it('should throw an error if Horizon API request fails', async () => {
    const mockError = new Error('Horizon API timeout');
    
    (getPayment as jest.Mock).mockResolvedValue(mockPayment);

    (axios.create as jest.Mock).mockReturnValue({
      get: jest.fn().mockRejectedValue(mockError),
    });

    await expect(paymentModule.processIncompletePayment(mockPaymentInfo))
      .rejects.toThrow(mockError);

    expect(getPayment).toHaveBeenCalledWith(mockPaymentInfo.identifier);
    expect(axios.create).toHaveBeenCalled();
  });

  it('should throw an error if no transaction ID exists [completePiPayment function]', async () => {
    const mockPayment_noTxnId = {
      ...mockPayment,
      txid: null
    } as unknown as IPayment;

    const mockPaymentInfo_noTxnId = {
      ...mockPaymentInfo,
      transaction: {
        txid: null
      }
    } as unknown as PaymentInfo;

    const mockError = new Error('No transaction ID');

    initializePayments(mockPayment_noTxnId, mockPaymentDTO);

    (axios.create as jest.Mock).mockReturnValue({
      get: jest.fn().mockResolvedValue({ data: { memo: "paymentInfo_TEST" } }),
    });

    await expect(paymentModule.processIncompletePayment(mockPaymentInfo_noTxnId))
      .rejects.toThrow(mockError);

    expect(getPayment).toHaveBeenCalledWith(mockPaymentInfo.identifier);
    expect(axios.create).toHaveBeenCalled();
    expect(platformAPIClient.get).toHaveBeenCalledWith(`/v2/payments/${ mockPaymentInfo.identifier }`);
  });

  describe('BuyerCheckout payments', () => {
    const mockOrder: IOrder = {
      _id: new Types.ObjectId() as any,
      buyer_id: new Types.ObjectId(),
      seller_id: new Types.ObjectId(),
      payment_id: new Types.ObjectId(),
      total_amount: Types.Decimal128.fromString("100.00"),
      status: OrderStatusType.Pending,
      is_paid: true,
      is_fulfilled: false,
      fulfillment_type: FulfillmentType.CollectionByBuyer,
      seller_fulfillment_description: "Test seller description",
      buyer_fulfillment_description: "Test buyer description",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as IOrder;

    const mockPayment_buyerCheckout = {
      ...mockPayment,
      payment_type: PaymentType.BuyerCheckout
    } as unknown as IPayment;

    it('should complete BuyerCheckout payment and update paid order', async () => {
      initializePayments(mockPayment_buyerCheckout, mockPaymentDTO);

      (completePayment as jest.Mock).mockResolvedValue({
        ...mockPayment_buyerCheckout,
        paid: true
      });

      (updatePaidOrder as jest.Mock).mockResolvedValue(mockOrder);

      (platformAPIClient.post as jest.Mock).mockResolvedValue({ status: 200 });

      const result = await paymentModule.processIncompletePayment(mockPaymentInfo);

      expect(result).toEqual({
        success: true,
        message: `Payment completed from incomplete payment with id ${ mockPaymentInfo.identifier }`
      });
      expect(getPayment).toHaveBeenCalledWith(mockPaymentInfo.identifier);
      expect(axios.create).toHaveBeenCalled();
      expect(platformAPIClient.get).toHaveBeenCalledWith(`/v2/payments/${ mockPaymentInfo.identifier }`);
      expect(completePayment).toHaveBeenCalledWith(mockPaymentInfo.identifier, mockPaymentInfo.transaction?.txid);
      expect(updatePaidOrder).toHaveBeenCalledWith(mockPayment_buyerCheckout._id);
      expect(platformAPIClient.post).toHaveBeenCalledWith(
        `/v2/payments/${ mockPaymentInfo.identifier }/complete`,
        { txid: 'txid_TEST' }
      );
    });

    it('should throw an error if Pi payment fails to successfully complete', async () => {
      const mockError = new Error('Failed to mark U2A payment completed on Pi blockchain');
      
      initializePayments(mockPayment_buyerCheckout, mockPaymentDTO);

      (completePayment as jest.Mock).mockResolvedValue({
        ...mockPayment_buyerCheckout,
        paid: true
      });

      (updatePaidOrder as jest.Mock).mockResolvedValue(mockOrder);

      (platformAPIClient.post as jest.Mock).mockResolvedValue({ status: 500 });

      await expect(paymentModule.processIncompletePayment(mockPaymentInfo)).rejects.toThrow(mockError);

      expect(getPayment).toHaveBeenCalledWith(mockPaymentInfo.identifier);
      expect(axios.create).toHaveBeenCalled();
      expect(platformAPIClient.get).toHaveBeenCalledWith(`/v2/payments/${ mockPaymentInfo.identifier }`);
      expect(completePayment).toHaveBeenCalledWith(mockPaymentInfo.identifier, mockPaymentInfo.transaction?.txid);
      expect(updatePaidOrder).toHaveBeenCalledWith(mockPayment_buyerCheckout._id);
      expect(platformAPIClient.post).toHaveBeenCalledWith(
        `/v2/payments/${ mockPaymentInfo.identifier }/complete`,
        { txid: 'txid_TEST' }
      );
    });
  });

  describe('Membership payments', () => {
    const u2aMetadata: U2AMetadata = {
      payment_type: PaymentType.Membership,
      MembershipPayment: {
        membership_class: MembershipClassType.GOLD
      },
    } as U2AMetadata;

    const mockPayment_membership = {
      ...mockPayment,
      payment_type: PaymentType.Membership
    } as unknown as IPayment;

    it('should complete Membership payment and update or renew membership', async () => {
      initializePayments(mockPayment_membership, mockPaymentDTO, u2aMetadata);

      (completePayment as jest.Mock).mockResolvedValue({
        ...mockPayment_membership,
        paid: true
      });

      (applyMembershipChange as jest.Mock).mockResolvedValue({});

      (platformAPIClient.post as jest.Mock).mockResolvedValue({ status: 200 });

      const result = await paymentModule.processIncompletePayment(mockPaymentInfo);

      expect(result).toEqual({
        success: true,
        message: `Payment completed from incomplete payment with id ${ mockPaymentInfo.identifier }`
      });
      expect(getPayment).toHaveBeenCalledWith(mockPaymentInfo.identifier);
      expect(axios.create).toHaveBeenCalled();
      expect(platformAPIClient.get).toHaveBeenCalledWith(`/v2/payments/${ mockPaymentInfo.identifier }`);
      expect(completePayment).toHaveBeenCalledWith(mockPaymentInfo.identifier, mockPaymentInfo.transaction?.txid);
      expect(applyMembershipChange).toHaveBeenCalledWith(
        mockPaymentDTO.user_uid, 
        u2aMetadata.MembershipPayment?.membership_class
      );
      expect(platformAPIClient.post).toHaveBeenCalledWith(
        `/v2/payments/${ mockPaymentInfo.identifier }/complete`,
        { txid: 'txid_TEST' }
      );
    });

    it('should throw an error if Pi payment fails to successfully complete', async () => {
      const mockError = new Error('Failed to mark U2A payment completed on Pi blockchain');
      
      initializePayments(mockPayment_membership, mockPaymentDTO, u2aMetadata);

      (completePayment as jest.Mock).mockResolvedValue({
        ...mockPayment_membership,
        paid: true
      });

      (applyMembershipChange as jest.Mock).mockResolvedValue({});

      (platformAPIClient.post as jest.Mock).mockResolvedValue({ status: 500 });

      await expect(paymentModule.processIncompletePayment(mockPaymentInfo)).rejects.toThrow(mockError);

      expect(getPayment).toHaveBeenCalledWith(mockPaymentInfo.identifier);
      expect(axios.create).toHaveBeenCalled();
      expect(platformAPIClient.get).toHaveBeenCalledWith(`/v2/payments/${ mockPaymentInfo.identifier }`);
      expect(completePayment).toHaveBeenCalledWith(mockPaymentInfo.identifier, mockPaymentInfo.transaction?.txid);
      expect(applyMembershipChange).toHaveBeenCalledWith(
        mockPaymentDTO.user_uid, 
        u2aMetadata.MembershipPayment?.membership_class
      );
      expect(platformAPIClient.post).toHaveBeenCalledWith(
        `/v2/payments/${ mockPaymentInfo.identifier }/complete`,
        { txid: 'txid_TEST' }
      );
    });
  });
});

describe('processPaymentApproval function', () => {
  const mockOrder: IOrder = {
    _id: new Types.ObjectId() as any,
    buyer_id: new Types.ObjectId(),
    seller_id: new Types.ObjectId(),
    payment_id: new Types.ObjectId(),
    total_amount: Types.Decimal128.fromString("100.00"),
    status: OrderStatusType.Pending,
    is_paid: true,
    is_fulfilled: false,
    fulfillment_type: FulfillmentType.CollectionByBuyer,
    seller_fulfillment_description: "Test seller description",
    buyer_fulfillment_description: "Test buyer description",
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as IOrder;
  
  const mockPayment: IPayment = {
    user_id: new Types.ObjectId() as any,
    pi_payment_id: 'paymentInfo_TEST',
    amount: Types.Decimal128.fromString("100.00"),
    paid: false,
    memo: "paymentInfo_TEST",
    txid: "txid_TEST",
    cancelled: false,
    createdAt: new Date()
  } as unknown as IPayment;

  const mockPaymentDTO: PaymentDTO = {
    amount: 100,
    user_uid: "userUid_TEST",
    created_at: new Date().toISOString(),
    identifier: 'paymentInfo_TEST',
    memo: "paymentInfo_TEST",
    status: {
      developer_approved: true,
      transaction_verified: true,
      developer_completed: false,
      cancelled: false,
      user_cancelled: false,
    },
    to_address: "Test Pi Address",
    transaction: {
      txid: "txid_TEST",
      verified: true,
      _link: "https://example.com",
    },
  } as unknown as PaymentDTO;

  const u2aMetadata: U2AMetadata = {
    OrderPayment: {
      seller: 'sellerid_TEST',
      buyer: 'buyerid_TEST',
      fulfillment_method: FulfillmentType.CollectionByBuyer,
      seller_fulfillment_description: 'Pickup from store',
      buyer_fulfillment_description: 'Will pickup tomorrow',
      items: [{ itemId: 'mockItemId1_TEST', quantity: 2 }],
    },
  } as U2AMetadata;

  it('should process and approve a new BuyerCheckout payment successfully', async () => {    
    const u2aMetadata_buyerCheckout: U2AMetadata = {
      ...u2aMetadata,
      payment_type: PaymentType.BuyerCheckout,
    } as U2AMetadata;

    const mockNewPayment: NewPayment = {
      piPaymentId: mockPaymentDTO.identifier,
      buyerPiUid: mockPaymentDTO.user_uid,
      memo: mockPaymentDTO.memo,
      amount: mockPaymentDTO.amount,
      paymentType: u2aMetadata_buyerCheckout.payment_type
    };
    
    (platformAPIClient.get as jest.Mock).mockResolvedValue({ 
      data: { 
        ...mockPaymentDTO, 
        metadata: u2aMetadata_buyerCheckout 
      } 
    });
    
    (getPayment as jest.Mock).mockResolvedValue(null);
    (createPayment as jest.Mock).mockResolvedValue(mockNewPayment);
    // Mock functions in checkoutProcess
    (createOrder as jest.Mock).mockResolvedValue(mockOrder);
    (platformAPIClient.post as jest.Mock).mockResolvedValue({});
    
    const result = await paymentModule.processPaymentApproval(mockPayment.pi_payment_id);
    
    expect(result).toEqual({
      success: true,
      message: `Payment approved with id ${ mockPayment.pi_payment_id }`,
    });
    expect(platformAPIClient.get).toHaveBeenCalledWith(`/v2/payments/${ mockPayment.pi_payment_id }`);
    expect(getPayment).toHaveBeenCalledWith(mockPayment.pi_payment_id);
    expect(createPayment).toHaveBeenCalledWith(mockNewPayment);
    expect(createOrder).toHaveBeenCalledWith({
      buyerPiUid: u2aMetadata_buyerCheckout.OrderPayment?.buyer,
      sellerPiUid: u2aMetadata_buyerCheckout.OrderPayment?.seller,
      paymentId: mockPayment._id,
      totalAmount: mockPaymentDTO.amount.toString(),
      orderItems: u2aMetadata_buyerCheckout.OrderPayment?.items,
      status: OrderStatusType.Initialized,
      fulfillmentMethod: u2aMetadata_buyerCheckout.OrderPayment?.fulfillment_method,
      sellerFulfillmentDescription: u2aMetadata_buyerCheckout.OrderPayment?.seller_fulfillment_description,
      buyerFulfillmentDescription: u2aMetadata_buyerCheckout.OrderPayment?.buyer_fulfillment_description,
    });
    expect(platformAPIClient.post).toHaveBeenCalledWith(`/v2/payments/${ mockPayment.pi_payment_id }/approve`);
  });

  it('should return an unsuccessful message if payment already exists', async () => {
    const u2aMetadata_buyerCheckout: U2AMetadata = {
      ...u2aMetadata,
      payment_type: PaymentType.BuyerCheckout,
    } as U2AMetadata;
    
    (platformAPIClient.get as jest.Mock).mockResolvedValue({ 
      data: { 
        ...mockPaymentDTO, 
        metadata: u2aMetadata_buyerCheckout 
      } 
    });
    
    (getPayment as jest.Mock).mockResolvedValue(mockPayment);

    // Spy on processPaymentError (mock implementation so we don't hit internals)
    const processPaymentErrorSpy = jest
      .spyOn(paymentModule, 'processPaymentError')
      .mockResolvedValue({
        success: true,
        message: `Payment Error with ID ${ mockPaymentDTO.identifier } handled and completed successfully`
    });

    const result = await paymentModule.processPaymentApproval(mockPayment.pi_payment_id);

    expect(result).toEqual({
      success: false,
      message: `Payment already exists with ID ${ mockPayment.pi_payment_id }`,
    });
    expect(platformAPIClient.get).toHaveBeenCalledWith(`/v2/payments/${ mockPayment.pi_payment_id }`);
    expect(getPayment).toHaveBeenCalledWith(mockPayment.pi_payment_id);
    expect(processPaymentErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: mockPaymentDTO.identifier,
        transaction: mockPaymentDTO.transaction
      })
    );
  });

  it('should process and approve a new Membership payment successfully', async () => {
    const u2aMetadata_membership: U2AMetadata = {
      ...u2aMetadata,
      payment_type: PaymentType.Membership,
    } as U2AMetadata;

    const mockNewPayment: NewPayment = {
      piPaymentId: mockPaymentDTO.identifier,
      buyerPiUid: mockPaymentDTO.user_uid,
      memo: mockPaymentDTO.memo,
      amount: mockPaymentDTO.amount,
      paymentType: u2aMetadata_membership.payment_type
    };
    
    (platformAPIClient.get as jest.Mock).mockResolvedValue({ 
      data: { 
        ...mockPaymentDTO, 
        metadata: u2aMetadata_membership 
      } 
    });
    
    (getPayment as jest.Mock).mockResolvedValue(null);
    (createPayment as jest.Mock).mockResolvedValue(mockNewPayment);

    (platformAPIClient.post as jest.Mock).mockResolvedValue({});

    const result = await paymentModule.processPaymentApproval(mockPayment.pi_payment_id);
    
    expect(result).toEqual({
      success: true,
      message: `Payment approved with id ${ mockPayment.pi_payment_id }`,
    });
    expect(platformAPIClient.get).toHaveBeenCalledWith(`/v2/payments/${ mockPayment.pi_payment_id }`);
    expect(getPayment).toHaveBeenCalledWith(mockPayment.pi_payment_id);
    expect(createPayment).toHaveBeenCalledWith(mockNewPayment);
    expect(platformAPIClient.post).toHaveBeenCalledWith(`/v2/payments/${ mockPayment.pi_payment_id }/approve`);
  });

  it('should throw error if processing payment approval fails', async () => {
    const mockError = new Error('Pi Platform API timeout');
    (platformAPIClient.get as jest.Mock).mockRejectedValue(mockError);

    await expect(paymentModule.processPaymentApproval(mockPayment.pi_payment_id)).rejects.toThrow('Pi Platform API timeout');
  });
});

describe('processPaymentCompletion function', () => {
  const mockPaymentId = "paymentInfo_TEST";
  const mockTxid = "txid_TEST";

  const mockPayment: IPayment = {
    user_id: new Types.ObjectId() as any,
    pi_payment_id: 'paymentInfo_TEST',
    amount: Types.Decimal128.fromString("100.00"),
    paid: false,
    memo: "paymentInfo_TEST",
    txid: "txid_TEST",
    cancelled: false,
    createdAt: new Date()
  } as unknown as IPayment;

  const mockPaymentDTO: PaymentDTO = {
    amount: 100,
    user_uid: "userUid_TEST",
    created_at: new Date().toISOString(),
    identifier: 'paymentInfo_TEST',
    memo: "paymentInfo_TEST",
    status: {
      developer_approved: true,
      transaction_verified: true,
      developer_completed: false,
      cancelled: false,
      user_cancelled: false,
    },
    to_address: "Test Pi Address",
    transaction: {
      txid: "txid_TEST",
      verified: true,
      _link: "https://example.com",
    },
  } as unknown as PaymentDTO;

  const u2aMetadata: U2AMetadata = {
    OrderPayment: {
      seller: 'sellerid_TEST',
      buyer: 'buyerid_TEST',
      fulfillment_method: FulfillmentType.CollectionByBuyer,
      seller_fulfillment_description: 'Pickup from store',
      buyer_fulfillment_description: 'Will pickup tomorrow',
      items: [{ itemId: 'mockItemId1_TEST', quantity: 2 }],
    },
  } as U2AMetadata;

  const mockOrder: IOrder = {
    _id: new Types.ObjectId() as any,
    buyer_id: new Types.ObjectId(),
    seller_id: new Types.ObjectId(),
    payment_id: new Types.ObjectId(),
    total_amount: Types.Decimal128.fromString("100.00"),
    status: OrderStatusType.Pending,
    is_paid: true,
    is_fulfilled: false,
    fulfillment_type: FulfillmentType.CollectionByBuyer,
    seller_fulfillment_description: "Test seller description",
    buyer_fulfillment_description: "Test buyer description",
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as IOrder;

  it('should complete BuyerCheckout payment accordingly', async () => {
    const mockPayment_buyerCheckout = {
      ...mockPayment,
      payment_type: PaymentType.BuyerCheckout
    } as unknown as IPayment;

    (platformAPIClient.get as jest.Mock).mockResolvedValue({ 
      data: { 
        ...mockPaymentDTO,  
      } 
    });

    (completePayment as jest.Mock).mockResolvedValue({
      ...mockPayment_buyerCheckout,
      paid: true
    });
    (updatePaidOrder as jest.Mock).mockResolvedValue(mockOrder);

    (platformAPIClient.post as jest.Mock).mockResolvedValue({ status: 200 });

    const result = await paymentModule.processPaymentCompletion(mockPaymentId, mockTxid);

    expect(result).toEqual({
      success: true,
      message: `U2A Payment completed with id ${ mockPaymentId }`
    });
    expect(platformAPIClient.get).toHaveBeenCalledWith(`/v2/payments/${ mockPaymentId }`);
    expect(completePayment).toHaveBeenCalledWith(mockPaymentId, mockTxid);
    expect(updatePaidOrder).toHaveBeenCalledWith(mockPayment_buyerCheckout._id);
    expect(platformAPIClient.post).toHaveBeenCalledWith(
      `/v2/payments/${ mockPaymentId }/complete`,
      { txid: 'txid_TEST' }
    );
  });

  it('should complete Membership payment accordingly', async () => {
    const mockPayment_membership = {
      ...mockPayment,
      payment_type: PaymentType.Membership
    } as unknown as IPayment;

    (platformAPIClient.get as jest.Mock).mockResolvedValue({ 
      data: { 
        ...mockPaymentDTO,  
        metadata: u2aMetadata
      } 
    });

    (completePayment as jest.Mock).mockResolvedValue({
      ...mockPayment_membership,
      paid: true
    });

    (applyMembershipChange as jest.Mock).mockResolvedValue({});

    (platformAPIClient.post as jest.Mock).mockResolvedValue({ status: 200 });

    const result = await paymentModule.processPaymentCompletion(mockPaymentId, mockTxid);

    expect(result).toEqual({
      success: true,
      message: `U2A Payment completed with id ${ mockPaymentId }`
    });
    expect(platformAPIClient.get).toHaveBeenCalledWith(`/v2/payments/${ mockPaymentId }`);
    expect(completePayment).toHaveBeenCalledWith(mockPaymentId, mockTxid);
    expect(applyMembershipChange).toHaveBeenCalledWith(
      mockPaymentDTO.user_uid, 
      u2aMetadata.MembershipPayment?.membership_class
    );
    expect(platformAPIClient.post).toHaveBeenCalledWith(
      `/v2/payments/${ mockPaymentId }/complete`,
      { txid: 'txid_TEST' }
    );
  });

  it('should rethrow if completePiPayment throws a platform API error', async () => {
    const mockError = {
      response: {
        status: 500,
        data: { error: "Server Error" },
      },
      config: { url: "/v2/payments", method: "post" },
    };

    (platformAPIClient.get as jest.Mock).mockRejectedValue(mockError);

    await expect(
      paymentModule.processPaymentCompletion(mockPaymentId, mockTxid)
    ).rejects.toEqual(mockError);
  });

  it('should rethrow if completePiPayment throws an unhandled error', async () => {
    const mockError = new Error('Unexpected error');

    (platformAPIClient.get as jest.Mock).mockRejectedValue(mockError);

    await expect(
      paymentModule.processPaymentCompletion(mockPaymentId, mockTxid)
    ).rejects.toThrow(mockError.message);
  });
});

describe('processPaymentCancellation function', () => {
  const mockPaymentId = "paymentInfo_TEST";

  const mockPayment: IPayment = {
    user_id: new Types.ObjectId() as any,
    pi_payment_id: 'paymentInfo_TEST',
    amount: Types.Decimal128.fromString("100.00"),
    paid: false,
    memo: "paymentInfo_TEST",
    txid: "txid_TEST",
    cancelled: true,
    createdAt: new Date()
  } as unknown as IPayment;

  const mockOrder: IOrder = {
    _id: new Types.ObjectId() as any,
    buyer_id: new Types.ObjectId(),
    seller_id: new Types.ObjectId(),
    payment_id: new Types.ObjectId(),
    total_amount: Types.Decimal128.fromString("100.00"),
    status: OrderStatusType.Cancelled,
    is_paid: false,
    is_fulfilled: false,
    fulfillment_type: FulfillmentType.CollectionByBuyer,
    seller_fulfillment_description: "Test seller description",
    buyer_fulfillment_description: "Test buyer description",
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as IOrder;


  it('should cancel BuyerCheckout payment accordingly', async () => {
    const mockPayment_buyerCheckout = {
      ...mockPayment,
      payment_type: PaymentType.BuyerCheckout
    } as unknown as IPayment;

    (cancelPayment as jest.Mock).mockResolvedValue(mockPayment_buyerCheckout);
    (cancelOrder as jest.Mock).mockResolvedValue(mockOrder);
    (platformAPIClient.post as jest.Mock).mockResolvedValue({ status: 200 });

    const result = await paymentModule.processPaymentCancellation(mockPaymentId);

    expect(result).toEqual({
      success: true,
      message: `Payment cancelled with id ${ mockPaymentId }`,
    });
    expect(cancelPayment).toHaveBeenCalledWith(mockPaymentId);
    expect(cancelOrder).toHaveBeenCalledWith(mockPayment._id);
    expect(platformAPIClient.post).toHaveBeenCalledWith(`/v2/payments/${mockPaymentId}/cancel`);
  });

  it('should cancel Membership payment accordingly', async () => {
    const mockPayment_membership = {
      ...mockPayment,
      payment_type: PaymentType.Membership
    } as unknown as IPayment;

    (cancelPayment as jest.Mock).mockResolvedValue(mockPayment_membership);
    (platformAPIClient.post as jest.Mock).mockResolvedValue({ status: 200 });

    const result = await paymentModule.processPaymentCancellation(mockPaymentId);

    expect(result).toEqual({
      success: true,
      message: `Payment cancelled with id ${ mockPaymentId }`,
    });
    expect(cancelPayment).toHaveBeenCalledWith(mockPaymentId);
    expect(cancelOrder).not.toHaveBeenCalled();
    expect(platformAPIClient.post).toHaveBeenCalledWith(`/v2/payments/${mockPaymentId}/cancel`);
  });

  it('should throw error if no cancelled payment found', async () => {
    (cancelPayment as jest.Mock).mockResolvedValue(null);

    await expect(
      paymentModule.processPaymentCancellation(mockPaymentId)
    ).rejects.toThrow(`No payment found with id ${ mockPaymentId }`);

    expect(cancelOrder).not.toHaveBeenCalled();
    expect(platformAPIClient.post).not.toHaveBeenCalled();
  });

  it('should throw a platform API error', async () => {
    const mockError = {
      response: {
        status: 500,
        data: { error: "Server Error" },
      },
      config: { url: "/v2/payments", method: "post" },
    };

    const mockPayment_membership = {
      ...mockPayment,
      payment_type: PaymentType.Membership
    } as unknown as IPayment;

    (cancelPayment as jest.Mock).mockResolvedValue(mockPayment_membership);
    (platformAPIClient.post as jest.Mock).mockRejectedValue(mockError);

    await expect(
      paymentModule.processPaymentCancellation(mockPaymentId)
    ).rejects.toEqual(mockError);
  });

  it('should throw an unhandled error', async () => {
    const mockError = new Error('Unexpected error');

    (cancelPayment as jest.Mock).mockRejectedValue(mockError);

    await expect(
      paymentModule.processPaymentCancellation(mockPaymentId)
    ).rejects.toThrow(mockError.message);
  });
});

describe('processPaymentError function', () => {
  const mockPaymentId = "paymentInfo_TEST";

  const mockPaymentDTO: PaymentDTO = {
    amount: 100,
    user_uid: "userUid_TEST",
    created_at: new Date().toISOString(),
    identifier: 'paymentInfo_TEST',
    memo: "paymentInfo_TEST",
    status: {
      developer_approved: true,
      transaction_verified: true,
      developer_completed: false,
      cancelled: false,
      user_cancelled: false,
    },
    to_address: "Test Pi Address"
  } as unknown as PaymentDTO;

  let processIncompletePaymentSpy: jest.SpyInstance;
  let processPaymentCancellationSpy: jest.SpyInstance;

  beforeEach(() => {
    processIncompletePaymentSpy = jest
      .spyOn(paymentModule, "processIncompletePayment")
      .mockResolvedValue({ 
        success: true,
        message: `Payment completed from incomplete payment with id ${ mockPaymentId }` 
      });

    processPaymentCancellationSpy = jest
      .spyOn(paymentModule, "processPaymentCancellation")
      .mockResolvedValue({ 
        success: true,
        message: `Payment cancelled with id ${ mockPaymentId }`
      });
  });

  it('should call processIncompletePayment when the payment transaction exists', async () => {
    const mockPaymentDTO_withTxn = {
      ...mockPaymentDTO,
      transaction: {
        txid: "txid_TEST",
        _link: "https://example.com"
      }
    } as unknown as PaymentDTO;

    const result = await paymentModule.processPaymentError(mockPaymentDTO_withTxn);

    expect(result).toEqual({
      success: true,
      message: `Payment Error with ID ${mockPaymentDTO_withTxn.identifier} handled and completed successfully`,
    });
    expect(processIncompletePaymentSpy).toHaveBeenCalledWith({
      identifier: mockPaymentDTO_withTxn.identifier,
      transaction: mockPaymentDTO_withTxn.transaction
    });
    expect(processPaymentCancellationSpy).not.toHaveBeenCalled();
  });

  it('should call processPaymentCancellation when no payment transaction exists', async () => {
    const mockPaymentDTO_withoutTxn = {
      ...mockPaymentDTO,
      transaction: undefined
    } as unknown as PaymentDTO;

    const result = await paymentModule.processPaymentError(mockPaymentDTO_withoutTxn);

    expect(result).toEqual({
      success: true,
      message: `Payment Error with ID ${mockPaymentDTO_withoutTxn.identifier} cancelled successfully`,
    });
    expect(processPaymentCancellationSpy).toHaveBeenCalledWith(mockPaymentDTO_withoutTxn.identifier);
    expect(processIncompletePaymentSpy).not.toHaveBeenCalled();
  });

  it('should rethrow if processIncompletePayment throws an error', async () => {
    const mockPaymentDTO_withTxn = {
      ...mockPaymentDTO,
      transaction: {
        txid: "txid_TEST",
        verified: true,
        _link: "https://example.com"
      }
    } as unknown as PaymentDTO;

    const mockError = new Error("Incomplete payment failed");

    processIncompletePaymentSpy.mockRejectedValueOnce(mockError);

    await expect(
      paymentModule.processPaymentError(mockPaymentDTO_withTxn)
    ).rejects.toThrow("Incomplete payment failed");
  });

  it('should rethrow if processPaymentCancellation throws an error', async () => {
    const mockPaymentDTO_withoutTxn = {
      ...mockPaymentDTO,
      transaction: undefined
    } as unknown as PaymentDTO;

    const mockError = new Error("Payment cancellation failed");

    processPaymentCancellationSpy.mockRejectedValueOnce(mockError);

    await expect(
      paymentModule.processPaymentError(mockPaymentDTO_withoutTxn)
    ).rejects.toThrow("Payment cancellation failed");
  });
});