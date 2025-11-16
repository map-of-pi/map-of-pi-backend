import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import * as mockData from './mockData.json';
import User from '../src/models/User';
import UserSettings from '../src/models/UserSettings';
import Seller from '../src/models/Seller';
import SellerItem from '../src/models/SellerItem';
import ReviewFeedback from '../src/models/ReviewFeedback';
import Toggle from '../src/models/misc/Toggle';

// mock the Winston logger
jest.mock('../src/config/loggingConfig', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// allow ample time to start running tests
// TODO - replace mockData.json file w/ mocks to lessen timeout value.
jest.setTimeout(60000);

// MongoDB memory server setup
let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  try {
    mongoServer = await MongoMemoryServer.create({
      instance: {
        dbName: 'mapofpi-test-db',
      },
    });
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    // Ensure indexes exist before inserts
    await Promise.all([
      User.init(),
      UserSettings.init(),
      Seller.init(),
      SellerItem.init(),
    ]);

    // Insert data in parallel to save time
    await Promise.all([
      // Load the mock data into Map of PI DB collections
      User.insertMany(mockData.users),
      UserSettings.insertMany(mockData.userSettings),
      Seller.insertMany(mockData.sellers),
      SellerItem.insertMany(mockData.sellerItems),
      ReviewFeedback.insertMany(mockData.reviews),
      Toggle.insertMany(mockData.toggle),
    ]);
  } catch (error) {
    console.error('Failed to start MongoMemoryServer:', error);
    throw error;
  }
});

afterAll(async () => {
  try {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  } catch (error) {
    console.warn('Error during cleanup:', error);
  }
});