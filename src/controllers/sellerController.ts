import { Request, Response } from "express";
import * as sellerService from "../services/seller.service";
import { uploadImage } from "../services/misc/image.service";
import * as userSettingsService from '../services/userSettings.service';
import { ISeller } from "../types";
import logger from "../config/loggingConfig";

export const fetchSellersByCriteria = async (req: Request, res: Response) => {
  try {
    const { bounds, search_query } = req.body; // bounds: [sw_lat, sw_lng, ne_lat, ne_lng]
    const userId = req.currentUser?.pi_uid;
    const sellers = await sellerService.getAllSellers(bounds, search_query, userId);

    if (!sellers || sellers.length === 0) {
      logger.warn(`No sellers found within bounds (${bounds?.sw_lat}, ${bounds?.sw_lng}) to (${bounds?.ne_lat}, ${bounds?.ne_lng}) with ${search_query}`);
      return res.status(204).json({ message: "Sellers not found" });
    }
    logger.info(`Fetched ${sellers.length} sellers within bounds (${bounds?.sw_lat}, ${bounds?.sw_lng}) to (${bounds?.ne_lat}, ${bounds?.ne_lng}) with ${search_query}`);
    return res.status(200).json(sellers);
  } catch (error) {
    logger.error('Failed to fetch sellers by criteria:', error);
    return res.status(500).json({ message: 'An error occurred while fetching sellers; please try again later' });
  }
};

export const getSingleSeller = async (req: Request, res: Response) => {
  const { seller_id } = req.params;
  try {
    const currentSeller = await sellerService.getSingleSellerById(seller_id);
    if (!currentSeller) {
      logger.warn(`Seller with ID ${seller_id} not found.`);
      return res.status(404).json({ message: "Seller not found" });
    }
    logger.info(`Fetched seller with ID ${seller_id}`);
    return res.status(200).json(currentSeller);
  } catch (error) {
    logger.error(`Failed to get single seller for sellerID ${ seller_id }:`, error);
    return res.status(500).json({ message: 'An error occurred while getting single seller; please try again later' });
  }
};

export const fetchSellerRegistration = async (req: Request, res: Response) => {
  try {
    if (!req.currentUser || !req.currentSeller) {
      logger.warn(`Seller registration not found for user ${req.currentUser?.pi_uid || "NULL"}`);
      return res.status(404).json({ message: "Seller registration not found" });
    }
    const currentSeller = req.currentSeller;
    logger.info(`Fetched seller registration for user ${req.currentUser.pi_uid}`);
    return res.status(200).json(currentSeller);
  } catch (error) {
    logger.error('Failed to fetch seller registration:', error);
    return res.status(500).json({ message: 'An error occurred while fetching seller registration; please try again later' });
  }
};

export const registerSeller = async (req: Request, res: Response) => {
  const authUser = req.currentUser;

  // Check if authUser is defined
  if (!authUser) {
    logger.warn('No authenticated user found when trying to register seller.');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const formData = req.body;
  logger.debug('Received formData for registration:', { formData });

  try {
    // Image file handling
    const file = req.file;
    const image = file ? await uploadImage(authUser.pi_uid, file, 'seller-registration') : '';
    formData.image = image;

    // Register or update seller
    const registeredSeller = await sellerService.registerOrUpdateSeller(authUser, formData);
    logger.info(`Registered or updated seller for user ${authUser.pi_uid}`);

    // Update UserSettings with email and phone_number
    const userSettings = await userSettingsService.addOrUpdateUserSettings(authUser, formData, '');
    logger.debug('UserSettings updated for user:', { pi_uid: authUser.pi_uid });

    // Send response
    return res.status(200).json({ 
      seller: registeredSeller, 
      email: userSettings.email, 
      phone_number: userSettings.phone_number 
    });
  } catch (error) {
    logger.error(`Failed to register seller for userID ${authUser.pi_uid}:`, error);
    return res.status(500).json({
      message: 'An error occurred while registering seller; please try again later',
    });
  }
};

export const deleteSeller = async (req: Request, res: Response) => {
  try {
    const authUser = req.currentUser;
    const deletedSeller = await sellerService.deleteSeller(authUser?.pi_uid);
    logger.info(`Deleted seller with ID ${authUser?.pi_uid}`);
    return res.status(200).json({ message: "Seller deleted successfully", deletedSeller });
  } catch (error) {
    logger.error(`Failed to delete seller for userID ${ req.currentUser?.pi_uid }:`, error);
    return res.status(500).json({ message: 'An error occurred while deleting seller; please try again later' });
  }
};

export const getSellerItems = async (req: Request, res: Response) => {  
  const { seller_id } = req.params
  try {
    const items = await sellerService.getAllSellerItems(seller_id);

    if (!items || items.length === 0) {
      logger.warn(`No items are found for seller: ${seller_id}`);
      return res.status(204).json({ message: 'Seller items not found' });
    }
    logger.info(`Fetched ${items.length} items for seller: ${seller_id}`);
    return res.status(200).json(items);
  } catch (error) {
    logger.error('Failed to fetch seller items:', error);
    return res.status(500).json({ message: 'An error occurred while fetching seller Items; please try again later' });
  }
};

export const addOrUpdateSellerItem = async (req: Request, res: Response) => {
  const currentSeller = req.currentSeller as ISeller;

  const formData = req.body;
  logger.debug('Received formData for seller item:', { formData });

  try {
    // Image file handling
    const file = req.file;
    const image = file ? await uploadImage(currentSeller.seller_id, file, 'seller-item') : '';
    formData.image = image;

    logger.debug('Form data being sent:', { formData });
    // Add or update Item
    const sellerItem = await sellerService.addOrUpdateSellerItem(currentSeller, formData);
    logger.info(`Added/ updated seller item for seller ${currentSeller.seller_id}`);

    // Send response
    return res.status(200).json({ sellerItem: sellerItem });
  } catch (error) {
    logger.error(`Failed to add or update seller item for userID ${currentSeller.seller_id}:`, error);
    return res.status(500).json({
      message: 'An error occurred while adding/ updating seller item; please try again later',
    });
  }
};

export const deleteSellerItem = async (req: Request, res: Response) => {
  try {
    const currentSeller = req.currentSeller as ISeller;

    const { item_id } = req.params;
    const deletedSellerItem = await sellerService.deleteSellerItem(item_id);
    logger.info(`Deleted seller item with ID ${currentSeller.seller_id}`);
    return res.status(200).json({ message: "Seller item deleted successfully", deletedSellerItem: deletedSellerItem });
  } catch (error) {
    logger.error(`Failed to delete seller item for userID ${ req.currentUser?.pi_uid }:`, error);
    return res.status(500).json({ message: 'An error occurred while deleting seller item; please try again later' });
  }
};