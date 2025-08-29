import { 
  authenticateUser,
  autoLoginUser,
  getUser,
  deleteUser 
} from '../../src/controllers/userController';
import * as jwtHelper from '../../src/helpers/jwt';
import { MembershipClassType } from '../../src/models/enums/membershipClassType';
import * as membershipService from '../../src/services/membership.service';
import * as userService from '../../src/services/user.service';

jest.mock('../../src/helpers/jwt');

jest.mock('../../src/services/user.service', () => ({
  authenticate: jest.fn(),
  getUser: jest.fn(),
  deleteUser: jest.fn()
}));

jest.mock('../../src/services/membership.service', () => ({
  getUserMembership: jest.fn()
}));

describe('userController', () => {
  let req: any;
  let res: any;

  describe('authenticateUser function', () => {
    beforeEach(() => {
      req = {
        body: {
          user: {
            pi_uid: '0a0a0a-0a0a-0a0a',
            username: 'testUser'
          }
        }
      };
      res = {
        cookie: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
    });

    it('should authenticate the user and return with appropriate [200] with expected response', async () => {
      const mockUser = { 
        pi_uid: req.body.user.pi_uid, 
        username: req.body.user.username 
      };
      const mockToken = 'jwtToken_test';

      (userService.authenticate as jest.Mock).mockResolvedValue({
        user: mockUser,
        membership_class: MembershipClassType.GOLD
      });

      (jwtHelper.generateUserToken as jest.Mock).mockReturnValue(mockToken);

      await authenticateUser(req, res);

      expect(userService.authenticate).toHaveBeenCalledWith(req.body.user);
      expect(jwtHelper.generateUserToken).toHaveBeenCalledWith(mockUser);
      expect(res.cookie).toHaveBeenCalledWith(
        'token',
        mockToken,
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          priority: 'high',
          sameSite: 'lax'
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        user: mockUser,
        token: mockToken,
        membership_class: MembershipClassType.GOLD
      });
    });

    it('should return [500] if authentication throws an error', async () => {
      const mockError = new Error('Service layer error');
      (userService.authenticate as jest.Mock).mockRejectedValue(mockError);
  
      await authenticateUser(req, res);
  
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'An error occurred while authenticating user; please try again later'
      });
    });
  });

  describe('autoLoginUser function', () => {
    beforeEach(() => {
      req = {
        currentUser: {
          pi_uid: '0a0a0a-0a0a-0a0a',
          username: 'testUser'
        }
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
    }); 
    
    it('should return [200] with expected response when successful', async () => {
      const mockMembership = {
        membership_class: MembershipClassType.TRIPLE_GOLD
      };
      
      (membershipService.getUserMembership as jest.Mock).mockResolvedValue(mockMembership);
      
      await autoLoginUser(req, res);

      expect(membershipService.getUserMembership).toHaveBeenCalledWith(req.currentUser);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        user: req.currentUser,
        membership_class: mockMembership.membership_class
      });
    });
    
    it('should return [500] if membership service throws an error', async () => {
      const mockError = new Error('Service layer error');
      (membershipService.getUserMembership as jest.Mock).mockRejectedValue(mockError);
  
      await autoLoginUser(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'An error occurred while auto-logging the user; please try again later'
      });
    });
  });

  describe('getUser function', () => {
    beforeEach(() => {
      req = {
        params: {
          pi_uid: '0a0a0a-0a0a-0a0a'
        }
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
    });

    it('should return [200] and user data if user is found', async () => {
      const mockUser = {
        pi_uid: req.params.pi_uid,
        username: 'testUser'
      };
  
      (userService.getUser as jest.Mock).mockResolvedValue(mockUser);
  
      await getUser(req, res);
  
      expect(userService.getUser).toHaveBeenCalledWith(req.params.pi_uid);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockUser);
    });

    it('should return [404] if user is not found', async () => {
      (userService.getUser as jest.Mock).mockResolvedValue(null);
  
      await getUser(req, res);
  
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "User not found" });
    });

    it('should return [500] if userService throws an error', async () => {
      const mockError = new Error('Service layer error');
      (userService.getUser as jest.Mock).mockRejectedValue(mockError);
  
      await getUser(req, res);
  
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'An error occurred while getting user; please try again later'
      });
    });
  });

  describe('deleteUser function', () => {
    beforeEach(() => {
      req = {
        currentUser: {
          pi_uid: '0a0a0a-0a0a-0a0a',
        },
      };
  
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
    });

    it('should delete user and return successful message', async () => {
      const expectedDeletedData = { 
        user: { pi_uid: '0a0a0a-0a0a-0a0a' },
        sellers: [{ seller_id: '0a0a0a-0a0a-0a0a' }],
        userSetting: { user_settings_id: '0a0a0a-0a0a-0a0a' }, 
      };

      (userService.deleteUser as jest.Mock).mockResolvedValue(expectedDeletedData);

      await deleteUser(req, res);

      expect(userService.deleteUser).toHaveBeenCalledWith('0a0a0a-0a0a-0a0a');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User deleted successfully',
        deletedData: expectedDeletedData,
      });
    });

    it('should return appropriate [500] if delete user fails', async () => {
      const mockError = new Error('An error occurred while deleting user; please try again later');

      (userService.deleteUser as jest.Mock).mockRejectedValue(mockError);

      await deleteUser(req, res);

      expect(userService.deleteUser).toHaveBeenCalledWith('0a0a0a-0a0a-0a0a');
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: mockError.message });
    });
  });
});
