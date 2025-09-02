import { Request, Response } from "express";

import * as reviewFeedbackService from "../services/reviewFeedback.service";
import { uploadImage } from "../services/misc/image.service";

import logger from "../config/loggingConfig";

export const getReviews = async (req: Request, res: Response) => {
  const { review_receiver_id } = req.params;
  const { searchQuery } = req.query;

  try {
    // Call the service with the review_receiver_id and searchQuery
    const completeReviews = await reviewFeedbackService.getReviewFeedback(
      review_receiver_id, 
      searchQuery as string
    );

    logger.info(`Retrieved reviews for receiver ID ${review_receiver_id} with search query "${searchQuery ?? 'none'}"`);
    return res.status(200).json(completeReviews);
  } catch (error) {
    logger.error(`Failed to get reviews for receiverID ${review_receiver_id}:`, error);
    return res.status(500).json({ message: 'An error occurred while getting reviews; please try again later' });
  }
};

export const getSingleReviewById = async (req: Request, res: Response) => {
  const { review_id } = req.params;
  try {
    const associatedReview = await reviewFeedbackService.getReviewFeedbackById(review_id);
    if (!associatedReview) {
      logger.warn(`Review with ID ${review_id} not found.`);
      return res.status(404).json({ message: "Review not found" });
    }
    logger.info(`Retrieved review with ID ${review_id}`);
    res.status(200).json(associatedReview);
  } catch (error) {
    logger.error(`Failed to get review for reviewID ${ review_id }:`, error);
    return res.status(500).json({ message: 'An error occurred while getting single review; please try again later' });
  }
};

export const addReview = async (req: Request, res: Response) => {
  try {
    const authUser = req.currentUser;
    const formData = req.body;

    if (!authUser) {
      logger.warn("No authenticated user found for adding review.");
      return res.status(401).json({ message: "Unauthorized" });
    } else if (authUser.pi_uid === formData.review_receiver_id) {
      logger.warn(`Attempted self review by user ${authUser.pi_uid}`);
      return res.status(400).json({ message: "Self review is prohibited" });
    }

    // image file handling
    const file = req.file;
    const image = file ? await uploadImage(authUser.pi_uid, file, 'review-feedback') : '';

    const newReview = await reviewFeedbackService.addReviewFeedback(authUser, formData, image);
    logger.info(`Added new review by user ${authUser.pi_uid} for receiver ID ${newReview.review_receiver_id}`);
    return res.status(200).json({ newReview });
  } catch (error) {
    logger.error(`Failed to add review for userID ${ req.currentUser?.pi_uid }:`, error);
    return res.status(500).json({ message: 'An error occurred while adding review; please try again later' });
  }
};

export const updateReview = async (req: Request, res: Response) => {
  try {
    const authUser = req.currentUser;
    const { reviewId } = req.params;
    const { comment, rating } = req.body;

    if (!authUser) {
      logger.warn("No authenticated user found for updating review.");
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Fetch existing review
    const existingReviewData = await reviewFeedbackService.getReviewFeedbackById(reviewId);
    if (!existingReviewData || !existingReviewData.review) {
      logger.warn(`Review with ID ${reviewId} not found for update.`);
      return res.status(404).json({ message: "Review not found" });
    }

    const existingReview = existingReviewData.review;

    // Ensure user owns this review
    if (existingReview.review_giver_id !== authUser.pi_uid) {
      logger.warn(`User ${authUser.pi_uid} attempted to update review ${reviewId} without permission.`);
      return res.status(403).json({ message: "You do not have permission to update this review" });
    }

    // Handle image
    let image = existingReview.image;
    if (req.file) {
      image = await uploadImage(authUser.pi_uid, req.file, 'review-feedback');
    }

    // Call service with correct arguments
    const updatedReview = await reviewFeedbackService.updateReviewFeedback(
      reviewId,
      authUser,
      { comment: comment ?? existingReview.comment, rating: rating ?? existingReview.rating },
      image
    );

    logger.info(`Updated review ${reviewId} by user ${authUser.pi_uid}`);
    return res.status(200).json({ updatedReview });
  } catch (error) {
    logger.error(`Failed to update review for userID ${req.currentUser?.pi_uid}:`, error);
    return res.status(500).json({ message: 'An error occurred while updating review; please try again later' });
  }
};