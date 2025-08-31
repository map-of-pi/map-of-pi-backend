import Notification from "../../src/models/Notification";
import {
  addNotification,
  getNotifications,
  toggleNotificationStatus
} from '../../src/services/notification.service';

jest.mock('../../src/models/Notification');

describe('addNotification function', () => {
  const pi_uid = '0a0a0a-0a0a-0a0a';
  const reason = 'TEST_REASON_A';

  it('should create and return a new notification', async () => {
    const mockNotification = { 
      _id: 'notificationId1_TEST',
      pi_uid, 
      reason,
      is_cleared: false, 
      createdAt: new Date(),
    };

    (Notification.create as jest.Mock).mockResolvedValue(mockNotification);

    const newNotification = await addNotification(pi_uid, reason);
    
    expect(Notification.create).toHaveBeenCalledWith({
      pi_uid,
      reason,
      is_cleared: false,
    });

    expect(newNotification).toEqual(mockNotification);
  });

  it('should throw an error if adding notification fails', async () => {
    const mockError = new Error('Mock database error');

    (Notification.create as jest.Mock).mockRejectedValue(mockError);

    await expect(addNotification(pi_uid, reason)).rejects.toThrow('Mock database error');
  });
});

describe('getNotifications function', () => {
  const pi_uid = '0b0b0b-0b0b-0b0b';
  const skip = 5;
  const limit = 10;

  function mockNotificationQuery(mockResult: any) {
    const sortMock = jest.fn().mockReturnThis();
    const skipMock = jest.fn().mockReturnThis();
    const limitMock = jest.fn().mockReturnThis();
    const execMock = jest.fn().mockResolvedValue(mockResult);
  
    (Notification.find as jest.Mock).mockReturnValue({
      sort: sortMock,
      skip: skipMock,
      limit: limitMock,
      exec: execMock,
    });
  
    return { sortMock, skipMock, limitMock, execMock };
  }

  it('should return a list of notifications associated with the user', async () => {
    const mockNotifications = [
      { pi_uid, is_cleared: false, reason: 'TEST_REASON_A' },
      { pi_uid, is_cleared: true, reason: 'TEST_REASON_B' },
      { pi_uid, is_cleared: true, reason: 'TEST_REASON_C' },
      { pi_uid, is_cleared: false, reason: 'TEST_REASON_D' }
    ];

    const { sortMock, skipMock, limitMock, execMock } = mockNotificationQuery(mockNotifications);

    const existingNotifications = await getNotifications(pi_uid, skip, limit, undefined);
    
    expect(Notification.find).toHaveBeenCalledWith({ pi_uid });
    expect(sortMock).toHaveBeenCalledWith({ createdAt: -1 });
    expect(skipMock).toHaveBeenCalledWith(skip);
    expect(limitMock).toHaveBeenCalledWith(limit);
    expect(execMock).toHaveBeenCalled();
    expect(existingNotifications).toEqual(mockNotifications);
  });

  it('should filter notifications for status cleared', async () => {
    const mockClearedNotifications = [
      { pi_uid, is_cleared: true, reason: 'TEST_REASON_B' },
      { pi_uid, is_cleared: true, reason: 'TEST_REASON_C' }
    ];

    const { sortMock, skipMock, limitMock, execMock } = mockNotificationQuery(mockClearedNotifications);

    const result = await getNotifications(pi_uid, skip, limit, 'cleared');
    expect(Notification.find).toHaveBeenCalledWith({ pi_uid, is_cleared: true });
    expect(sortMock).toHaveBeenCalledWith({ createdAt: -1 });
    expect(skipMock).toHaveBeenCalledWith(skip);
    expect(limitMock).toHaveBeenCalledWith(limit);
    expect(execMock).toHaveBeenCalled();
    expect(result).toEqual(mockClearedNotifications);
  });

  it('should filter notifications for status uncleared', async () => {
    const mockUnclearedNotifications = [
      { pi_uid, is_cleared: false, reason: 'TEST_REASON_A' },
      { pi_uid, is_cleared: false, reason: 'TEST_REASON_D' }
    ];

    const { sortMock, skipMock, limitMock, execMock } = mockNotificationQuery(mockUnclearedNotifications);

    const result = await getNotifications(pi_uid, skip, limit, 'uncleared');
    expect(Notification.find).toHaveBeenCalledWith({ pi_uid, is_cleared: false });
    expect(sortMock).toHaveBeenCalledWith({ createdAt: -1 });
    expect(skipMock).toHaveBeenCalledWith(skip);
    expect(limitMock).toHaveBeenCalledWith(limit);
    expect(execMock).toHaveBeenCalled();
    expect(result).toEqual(mockUnclearedNotifications);
  });

  it('should throw an error if getting notifications fail', async () => {
    const mockError = new Error('Mock database error');

    // Fully mock the chained methods with exec throwing
    (Notification.find as jest.Mock).mockReturnValue({
      sort: () => ({
        skip: () => ({
          limit: () => ({
            exec: jest.fn().mockRejectedValue(mockError),
          }),
        }),
      }),
    });

    await expect(getNotifications(pi_uid, skip, limit)).rejects.toThrow('Mock database error');
  });
});

describe('toggleNotificationStatus function', () => {
  const notification_id = 'notificationId1_TEST';

  it('should toggle the notification status and return the notification', async () => {
    const mockExistingNotification = {
      _id: notification_id,
      is_cleared: false
    };
    
    const mockUpdatedNotification = { 
      _id: notification_id,
      pi_uid: '0c0c0c-0c0c-0c0c', 
      is_cleared: true, 
      reason: 'TEST_REASON_C',
      createdAt: new Date(),
    };

    (Notification.findById as jest.Mock).mockReturnValue({ exec: jest.fn().mockResolvedValue(mockExistingNotification) });
    (Notification.findByIdAndUpdate as jest.Mock).mockReturnValue({ exec: jest.fn().mockResolvedValue(mockUpdatedNotification) });

    const updatedNotification = await toggleNotificationStatus(notification_id);
    
    expect(Notification.findById).toHaveBeenCalledWith(notification_id);
    expect(Notification.findByIdAndUpdate).toHaveBeenCalledWith(
      { _id: notification_id },
      { is_cleared: true },
      { new: true }
    );
    expect(updatedNotification).toEqual(mockUpdatedNotification);
  });

  it('should return null if notification does not exist', async () => {
    (Notification.findById as jest.Mock).mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
  
    const notification = await toggleNotificationStatus(notification_id);

    expect(notification).toBeNull();
    expect(Notification.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('should throw an error if toggling notification status fails', async () => {
    const mockError = new Error('Mock database error');

    (Notification.findById as jest.Mock).mockReturnValue({ exec: jest.fn().mockRejectedValue(mockError) });

    await expect(toggleNotificationStatus(notification_id)).rejects.toThrow('Mock database error');
    expect(Notification.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});