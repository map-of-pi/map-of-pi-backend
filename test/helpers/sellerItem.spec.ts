import { 
  computeNewExpiryDate,
  getChangeInWeeks,
  getRemainingWeeks, 
  isExpiredItem 
} from "../../src/helpers/sellerItem";
import { ISellerItem } from "../../src/types";

describe('isExpiredItem function', () => {
  it('should return true if item is null or undefined', () => {
    expect(isExpiredItem(null as unknown as ISellerItem)).toBe(true);
    expect(isExpiredItem(undefined as unknown as ISellerItem)).toBe(true);
  });

  it('should return true if item has no expired_by', () => {
    const item = { duration: 5 } as ISellerItem;
    expect(isExpiredItem(item)).toBe(true);
  });

  it('should return true if expired_by date is in the past', () => {
    const pastDate = new Date(Date.now() - 1000 * 60 * 60 * 24); // 1 day ago
    const item = { expired_by: pastDate.toISOString(), duration: 5 } as unknown as ISellerItem;
    expect(isExpiredItem(item)).toBe(true);
  });

  it('should return false if expired_by date is in the future', () => {
    const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24); // 1 day ahead
    const item = { expired_by: futureDate.toISOString(), duration: 5 } as unknown as ISellerItem;
    expect(isExpiredItem(item)).toBe(false);
  });

  it('should return false if expired_by date is exactly now', () => {
    const now = new Date();
    const item = { expired_by: now.toISOString(), duration: 5 } as unknown as ISellerItem;
    // new Date() > new Date(expired_by) → should be false if equal
    expect(isExpiredItem(item)).toBe(false);
  });
});

describe('getRemainingWeeks function', () => {
  it('should return 0 if item is null or missing fields', () => {
    expect(getRemainingWeeks(null as unknown as ISellerItem)).toBe(0);
    expect(getRemainingWeeks({} as ISellerItem)).toBe(0);
    expect(getRemainingWeeks({ expired_by: new Date().toISOString() } as unknown as ISellerItem)).toBe(0);
    expect(getRemainingWeeks({ duration: 5 } as ISellerItem)).toBe(0);
  });

  it('should return 0 if item already expired', () => {
    const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 1 week ago
    const item = { expired_by: pastDate.toISOString(), duration: 5 } as unknown as ISellerItem;
    expect(getRemainingWeeks(item)).toBe(0);
  });

  it('should return remaining weeks less current week', () => {
    const futureDate = new Date(Date.now() + 3 * 7 * 24 * 60 * 60 * 1000); // 3 weeks ahead
    const item = { expired_by: futureDate.toISOString(), duration: 5 } as unknown as ISellerItem;
    // 3 weeks left, but exclude current week → 2
    expect(getRemainingWeeks(item)).toBe(2);
  });

  it('should not exceed total duration', () => {
    const futureDate = new Date(Date.now() + 10 * 7 * 24 * 60 * 60 * 1000); // 10 weeks ahead
    const item = { expired_by: futureDate.toISOString(), duration: 5 } as unknown as ISellerItem;
    // 10 weeks left minus current week = 9, but capped at duration = 5
    expect(getRemainingWeeks(item)).toBe(5);
  });

  it('should return 0 if expiry is less than 1 week from now', () => {
    const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days ahead
    const item = { expired_by: futureDate.toISOString(), duration: 5 } as unknown as ISellerItem;
    // Less than a week left → floor → 0
    expect(getRemainingWeeks(item)).toBe(0);
  });
});

describe('getChangeInWeeks function', () => {
  it('should return positive change when duration is increased', () => {
    const existingItem = { duration: 2 } as ISellerItem;
    const itemData = { duration: 5 } as ISellerItem;
    expect(getChangeInWeeks(existingItem, itemData)).toBe(3);
  });

  it('should return negative change when duration is decreased within remaining weeks', () => {
    const futureDate = new Date(Date.now() + 4 * 7 * 24 * 60 * 60 * 1000); // 4 weeks ahead
    const existingItem = { duration: 5, expired_by: futureDate.toISOString() } as unknown as ISellerItem;
    const itemData = { duration: 3 } as ISellerItem;
    expect(getChangeInWeeks(existingItem, itemData)).toBe(-2);
  });

  it('should return 0 when reducing more than remaining weeks', () => {
    const existingItem = { duration: 5 } as ISellerItem;
    const itemData = { duration: 1 } as ISellerItem;

    const result = getChangeInWeeks(existingItem, itemData);

    expect(result).toBe(0);
  });

  it('should return 0 when duration is unchanged', () => {
    const existingItem = { duration: 4 } as ISellerItem;
    const itemData = { duration: 4 } as ISellerItem;
    expect(getChangeInWeeks(existingItem, itemData)).toBe(0);
  });

  it('should treat invalid or missing durations as minimum 1', () => {
    const existingItem = { duration: 0 } as ISellerItem;
    const itemData = { duration: undefined } as unknown as ISellerItem;
    // Both parse to 1 → no change
    expect(getChangeInWeeks(existingItem, itemData)).toBe(0);
  });
});

describe('computeNewExpiryDate function', () => {
  beforeAll(() => {
    jest.useFakeTimers({ now: new Date('2025-01-01T00:00:00Z').getTime() });
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('should reset expiry for expired item', () => {
    const pastDate = new Date('2024-12-01T00:00:00Z');
    const existingItem = { duration: 3, expired_by: pastDate.toISOString() } as unknown as ISellerItem;
    const itemData = { duration: 4 } as ISellerItem;

    const newExpiry = computeNewExpiryDate(existingItem, itemData);

    const expectedExpiry = new Date(Date.now() + 4 * 7 * 24 * 60 * 60 * 1000);
    expect(newExpiry.getTime()).toBe(expectedExpiry.getTime());
  });

  it("should extend expiry if duration increased", () => {
    const futureDate = new Date(Date.now() + 2 * 7 * 24 * 60 * 60 * 1000); // 2 weeks ahead
    const existingItem = { duration: 2, expired_by: futureDate.toISOString() } as unknown as ISellerItem;
    const itemData = { duration: 5 } as ISellerItem;

    const newExpiry = computeNewExpiryDate(existingItem, itemData);

    // changeInWeeks = 5-2=3 → extend expiry by 3 weeks
    const expectedExpiry = new Date(futureDate.getTime() + 3 * 7 * 24 * 60 * 60 * 1000);
    expect(newExpiry.getTime()).toBe(expectedExpiry.getTime());
  });

  it('should reduce expiry if duration decreased within remaining weeks', () => {
    const futureDate = new Date(Date.now() + 4 * 7 * 24 * 60 * 60 * 1000); // 4 weeks ahead
    const existingItem = { duration: 5, expired_by: futureDate.toISOString() } as unknown as ISellerItem;
    const itemData = { duration: 3 } as ISellerItem;

    const newExpiry = computeNewExpiryDate(existingItem, itemData);

    // changeInWeeks = -2 → reduce expiry by 2 weeks
    const expectedExpiry = new Date(futureDate.getTime() - 2 * 7 * 24 * 60 * 60 * 1000);
    expect(newExpiry.getTime()).toBe(expectedExpiry.getTime());
  });

  it('should not change expiry if duration unchanged', () => {
    const futureDate = new Date(Date.now() + 3 * 7 * 24 * 60 * 60 * 1000);
    const existingItem = { duration: 3, expired_by: futureDate.toISOString() } as unknown as ISellerItem;
    const itemData = { duration: 3 } as ISellerItem;

    const newExpiry = computeNewExpiryDate(existingItem, itemData);

    expect(newExpiry.getTime()).toBe(futureDate.getTime());
  });

  it('should default to duration 1 if missing', () => {
    const pastDate = new Date('2024-12-01T00:00:00Z');
    const existingItem = { expired_by: pastDate.toISOString() } as unknown as ISellerItem;
    const itemData = {} as ISellerItem;

    const newExpiry = computeNewExpiryDate(existingItem, itemData);
    const expectedExpiry = new Date(Date.now() + 1 * 7 * 24 * 60 * 60 * 1000);
    expect(newExpiry.getTime()).toBe(expectedExpiry.getTime());
  });
});