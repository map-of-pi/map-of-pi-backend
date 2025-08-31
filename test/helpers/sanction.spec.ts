import { summarizeSanctionedResults } from "../../src/helpers/sanction";
import { SanctionedUpdateResult } from "../../src/types";

describe('summarizeSanctionedResults function', () => {
  it('should return zero Sanctioned Stats for an empty input array', () => {
    const results: PromiseSettledResult<SanctionedUpdateResult>[] = [];

    const stats = summarizeSanctionedResults(results);

    expect(stats).toEqual({
      total: 0,
      changed: 0,
      restricted: 0,
      unrestricted: 0,
    });
  });

  it('should count expected Sanctioned Stats for only fulfilled results', () => {
    const results: PromiseSettledResult<SanctionedUpdateResult>[] = [
      { 
        status: 'fulfilled', 
        value: { 
          seller_id: 'seller1',
          isChanged: true,
          isRestricted: true,
          isUpdateSuccess: true,
          isNotificationSuccess: true
        }
      },
      { 
        status: 'fulfilled', 
        value: { 
          seller_id: 'seller2',
          isChanged: false,
          isRestricted: false,
          isUpdateSuccess: true,
          isNotificationSuccess: false
        }
      },
      {
        status: 'rejected',
        reason: new Error('Unexpected Exception'),
      }
    ];

    const stats = summarizeSanctionedResults(results);

    expect(stats).toEqual({
      total: 3,
      changed: 1,
      restricted: 1,
      unrestricted: 1,
    });
  });

  it('should count expected Sanctioned Stats for non-fulfilled results', () => {
    const results: PromiseSettledResult<SanctionedUpdateResult>[] = [
      {
        status: 'rejected',
        reason: new Error('Unexpected Exception'),
      },
      {
        status: 'rejected',
        reason: new Error('Unexpected Exception'),
      },
      {
        status: 'rejected',
        reason: new Error('Unexpected Exception'),
      }
    ];

    const stats = summarizeSanctionedResults(results);

    expect(stats).toEqual({
      total: 3,
      changed: 0,
      restricted: 0,
      unrestricted: 0,
    });
  });
});

describe('getCachedSanctionedBoundaries function', () => {
  beforeEach(() => {
    jest.resetModules(); // This ensures a fresh module import each time
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should call fetchFn and cache the result on first call', async () => {
    const mockData = [{ id: 1, name: 'testBoundary' }];

    const fetchFn = jest.fn().mockResolvedValue(mockData);
    jest.setSystemTime(1_000_000); // mock Date.now()

    // Dynamic import here to get fresh module instance
    const { getCachedSanctionedBoundaries } = await import('../../src/helpers/sanction');
    const result = await getCachedSanctionedBoundaries(fetchFn);

    expect(result).toBe(mockData);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('should return cached result within TTL without calling fetchFn again', async () => {
    const mockData = [{ id: 1, name: 'testBoundary' }];

    const fetchFn = jest.fn().mockResolvedValue(mockData);
    jest.setSystemTime(1_000_000);

    const { getCachedSanctionedBoundaries } = await import('../../src/helpers/sanction');

    await getCachedSanctionedBoundaries(fetchFn); // First call to cache
    const result = await getCachedSanctionedBoundaries(fetchFn); // Should use cache

    expect(result).toBe(mockData);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('should re-fetch and update cache if TTL has expired', async () => {
    const mockData_1 = [{ id: 1, name: 'testBoundary_1' }];
    const mockData_2 = [{ id: 2, name: 'testBoundary_2' }];

    const fetchFn = jest.fn()
      .mockResolvedValueOnce(mockData_1)
      .mockResolvedValueOnce(mockData_2);

    jest.setSystemTime(1_000_000);

    const { getCachedSanctionedBoundaries } = await import('../../src/helpers/sanction');
    const firstCall = await getCachedSanctionedBoundaries(fetchFn);

    // Advance time past TTL
    jest.setSystemTime(1_000_000 + 60 * 60 * 1000 + 1);

    const secondCall = await getCachedSanctionedBoundaries(fetchFn);

    expect(firstCall).toBe(mockData_1);
    expect(secondCall).toBe(mockData_2);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});