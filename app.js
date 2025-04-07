/* eslint-env node */
// Replace all require() statements with imports
import express from 'express';
import { engine } from 'express-handlebars';
import mysql from 'mysql2';
import cors from 'cors';
import session from 'express-session';
import logger from './utils/logger.js';

// Initialize the Express application
const app = express();

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files and enable CORS
app.use(express.static('public'));
app.use(cors());

// Configure session middleware
app.use(session({
  secret: 'QSM45ED2A45MZDQSD452QS2MD2K',
  resave: false,
  saveUninitialized: true,
}));

// Attach user info to response locals
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// Database connection setup
const connection = mysql.createConnection({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  port: process.env.MYSQL_PORT
});

connection.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL server: ' + err.stack);
    return;
  }
  logger.info(`Connected to MySQL server as ID ${connection.threadId}`);
});

// Health check route
app.get('/health', (req, res) => {
  connection.query('SELECT 1', (err) => {
    if (err) return res.status(500).send('DB connection failed');
    res.status(200).send('OK');
  });
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
    }
  }
}));
app.set('view engine', '.hbs');
app.set('views', './views');

// Authentication middleware
function isAuthenticated(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/login?error=not_logged_in');
}

// Role-based authorization middleware
const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.session.user || !allowedRoles.includes(req.session.user.role_user)) {
      return res.redirect('/login?error=unauthorized');
    }
    next();
  };
};

const isChef = checkRole(['chef_dentreprise']);
const isGerant = checkRole(['gerant']);
const isDirecteur = checkRole(['directeur']);
const isGerantOrDirecteur = checkRole(['gerant', 'directeur']);

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
    success: req.query.success
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
    user: req.session.user
  });
});

// Display services page (for viewing)
app.get('/afficher', isAuthenticated, (req, res) => {
  res.render('afficher', { title: 'المحتوى', layout: 'main', user: req.session.user });
});

// Get services with status
app.get('/getservices', isAuthenticated, isChef, (req, res) => {
  const sql = `
    SELECT s.*, 
           IF(r.id IS NOT NULL, 'تم', 'قيد الانتظار') AS status
    FROM services_utilisateur s
    LEFT JOIN rapport r 
      ON s.cin = r.cin AND s.sujet = r.sujet
  `;
  connection.query(sql, (err, results) => {
    if (err) return res.status(500).send('Database error');
    res.render('afficher', {
      title: 'المحتوى',
      services: results,
      helpers: { eq: (a, b) => a === b }
    });
  });
});

// API: Get a specific service
app.get('/api/services/:id', isAuthenticated, isChef, (req, res) => {
  const sql = 'SELECT * FROM services_utilisateur WHERE id = ?';
  connection.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(result[0]);
  });
});

// Edit service page
app.get('/editservice/:id', isAuthenticated, isChef, (req, res) => {
  const sql = 'SELECT * FROM services_utilisateur WHERE id = ?';
  connection.query(sql, [req.params.id], (err, results) => {
    if (err || results.length === 0) return res.redirect('/getservices');
    res.render('editservice', {
      title: 'تعديل الطلب',
      layout: 'main',
      service: results[0],
      user: req.session.user
    });
  });
});

// View report page (accessible by gerant or directeur)
app.get('/viewreport', isAuthenticated, isGerantOrDirecteur, (req, res) => {
  const { cin, sujet } = req.query;
  const reportQuery = `
    SELECT * FROM rapport 
    WHERE cin = ? AND sujet = ?
  `;
  connection.query(reportQuery, [cin, sujet], (err, results) => {
    if (err || results.length === 0) {
      console.error('View Report Error:', err?.message || 'No report found');
      return req.session.user.role_user === 'gerant'
        ? res.redirect('/getreports')
        : res.redirect('/results');
    }
    res.render('report', {
      title: 'عرض التقرير',
      layout: 'main',
      isViewing: true,
      report: results[0],
      user: req.session.user
    });
  });
});

// Cancel report redirect
app.get('/cancelreport', isAuthenticated, (req, res) => {
  res.redirect('/getservices');
});

// Results page (accessible by directeur)
app.get('/results', isAuthenticated, isDirecteur, (req, res) => {
  const sql = `
    SELECT 
      s.*, 
      r.statut,
      rap.id AS report_id
    FROM services_utilisateur s
    LEFT JOIN results r ON s.cin = r.cin AND s.sujet = r.sujet
    INNER JOIN rapport rap ON s.cin = rap.cin AND s.sujet = rap.sujet
    ORDER BY s.id DESC;
  `;
  connection.query(sql, (err, services) => {
    if (err) return res.status(500).send('Database error');
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
        }
      }
    });
  });
});

// Delete result API route
app.delete('/api/results', isAuthenticated, (req, res) => {
  const { cin, sujet } = req.body;
  const sql = 'DELETE FROM results WHERE cin = ? AND sujet = ?';
  connection.query(sql, [cin, sujet], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// Edit result page (accessible by directeur)
app.get('/editresult/:id', isAuthenticated, isDirecteur, (req, res) => {
  const sql = `
    SELECT s.*, r.statut 
    FROM services_utilisateur s
    LEFT JOIN results r ON s.cin = r.cin AND s.sujet = r.sujet
    WHERE s.id = ?
  `;
  connection.query(sql, [req.params.id], (err, results) => {
    if (err || results.length === 0) return res.redirect('/results');
    res.render('editresult', {
      title: 'تعديل النتيجة',
      service: results[0],
      result: results[0].statut || 'pending',
      helpers: { eq: (a, b) => a === b }
    });
  });
});

// Update result
app.post('/updateresult', isAuthenticated, isDirecteur, (req, res) => {
  const { id, sujet, nom, prenom, cin, numero_transaction, statut } = req.body;
  const allowedStatuses = ['مقبول', 'مرفوض'];
  if (!allowedStatuses.includes(statut)) {
    return res.status(400).send('الحالة المحددة غير صالحة');
  }
  const sql = `
    INSERT INTO results (sujet, nom, prenom, cin, numero_transaction, statut)
    VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE statut = ?
  `;
  connection.query(sql,
    [sujet, nom, prenom, cin, numero_transaction, statut, statut],
    (err) => {
      if (err) {
        console.error('Result Update Error:', err);
        return res.redirect(`/editresult/${id}?error=update_failed`);
      }
      res.redirect('/results');
    }
  );
});

// Check status page
app.get('/check-status', (req, res) => {
  res.render('check-status', { title: 'التحقق من الحالة', result: null, error: null });
});

app.post('/check-status', (req, res) => {
  const { cin, transaction_number } = req.body;
  if (!cin || !transaction_number) {
    return res.render('check-status', {
      title: 'التحقق من الحالة',
      error: 'الرجاء إدخال جميع الحقول المطلوبة',
      formData: req.body
    });
  }
  const sql = `
    SELECT s.*, r.statut 
    FROM services_utilisateur s
    LEFT JOIN results r ON s.cin = r.cin AND s.sujet = r.sujet
    WHERE s.cin = ? AND s.numero_transaction = ?
  `;
  connection.query(sql, [cin, transaction_number], (err, results) => {
    if (err) {
      console.error('Status Check Error:', err);
      return res.render('check-status', {
        title: 'التحقق من الحالة',
        error: 'حدث خطأ في النظام',
        formData: req.body
      });
    }
    if (results.length === 0) {
      return res.render('check-status', {
        title: 'التحقق من الحالة',
        error: 'لم يتم العثور على نتائج مطابقة',
        formData: req.body
      });
    }
    res.render('check-status', { title: 'التحقق من الحالة', result: results[0], error: null });
  });
});

// Get all reports (accessible by gerant)
app.get('/getreports', isAuthenticated, isGerant, (req, res) => {
  const sql = `
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
  `;
  connection.query(sql, (err, results) => {
    if (err) return res.status(500).send('Database error');
    res.render('reports', { title: 'التقارير', services: results });
  });
});

// Delete report route (accessible by gerant)
app.delete('/api/reports/:id', isAuthenticated, isGerant, (req, res) => {
  const reportId = req.params.id;
  connection.beginTransaction(err => {
    if (err) return res.status(500).json({ success: false, message: 'Failed to start transaction' });
    const rollback = (res, err) => {
      console.error('Error during transaction:', err);
      connection.rollback(() => {
        res.status(500).json({ success: false, message: err.message || 'An error occurred during the database operation' });
      });
    };
    connection.query('SELECT cin, sujet FROM rapport WHERE id = ?', [reportId], (err, results) => {
      if (err) return rollback(res, err);
      if (results.length === 0) return rollback(res, new Error('Report not found'));
      const { cin, sujet } = results[0];
      connection.query('DELETE FROM results WHERE cin = ? AND sujet = ?', [cin, sujet], (err) => {
        if (err) return rollback(res, err);
        connection.query('DELETE FROM rapport WHERE id = ?', [reportId], (err) => {
          if (err) return rollback(res, err);
          connection.commit(err => {
            if (err) return rollback(res, err);
            res.json({ success: true });
          });
        });
      });
    });
  });
});

// Edit report page (accessible by gerant)
app.get('/editreport/:id', isAuthenticated, isGerant, (req, res) => {
  const sql = 'SELECT * FROM rapport WHERE id = ?';
  connection.query(sql, [req.params.id], (err, results) => {
    if (err || results.length === 0) return res.redirect('/getreports');
    res.render('edit-report', { title: 'تعديل التقرير', report: results[0], user: req.session.user });
  });
});

// Update report
app.post('/updatereport/:id', isAuthenticated, isGerant, (req, res) => {
  const { surface, limites_terrain, localisation, superficie_batiments_anciens, observations } = req.body;
  const sql = `
    UPDATE rapport 
    SET 
      surface = ?,
      limites_terrain = ?,
      localisation = ?,
      superficie_batiments_anciens = ?,
      observations = ?
    WHERE id = ?
  `;
  const values = [surface, limites_terrain, localisation, superficie_batiments_anciens, observations, req.params.id];
  connection.query(sql, values, (err) => {
    if (err) {
      console.error('Update Error:', err);
      return res.redirect(`/editreport/${req.params.id}?error=update_failed`);
    }
    res.redirect('/getreports');
  });
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
    success: req.query.success
  });
});

// Handle registration
app.post('/register', (req, res) => {
  const { email_user, password_user, role_user, nom_user, prenom_user, sex_user, cin_user } = req.body;
  if (!email_user.endsWith('@crda.com')) return res.redirect('/register?error=invalid_domain');
  if (!email_user || !password_user || !role_user || !nom_user || !prenom_user || !sex_user || !cin_user) {
    return res.redirect('/register?error=missing_fields');
  }
  connection.query(
    'SELECT * FROM utilisateur WHERE email_user = ? OR cin_user = ?',
    [email_user, cin_user],
    (error, results) => {
      if (error) return res.redirect('/register?error=database_error');
      if (results.length > 0) return res.redirect('/register?error=exists');
      connection.query(
        `INSERT INTO utilisateur 
         (email_user, password_user, role_user, status_user, nom_user, prenom_user, sex_user, cin_user) 
         VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)`,
        [email_user, password_user, role_user, nom_user, prenom_user, sex_user, cin_user],
        (insertError) => {
          if (insertError) return res.redirect('/register?error=database_error');
          res.redirect('/pending_approval');
        }
      );
    }
  );
});

// Admin routes (accessible by directeur)
app.get('/admin/pending-accounts', isAuthenticated, isDirecteur, (req, res) => {
  connection.query(
    'SELECT id, email_user, nom_user, prenom_user, role_user FROM utilisateur WHERE status_user = "pending"',
    (err, results) => {
      if (err) return res.status(500).send('Database error');
      res.render('admin/pending-accounts', { title: 'الحسابات المعلقة', accounts: results });
    }
  );
});

app.post('/admin/approve-account/:id', isAuthenticated, isDirecteur, (req, res) => {
  connection.query(
    'UPDATE utilisateur SET status_user = "approved" WHERE id = ?',
    [req.params.id],
    (err) => {
      if (err) {
        console.error('Approve Error:', err);
        return res.status(500).redirect('/admin/pending-accounts?error=approve_failed');
      }
      res.redirect('/admin/pending-accounts');
    }
  );
});

app.post('/admin/reject-account/:id', isAuthenticated, isDirecteur, (req, res) => {
  connection.query(
    'DELETE FROM utilisateur WHERE id = ?',
    [req.params.id],
    (err) => {
      if (err) {
        console.error('Reject Error:', err);
        return res.status(500).redirect('/admin/pending-accounts?error=reject_failed');
      }
      res.redirect('/admin/pending-accounts');
    }
  );
});

/* ====== Error Handling ====== */

// Global error handler for API errors
app.use((error, req, res) => {
  res.status(error.status || 500).json({ message: error.message || 'Erreur interne du serveur' });
});

// 404 error handler
app.use((req, res, next) => {
  const error = new Error('Ressource non trouvée');
  error.status = 404;
  next(error);
});

// Final error handler for rendering error pages
app.use((err, req, res) => {
  console.error('Global Error:', err);
  res.status(500).render('error', {
    message: 'حدث خطأ غير متوقع',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// Start the server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 4200;
  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Server running on port ${PORT}`);
  });
}

export default app;
