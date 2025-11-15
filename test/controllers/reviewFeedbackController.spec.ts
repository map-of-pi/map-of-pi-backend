import { 
  getReviews,
  getSingleReviewById,
  addReview,
  updateReview 
} from '../../src/controllers/reviewFeedbackController';
import { uploadImage } from '../../src/services/misc/image.service';
import * as reviewFeedbackService from '../../src/services/reviewFeedback.service';

jest.mock('../../src/services/reviewFeedback.service', () => ({
  getReviewFeedback: jest.fn(),
  getReviewFeedbackById: jest.fn(),
  addReviewFeedback: jest.fn(),
  updateReviewFeedback: jest.fn()
}));

jest.mock('../../src/services/misc/image.service');

describe('reviewFeedbackController', () => {
  let req: any;
  let res: any;

  describe('getReviews function', () => {
    const mockReviews = {
      givenReviews: [
        {
          _id: '64f5a0f2a86d1f9f3b7e4e81',
          review_receiver_id: '0b0b0b-0b0b-0b0b',
          review_giver_id: '0a0a0a-0a0a-0a0a',
          reply_to_review_id: null,
          giver: 'Test_A',
          receiver: 'Test_B',
          comment: '0a0a0a-0a0a-0a0a Test Review Comment',
          rating: 5,
          image: 'http://example.com/image.jpg',
          review_date: '2024-10-14T00:00:00.000Z',
        },
      ],
      receivedReviews: [
        {
          _id: '64f5a0f2a86d1f9f3b7e4e82',
          review_receiver_id: '0a0a0a-0a0a-0a0a',
          review_giver_id: '0c0c0c-0c0c-0c0c',
          reply_to_review_id: null,
          giver: 'Test_C',
          receiver: 'Test_A',
          comment: '0c0c0c-0c0c-0c0c Test Review Comment',
          rating: 3,
          image: 'http://example.com/image.jpg',
          review_date: '2024-10-15T00:00:00.000Z',
        }
      ],
    };

    beforeEach(() => {
      req = {
        params: { review_receiver_id: '0a0a0a-0a0a-0a0a' },
        query: { searchQuery: 'Test_C' }
      };
  
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
    });

    it('should get associated reviews successfully if search query is not provided', async () => {
      req.query = {}; // no search query
      
      (reviewFeedbackService.getReviewFeedback as jest.Mock).mockResolvedValue(mockReviews);

      await getReviews(req, res);

      expect(reviewFeedbackService.getReviewFeedback).toHaveBeenCalledWith('0a0a0a-0a0a-0a0a', undefined);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        givenReviews: expect.any(Array),
        receivedReviews: expect.any(Array),
      });
    });

    it('should get associated reviews successfully if search query is provided', async () => {
      (reviewFeedbackService.getReviewFeedback as jest.Mock).mockResolvedValue(mockReviews);

      await getReviews(req, res);

      expect(reviewFeedbackService.getReviewFeedback).toHaveBeenCalledWith('0a0a0a-0a0a-0a0a', 'Test_C');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        givenReviews: expect.any(Array),
        receivedReviews: expect.any(Array),
      });
    });

    it('should return appropriate [500] if retrieving reviews fails', async () => {
      req.query = {}; // no search query
      
      const mockError = new Error('An error occurred while getting reviews; please try again later');
      
      (reviewFeedbackService.getReviewFeedback as jest.Mock).mockRejectedValue(mockError);

      await getReviews(req, res);

      expect(reviewFeedbackService.getReviewFeedback).toHaveBeenCalledWith('0a0a0a-0a0a-0a0a', undefined);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: mockError.message });
    });
  });

  describe('getSingleReviewById function', () => {
    beforeEach(() => {
      req = {
        params: { review_id: 'reviewId_TEST' }
      };
  
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
    });

    it('should return [200] and the existing review on success', async () => {
      const mockExistingReview = { 
        id: 'reviewId_TEST',
        comment: 'Existing sample comment',
        rating: 3 
      };

      (reviewFeedbackService.getReviewFeedbackById as jest.Mock).mockResolvedValue(mockExistingReview);

      await getSingleReviewById(req, res);

      expect(reviewFeedbackService.getReviewFeedbackById).toHaveBeenCalledWith('reviewId_TEST');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockExistingReview);
    });

    it('should return [404] if existing single review is not found', async () => {
      (reviewFeedbackService.getReviewFeedbackById as jest.Mock).mockResolvedValue(null);

      await getSingleReviewById(req, res);

      expect(reviewFeedbackService.getReviewFeedbackById).toHaveBeenCalledWith('reviewId_TEST');
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Review not found' });
    });

    it('should return [500] on unexpected error', async () => {
      const mockError = new Error('Service layer error');
      
      (reviewFeedbackService.getReviewFeedbackById as jest.Mock).mockRejectedValue(mockError);

      await getSingleReviewById(req, res);

      expect(reviewFeedbackService.getReviewFeedbackById).toHaveBeenCalledWith('reviewId_TEST');
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ 
        message: 'An error occurred while getting single review; please try again later' 
      });
    });
  });

  describe('addReview function', () => {
    beforeEach(() => {
      req = {
        body: { 
          review_receiver_id: 'receiverId_TEST',
          comment: 'New sample comment', 
          rating: 1 
        },
        file: { } as any, // mock file
        currentUser: { pi_uid: 'piUID_TEST'}
      };
  
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
    });

    it('should return [401] if no authenticated user found', async () => {
      req.currentUser = null;

      await addReview(req, res);

      expect(uploadImage).not.toHaveBeenCalled();
      expect(reviewFeedbackService.addReviewFeedback).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorized' });
    });

    it('should return [400] if user attempts to self-review', async () => {
      req.currentUser.pi_uid = 'receiverId_TEST'; // same as review_receiver_id

      await addReview(req, res);

      expect(uploadImage).not.toHaveBeenCalled();
      expect(reviewFeedbackService.addReviewFeedback).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Self review is prohibited' });
    });

    it('should return [200] and add review successfully without image', async () => {
      req.file = null;
      const mockNewReview = {
        review_receiver_id: 'receiverId_TEST',
        comment: 'New sample comment',
        rating: 1
      };

      (reviewFeedbackService.addReviewFeedback as jest.Mock).mockResolvedValue(mockNewReview);

      await addReview(req, res);

      expect(uploadImage).not.toHaveBeenCalled();
      expect(reviewFeedbackService.addReviewFeedback).toHaveBeenCalledWith(
        req.currentUser, 
        req.body, 
        ''
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ newReview: mockNewReview });
    });

    it('should return [200] and add review successfully with image', async () => {
      const mockNewReview = {
        review_receiver_id: 'receiverId_TEST',
        comment: 'New sample comment',
        rating: 1,
        image: 'example_upload_url',
      };

      (uploadImage as jest.Mock).mockResolvedValue('example_upload_url');
      (reviewFeedbackService.addReviewFeedback as jest.Mock).mockResolvedValue(mockNewReview);

      await addReview(req, res);

      expect(uploadImage).toHaveBeenCalledWith('piUID_TEST', req.file, 'review-feedback');
      expect(reviewFeedbackService.addReviewFeedback).toHaveBeenCalledWith(
        req.currentUser, 
        req.body, 
        'example_upload_url'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ newReview: mockNewReview });
    });

    it('should return [500] on unexpected error', async () => {
      const mockError = new Error('Service layer error');
      
      (uploadImage as jest.Mock).mockResolvedValue('example_upload_url');
      (reviewFeedbackService.addReviewFeedback as jest.Mock).mockRejectedValue(mockError);

      await addReview(req, res);

      expect(uploadImage).toHaveBeenCalledWith('piUID_TEST', req.file, 'review-feedback');
      expect(reviewFeedbackService.addReviewFeedback).toHaveBeenCalledWith(
        req.currentUser, 
        req.body, 
        'example_upload_url'
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ 
        message: 'An error occurred while adding review; please try again later' 
      });
    });
  });

  describe('updateReview function', () => {
    beforeEach(() => {
      req = {
        params: { review_id: 'reviewId_TEST' },
        body: { comment: 'Updated sample comment', rating: 5 },
        file: { } as any, // mock file
        currentUser: { pi_uid: 'piUID_TEST'}
      };
  
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
    });

    it('should return [401] if no authenticated user found', async () => {
      req.currentUser = undefined;

      await updateReview(req, res);

      expect(reviewFeedbackService.updateReviewFeedback).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorized' });
    });

    it('should return [200] and updated review on success', async () => {
      const mockUpdatedReview = { 
        id: 'reviewId_TEST',
        comment: 'Updated sample comment',
        rating: 5 
      };

      (reviewFeedbackService.updateReviewFeedback as jest.Mock).mockResolvedValue(mockUpdatedReview);

      await updateReview(req, res);

      expect(reviewFeedbackService.updateReviewFeedback).toHaveBeenCalledWith(
        'reviewId_TEST',
        req.currentUser,
        { comment: req.body.comment, rating: req.body.rating },
        req.file
      )
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ updatedReview: mockUpdatedReview});
    });

    it('should return [404] if existing review is not found', async () => {
      const mockError = new Error(`Review with ID ${ req.params.review_id } not found`);
      mockError.name = 'NotFoundError';

      (reviewFeedbackService.updateReviewFeedback as jest.Mock).mockRejectedValue(mockError);

      await updateReview(req, res);

      expect(reviewFeedbackService.updateReviewFeedback).toHaveBeenCalledWith(
        'reviewId_TEST',
        req.currentUser,
        { comment: req.body.comment, rating: req.body.rating },
        req.file
      )
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: mockError.message });
    });

    it('should return [403] if user lacks permission to update the review', async () => {
      const mockError = new Error('User does not have permission to update this review');
      mockError.name = 'ForbiddenError';

      (reviewFeedbackService.updateReviewFeedback as jest.Mock).mockRejectedValue(mockError);

      await updateReview(req, res);

      expect(reviewFeedbackService.updateReviewFeedback).toHaveBeenCalledWith(
        'reviewId_TEST',
        req.currentUser,
        { comment: req.body.comment, rating: req.body.rating },
        req.file
      )
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: mockError.message });
    });

    it('should return [500] on unexpected error', async () => {
      const mockError = new Error('Service layer error');
      
      (reviewFeedbackService.updateReviewFeedback as jest.Mock).mockRejectedValue(mockError);

      await updateReview(req, res);

      expect(reviewFeedbackService.updateReviewFeedback).toHaveBeenCalledWith(
        'reviewId_TEST',
        req.currentUser,
        { comment: req.body.comment, rating: req.body.rating },
        req.file
      )
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ 
        message: 'An error occurred while updating review; please try again later' 
      });
    });
  });
});