import cloudinary from '../../utils/cloudinary';
import logger from '../../config/loggingConfig';

export const uploadImage = async (publicId: string, file: Express.Multer.File, folder: string) => {
  try {
    const result = await cloudinary.uploader.upload(file.path, {
      folder: folder,
      public_id: publicId,
      resource_type: 'image',
      overwrite: true
    });
    logger.info('Image has been uploaded successfully');
    return result.secure_url;
  } catch (error: any) {
    logger.error(`Failed to upload image: ${ error }`);
    throw error;
  }
};
