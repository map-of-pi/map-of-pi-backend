import { NextFunction } from "express";
import { isMembershipFound } from "../../src/middlewares/isMembershipFound";
import Membership from "../../src/models/Membership";
import { MembershipClassType } from "../../src/models/enums/membershipClassType";

jest.mock('../../src/models/Membership');

describe('isMembershipFound function', () => {
  let req: any;
  let res: any;

  const next: NextFunction = jest.fn();

  beforeEach(() => {
    req = {
      currentUser: { pi_uid: '0a0a0a-0a0a-0a0a' }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  it('should pass middleware and call next() if membership is found', async () => {
    const mockMembership = {
      _id: 'membershipID_TEST',
      pi_uid: req.currentUser.pi_uid,
      membership_class: MembershipClassType.GOLD
    };

    (Membership.findOne as jest.Mock).mockResolvedValue(mockMembership);

    await isMembershipFound(req, res, next);

    expect(Membership.findOne).toHaveBeenCalledWith({ pi_uid: '0a0a0a-0a0a-0a0a' });
    expect(req.currentMembership).toEqual(mockMembership);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 404 if membership is not found', async () => {
    (Membership.findOne as jest.Mock).mockResolvedValue(null);

    await isMembershipFound(req, res, next);

    expect(Membership.findOne).toHaveBeenCalledWith({ pi_uid: '0a0a0a-0a0a-0a0a' });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Membership not found' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 500 if an exception occurs', async () => {
    const mockError = new Error('Internal DB Error');
    (Membership.findOne as jest.Mock).mockRejectedValue(mockError);

    await isMembershipFound(req, res, next);

    expect(Membership.findOne).toHaveBeenCalledWith({ pi_uid: '0a0a0a-0a0a-0a0a' });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Failed to identify | membership not found; please try again later',
    });
    expect(next).not.toHaveBeenCalled();
  });
});