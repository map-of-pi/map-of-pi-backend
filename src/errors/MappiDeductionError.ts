export class MappiDeductionError extends Error {
  constructor(public pi_uid: string, public amount: number, message: string) {
    super(message);
    this.name = "MappiDeductionError";
  }
}