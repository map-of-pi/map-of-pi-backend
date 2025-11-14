import { StockLevelType } from "../models/enums/stockLevelType";
import { StockValidationError } from "../errors/StockValidationError";

export function getUpdatedStockLevel(
  currentLevel: StockLevelType,
  quantity: number,
  itemId: string
): StockLevelType | null {
  // Helper to throw error for exceeding max quantity
  const throwIfOver = (max: number) => {
    if (quantity > max) {
      throw new StockValidationError(
        `Cannot order more than ${max} item${max > 1 ? 's' : ''} for "${max} available"`,
        itemId
      );
    }
  };

  switch (currentLevel) {
    case StockLevelType.AVAILABLE_1:
      throwIfOver(1);
      return StockLevelType.SOLD;

    case StockLevelType.AVAILABLE_2:
      throwIfOver(2);
      return quantity === 2 ? StockLevelType.SOLD : StockLevelType.AVAILABLE_1;

    case StockLevelType.AVAILABLE_3:
      throwIfOver(3);
      // Map quantity to resulting stock level explicitly
      if (quantity === 3) return StockLevelType.SOLD;
      if (quantity === 2) return StockLevelType.AVAILABLE_1;
      return StockLevelType.AVAILABLE_2;

    case StockLevelType.MANY_AVAILABLE:
    case StockLevelType.MADE_TO_ORDER:
    case StockLevelType.ONGOING_SERVICE:
      return null; // No update needed

    default:
      throw new StockValidationError(`Unhandled stock level type`, itemId);
  }
}

export function getRollbackStockLevel(
  currentStock: StockLevelType,
  quantity: number
): StockLevelType | null {
  // Helper to map quantity to stock level for rollback from SOLD
  const soldRollbackMap: Record<number, StockLevelType> = {
    1: StockLevelType.AVAILABLE_1,
    2: StockLevelType.AVAILABLE_2,
    3: StockLevelType.AVAILABLE_3,
  };

  switch (currentStock) {
    case StockLevelType.SOLD:
      return soldRollbackMap[quantity] ?? null;

    case StockLevelType.AVAILABLE_1:
      if (quantity === 1) return StockLevelType.AVAILABLE_2;
      if (quantity === 2) return StockLevelType.AVAILABLE_3;
      return null;

    case StockLevelType.AVAILABLE_2:
      if (quantity === 1) return StockLevelType.AVAILABLE_3;
      return null;

    // For non-limited stock types, we assume no rollback is needed
    case StockLevelType.MANY_AVAILABLE:
    case StockLevelType.MADE_TO_ORDER:
    case StockLevelType.ONGOING_SERVICE:
      return null;

    default:
      return null;
  }
}