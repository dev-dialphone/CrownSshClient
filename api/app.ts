/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import session from 'express-session'
import MongoStore from 'connect-mongo'
import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import helmet from 'helmet'
import compression from 'compression'
import { rateLimit } from 'express-rate-limit'
import morgan from 'morgan'
import logger from './utils/logger.js'
import { AppError } from './utils/AppError.js'
import { User } from './models/User.js'
import { ipWhitelist } from './middleware/ipWhitelist.js'
import { Setting } from './models/Setting.js'
import { initWebPush } from './services/pushService.js'
import { startHealthMonitor } from './services/healthService.js'

import authRoutes from './routes/auth.js'
import vmRoutes from './routes/vms.js'
import environmentRoutes from './routes/environments.js'
import executionRoutes from './routes/execution.js'
import totpRoutes from './routes/totp.js'
import settingsRoutes from './routes/settings.js'
import accessRequestsRoutes from './routes/accessRequests.js'
import auditLogsRoutes from './routes/auditLogs.js'
import pushRoutes from './routes/push.js'

const app: express.Application = express()

// Trust exactly 1 proxy hop (the Nginx container in front of this backend)
app.set('trust proxy', 1);

// Auth routes are EXEMPT from IP whitelist so users can authenticate from any IP
// The role-aware whitelist is applied later (post-session) to data/API routes.

// Basic security & performance middleware
app.use(helmet())
app.use(compression())

// Request logging via Morgan and Winston
const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat, {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

app.use(cors({
  origin: [
    process.env.FRONTEND_URL,
    process.env.VITE_API_URL
  ].filter(Boolean) as string[],
  credentials: true
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Rate limiting for auth routes to prevent brute force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Session config
app.use(session({
  proxy: true, // Required for secure cookies behind a proxy
  secret: process.env.SESSION_SECRET || 'keyboard cat',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.mongo,
    collectionName: 'sessions',
    ttl: 14 * 24 * 60 * 60, // = 14 days. Default
    touchAfter: 24 * 3600 // time period in seconds: 24 hours
  }),
  cookie: {
    // Determine secure cookies purely based on node environment
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 14, // 14 days
    sameSite: 'lax'
  }
}));

// Passport config
app.use(passport.initialize());
app.use(passport.session());

// Serialize user by MongoDB _id
passport.serializeUser((user: any, done) => {
  done(null, user._id?.toString() || user.id);
});

// Deserialize user by looking up from DB
// Handles both old sessions (Google profile object) and new sessions (MongoDB _id string)
passport.deserializeUser(async (id: any, done) => {
  try {
    // Old session format: id is the full Google profile object
    if (typeof id === 'object' && id !== null) {
      const googleId = id.id || id.sub || id.googleId;
      if (googleId) {
        let user = await User.findOne({ googleId });
        if (!user) {
          // Migrate: create the user from the old profile data
          const userCount = await User.countDocuments();
          user = new User({
            googleId,
            displayName: id.displayName || id.name || 'User',
            email: id.emails?.[0]?.value || id.email || '',
            photo: id.photos?.[0]?.value || id.picture || '',
            role: userCount === 0 ? 'admin' : 'user',
          });
          await user.save();
          logger.info(`Migrated old session user: ${user.email} with role: ${user.role}`);
        }
        const userObj = user.toObject() as any;
        userObj.id = userObj._id.toString();
        return done(null, userObj);
      }
      return done(null, false);
    }

    // New session format: id is a MongoDB ObjectId string
    const user = await User.findById(id);
    if (user) {
      const userObj = user.toObject() as any;
      userObj.id = userObj._id.toString();
      done(null, userObj);
    } else {
      done(null, false);
    }
  } catch (err) {
    logger.error('Deserialize user error:', err);
    done(null, false); // Don't crash — just invalidate the session
  }
});

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    // Using a relative path allows Passport to map to whatever host is serving the app
    // Required for self-hosting on Coolify or any unpredictable domain/IP.
    callbackURL: "/api/auth/google/callback"
  },
    async (accessToken: string, refreshToken: string, profile: any, done: (error: any, user?: any) => void) => {
      try {
        let user = await User.findOne({ googleId: profile.id });

        if (!user) {
          const userCount = await User.countDocuments();
          const role = userCount === 0 ? 'admin' : 'user';

          // Check global setting: does this platform require access approval?
          const setting = await Setting.findOne({ key: 'accessRequestsRequired' });
          const requiresApproval = setting?.value === true;
          const status = role === 'admin' ? 'active' : (requiresApproval ? 'pending' : 'active');

          user = new User({
            googleId: profile.id,
            displayName: profile.displayName,
            email: profile.emails?.[0]?.value || '',
            photo: profile.photos?.[0]?.value || '',
            role,
            status,
          });
          await user.save();
          logger.info(`New user created: ${user.email} (role: ${role}, status: ${status})`);
        } else {
          // Check if a temporary user's access has expired
          if (user.isTempAccess && user.accessExpiresAt && new Date() > user.accessExpiresAt) {
            user.status = 'pending';
            await user.save();
            logger.info(`Temporary access expired for user: ${user.email}`);
          }
        }

        return done(null, user);
      } catch (err) {
        logger.error('Error in Google Strategy:', err);
        return done(err, undefined);
      }
    }));
} else {
  logger.warn("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET not set. OAuth will not work.");
}

/**
 * API Routes
 */
app.use('/api/auth', authLimiter, authRoutes)

// Role-aware IP whitelist: Admins bypass it, regular users are blocked if not in ALLOWED_IPS
app.use('/api', ipWhitelist);

app.use('/api/vms', vmRoutes)
app.use('/api/environments', environmentRoutes)
app.use('/api/execute', executionRoutes)
app.use('/api/totp', totpRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/access-requests', accessRequestsRoutes)
app.use('/api/audit-logs', auditLogsRoutes)
app.use('/api/push', pushRoutes)

/**
 * health
 */
app.use(
  '/api/health',
  (req: Request, res: Response): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

/**
 * error handler middleware
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((error: any, req: Request, res: Response, _next: NextFunction) => {
  const statusCode = error instanceof AppError ? error.statusCode : 500;
  const message = error instanceof AppError ? error.message : 'Internal Server Error';

  if (statusCode === 500) {
    logger.error('Unhandled Error:', {
      message: error.message,
      stack: error.stack,
      path: req.path,
    });
  } else {
    logger.warn(`Operational Error [${statusCode}]: ${message}`);
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    // Include stack in non-production environments
    stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
  });
})

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.originalUrl} not found`,
  })
})

// Bootstrap Web Push and health monitoring services
initWebPush();
startHealthMonitor();

export default app
