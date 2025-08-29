import SanctionedGeoBoundary from "../../models/misc/SanctionedGeoBoundary";

export const validateSellerLocation = async (longitude: number, latitude: number) => {
	const sellCenter = {
		type: 'Point' as const,
		coordinates: [longitude, latitude],
	};

	const sanctionedLocation = await SanctionedGeoBoundary.findOne({
		geometry: {
			$geoIntersects: {
				$geometry: sellCenter
			}
		}
	}).exec();

	return sanctionedLocation;
};