import { Router } from "express";

import * as reviewFeedbackController from "../controllers/reviewFeedbackController";
import { verifyToken } from "../middlewares/verifyToken";
import upload from "../utils/multer";

/**
 * @swagger
 * components:
 *   schemas:
 *     ReviewFeedbackSchema:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Unique ID of the review
 *         review_receiver_id:
 *           type: string
 *           description: Pi user ID of the user receiving the review
 *         review_giver_id:
 *           type: string
 *           description: Pi user ID of the user giving the review
 *         reply_to_review_id:
 *           type: string
 *           description: Unique ID of the replied review
 *         rating:
 *           $ref: '/api/docs/enum/RatingScale.yml#/components/schemas/RatingScale'
 *         comment:
 *           type: string
 *           description: Comment given in the review
 *         image:
 *           type: string
 *           description: Image associated with the review
 *         review_date:
 *           type: string
 *           format: date-time
 *           description: Date when the review was given
 */
const reviewFeedbackRoutes = Router();

/**
 * @swagger
 * /api/v1/review-feedback/{review_receiver_id}:
 *   get:
 *     tags:
 *       - Review Feedback
 *     summary: Get all associated reviews for seller according to search criteria, or all reviews if no search criteria provided
 *     parameters:
 *       - name: review_receiver_id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: The piUID of the review receiver to retrieve
 *       - name: searchQuery
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *         description: The Pi username to search
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '/api/docs/ReviewFeedbackSchema.yml#/components/schemas/GetReviewsRs'
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */
reviewFeedbackRoutes.get("/:review_receiver_id", reviewFeedbackController.getReviews);

/**
 * @swagger
 * /api/v1/review-feedback/single/{review_id}:
 *   get:
 *     tags:
 *       - Review Feedback
 *     summary: Get a single review by review ID
 *     parameters:
 *       - name: review_id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the review to retrieve
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '/api/docs/ReviewFeedbackSchema.yml#/components/schemas/GetSingleReviewRs'
 *       404:
 *         description: Review not found
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */
reviewFeedbackRoutes.get("/single/:review_id", reviewFeedbackController.getSingleReviewById);

/**
 * @swagger
 * /api/v1/review-feedback/add:
 *   post:
 *     tags:
 *       - Review Feedback
 *     summary: Add a new review *
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '/api/docs/ReviewFeedbackSchema.yml#/components/schemas/AddReviewRq'
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '/api/docs/ReviewFeedbackSchema.yml#/components/schemas/AddReviewRs'
 *       401:
 *         description: Unauthorized
 *       400:
 *         description: Self review is prohibited
 *       500:
 *         description: Internal server error
 */
reviewFeedbackRoutes.post(
  "/add",
  verifyToken,
  upload.single("image"),
  reviewFeedbackController.addReview
);

/**
 * @swagger
 * /api/v1/review-feedback/update/{review_id}:
 *   put:
 *     tags:
 *       - Review Feedback
 *     summary: Update an existing review *
 *     parameters:
 *       - name: review_id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the review to update
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               comment:
 *                 type: string
 *                 example: This is a sample updated review comment.
 *               rating:
 *                 $ref: '/api/docs/enum/RatingScale.yml#/components/schemas/RatingScale'
 *               image:
 *                 type: string
 *                 format: binary
 *                 example: http://example.com/new-image.jpg
 *             required:
 *               - comment
 *               - rating
 *     responses:
 *       200:
 *         description: Successful response
 *       404:
 *         description: Review not found
 *       403:
 *         description: Forbidden
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
reviewFeedbackRoutes.put(
  "/update/:review_id",
  verifyToken,
  upload.single("image"),
  reviewFeedbackController.updateReview
);
/**
 * @swagger
 * /api/v1/review-feedback/trust-protect/{review_id}:
 *   put:
 *     tags:
 *       - Review Feedback
 *     summary: Apply Trust Protect on a review (admin/moderation action)
 *     parameters:
 *       - name: review_id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the review to apply Trust Protect on
 *     responses:
 *       200:
 *         description: Trust Protect applied successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Review not found
 *       500:
 *         description: Internal server error
 */
reviewFeedbackRoutes.put(
  "/trust-protect/:review_id",
  verifyToken,
  reviewFeedbackController.applyTrustProtect
);

export default reviewFeedbackRoutes;