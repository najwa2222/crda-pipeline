/* eslint-env node */
import express from 'express';
import { engine } from 'express-handlebars';
import mysql from 'mysql2/promise';
import cors from 'cors';
import session from 'express-session';
import bcrypt from 'bcrypt';
import helmet from 'helmet';
import logger from './utils/logger.js';
import methodOverride from 'method-override';

// Initialize Express application
const app = express();

// Database connection setup
let connection;
const MAX_RETRIES = 5;
const RETRY_INTERVAL = 5000;

async function createConnection() {
  try {
    const conn = await mysql.createConnection({
      host: process.env.MYSQL_HOST || 'localhost',
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'base_crda',
      port: process.env.MYSQL_PORT || 3306,
    });
    logger.info(`Connected to MySQL server as ID ${conn.threadId}`);
    return conn;
  } catch (err) {
    logger.error('MySQL connection error:', err.message);
    throw err;
  }
}

async function initializeDatabase(retries = MAX_RETRIES) {
  try {
    connection = await createConnection();
  } catch (err) {
    if (retries > 0) {
      logger.info(`Retrying connection... (${MAX_RETRIES - retries + 1}/${MAX_RETRIES})`);
      setTimeout(() => initializeDatabase(retries - 1), RETRY_INTERVAL);
    } else {
      logger.error('Failed to connect to MySQL after retries:', err.message);
      process.exit(1);
    }
  }
}

// Middleware setup
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(methodOverride('_method'));
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

app.use(session({
  secret: process.env.SESSION_SECRET || 'default-secure-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict'
  }
}));

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// View engine configuration
app.engine('.hbs', engine({
  extname: '.hbs',
  helpers: {
    eq: (a, b) => a === b,
    statusClass: (status) => {
      switch (status) {
        case 'مقبول': return 'bg-green-100 text-green-800 border-green-200';
        case 'مرفوض': return 'bg-red-100 text-red-800 border-red-200';
        default: return 'bg-gray-100 text-gray-800 border-gray-200';
      }
    },
  },
}));
app.set('view engine', '.hbs');
app.set('views', './views');

// Authentication & Authorization
const isAuthenticated = (req, res, next) => {
  req.session.user ? next() : res.redirect('/login?error=not_logged_in');
};

const createRoleCheck = (...allowedRoles) => (req, res, next) => {
  if (!allowedRoles.includes(req.session.user?.role_user)) {
    return res.redirect('/login?error=unauthorized');
  }
  next();
};

const isChef = createRoleCheck('chef_dentreprise');
const isGerant = createRoleCheck('gerant');
const isDirecteur = createRoleCheck('directeur');

/* ====================== ROUTES ====================== */

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    await connection.query('SELECT 1');
    res.status(200).send('OK');
  } catch (err) {
    logger.error('Health check failed:', err.message);
    res.status(500).send('DB connection failed');
  }
});

app.get('/', (req, res) => res.render('index', { title: 'Home', layout: 'main' }));
app.get('/about', (req, res) => res.render('about', { title: 'من نحن', user: req.session.user }));
app.get('/services', isAuthenticated, isChef, (req, res) => res.render('services', { title: 'المحتوى', layout: 'main', user: req.session.user }));
app.get('/afficher', isAuthenticated, (req, res) => res.render('afficher', { title: 'المحتوى', layout: 'main', user: req.session.user }));

// Auth
app.get('/login', (req, res) => {
  res.render('login', {
    title: 'تسجيل الدخول', layout: 'main', error: req.query.error, success: req.query.success
  });
});

app.post('/login', async (req, res) => {
  if (!connection) {
    return res.status(500).send('Database connection is not available at the moment.');
  }

  const { email_user, password_user } = req.body;
  try {
    const [users] = await connection.query('SELECT * FROM utilisateur WHERE email_user = ?', [email_user]);
    if (!users.length) return res.redirect('/login?error=invalid_credentials');
    const user = users[0];
    if (user.status_user !== 'approved') return res.redirect('/unapproved_login');
    const match = await bcrypt.compare(password_user, user.password_user);
    if (!match) return res.redirect('/login?error=invalid_credentials');
    req.session.user = { id: user.id, email_user: user.email_user, role_user: user.role_user, nom_user: user.nom_user, prenom_user: user.prenom_user };
    const routes = { chef_dentreprise: '/getservices', gerant: '/getreports', directeur: '/results' };
    res.redirect(routes[user.role_user] || '/login?error=invalid_role');
  } catch (err) {
    logger.error('Login error:', err.message);
    res.redirect('/login?error=server_error');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) logger.error('Session destruction error:', err.message);
    res.redirect('/login');
  });
});

// Service Management
app.get('/getservices', isAuthenticated, isChef, async (req, res) => {
  try {
    const [services] = await connection.query(`
      SELECT s.*, IF(r.id IS NOT NULL, 'تم', 'قيد الانتظار') AS status
      FROM services_utilisateur s
      LEFT JOIN rapport r ON s.cin = r.cin AND s.sujet = r.sujet
    `);
    res.render('afficher', { title: 'المحتوى', services });
  } catch (err) {
    logger.error(`Database Error: ${err.message}`);
    res.redirect('/getservices?error=database_error');
  }
});

app.post('/addservice', async (req, res) => {
  const fields = sanitizeServiceFields(req.body);
  try {
    await connection.query(`
      INSERT INTO services_utilisateur (sujet, prenom, nom, cin, numero_transaction, certificat_propriete_terre, copie_piece_identite_fermier, copie_piece_identite_nationale, demande_but, copie_contrat_location_terrain, autres_documents)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, Object.values(fields));
    res.redirect('/getservices');
  } catch (err) {
    logger.error(`Database Error: ${err.message}`);
    res.redirect('/services?error=database_error');
  }
});

// Report Management
app.get('/report', isAuthenticated, isGerant, (req, res) => {
  res.render('report', { title: 'إنشاء تقرير', layout: 'main', isViewing: false, ...req.query, user: req.session.user });
});

app.get('/getreports', isAuthenticated, isGerant, async (req, res) => {
  try {
    const [reports] = await connection.query('SELECT * FROM rapport ORDER BY id DESC');
    res.render('getreports', { title: 'قائمة التقارير', reports });
  } catch (err) {
    logger.error(`Database Error: ${err.message}`);
    res.redirect('/getreports?error=database_error');
  }
});

app.post('/addreport', isAuthenticated, async (req, res) => {
  const reportData = req.body;
  try {
    await connection.beginTransaction();
    await connection.query(`
      INSERT INTO rapport (cin, sujet, nom, prenom, surface, limites_terrain, localisation, superficie_batiments_anciens, observations)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, Object.values(reportData));
    await connection.query(`
      UPDATE services_utilisateur SET status = 'تم' WHERE cin = ? AND sujet = ?
    `, [reportData.cin, reportData.sujet]);
    await connection.commit();
    res.redirect('/getreports');
  } catch (err) {
    await connection.rollback();
    logger.error(`Database Error: ${err.message}`);
    res.redirect(`/report?cin=${reportData.cin}&sujet=${reportData.sujet}&error=database_error`);
  }
});

// Results
app.get('/results', isAuthenticated, isDirecteur, async (req, res) => {
  try {
    const [services] = await connection.query(`
      SELECT s.*, r.statut, rap.id AS report_id 
      FROM services_utilisateur s
      LEFT JOIN results r ON s.cin = r.cin AND s.sujet = r.sujet
      INNER JOIN rapport rap ON s.cin = rap.cin AND s.sujet = rap.sujet
      ORDER BY s.id DESC
    `);
    res.render('results', { title: 'النتائج النهائية', services });
  } catch (err) {
    logger.error(`Database Error: ${err.message}`);
    res.redirect('/results?error=database_error');
  }
});

// Registration
app.get('/register', (req, res) => res.render('register', { title: 'تسجيل جديد', layout: 'main', error: req.query.error, success: req.query.success }));

app.post('/register', async (req, res) => {
  const userData = req.body;
  try {
    const [existing] = await connection.query('SELECT * FROM utilisateur WHERE email_user = ? OR cin_user = ?', [userData.email_user, userData.cin_user]);
    if (existing.length) return res.redirect('/register?error=exists');
    const hashedPassword = await bcrypt.hash(userData.password_user, 10);
    await connection.query(`
      INSERT INTO utilisateur (email_user, password_user, role_user, status_user, nom_user, prenom_user, sex_user, cin_user)
      VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)
    `, [userData.email_user, hashedPassword, userData.role_user, userData.nom_user, userData.prenom_user, userData.sex_user, userData.cin_user]);
    res.redirect('/pending_approval');
  } catch (err) {
    logger.error(`Database Error: ${err.message}`);
    res.redirect('/register?error=database_error');
  }
});

// Pending & Unapproved Pages
app.get('/pending_approval', (req, res) => res.render('pending_approval', { title: 'تم التسجيل', message: 'شكراً لتسجيلك. سيتم مراجعة طلبك قريباً.' }));
app.get('/unapproved_login', (req, res) => res.render('unapproved_login', { title: 'لم يتم التحقق', message: 'حسابك لم يتم الموافقة عليه بعد. يرجى المحاولة لاحقاً.' }));

// Admin
app.get('/admin/pending-accounts', isAuthenticated, isDirecteur, async (req, res) => {
  try {
    const [accounts] = await connection.query('SELECT id, email_user, nom_user, prenom_user, role_user FROM utilisateur WHERE status_user = "pending"');
    res.render('admin/pending-accounts', { title: 'الحسابات المعلقة', accounts });
  } catch (err) {
    logger.error(`Database Error: ${err.message}`);
    res.redirect('/admin/pending-accounts?error=database_error');
  }
});

// Error Handling
app.use((err, req, res, next) => {
  logger.error(`Global Error: ${err.message}`);
  res.status(500).render('error', { message: 'حدث خطأ غير متوقع', error: process.env.NODE_ENV === 'development' ? err : {} });
});

app.use((req, res) => {
  res.status(404).render('error', { message: 'Ressource non trouvée', error: { status: 404 } });
});

// Helpers
function sanitizeServiceFields(body) {
  return {
    sujet: body.sujet,
    prenom: body.prenom,
    nom: body.nom,
    cin: body.cin,
    numero_transaction: body.numero_transaction,
    certificat_propriete_terre: body.certificat_propriete_terre === 'true',
    copie_piece_identite_fermier: body.copie_piece_identite_fermier === 'true',
    copie_piece_identite_nationale: body.copie_piece_identite_nationale === 'true',
    demande_but: body.demande_but === 'true',
    copie_contrat_location_terrain: body.copie_contrat_location_terrain === 'true',
    autres_documents: body.autres_documents === 'true'
  };
}

// Initialize and Start Server
initializeDatabase().then(() => {
  const PORT = process.env.PORT || 4200;
  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Server running on port ${PORT}`);
  });
});

export default app;
