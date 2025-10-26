import { Router } from 'express';
import { startWatchAdsSession, completeSegment } from '../controllers/watchAdsSessionController';
import { verifyToken } from '../middlewares/verifyToken';

const router = Router();

// start/resume endpoint
router.post('/watch-ads/session', verifyToken, startWatchAdsSession);

router.post('/watch-ads/session/:id/segment-complete', verifyToken, completeSegment);

export default router;