import { uploadImage } from "./misc/image.service";
import { getUser } from "./user.service";
import ReviewFeedback from "../models/ReviewFeedback";
import User from "../models/User";
import UserSettings from "../models/UserSettings";
import { IReviewFeedback, IUser, IReviewFeedbackOutput, CompleteFeedback } from "../types";

import logger from "../config/loggingConfig";

/**
  The value is set depending on the number of zero(0) ratings in the ReviewFeedback table where this user is review-receiver. 
  IF user has less than or equal to 5% zero ratings THEN set it to 100. 
  IF user has 5.01%-10% zero ratings THEN set it to 80. 
  IF user has 10.01%-20% zero ratings THEN set it to 50. 
  IF user has more than 20.01% zero ratings THEN set it to 0.
  When the User Registration screen is first used (before the users User record has been created) 
  then the value of “100” is displayed and saved to the DB.
**/
const computeRatings = async (user_settings_id: string) => {
  try {
    // Fetch all reviews for the user
    const reviewFeedbackCount = await ReviewFeedback.countDocuments({ review_receiver_id: user_settings_id }).exec();
    if (reviewFeedbackCount === 0) {
      // Default value when there are no reviews
      await UserSettings.findOneAndUpdate({ user_settings_id }, { trust_meter_rating: 100 }).exec();
      return 100;
    }
    // Calculate the total number of reviews and the number of zero ratings
    const totalReviews = reviewFeedbackCount
    const zeroRatingsCount = await ReviewFeedback.countDocuments({ review_receiver_id: user_settings_id, rating: 0 }).exec();

    // Calculate the percentage of zero ratings
    const zeroRatingsPercentage = (zeroRatingsCount / totalReviews) * 100;

    // Determine the value based on the percentage of zero ratings
    let value;
    switch (true) {
      case (zeroRatingsPercentage <= 5):
        value = 100;
        break;
      case (zeroRatingsPercentage > 5 && zeroRatingsPercentage <= 10):
        value = 80;
        break;
      case (zeroRatingsPercentage > 10 && zeroRatingsPercentage <= 20):
        value = 50;
        break;
      default:
        value = 0;
    }

    // Update the user's rating value in the database
    await UserSettings.findOneAndUpdate({ user_settings_id }, { trust_meter_rating: value });
    return value;
  } catch (error: any) {
    logger.error(`Failed to compute ratings for userSettingsID ${ user_settings_id }: ${ error }`);
    throw error;
  }
};

export const getReviewFeedback = async (
  review_receiver_id: string, 
  searchQuery?: string 
): Promise<CompleteFeedback | null> => {
  try {
    //condition to search by username
    if (searchQuery && searchQuery.trim()) {
      const user = await User.findOne({
        pi_username: searchQuery
      });
      if (!user) {
        return null;
      }
      review_receiver_id = user.pi_uid;
    }

    const receivedFeedbackList = await ReviewFeedback.find({
      review_receiver_id: review_receiver_id
    }).sort({ review_date: -1 }).exec();

    const givenFeedbackList = await ReviewFeedback.find({
      review_giver_id: review_receiver_id
    }).sort({ review_date: -1 }).exec();

    const updatedReceivedFeedbackList = await Promise.all(
      receivedFeedbackList.map(async (reviewFeedback) => {
        // Retrieve user details for both giver and receiver
        const reviewer = await getUser(reviewFeedback.review_giver_id);
        const receiver = await getUser(reviewFeedback.review_receiver_id);

        const giverName = reviewer ? reviewer.user_name : '';
        const receiverName = receiver ? receiver.user_name : '';

        // Return the updated review feedback object
        return { ...reviewFeedback.toObject(), giver: giverName, receiver: receiverName };
      })
    );

    const updatedGivenFeedbackList = await Promise.all(
      givenFeedbackList.map(async (reviewFeedback) => {
        // Retrieve user details for both giver and receiver
        const reviewer = await getUser(reviewFeedback.review_giver_id);
        const receiver = await getUser(reviewFeedback.review_receiver_id);

        const giverName = reviewer ? reviewer.user_name : '';
        const receiverName = receiver ? receiver.user_name : '';

        // Return the updated review feedback object
        return { ...reviewFeedback.toObject(), giver: giverName, receiver: receiverName };
      })
    );
    return {
      givenReviews: updatedGivenFeedbackList,
      receivedReviews: updatedReceivedFeedbackList
    } as unknown as CompleteFeedback;

  } catch (error: any) {
    logger.error(`Failed to retrieve reviews for reviewReceiverID ${ review_receiver_id }: ${ error }`);
    throw error;
  }
};

export const getReviewFeedbackById = async (review_id: string): Promise<{
  review: IReviewFeedbackOutput | null;
  replies: IReviewFeedbackOutput[];
} | null> => {
  try {
    // Find the main review by ID
    const reviewFeedback = await ReviewFeedback.findById(review_id).exec();

    if (!reviewFeedback) {
      logger.warn(`No review found with ID: ${review_id}`);
      return null;
    }

    // Fetch replies to the main review
    const replies = await ReviewFeedback.find({ reply_to_review_id: review_id }).exec();

    // Fetch giver and receiver names for each reply asynchronously
    const updatedReplyList = await Promise.all(
      replies.map(async (reply) => {
        const [reviewer, receiver] = await Promise.all([
          getUser(reply.review_giver_id),
          getUser(reply.review_receiver_id),
        ]);

        const giverName = reviewer?.user_name || 'Unknown';
        const receiverName = receiver?.user_name || 'Unknown';

        // Return updated reply object
        return { ...reply.toObject(), giver: giverName, receiver: receiverName };
      })
    );

    // Fetch giver and receiver names for the main review
    const [reviewer, receiver] = await Promise.all([
      getUser(reviewFeedback.review_giver_id),
      getUser(reviewFeedback.review_receiver_id),
    ]);

    const giverName = reviewer?.user_name || 'Unknown';
    const receiverName = receiver?.user_name || 'Unknown';

    // Create the main review object with giver and receiver names
    const mainReview = { ...reviewFeedback.toObject(), giver: giverName, receiver: receiverName };

    return {
      review: mainReview as unknown as IReviewFeedbackOutput,
      replies: updatedReplyList as unknown as IReviewFeedbackOutput[],
    };
  } catch (error: any) {
    logger.error(`Failed to retrieve review for reviewID ${ review_id }: ${ error }`);
    throw error;
  }
};

export const addReviewFeedback = async (authUser: IUser, formData: any, image: string): Promise<IReviewFeedback> => {
  try {
    const reviewFeedbackData: Partial<IReviewFeedback> = {
      review_receiver_id: formData.review_receiver_id || '',
      review_giver_id: authUser.pi_uid,
      reply_to_review_id: formData.reply_to_review_id || null,
      rating: formData.rating || '',
      comment: formData.comment || '',
      image: image || '',
      review_date: new Date()
    };
    const newReviewFeedback = new ReviewFeedback(reviewFeedbackData);
    const savedReviewFeedback = await newReviewFeedback.save();

    const computedValue = await computeRatings(savedReviewFeedback.review_receiver_id);
    logger.info(`Computed review rating: ${computedValue}`);

    return savedReviewFeedback as IReviewFeedback;
  } catch (error: any) {
    logger.error(`Failed to add review: ${ error }`);
    throw error;
  }
};

export const updateReviewFeedback = async (
  reviewId: string,
  authUser: IUser,
  formData: any,
  file?: Express.Multer.File
): Promise<IReviewFeedback | null> => {
  const review = await ReviewFeedback.findById(reviewId);

  if (!review) {
    const error = new Error(`Review with ID ${reviewId} not found`);
    error.name = "NotFoundError";
    throw error;
  }

  if (review.review_giver_id !== authUser.pi_uid) {
    const error = new Error(`User with ID: ${ review.review_giver_id } does not have permission to update this review`);
    error.name = "ForbiddenError";
    throw error;
  }

  // Update fields
  if (formData.rating !== undefined) review.rating = formData.rating;
  if (formData.comment !== undefined) review.comment = formData.comment;

  // Handle image (keep existing unless a new file is uploaded)
  if (file) {
    review.image = await uploadImage(authUser.pi_uid, file, "review-feedback");
  }

  await review.save();

  await computeRatings(review.review_receiver_id);

  logger.info(`Review ${reviewId} updated successfully by user ${authUser.pi_uid}`);
  return review as IReviewFeedback;
};