export class StockValidationError extends Error {
  constructor(message: string, public itemId?: string) {
    super(message);
    this.name = 'StockValidationError';
  }
}