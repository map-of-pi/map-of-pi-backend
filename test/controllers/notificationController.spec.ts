import { 
  createNotification,
  getNotifications,
  updateNotification
} from '../../src/controllers/notificationController';
import * as notificationService from '../../src/services/notification.service';

jest.mock('../../src/services/notification.service', () => ({
  addNotification: jest.fn(),
  getNotificationsAndCount: jest.fn(),
  toggleNotificationStatus: jest.fn()
}));

describe('notificationController', () => {
  let req: any;
  let res: any;

  describe('getNotifications function', () => {
    const mockUser = { pi_uid: '0a0a0a-0a0a-0a0a' };

    beforeEach(() => {
      req = {
        currentUser: mockUser,
        query : {
          skip: '5',
          limit: '10'
        }
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
    });

    it('should return [401] if no authenticated user', async () => {
      req.currentUser = undefined;
  
      await getNotifications(req, res);
  
      expect(notificationService.getNotificationsAndCount).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should coerce pagination values; skip < 0 to 0 and limit > 100 to 100', async () => {
      req.query.skip = '-10';
      req.query.limit = '150';
    
      const mockNotifications = [
        { pi_uid: '0a0a0a-0a0a-0a0a', is_cleared: false, reason: 'TEST_REASON_A' },
      ];
    
      (notificationService.getNotificationsAndCount as jest.Mock).mockResolvedValue({
        items: mockNotifications,
        count: mockNotifications.length,
      });
    
      await getNotifications(req, res);
    
      expect(notificationService.getNotificationsAndCount).toHaveBeenCalledWith(mockUser.pi_uid, 0, 100, undefined);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        items: mockNotifications,
        count: mockNotifications.length,
      });
    });

    it('should coerce pagination values; limit < 1 to 20', async () => {
      req.query.skip = '5';
      req.query.limit = '0';
    
      const mockNotifications = [
        { pi_uid: '0a0a0a-0a0a-0a0a', is_cleared: false, reason: 'TEST_REASON_A' },
      ];
    
      (notificationService.getNotificationsAndCount as jest.Mock).mockResolvedValue({
        items: mockNotifications,
        count: mockNotifications.length,
      });
    
      await getNotifications(req, res);
    
      expect(notificationService.getNotificationsAndCount).toHaveBeenCalledWith(mockUser.pi_uid, 5, 20, undefined);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        items: mockNotifications,
        count: mockNotifications.length,
      });
    });

    it('should use default pagination values when skip and limit are not provided', async () => {
      req.query = {}; // no skip or limit
    
      const mockNotifications = [
        { pi_uid: '0a0a0a-0a0a-0a0a', is_cleared: false, reason: 'TEST_REASON_A' },
      ];
    
      (notificationService.getNotificationsAndCount as jest.Mock).mockResolvedValue({
        items: mockNotifications,
        count: mockNotifications.length,
      });
    
      await getNotifications(req, res);
    
      expect(notificationService.getNotificationsAndCount).toHaveBeenCalledWith(mockUser.pi_uid, 0, 20, undefined);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        items: mockNotifications,
        count: mockNotifications.length,
      });
    });

    it('should get all notifications (pagination provided) and return [200] on success', async () => {
      const mockNotifications = [
        { pi_uid: '0a0a0a-0a0a-0a0a', is_cleared: false, reason: 'TEST_REASON_A' },
        { pi_uid: '0a0a0a-0a0a-0a0a', is_cleared: true, reason: 'TEST_REASON_B' }
      ];
      
      (notificationService.getNotificationsAndCount as jest.Mock).mockResolvedValue({
        items: mockNotifications,
        count: mockNotifications.length,
      });

      await getNotifications(req, res);

      expect(notificationService.getNotificationsAndCount).toHaveBeenCalledWith(mockUser.pi_uid, 5, 10, undefined);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        items: mockNotifications,
        count: mockNotifications.length
      });
    });

    it('should get only cleared notifications (pagination provided) and return [200] on success', async () => {
      req.query.status = 'cleared';
      const mockNotifications = [
        { pi_uid: '0a0a0a-0a0a-0a0a', is_cleared: false, reason: 'TEST_REASON_A' },
        { pi_uid: '0a0a0a-0a0a-0a0a', is_cleared: true, reason: 'TEST_REASON_B' },
        { pi_uid: '0a0a0a-0a0a-0a0a', is_cleared: true, reason: 'TEST_REASON_C' },
      ];
      
      (notificationService.getNotificationsAndCount as jest.Mock).mockResolvedValue({
        items: mockNotifications,
        count: mockNotifications.length,
      });

      await getNotifications(req, res);

      expect(notificationService.getNotificationsAndCount).toHaveBeenCalledWith(mockUser.pi_uid, 5, 10, 'cleared');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        items: mockNotifications,
        count: mockNotifications.length
      });
    });

    it('should get only uncleared notifications (pagination provided) and return [200] on success', async () => {
      req.query.status = 'uncleared';
      const mockNotifications = [
        { pi_uid: '0a0a0a-0a0a-0a0a', is_cleared: false, reason: 'TEST_REASON_A' },
        { pi_uid: '0a0a0a-0a0a-0a0a', is_cleared: true, reason: 'TEST_REASON_B' },
        { pi_uid: '0a0a0a-0a0a-0a0a', is_cleared: true, reason: 'TEST_REASON_C' },
        { pi_uid: '0a0a0a-0a0a-0a0a', is_cleared: false, reason: 'TEST_REASON_D' },
      ];
      
      (notificationService.getNotificationsAndCount as jest.Mock).mockResolvedValue({
        items: mockNotifications,
        count: mockNotifications.length,
      });

      await getNotifications(req, res);

      expect(notificationService.getNotificationsAndCount).toHaveBeenCalledWith(mockUser.pi_uid, 5, 10, 'uncleared');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        items: mockNotifications,
        count: mockNotifications.length
      });
    });

    it('should get all notifications for invalid status (pagination provided) and return [200] on success', async () => {
      req.query.status = 'invalid';
      const mockNotifications = [
        { pi_uid: '0a0a0a-0a0a-0a0a', is_cleared: false, reason: 'TEST_REASON_A' },
        { pi_uid: '0a0a0a-0a0a-0a0a', is_cleared: true, reason: 'TEST_REASON_B' },
        { pi_uid: '0a0a0a-0a0a-0a0a', is_cleared: true, reason: 'TEST_REASON_C' },
        { pi_uid: '0a0a0a-0a0a-0a0a', is_cleared: false, reason: 'TEST_REASON_D' },
      ];
      
      (notificationService.getNotificationsAndCount as jest.Mock).mockResolvedValue({
        items: mockNotifications,
        count: mockNotifications.length,
      });

      await getNotifications(req, res);

      expect(notificationService.getNotificationsAndCount).toHaveBeenCalledWith(mockUser.pi_uid, 5, 10, undefined);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        items: mockNotifications,
        count: mockNotifications.length
      });
    });

    it('should return [500] if getting notifications fails', async () => {
      const error = new Error('Service layer error');
      (notificationService.getNotificationsAndCount as jest.Mock).mockRejectedValue(error);
  
      await getNotifications(req, res);
  
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'An error occurred while getting notifications; please try again later',
      });
    });
  });

  describe('createNotification function', () => {
    beforeEach(() => {
      req = {
        currentUser: {
          pi_uid: '0a0a0a-0a0a-0a0a',
        },
        body : {
          reason: 'TEST_REASON'
        }
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
    });

    it('should create a notification and return [200] on success', async () => {
      const mockNotification = { id: 'notification_1', reason: 'TEST_REASON' };
      
      (notificationService.addNotification as jest.Mock).mockResolvedValue(mockNotification);

      await createNotification(req, res);

      expect(notificationService.addNotification).toHaveBeenCalledWith('0a0a0a-0a0a-0a0a', 'TEST_REASON');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Notification created successfully',
        notification: mockNotification,
      });
    });

    it('should return [401] if no authenticated user', async () => {
      req.currentUser = undefined;

      await createNotification(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should return [500] if creating notification fails', async () => {
      const error = new Error('Service layer error');
      (notificationService.addNotification as jest.Mock).mockRejectedValue(error);
  
      await createNotification(req, res);
  
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'An error occurred while creating notification; please try again later',
      });
    });
  });

  describe('updateNotification function', () => {
    beforeEach(() => {
      req = {
        params: { 
          notification_id: 'notificationId1_TEST',
        }
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
    });

    it('should update notification and return [200] on success', async () => {
      const mockUpdatedNotification = [
        { pi_uid: '0a0a0a-0a0a-0a0a', is_cleared: true, reason: 'TEST_REASON_A' }
      ];
      
      (notificationService.toggleNotificationStatus as jest.Mock).mockResolvedValue(mockUpdatedNotification);

      await updateNotification(req, res);

      expect(notificationService.toggleNotificationStatus).toHaveBeenCalledWith('notificationId1_TEST');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Notification updated successfully',
        updatedNotification: mockUpdatedNotification
      });
    });

    it('should return [404] if notification not found', async () => {
      (notificationService.toggleNotificationStatus as jest.Mock).mockResolvedValue(null);
        
      await updateNotification(req, res);
  
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Notification not found or could not be updated' });
    });

    it('should return [500] if updating notification fails', async () => {
      const error = new Error('Service layer error');
      (notificationService.toggleNotificationStatus as jest.Mock).mockRejectedValue(error);
  
      await updateNotification(req, res);
  
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'An error occurred while updating notification; please try again later',
      });
    });
  });
});