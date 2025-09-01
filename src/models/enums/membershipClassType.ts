export enum MembershipClassType {
  CASUAL = "Casual",
  WHITE = "White",
  GREEN = "Green",
  GOLD = "Gold",
  DOUBLE_GOLD = "Double Gold",
  TRIPLE_GOLD = "Triple Gold"
}

export enum MappiCreditType {
  SINGLE = "Single"
}

export const membershipTiers = {
  tier0: {
    CLASS: MembershipClassType.CASUAL,
    MAPPI_ALLOWANCE: 0,
    COST: 0,
    DURATION: null,
    RANK: 0
  },
  tier1: {
    CLASS: MembershipClassType.WHITE,
    MAPPI_ALLOWANCE: 0,
    COST: 1,
    DURATION: 50,
    RANK: 1
  },
  tier2: {
    CLASS: MembershipClassType.GREEN,
    MAPPI_ALLOWANCE: 20,
    COST: 2,
    DURATION: 4,
    RANK: 2
  },
  tier3: {
    CLASS: MembershipClassType.GOLD,
    MAPPI_ALLOWANCE: 100,
    COST: 5,
    DURATION: 10,
    RANK: 3
  },
  tier4: {
    CLASS: MembershipClassType.DOUBLE_GOLD,
    MAPPI_ALLOWANCE: 400,
    COST: 10,
    DURATION: 20,
    RANK: 4
  },
  tier5: {
    CLASS: MembershipClassType.TRIPLE_GOLD,
    MAPPI_ALLOWANCE: 2000,
    COST: 20,
    DURATION: 50,
    RANK: 5
  }
}

export const mappiCreditOptions = {
  CLASS: MappiCreditType.SINGLE,
  MAPPI_ALLOWANCE: 1,
  COST: 0.2,
  DURATION: null,
  RANK: 0
}