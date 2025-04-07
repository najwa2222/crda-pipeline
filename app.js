/* eslint-env node */
import express from 'express';
import { engine } from 'express-handlebars';
import mysql from 'mysql2/promise';
import cors from 'cors';
import session from 'express-session';
import logger from './utils/logger.js';

// Initialize Express application
const app = express();

// Database connection setup
let connection;
const MAX_RETRIES = 5;
const RETRY_INTERVAL = 5000;

async function createConnection() {
  try {
    const conn = await mysql.createConnection({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      port: process.env.MYSQL_PORT || 3306,
    });
    logger.info(`Connected to MySQL server as ID ${conn.threadId}`);
    return conn;
  } catch (error) {
    logger.error('MySQL connection error:', error.message);
    throw error;
  }
}

async function initializeDatabase(retries = MAX_RETRIES) {
  try {
    connection = await createConnection();
  } catch (error) {
    if (retries > 0) {
      logger.info(`Retrying connection... (${MAX_RETRIES - retries + 1}/${MAX_RETRIES})`);
      setTimeout(() => initializeDatabase(retries - 1), RETRY_INTERVAL);
    } else {
      logger.error('Failed to connect to MySQL after retries');
      process.exit(1);
    }
  }
}


// Middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(cors());
app.use(session({
  secret: process.env.SESSION_SECRET, // Add to .env file
  resave: false,
  saveUninitialized: false, // Changed from true
  cookie: { 
    secure: process.env.NODE_ENV === 'production'
  }
}));

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    await connection.query('SELECT 1');
    res.status(200).send('OK');
  } catch (error) {
    res.status(500).send('DB connection failed');
  }
});

// View engine configuration for Handlebars
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

// Authentication middleware
function isAuthenticated(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/login?error=not_logged_in');
}

// Role-based authorization middleware
const createRoleCheck = (...allowedRoles) => (req, res, next) => {
  if (!req.session.user?.role_user || !allowedRoles.includes(req.session.user.role_user)) {
    return res.redirect('/login?error=unauthorized');
  }
  next();
};

const isChef = createRoleCheck('chef_dentreprise');
const isGerant = createRoleCheck('gerant');
const isDirecteur = createRoleCheck('directeur');
const isGerantOrDirecteur = createRoleCheck('gerant', 'directeur');

/* ====== GET Routes ====== */

// Home page
app.get('/', (req, res) => {
  res.render('index', { title: 'Home', layout: 'main' });
});

// Login page
app.get('/login', (req, res) => {
  res.render('login', {
    title: 'تسجيل الدخول',
    layout: 'main',
    error: req.query.error,
    success: req.query.success,
  });
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.redirect('/services?error=session_error');
    res.redirect('/login');
  });
});

// About page
app.get('/about', (req, res) => {
  res.render('about', { title: 'من نحن', user: req.session.user });
});

// Services page (accessible by chef only)
app.get('/services', isAuthenticated, isChef, (req, res) => {
  res.render('services', { title: 'المحتوى', layout: 'main', user: req.session.user });
});

// Report creation page (accessible by gerant only)
app.get('/report', isAuthenticated, isGerant, (req, res) => {
  const { cin, sujet, prenom, nom } = req.query;
  res.render('report', {
    title: 'إنشاء تقرير',
    layout: 'main',
    isViewing: false,
    cin,
    sujet,
    prenom,
    nom,
    user: req.session.user,
  });
});

// Display services page (for viewing)
app.get('/afficher', isAuthenticated, (req, res) => {
  res.render('afficher', { title: 'المحتوى', layout: 'main', user: req.session.user });
});

// Get services with status
app.get('/getservices', isAuthenticated, isChef, async (req, res) => {
  try {
    const [services] = await connection.query(`
      SELECT s.*, 
             IF(r.id IS NOT NULL, 'تم', 'قيد الانتظار') AS status
      FROM services_utilisateur s
      LEFT JOIN rapport r ON s.cin = r.cin AND s.sujet = r.sujet
    `);
    res.render('afficher', {
      title: 'المحتوى',
      services,
      helpers: { eq: (a, b) => a === b },
    });
  } catch (error) {
    logger.error('Database error:', error);
    res.status(500).send('Database error');
  }
});

// API: Get a specific service
app.get('/api/services/:id', isAuthenticated, isChef, async (req, res) => {
  try {
    const [rows] = await connection.query(
      'SELECT * FROM services_utilisateur WHERE id = ?',
      [req.params.id]
    );
    res.json(rows[0] || {});
  } catch (error) {
    logger.error('Database error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Edit service page
app.get('/editservice/:id', isAuthenticated, isChef, async (req, res) => {
  try {
    const [results] = await connection.query(
      'SELECT * FROM services_utilisateur WHERE id = ?',
      [req.params.id]
    );
    if (!results.length) return res.redirect('/getservices');
    res.render('editservice', {
      title: 'تعديل الطلب',
      layout: 'main',
      service: results[0],
      user: req.session.user,
    });
  } catch (error) {
    logger.error('Database error:', error);
    res.redirect('/getservices');
  }
});

// View report page (accessible by gerant or directeur)
app.get('/viewreport', isAuthenticated, isGerantOrDirecteur, async (req, res) => {
  const { cin, sujet } = req.query;
  try {
    const [results] = await connection.query(`
      SELECT * FROM rapport 
      WHERE cin = ? AND sujet = ?
    `, [cin, sujet]);
    if (!results.length) {
      logger.error('No report found for viewreport');
      return req.session.user.role_user === 'gerant'
        ? res.redirect('/getreports')
        : res.redirect('/results');
    }
    res.render('report', {
      title: 'عرض التقرير',
      layout: 'main',
      isViewing: true,
      report: results[0],
      user: req.session.user,
    });
  } catch (error) {
    logger.error('View Report Error:', error.message);
    return req.session.user.role_user === 'gerant'
      ? res.redirect('/getreports')
      : res.redirect('/results');
  }
});

// Cancel report redirect
app.get('/cancelreport', isAuthenticated, (req, res) => {
  res.redirect('/getservices');
});

// Results page (accessible by directeur)
app.get('/results', isAuthenticated, isDirecteur, async (req, res) => {
  try {
    const [services] = await connection.query(`
      SELECT 
        s.*, 
        r.statut,
        rap.id AS report_id
      FROM services_utilisateur s
      LEFT JOIN results r ON s.cin = r.cin AND s.sujet = r.sujet
      INNER JOIN rapport rap ON s.cin = rap.cin AND s.sujet = rap.sujet
      ORDER BY s.id DESC;
    `);
    res.render('results', {
      title: 'النتائج النهائية',
      services,
      helpers: {
        statusClass: (status) => {
          switch (status) {
            case 'مقبول': return 'bg-green-100 text-green-800 border-green-200';
            case 'مرفوض': return 'bg-red-100 text-red-800 border-red-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
          }
        },
      },
    });
  } catch (error) {
    logger.error('Database error:', error);
    res.status(500).send('Database error');
  }
});

// Delete result API route
app.delete('/api/results', isAuthenticated, async (req, res) => {
  const { cin, sujet } = req.body;
  try {
    await connection.query(
      'DELETE FROM results WHERE cin = ? AND sujet = ?',
      [cin, sujet]
    );
    res.json({ success: true });
  } catch (error) {
    logger.error('Database error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Edit result page (accessible by directeur)
app.get('/editresult/:id', isAuthenticated, isDirecteur, async (req, res) => {
  try {
    const [results] = await connection.query(`
      SELECT s.*, r.statut 
      FROM services_utilisateur s
      LEFT JOIN results r ON s.cin = r.cin AND s.sujet = r.sujet
      WHERE s.id = ?
    `, [req.params.id]);
    if (!results.length) return res.redirect('/results');
    res.render('editresult', {
      title: 'تعديل النتيجة',
      service: results[0],
      result: results[0].statut || 'pending',
      helpers: { eq: (a, b) => a === b },
    });
  } catch (error) {
    logger.error('Database error:', error);
    res.redirect('/results');
  }
});

// Update result endpoint
app.post('/updateresult', isAuthenticated, isDirecteur, async (req, res) => {
  const { id, sujet, nom, prenom, cin, numero_transaction, statut } = req.body;
  if (!['مقبول', 'مرفوض'].includes(statut)) {
    return res.status(400).send('الحالة المحددة غير صالحة');
  }
  try {
    await connection.query(`
      INSERT INTO results 
        (sujet, nom, prenom, cin, numero_transaction, statut)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE statut = ?`,
      [sujet, nom, prenom, cin, numero_transaction, statut, statut]
    );
    res.redirect('/results');
  } catch (error) {
    logger.error('Update error:', error);
    res.redirect(`/editresult/${id}?error=update_failed`);
  }
});

// Check status page
app.get('/check-status', (req, res) => {
  res.render('check-status', { title: 'التحقق من الحالة', result: null, error: null });
});

app.post('/check-status', async (req, res) => {
  const { cin, transaction_number } = req.body;
  if (!cin || !transaction_number) {
    return res.render('check-status', {
      title: 'التحقق من الحالة',
      error: 'الرجاء إدخال جميع الحقول المطلوبة',
      formData: req.body,
    });
  }
  try {
    const [results] = await connection.query(`
      SELECT s.*, r.statut 
      FROM services_utilisateur s
      LEFT JOIN results r ON s.cin = r.cin AND s.sujet = r.sujet
      WHERE s.cin = ? AND s.numero_transaction = ?
    `, [cin, transaction_number]);
    if (!results.length) {
      return res.render('check-status', {
        title: 'التحقق من الحالة',
        error: 'لم يتم العثور على نتائج مطابقة',
        formData: req.body,
      });
    }
    res.render('check-status', { title: 'التحقق من الحالة', result: results[0], error: null });
  } catch (error) {
    logger.error('Status Check Error:', error);
    res.render('check-status', {
      title: 'التحقق من الحالة',
      error: 'حدث خطأ في النظام',
      formData: req.body,
    });
  }
});

// Get all reports (accessible by gerant)
app.get('/getreports', isAuthenticated, isGerant, async (req, res) => {
  try {
    const [results] = await connection.query(`
      SELECT 
        s.id AS service_id,
        s.sujet,
        s.prenom,
        s.nom,
        s.cin,
        s.numero_transaction,
        r.surface,
        r.limites_terrain,
        r.localisation,
        r.superficie_batiments_anciens,
        r.id AS report_id
      FROM services_utilisateur s
      LEFT JOIN rapport r ON s.cin = r.cin AND s.sujet = r.sujet
      ORDER BY s.id DESC
    `);
    res.render('reports', { title: 'التقارير', services: results });
  } catch (error) {
    logger.error('Database error:', error);
    res.status(500).send('Database error');
  }
});

// Delete report route (accessible by gerant)
app.delete('/api/reports/:id', isAuthenticated, isGerant, async (req, res) => {
  const reportId = req.params.id;
  try {
    await connection.beginTransaction();
    const [results] = await connection.query('SELECT cin, sujet FROM rapport WHERE id = ?', [reportId]);
    if (!results.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Report not found' });
    }
    const { cin, sujet } = results[0];
    await connection.query('DELETE FROM results WHERE cin = ? AND sujet = ?', [cin, sujet]);
    await connection.query('DELETE FROM rapport WHERE id = ?', [reportId]);
    await connection.commit();
    res.json({ success: true });
  } catch (error) {
    logger.error('Error during transaction:', error);
    await connection.rollback();
    res.status(500).json({ success: false, message: error.message || 'An error occurred during the database operation' });
  }
});

// Edit report page (accessible by gerant)
app.get('/editreport/:id', isAuthenticated, isGerant, async (req, res) => {
  try {
    const [results] = await connection.query('SELECT * FROM rapport WHERE id = ?', [req.params.id]);
    if (!results.length) return res.redirect('/getreports');
    res.render('edit-report', { title: 'تعديل التقرير', report: results[0], user: req.session.user });
  } catch (error) {
    logger.error('Database error:', error);
    res.redirect('/getreports');
  }
});

// Update report
app.post('/updatereport/:id', isAuthenticated, isGerant, async (req, res) => {
  const { surface, limites_terrain, localisation, superficie_batiments_anciens, observations } = req.body;
  try {
    await connection.query(`
      UPDATE rapport 
      SET 
        surface = ?,
        limites_terrain = ?,
        localisation = ?,
        superficie_batiments_anciens = ?,
        observations = ?
      WHERE id = ?`,
      [surface, limites_terrain, localisation, superficie_batiments_anciens, observations, req.params.id]
    );
    res.redirect('/getreports');
  } catch (error) {
    logger.error('Update Error:', error);
    res.redirect(`/editreport/${req.params.id}?error=update_failed`);
  }
});

// Registration pages
app.get('/pending_approval', (req, res) => {
  res.render('pending_approval', { title: 'قيد الانتظار' });
});
app.get('/unapproved_login', (req, res) => {
  res.render('unapproved_login', { title: 'قيد الانتظار' });
});
app.get('/register', (req, res) => {
  res.render('register', {
    title: 'تسجيل جديد',
    layout: 'main',
    error: req.query.error,
    success: req.query.success,
  });
});

// Handle registration
app.post('/register', async (req, res) => {
  const { email_user, password_user, role_user, nom_user, prenom_user, sex_user, cin_user } = req.body;
  if (!email_user.endsWith('@crda.com')) return res.redirect('/register?error=invalid_domain');
  if (!email_user || !password_user || !role_user || !nom_user || !prenom_user || !sex_user || !cin_user) {
    return res.redirect('/register?error=missing_fields');
  }
  try {
    const [existing] = await connection.query(
      'SELECT * FROM utilisateur WHERE email_user = ? OR cin_user = ?',
      [email_user, cin_user]
    );
    if (existing.length > 0) return res.redirect('/register?error=exists');
    await connection.query(
      `INSERT INTO utilisateur 
       (email_user, password_user, role_user, status_user, nom_user, prenom_user, sex_user, cin_user) 
       VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)`,
      [email_user, password_user, role_user, nom_user, prenom_user, sex_user, cin_user]
    );
    res.redirect('/pending_approval');
  } catch (error) {
    logger.error('Registration error:', error);
    res.redirect('/register?error=database_error');
  }
});

// Admin routes (accessible by directeur)
app.get('/admin/pending-accounts', isAuthenticated, isDirecteur, async (req, res) => {
  try {
    const [results] = await connection.query(
      'SELECT id, email_user, nom_user, prenom_user, role_user FROM utilisateur WHERE status_user = "pending"'
    );
    res.render('admin/pending-accounts', { title: 'الحسابات المعلقة', accounts: results });
  } catch (error) {
    logger.error('Database error:', error);
    res.status(500).send('Database error');
  }
});

app.post('/admin/approve-account/:id', isAuthenticated, isDirecteur, async (req, res) => {
  try {
    await connection.query(
      'UPDATE utilisateur SET status_user = "approved" WHERE id = ?',
      [req.params.id]
    );
    res.redirect('/admin/pending-accounts');
  } catch (error) {
    logger.error('Approve Error:', error);
    res.redirect('/admin/pending-accounts?error=approve_failed');
  }
});

app.post('/admin/reject-account/:id', isAuthenticated, isDirecteur, async (req, res) => {
  try {
    await connection.query(
      'DELETE FROM utilisateur WHERE id = ?',
      [req.params.id]
    );
    res.redirect('/admin/pending-accounts');
  } catch (error) {
    logger.error('Reject Error:', error);
    res.redirect('/admin/pending-accounts?error=reject_failed');
  }
});

// Error handler middleware (line 549)
app.use((err, req, res, next) => { // Add next even if unused
  logger.error('Error:', err);
  res.status(500).render('error', {
    message: 'حدث خطأ غير متوقع',
    error: process.env.NODE_ENV === 'development' ? err : {},
  });
});

// 404 error handler
app.use((req, res, next) => {
  const error = new Error('Ressource non trouvée');
  error.status = 404;
  next(error);
});

// Start the server after DB connection is established
initializeDatabase().then(() => {
  const PORT = process.env.PORT || 4200;
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });
});

export default app;
