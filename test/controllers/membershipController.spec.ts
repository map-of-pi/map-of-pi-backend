import {
  getMembershipList,
  fetchUserMembership,
  getSingleMembership,
  updateMembership
} from '../../src/controllers/membershipController';
import { MembershipClassType, membershipTiers } from "../../src/models/enums/membershipClassType";
import * as membershipService from "../../src/services/membership.service";

jest.mock('../../src/services/membership.service', () => ({
  buildMembershipList: jest.fn(),
  getUserMembership: jest.fn(),
  getSingleMembershipById: jest.fn(),
  applyMembershipChange: jest.fn()
}));

describe('membershipController', () => {
  let req: any;
  let res: any;

  describe('getMembershipList function', () => {
    const mockMembershipList = Object.values(membershipTiers).map((tier) => ({
      value: tier.CLASS,
      cost: tier.COST,
      duration: tier.DURATION,
      mappi_allowance: tier.MAPPI_ALLOWANCE,
    }));

    beforeEach(() => {
      req = {};
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
    });

    it('should return [200] and membership list on success', async () => {
      (membershipService.buildMembershipList as jest.Mock).mockResolvedValue(mockMembershipList);

      await getMembershipList(req, res);

      expect(membershipService.buildMembershipList).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockMembershipList);
    });

    it('should return [404] if membership list is not found', async () => {
      (membershipService.buildMembershipList as jest.Mock).mockResolvedValue(null);

      await getMembershipList(req, res);

      expect(membershipService.buildMembershipList).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Membership list not found' });
    });

    it('should return [404] if membership list is empty', async () => {
      (membershipService.buildMembershipList as jest.Mock).mockResolvedValue([]);

      await getMembershipList(req, res);

      expect(membershipService.buildMembershipList).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Membership list not found' });
    });

    it('should return [500] if membership service throws error', async () => {
      const mockError = new Error('Membership service layer error');
      (membershipService.buildMembershipList as jest.Mock).mockRejectedValue(mockError);

      await getMembershipList(req, res);

      expect(membershipService.buildMembershipList).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ 
        message: 'An error occurred while getting membership list; please try again later' 
      });
    });
  });

  describe('fetchUserMembership function', () => {
    const mockUser = { pi_uid: '0a0a0a-0a0a-0a0a' };
    const mockMembership = {
      membership_class: MembershipClassType.GREEN,
      mappi_balance: 100,
    };

    beforeEach(() => {
      req = {
        currentUser: mockUser
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
    });

    it('should return [200] and user membership on success', async () => {
      (membershipService.getUserMembership as jest.Mock).mockResolvedValue(mockMembership);

      await fetchUserMembership(req, res);

      expect(membershipService.getUserMembership).toHaveBeenCalledWith(mockUser);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockMembership);
    });

    it('should return [404] if user membership is not found', async () => {
      (membershipService.getUserMembership as jest.Mock).mockResolvedValue(null);

      await fetchUserMembership(req, res);

      expect(membershipService.getUserMembership).toHaveBeenCalledWith(mockUser);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'User Membership not found' });
    });

    it('should return [500] if membership service throws error', async () => {
      const mockError = new Error('Membership service layer error');
      (membershipService.getUserMembership as jest.Mock).mockRejectedValue(mockError);

      await fetchUserMembership(req, res);

      expect(membershipService.getUserMembership).toHaveBeenCalledWith(mockUser);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ 
        message: 'An error occurred while fetching user membership; please try again later' 
      });
    });
  });

  describe('getSingleMembership function', () => {
    const mockMembershipId = 'membershipID_TEST';
    const mockMembership = {
      _id: mockMembershipId,
      membership_class: MembershipClassType.DOUBLE_GOLD,
      mappi_balance: 200,
    };

    beforeEach(() => {
      req = {
        params: { membership_id: mockMembershipId }
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
    });

    it('should return [200] and membership on success', async () => {
      (membershipService.getSingleMembershipById as jest.Mock).mockResolvedValue(mockMembership);
  
      await getSingleMembership(req, res);
  
      expect(membershipService.getSingleMembershipById).toHaveBeenCalledWith(mockMembershipId);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockMembership);
    });

    it('should return [404] if membership is not found', async () => {
      (membershipService.getSingleMembershipById as jest.Mock).mockResolvedValue(null);
  
      await getSingleMembership(req, res);
  
      expect(membershipService.getSingleMembershipById).toHaveBeenCalledWith(mockMembershipId);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Membership not found' });
    });

    it('should return [500] if membership service throws error', async () => {
      const mockError = new Error('Membership service layer error');
      (membershipService.getSingleMembershipById as jest.Mock).mockRejectedValue(mockError);
  
      await getSingleMembership(req, res);
  
      expect(membershipService.getSingleMembershipById).toHaveBeenCalledWith(mockMembershipId);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'An error occurred while getting single membership; please try again later'
      });
    });
  });

  describe('updateMembership function', () => {
    const mockUser = { pi_uid: '0a0a0a-0a0a-0a0a' };
    const mockMembershipClass = MembershipClassType.WHITE;
    const mockUpdatedMembership = {
      membership_class: MembershipClassType.TRIPLE_GOLD,
      mappi_balance: 300
    };

    beforeEach(() => {
      req = {
        currentUser: mockUser,
        body: { membership_class: mockMembershipClass },
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
    });

    it('should return [200] and updated membership on success', async () => {
      (membershipService.applyMembershipChange as jest.Mock).mockResolvedValue(mockUpdatedMembership);
  
      await updateMembership(req, res);
  
      expect(membershipService.applyMembershipChange).toHaveBeenCalledWith(
        mockUser.pi_uid, 
        mockMembershipClass
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockUpdatedMembership);
    });

    it('should return [401] if no authenticated user', async () => {
      req.currentUser = undefined;
  
      await updateMembership(req, res);
  
      expect(membershipService.applyMembershipChange).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should return [500] if membership service throws error', async () => {
      const mockError = new Error('Membership service layer error');
      (membershipService.applyMembershipChange as jest.Mock).mockRejectedValue(mockError);
  
      await updateMembership(req, res);
  
      expect(membershipService.applyMembershipChange).toHaveBeenCalledWith(
        mockUser.pi_uid, 
        mockMembershipClass
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'An error occurred while updating membership; please try again later'
      });
    });
  });
});