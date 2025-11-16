import { getUpdatedStockLevel, getRollbackStockLevel } from "../../src/helpers/order";
import { StockLevelType } from "../../src/models/enums/stockLevelType";
import { StockValidationError } from "../../src/errors/StockValidationError";

describe('getUpdatedStockLevel function', () => {
  const itemId = 'itemId_TEST'

  it('should handle AVAILABLE_1: quantity 1 returns SOLD', () => {
    expect(getUpdatedStockLevel(StockLevelType.AVAILABLE_1, 1, itemId)).toBe(StockLevelType.SOLD);
  });

  it('should handle AVAILABLE_1: quantity > 1 throws error', () => {
    expect(() => getUpdatedStockLevel(StockLevelType.AVAILABLE_1, 2, itemId)).toThrow(StockValidationError);
  });

  it('should handle AVAILABLE_2: quantity 1 returns AVAILABLE_1', () => {
    expect(getUpdatedStockLevel(StockLevelType.AVAILABLE_2, 1, itemId)).toBe(StockLevelType.AVAILABLE_1);
  });

  it('should handle AVAILABLE_2: quantity 2 returns SOLD', () => {
    expect(getUpdatedStockLevel(StockLevelType.AVAILABLE_2, 2, itemId)).toBe(StockLevelType.SOLD);
  });

  it('should handle AVAILABLE_2: quantity > 2 throws error', () => {
    expect(() => getUpdatedStockLevel(StockLevelType.AVAILABLE_2, 3, itemId)).toThrow(StockValidationError);
  });

  it('should handle AVAILABLE_3: quantity 1 returns AVAILABLE_2', () => {
    expect(getUpdatedStockLevel(StockLevelType.AVAILABLE_3, 1, itemId)).toBe(StockLevelType.AVAILABLE_2);
  });

  it('should handle AVAILABLE_3: quantity 2 returns AVAILABLE_1', () => {
    expect(getUpdatedStockLevel(StockLevelType.AVAILABLE_3, 2, itemId)).toBe(StockLevelType.AVAILABLE_1);
  });

  it('should handle AVAILABLE_3: quantity 3 returns SOLD', () => {
    expect(getUpdatedStockLevel(StockLevelType.AVAILABLE_3, 3, itemId)).toBe(StockLevelType.SOLD);
  });

  it('should handle AVAILABLE_3: quantity > 3 throws error', () => {
    expect(() => getUpdatedStockLevel(StockLevelType.AVAILABLE_3, 4, itemId)).toThrow(StockValidationError);
  });

  it('should handle MANY_AVAILABLE: regardless of quantity returns null', () => {
    expect(getUpdatedStockLevel(StockLevelType.MANY_AVAILABLE, 10, itemId)).toBeNull();
  });

  it('should handle MADE_TO_ORDER: regardless of quantity returns null', () => {
    expect(getUpdatedStockLevel(StockLevelType.MADE_TO_ORDER, 5, itemId)).toBeNull();
  });

  it('should handle ONGOING_SERVICE: regardless of quantity returns null', () => {
    expect(getUpdatedStockLevel(StockLevelType.ONGOING_SERVICE, 1, itemId)).toBeNull();
  });

  it('should throw StockValidationError if stock level is unhandled', () => {
    expect(() => getUpdatedStockLevel('UNKNOWN_LEVEL' as StockLevelType, 1, itemId)).toThrow(StockValidationError);
  });
});

describe('getRollbackStockLevel function', () => {
  it('should handle SOLD: quantity 1 returns AVAILABLE_1', () => {
    expect(getRollbackStockLevel(StockLevelType.SOLD, 1)).toBe(StockLevelType.AVAILABLE_1);
  });

  it('should handle SOLD: quantity 2 returns AVAILABLE_2', () => {
    expect(getRollbackStockLevel(StockLevelType.SOLD, 2)).toBe(StockLevelType.AVAILABLE_2);
  });

  it('should handle SOLD: quantity 3 returns AVAILABLE_3', () => {
    expect(getRollbackStockLevel(StockLevelType.SOLD, 3)).toBe(StockLevelType.AVAILABLE_3);
  });

  it('should handle SOLD: quantity > 3 returns null', () => {
    expect(getRollbackStockLevel(StockLevelType.SOLD, 4)).toBeNull();
  });

  it('should handle AVAILABLE_1: quantity 1 returns AVAILABLE_2', () => {
    expect(getRollbackStockLevel(StockLevelType.AVAILABLE_1, 1)).toBe(StockLevelType.AVAILABLE_2);
  });

  it('should handle AVAILABLE_1: quantity 2 returns AVAILABLE_3', () => {
    expect(getRollbackStockLevel(StockLevelType.AVAILABLE_1, 2)).toBe(StockLevelType.AVAILABLE_3);
  });

  it('should handle AVAILABLE_1: quantity > 2 returns null', () => {
    expect(getRollbackStockLevel(StockLevelType.AVAILABLE_1, 3)).toBeNull();
  });

  it('should handle AVAILABLE_2: quantity 1 returns AVAILABLE_3', () => {
    expect(getRollbackStockLevel(StockLevelType.AVAILABLE_2, 1)).toBe(StockLevelType.AVAILABLE_3);
  });

  it('should handle AVAILABLE_2: quantity > 1 returns null', () => {
    expect(getRollbackStockLevel(StockLevelType.AVAILABLE_2, 2)).toBeNull();
  });

  it('should handle MANY_AVAILABLE: regardless of quantity returns null', () => {
    expect(getRollbackStockLevel(StockLevelType.MANY_AVAILABLE, 10)).toBeNull();
  });

  it('should handle MADE_TO_ORDER: regardless of quantity returns null', () => {
    expect(getRollbackStockLevel(StockLevelType.MADE_TO_ORDER, 5)).toBeNull();
  });

  it('should handle ONGOING_SERVICE: regardless of quantity returns null', () => {
    expect(getRollbackStockLevel(StockLevelType.ONGOING_SERVICE, 1)).toBeNull();
  });

  it('should return null if stock level is unhandled', () => {
    expect(getRollbackStockLevel('UNKNOWN_LEVEL' as StockLevelType, 1)).toBeNull();
  });
});