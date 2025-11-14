import ReviewFeedback from '../../src/models/ReviewFeedback';
import User from '../../src/models/User';
import UserSettings from '../../src/models/UserSettings';
import { 
  getReviewFeedback, 
  getReviewFeedbackById, 
  addReviewFeedback,
  updateReviewFeedback 
} from '../../src/services/reviewFeedback.service';
import { uploadImage } from '../../src/services/misc/image.service';
import { IReviewFeedback, IUser } from '../../src/types';

jest.mock('../../src/services/misc/image.service', () => ({
  uploadImage: jest.fn()
}));

describe('getReviewFeedback function', () => {
  // Helper function to convert Mongoose documents to plain objects
  const convertToPlainObjects = async (reviews: IReviewFeedback[]): Promise<any[]> => {
    return await Promise.all(reviews.map(async (review) => {
      const reviewer = await User.findOne({ pi_uid: review.review_giver_id });
      const receiver = await User.findOne({ pi_uid: review.review_receiver_id });
      
      return {
        ...review.toObject(),
        giver: reviewer ? reviewer.user_name : '',
        receiver: receiver ? receiver.user_name : '',
      };
    }));
  };

  it('should return associated reviews if search query is not provided', async () => {
    const reviewsReceivedData = await ReviewFeedback.find({
      review_receiver_id: '0a0a0a-0a0a-0a0a'
    }).sort({ review_date: -1 }).exec() as IReviewFeedback[];

    const reviewsGivenData = await ReviewFeedback.find({
      review_giver_id: '0a0a0a-0a0a-0a0a'
    }).sort({ review_date: -1 }).exec() as IReviewFeedback[];
    
    const result = await getReviewFeedback('0a0a0a-0a0a-0a0a', '');

    // Convert Mongoose documents to plain objects
    const plainReviewsReceivedData = await convertToPlainObjects(reviewsReceivedData);
    const plainReviewsGivenData = await convertToPlainObjects(reviewsGivenData);

    expect(result).toEqual({
      receivedReviews: plainReviewsReceivedData,
      givenReviews: plainReviewsGivenData
    });
  });

  it('should return associated reviews if search query is provided', async () => {
    const usersData = await User.findOne({
      pi_username: "TestUser2"
    });
    
    const reviewsReceivedData = await ReviewFeedback.find({
      review_receiver_id: usersData?.pi_uid
    }).sort({ review_date: -1 }).exec() as IReviewFeedback[];

    const reviewsGivenData = await ReviewFeedback.find({
      review_giver_id: usersData?.pi_uid
    }).sort({ review_date: -1 }).exec() as IReviewFeedback[];
    
    const result = await getReviewFeedback('0a0a0a-0a0a-0a0a', 'TestUser2');

    const plainReviewsReceivedData = await convertToPlainObjects(reviewsReceivedData);
    const plainReviewsGivenData = await convertToPlainObjects(reviewsGivenData);

    expect(result).toEqual({
      receivedReviews: plainReviewsReceivedData,
      givenReviews: plainReviewsGivenData
    });
  });

  it('should return no reviews if search query is provided but user is not found', async () => {
    const result = await getReviewFeedback('receiver-id', '0?0?0?-0?0?-0?0?');

    expect(result).toBeNull();
  });

  it('should throw error if reviews cannot be fetched successfully due to processing failure', async () => {   
    jest.spyOn(ReviewFeedback, 'find').mockImplementationOnce(() => {
      throw new Error('Mock database error');
    });

    await expect(getReviewFeedback('0a0a0a-0a0a-0a0a', '')).rejects.toThrow('Mock database error');
  });
});

describe('getReviewFeedbackById function', () => {
  it('should return the main review and its associated replies', async () => {
    const usersData = await User.find();

    const reviewData = await ReviewFeedback.findOne({
      _id: '64f5a0f2a86d1f9f3b7e4e81' 
    }) as IReviewFeedback;

    const reviewRepliesData = await ReviewFeedback.find({
      reply_to_review_id: reviewData._id
    }) as IReviewFeedback[];

    const result = await getReviewFeedbackById(reviewData._id.toString());

    // Convert Mongoose documents to plain objects
    const plainReviewData = reviewData.toObject();
    const plainReviewRepliesData = reviewRepliesData
      .map(reply => reply.toObject());

    // Assertions for the main review
    expect(result?.review).toMatchObject({
      ...plainReviewData,
      giver: usersData[1].user_name,
      receiver: usersData[0].user_name,
      comment: '0b0b0b-0b0b-0b0b Test Review Comment',
      rating: 5
    });

    // Assertions for the replies
    expect(result?.replies).toHaveLength(2);
    expect(result?.replies[0]).toMatchObject({
      ...plainReviewRepliesData[0],
      giver: usersData[2].user_name,
      receiver: usersData[0].user_name,
      comment: '0c0c0c-0c0c-0c0c Test Reply Comment',
      rating: 4,
    });
    expect(result?.replies[1]).toMatchObject({
      ...plainReviewRepliesData[1],
      giver: usersData[3].user_name,
      receiver: usersData[0].user_name,
      comment: '0d0d0d-0d0d-0d0d Test Reply Comment',
      rating: 3,
    });
  });
});

describe('addReviewFeedback function', () => {
  let userData: IUser;

  const formData = {
    review_receiver_id: '0e0e0e-0e0e-0e0e',
    review_giver_id: '0a0a0a-0a0a-0a0a',
    reply_to_review_id: null,
    rating: '5',
    comment: '0a0a0a-0a0a-0a0a Test Review Comment',
    image: 'http://example.com/image_new.jpg'
  };

  beforeEach(async () => {
    userData = await User.findOne({ pi_uid: '0a0a0a-0a0a-0a0a' }) as IUser;
  });

  afterEach(async () => {
    // Clear and reset collections after each test
    await ReviewFeedback.deleteMany({});
  });

  // Helper function to add review feedback
  const addReviewAndAssert = async () => {
    const reviewFeedbackData = await addReviewFeedback(userData, formData, formData.image);

    // Assert common fields of review feedback
    expect(reviewFeedbackData).toEqual(expect.objectContaining({
      review_receiver_id: formData.review_receiver_id,
      review_giver_id: userData.pi_uid,
      reply_to_review_id: formData.reply_to_review_id,
      rating: Number(formData.rating),
      comment: formData.comment,
      image: formData.image
    }));
  };

  // Helper function to assert the computed trust meter rating
  const assertComputedRating = async (expectedRating: number) => {
    const updatedUserSettings = await UserSettings.findOne({ user_settings_id: formData.review_receiver_id });
    expect(updatedUserSettings?.trust_meter_rating).toBe(expectedRating);
  };

  it('should add new review feedback and compute ratings correctly with less than or equal to 5% zero ratings', async () => {
    await addReviewAndAssert();
    await assertComputedRating(100);
  });

  it('should add new review feedback and compute ratings correctly with 5.01%-10% zero ratings', async () => {
    await ReviewFeedback.insertMany([
      { review_receiver_id: '0e0e0e-0e0e-0e0e', review_giver_id: '0a0a0a-0a0a-0a0a', rating: 0, comment: 'First Zero Rating', review_date: new Date() },
      { review_receiver_id: '0e0e0e-0e0e-0e0e', review_giver_id: '0b0b0b-0b0b-0b0b', rating: 5, comment: 'First Non-Zero Rating', review_date: new Date() },
      { review_receiver_id: '0e0e0e-0e0e-0e0e', review_giver_id: '0c0c0c-0c0c-0c0c', rating: 5, comment: 'Second Non-Zero Rating', review_date: new Date() },
      { review_receiver_id: '0e0e0e-0e0e-0e0e', review_giver_id: '0d0d0d-0d0d-0d0d', rating: 5, comment: 'Third Non-Zero Rating', review_date: new Date() },
      { review_receiver_id: '0e0e0e-0e0e-0e0e', review_giver_id: '0e0e0e-0e0e-0e0e', rating: 5, comment: 'Fourth Non-Zero Rating', review_date: new Date() },
      { review_receiver_id: '0e0e0e-0e0e-0e0e', review_giver_id: '0f0f0f-0f0f-0f0f', rating: 5, comment: 'Fifth Non-Zero Rating', review_date: new Date() },
      { review_receiver_id: '0e0e0e-0e0e-0e0e', review_giver_id: '0g0g0g-0g0g-0g0g', rating: 4, comment: 'Sixth Non-Zero Rating', review_date: new Date() },
      { review_receiver_id: '0e0e0e-0e0e-0e0e', review_giver_id: '0h0h0h-0h0h-0h0h', rating: 4, comment: 'Seventh Non-Zero Rating', review_date: new Date() },
      { review_receiver_id: '0e0e0e-0e0e-0e0e', review_giver_id: '0i0i0i-0i0i-0i0i', rating: 4, comment: 'Eighth Non-Zero Rating', review_date: new Date() }
    ]);

    await addReviewAndAssert();
    await assertComputedRating(80);
  });

  it('should add new review feedback and compute ratings correctly with 5%-10% zero ratings', async () => {
    await ReviewFeedback.insertMany([
      { review_receiver_id: '0e0e0e-0e0e-0e0e', review_giver_id: '0a0a0a-0a0a-0a0a', rating: 0, comment: 'First Zero Rating', review_date: new Date() },
      { review_receiver_id: '0e0e0e-0e0e-0e0e', review_giver_id: '0b0b0b-0b0b-0b0b', rating: 5, comment: 'First Non-Zero Rating', review_date: new Date() },
      { review_receiver_id: '0e0e0e-0e0e-0e0e', review_giver_id: '0c0c0c-0c0c-0c0c', rating: 5, comment: 'Second Non-Zero Rating', review_date: new Date() },
      { review_receiver_id: '0e0e0e-0e0e-0e0e', review_giver_id: '0d0d0d-0d0d-0d0d', rating: 5, comment: 'Third Non-Zero Rating', review_date: new Date() }
    ]);

    await addReviewAndAssert();
    await assertComputedRating(50);
  });

  it('should add new review feedback and compute ratings correctly with more than 10% zero ratings', async () => {
    await ReviewFeedback.insertMany([
      { review_receiver_id: '0e0e0e-0e0e-0e0e', review_giver_id: '0a0a0a-0a0a-0a0a', rating: 0, comment: 'First Zero Rating', review_date: new Date() },
      { review_receiver_id: '0e0e0e-0e0e-0e0e', review_giver_id: '0b0b0b-0b0b-0b0b', rating: 5, comment: 'First Non-Zero Rating', review_date: new Date() },
      { review_receiver_id: '0e0e0e-0e0e-0e0e', review_giver_id: '0c0c0c-0c0c-0c0c', rating: 5, comment: 'Second Non-Zero Rating', review_date: new Date() }
    ]);

    await addReviewAndAssert();
    await assertComputedRating(0);
  });
});

describe('updateReviewFeedback function', () => {
  const mockAuthUser = { pi_uid: 'piUID_TEST' };
  const mockReviewId = 'reviewId_TEST';
  let mockReview: any;

  beforeEach(() => {
    mockReview = {
      _id: mockReviewId,
      review_giver_id: 'piUID_TEST',
      review_receiver_id: 'receiverId_TEST',
      comment: 'Existing comment',
      rating: 2,
      image: 'example_existing_url',
    };
  });

  it('should throw NotFoundError if review does not exist', async () => {
    jest.spyOn(ReviewFeedback, 'findById').mockReturnValue({
      exec: jest.fn().mockResolvedValue(null)
    } as any);

    await expect(updateReviewFeedback(
      mockReviewId, 
      mockAuthUser as IUser, 
      { rating: 5, comment: 'Updated comment', image: 'http://example.com/image_new.jpg' }))
      .rejects.toMatchObject({ 
        name: 'NotFoundError', 
        message: `Review with ID ${mockReviewId} not found` 
      });
  });

  it('should throw ForbiddenError if user is not the expected review giver', async () => {
    mockReview.review_giver_id = 'giverId2_TEST';
    
    jest.spyOn(ReviewFeedback, 'findById').mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockReview)
    } as any);
    
    await expect(updateReviewFeedback(
      mockReviewId, 
      mockAuthUser as IUser, 
      { rating: 5, comment: 'Updated comment', image: 'http://example.com/image_new.jpg' }))
      .rejects.toMatchObject({ 
        name: 'ForbiddenError', 
        message: `User with ID: ${mockReview.review_giver_id} does not have permission to update this review` 
      });
  });

  it('should update the existing review without new image', async () => {
    const saveMock = jest.fn().mockResolvedValue(true);

    jest.spyOn(ReviewFeedback, 'findById').mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        ...mockReview,
        save: saveMock
      })
    } as any);
    
    const updatedFormData = { rating: 5, comment: 'Updated comment w/o image' };

    const updatedReview = await updateReviewFeedback(
      mockReviewId, 
      mockAuthUser as IUser, 
      updatedFormData
    );

    expect(updatedReview?.rating).toBe(updatedFormData.rating);
    expect(updatedReview?.comment).toBe(updatedFormData.comment);
    expect(updatedReview?.image).toBe('example_existing_url');
    expect(uploadImage).not.toHaveBeenCalled();
    expect(saveMock).toHaveBeenCalled();
    // TODO: test computeRatings helper function.
  });

  it('should update the existing review with new image', async () => {
    const newImageUrl = 'example_new_url'
    const mockFile = { buffer: Buffer.from('example-image') } as Express.Multer.File; 
    
    const saveMock = jest.fn().mockResolvedValue(true);

    jest.spyOn(ReviewFeedback, 'findById').mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        ...mockReview,
        save: saveMock
      })
    } as any);

    (uploadImage as jest.Mock).mockResolvedValue(newImageUrl);
    
    const updatedFormData = { rating: 5, comment: 'Updated comment w/ image' };

    const updatedReview = await updateReviewFeedback(
      mockReviewId, 
      mockAuthUser as IUser, 
      updatedFormData,
      mockFile
    );

    expect(updatedReview?.rating).toBe(updatedFormData.rating);
    expect(updatedReview?.comment).toBe(updatedFormData.comment);
    expect(updatedReview?.image).toBe(newImageUrl);
    expect(uploadImage).toHaveBeenCalledWith(mockAuthUser.pi_uid, mockFile, 'review-feedback');
    expect(saveMock).toHaveBeenCalled();
    // TODO: test computeRatings helper function.
  });
});