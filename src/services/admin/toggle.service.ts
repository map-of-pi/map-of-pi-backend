import Toggle from "../../models/misc/Toggle";
import { IToggle } from "../../types";

import logger from "../../config/loggingConfig";

export const getToggles = async (): Promise<IToggle[]> => {
  try {
    const toggles = await Toggle.find().sort({ createdAt: -1 }).exec();
    logger.info(`Successfully retrieved ${toggles.length} toggle(s)`);    
    return toggles;
  } catch (error: any) {
    logger.error(`Failed to retrieve toggles: ${ error }`);
    throw error;
  }
};

export const getToggleByName = async (name: string): Promise<IToggle | null> => {
  try {
    const toggle = await Toggle.findOne({ name }).exec();    
    return toggle ? toggle as IToggle : null;
  } catch (error: any) {
    logger.error(`Failed to retrieve toggle with identifier ${ name }: ${ error }`);
    throw error;
  }
};

export const addToggle = async (toggleData: IToggle): Promise<IToggle> => {
  try {
    // Check if a toggle with the same name already exists
    const existingToggle = await Toggle.findOne({ name: toggleData.name }).exec();
    if (existingToggle) {
      throw new Error(`A toggle with the identifier ${toggleData.name} already exists.`);
    }

    // Create the new toggle instance
    const newToggle = new Toggle({
      ...toggleData
    });
    const savedToggle = await newToggle.save();
    return savedToggle as IToggle;
  } catch (error: any) {
    if (error.message.includes('already exists')) {
      throw error;
    }
    logger.error(`Failed to add toggle: ${ error }`);
    throw error;
  }
};

export const updateToggle = async (
  name: string, 
  enabled: boolean, 
  description?: string
): Promise<IToggle> => {
  try {
    const updateData: any = { enabled };

    // Only update the description if it's provided and not an empty string
    if (description !== undefined && description !== '') {
      updateData.description = description;
    }

    // Find and update the toggle by name
    const updatedToggle = await Toggle.findOneAndUpdate(
      { name },
      { $set: updateData },
      { new: true }
    ).exec();

    if (!updatedToggle) {
      throw new Error(`A toggle with the identifier ${name} does not exist.`);
    }

    logger.info('Toggle successfully updated in the database:', updatedToggle);
    return updatedToggle as IToggle;
  } catch (error: any) {
    if (error.message.includes('does not exist')) {
      throw error;
    }
    logger.error(`Failed to update toggle: ${ error }`);
    throw error;
  }
};

export const deleteToggleByName = async (name: string): Promise<IToggle | null> => {
  try {
    const deletedToggle = await Toggle.findOneAndDelete({ name }).exec();
    
    if (!deletedToggle) {
      logger.warn(`A toggle with the identifier ${name} does not exist.`);
      return null;
    }
    logger.info('Toggle successfully deleted in the database:', deletedToggle);
    return deletedToggle as IToggle;
  } catch (error: any) {
    logger.error(`Failed to delete toggle with identifier ${ name }: ${ error }`);
    throw error;
  }
};