import { Request, Response } from "express";

import * as reviewFeedbackService from "../services/reviewFeedback.service";
import { uploadImage } from "../services/misc/image.service";

import logger from "../config/loggingConfig";
import * as notificationService from "../services/notification.service";


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
    const existingReview = await reviewFeedbackService.getReviewFeedbackById(review_id);
    if (!existingReview) {
      logger.warn(`Review with ID ${review_id} not found.`);
      return res.status(404).json({ message: "Review not found" });
    }
    logger.info(`Retrieved review with ID ${review_id}`);
    res.status(200).json(existingReview);
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
    const { review_id } = req.params;

    if (!authUser) {
      logger.warn("No authenticated user found for updating review.");
      return res.status(401).json({ message: "Unauthorized" });
    }

    const updatedReview = await reviewFeedbackService.updateReviewFeedback(
      review_id,
      authUser,
      { comment: req.body.comment, rating: req.body.rating },
      req.file
    );

    return res.status(200).json({ updatedReview });
  } catch (error: any) {
    if (error.name === "NotFoundError") {
      return res.status(404).json({ message: error.message });
    }
    if (error.name === "ForbiddenError") {
      return res.status(403).json({ message: error.message });
    }
    logger.error(`Failed to update review for userID ${req.currentUser?.pi_uid}:`, error);
    return res.status(500).json({ message: 'An error occurred while updating review; please try again later' });
  }
};
export const applyTrustProtect = async (req: Request, res: Response) => {
  try {
    const authUser = req.currentUser;
    const { review_id } = req.params;

    if (!authUser) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const updatedReview = await reviewFeedbackService.applyTrustProtect(review_id, authUser);

    // ✅ Send notification if Trust Protect changed rating to SAD
    if (updatedReview && updatedReview.rating === 2) {
      await notificationService.addNotification(
        updatedReview.review_giver_id,
        `Your review has been adjusted by Trust Protect you can reverse back the rating in the review screen.`
      );
      logger.info(
        `Notification sent to review giver ${updatedReview.review_giver_id} for Trust Protect adjustment.`
      );
    }

    return res.status(200).json({
      message: "Trust Protect applied successfully",
      updatedReview,
    });
  } catch (error: any) {
    logger.error(
      `Failed to apply Trust Protect for review ${req.params.review_id}:`,
      error
    );
    return res.status(500).json({ message: "Failed to apply Trust Protect" });
  }
};
