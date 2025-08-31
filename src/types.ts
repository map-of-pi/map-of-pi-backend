import {Document, Types} from "mongoose";
import {DeviceLocationType} from "./models/enums/deviceLocationType";
import {MembershipClassType, MappiCreditType} from "./models/enums/membershipClassType";
import {RatingScale} from "./models/enums/ratingScale";
import {SellerType} from "./models/enums/sellerType";
import {FulfillmentType} from "./models/enums/fulfillmentType";
import {StockLevelType} from "./models/enums/stockLevelType";
import {TrustMeterScale} from "./models/enums/trustMeterScale";
import {OrderStatusType} from "./models/enums/orderStatusType";
import {OrderItemStatusType} from "./models/enums/orderItemStatusType";
import {PaymentType} from "./models/enums/paymentType";
import {U2UPaymentStatus} from "./models/enums/u2uPaymentStatus";

// ========================
// USER MODELS
// ========================
export interface IUser extends Document {
  pi_uid: string;
  pi_username: string;
  user_name: string;
};

export interface IUserSettings extends Document {
  user_settings_id: string;
  user_name: string;
  email?: string | null;
  phone_number?: string | null;
  image?: string;
  findme: DeviceLocationType;
  trust_meter_rating: TrustMeterScale;
  search_map_center?: {
    type: 'Point';
    coordinates: [number, number];
  };
  search_filters?: {
    include_active_sellers: Boolean;
    include_inactive_sellers: Boolean;
    include_test_sellers: Boolean;
    include_trust_level_100: Boolean;
    include_trust_level_80: Boolean;
    include_trust_level_50: Boolean;
    include_trust_level_0: Boolean;
  };
};

// Select specific fields from IUserSettings
export type PartialUserSettings = Pick<IUserSettings, 'user_name' | 'email' | 'phone_number' | 'findme' | 'trust_meter_rating'>;

// ========================
// MEMBERSHIP MODELS
// ========================
export interface IMembership extends Document {
  user_id: Types.ObjectId;
  pi_uid: string;
  membership_class: MembershipClassType;
  mappi_balance: number;
  membership_expiry_date: Date | null;
  mappi_used_to_date: number;
};

export interface MembershipOption {
  value: MembershipClassType;
  cost: number;
  duration: number | null; // in weeks
  mappi_allowance: number;
}

// ========================
// MAP / GEOLOCATION TYPES
// ========================
export interface IMapCenter {
  type: 'Point';
  coordinates: [number, number];
};

// ========================
// SELLER MODELS
// ========================
export interface ISeller extends Document {
  seller_id: string;
  name: string;
  seller_type: SellerType;
  description: string;
  image?: string;
  address?: string;
  average_rating: Types.Decimal128;
  sell_map_center: {
    type: 'Point';
    coordinates: [number, number];
  };
  order_online_enabled_pref: boolean;
  fulfillment_method: FulfillmentType;
  fulfillment_description?: string;
  isRestricted: boolean;
  lastSanctionUpdateAt: Date;
};

// Combined interface representing a seller with selected user settings
export interface ISellerWithSettings extends ISeller, PartialUserSettings {
};

export interface ISellerItem extends Document {
  _id: string;
  seller_id: string;
  name: string;
  description: string;
  price: Types.Decimal128;
  stock_level: StockLevelType;
  image?: string;
  duration: number;
  expired_by: Date;
  createdAt: Date;
  updatedAt: Date;
};

// ========================
// REVIEW / FEEDBACK MODELS
// ========================
export interface IReviewFeedback extends Document {
  _id: string;
  review_receiver_id: string;
  review_giver_id: string;
  reply_to_review_id: string | null;
  rating: RatingScale;
  comment?: string;
  image?: string;
  review_date: Date;
};

export interface CompleteFeedback {
  givenReviews: IReviewFeedbackOutput[];
  receivedReviews: IReviewFeedbackOutput[];
};

export type PartialReview = {
  giver: string;
  receiver: string;
};

export interface IReviewFeedbackOutput extends IReviewFeedback, PartialReview {};

// ========================
// ORDER MODELS
// ========================
export interface IOrder extends Document {
  buyer_id: Types.ObjectId; // ref user model
  seller_id: Types.ObjectId; // ref seller model
  payment_id: Types.ObjectId; // ref payment model
  total_amount: Types.Decimal128;
  status: OrderStatusType;
  is_paid: boolean;
  is_fulfilled: boolean;
  fulfillment_type: FulfillmentType;
  seller_fulfillment_description: string;
  buyer_fulfillment_description: string;
  createdAt: Date;
  updatedAt: Date;
};

export interface IOrderItem extends Document {
  order_id: Types.ObjectId;
  seller_item_id: Types.ObjectId;
  quantity: number;
  subtotal: Types.Decimal128;
  status: OrderItemStatusType;
  createdAt: Date;
  updatedAt: Date;
};

export interface PickedItems {
  itemId: string;
  quantity: number;
};

export interface NewOrder {
  buyerPiUid: string;
  sellerPiUid: string;
  paymentId: string | null; // objectId of the Payment schema
  totalAmount: string;
  status: OrderStatusType;
  orderItems: PickedItems[];
  fulfillmentMethod: FulfillmentType;
  sellerFulfillmentDescription: string;
  buyerFulfillmentDescription: string;
};

export type OrderPaymentMetadataType = {
  buyer: string;
  seller: string;
  items: PickedItems[];
  fulfillment_method: FulfillmentType | undefined;
  seller_fulfillment_description: string | undefined;
  buyer_fulfillment_description: string;
};

// ========================
// PAYMENT MODELS
// ========================
export interface IPayment extends Document {
  user_id: Types.ObjectId;
  pi_payment_id: string;
  amount: Types.Decimal128;
  paid: boolean;
  memo: string;
  txid?: string;
  payment_type: PaymentType;
  cancelled: boolean;
  createdAt: Date;
};

export interface U2AMetadata {
  payment_type: PaymentType;
  OrderPayment?: OrderPaymentMetadataType;
  MembershipPayment?: MembershipPaymentMetadataType;
}

export interface A2UMetadata { 
  orderId: string; 
  sellerId: string; 
  buyerId: string 
};

export interface PaymentInfo {
  identifier: string;
  transaction?: {
    txid: string;
    _link: string;
  };
};

export interface PaymentDTO {
  amount: number;
  user_uid: string;
  created_at: string;
  identifier: string;
  memo: string;
  metadata: U2AMetadata | A2UMetadata;
  status: {
    developer_approved: boolean;
    transaction_verified: boolean;
    developer_completed: boolean;
    cancelled: boolean;
    user_cancelled: boolean;
  },
  to_address: string;
  transaction: null | {
    txid: string;
    verified: boolean;
    _link: string;
  },
};

export interface NewPayment {
  piPaymentId: string;
  buyerPiUid: string;
  memo: string;
  amount: number;
  paymentType: PaymentType;
};

export interface U2URefDataType {
  orderId: string;
  u2aPaymentId?: string;
  u2uStatus: U2UPaymentStatus;
  a2uPaymentId: string | null;
};

export type PaymentMetadataType = {
  OrderPayment: OrderPaymentMetadataType;
  MembershipPayment: MembershipPaymentMetadataType;
};

type MembershipPaymentMetadataType = {
  membership_class: MembershipClassType | MappiCreditType;
};

export interface IPaymentCrossReference {
  _id: Types.ObjectId;
  order_id: Types.ObjectId;
  u2a_payment_id: Types.ObjectId | null;
  a2u_payment_id: Types.ObjectId | null;
  u2u_status: U2UPaymentStatus;
  error_message: string;
  u2a_completed_at: Date;
  a2u_completed_at: Date;
  createdAt: Date;
  updatedAt: Date;
};

// ========================
// NOTIFICATION
// ========================
export interface INotification extends Document {
  _id: string;
  pi_uid: string;
  is_cleared: boolean;
  reason: string;
  createdAt: Date;
  updatedAt: Date;
};

// ========================
// SANCTIONS / GEO-RESTRICTIONS
// ========================
export interface ISanctionedGeoBoundary extends Document {
  type: "Feature";
  geometry: {
    type: "Polygon";
    coordinates: [[[number, number]]];
  };
  properties: {
    shapeName: string;
    shapeISO: string;
    shapeID: string;
    shapeGroup: string;
    shapeType: string;
  };
};

export type SanctionedUpdateResult = {
  seller_id: string;
  isChanged: boolean;
  isRestricted: boolean;
  isUpdateSuccess: boolean;
  isNotificationSuccess: boolean;
};

// ========================
// TOGGLES
// ========================
export interface IToggle extends Document {
  name: string;
  enabled: boolean;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
};