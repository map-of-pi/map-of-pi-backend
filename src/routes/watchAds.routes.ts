import { Router } from 'express';
import { startWatchAdsSession } from '../controllers/watchAdsSessionController';
import { verifyToken } from '../middlewares/verifyToken';

const router = Router();

// start/resume endpoint
router.post('/watch-ads/session', verifyToken, startWatchAdsSession);

export default router;