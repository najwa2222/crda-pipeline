const express = require('express');
const { engine } = require('express-handlebars');
const expressHbs = require('express-handlebars');
const mysql = require('mysql');
const cors = require('cors');
const session = require('express-session');
const methodOverride = require('method-override');
// Initialization of the Express application
const app = express();

// Middleware Middleware Middleware Middleware Middleware Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Method override
//app.use(methodOverride('_method'));
/*
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.originalUrl}`);
  next();
});*/
// Middleware Middleware Middleware Middleware Middleware Middleware

// New configuration
// Replace existing connection with:
const connection = mysql.createConnection({
  host: process.env.MYSQL_HOST || 'mysql',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'base_crda',
  port: process.env.MYSQL_PORT || 3306
});

// Establish a connection to the database
connection.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL server: ' + err.stack);
    return;
  }
  console.log('Connected to MySQL server as ID ' + connection.threadId);
});
// Add before other routes
app.get('/health', (req, res) => {
  connection.query('SELECT 1', (err) => {
    if (err) return res.status(500).send('DB connection failed');
    res.status(200).send('OK');
  });
});
// Middleware setup
app.use(express.static('public'));
app.use(cors());

app.engine('.hbs', engine({ 
  extname: '.hbs',
  helpers: {
    eq: (a, b) => a === b,
    statusClass: (status) => {
      switch(status) {
        case 'مقبول': return 'bg-green-100 text-green-800 border-green-200';
        case 'مرفوض': return 'bg-red-100 text-red-800 border-red-200';
        default: return 'bg-gray-100 text-gray-800 border-gray-200';
      }
    }
  }
}));

app.set('view engine', '.hbs');
app.set('views', './views');

// Middleware to protect routes
function isAuthenticated(req, res, next) {
  if (req.session.user) {
    return next(); // Proceed to the route if the user is logged in
  }
  res.redirect('/login?error=not_logged_in'); // Redirect to login if not authenticated
}
//login logout
app.use(session({
  secret: 'QSM45ED2A45MZDQSD452QS2MD2K',
  resave: false,
  saveUninitialized: true,
}));

// Middleware to attach user info to locals
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});
// Add after existing middleware
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
// begin GET Routes

app.get('/', (req, res) => {
  res.render('index', { title: 'Home', layout: 'main'});
});

app.get('/login', (req, res) => {
  res.render('login', { 
    title: 'تسجيل الدخول', 
    layout: 'main',
    error: req.query.error,
    success: req.query.success 
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.redirect('/services?error=session_error');
    }
    res.redirect('/login'); // Redirect to login page after logging out
  });
});

app.get('/about', (req, res) => {
  res.render('about', { 
      title: 'من نحن',
      user: req.session.user 
  });
});

app.get('/services', isAuthenticated, isChef, (req, res) => {
  res.render('services', { title: 'المحتوى', layout: 'main', user: req.session.user });
});

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


app.get('/afficher',isAuthenticated, (req, res) => {
  res.render('afficher', { title: 'المحتوى', layout: 'main', user: req.session.user });
});

app.get('/getservices', isAuthenticated, isChef, (req, res) => {
  const sql = `
    SELECT s.*, 
           IF(r.id IS NOT NULL, 'تم', 'قيد الانتظار') AS status
    FROM services_utilisateur s
    LEFT JOIN rapport r 
      ON s.cin = r.cin 
      AND s.sujet = r.sujet  -- Add sujet to join condition
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

app.get('/api/services/:id', isAuthenticated, isChef, (req, res) => {
  const sql = 'SELECT * FROM services_utilisateur WHERE id = ?';
  connection.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(result[0]);
  });
});

app.get('/editservice/:id', isAuthenticated, isChef, (req, res) => {
  const sql = 'SELECT * FROM services_utilisateur WHERE id = ?';
  
  connection.query(sql, [req.params.id], (err, results) => {
    if (err || results.length === 0) {
      return res.redirect('/getservices');
    }
    
    res.render('editservice', {
      title: 'تعديل الطلب',
      layout: 'main',
      service: results[0],
      user: req.session.user
    });
  });
});

app.get('/viewreport', isAuthenticated, isGerantOrDirecteur, (req, res) => {
  const { cin, sujet } = req.query;
  const reportQuery = `
    SELECT * FROM rapport 
    WHERE cin = ? AND sujet = ?`;

  connection.query(reportQuery, [cin, sujet], (err, results) => {
    if (err || results.length === 0) {
      console.error('View Report Error:', err?.message || 'No report found');
      if (req.session.user.role_user === 'gerant') {
        return res.redirect('/getreports');
      }
      return res.redirect('/results');
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

app.get('/cancelreport', isAuthenticated, (req, res) => {
  res.redirect('/getservices');
});

// end GET Routes


// begin post Routes

app.post('/login', (req, res) => {
  const { email_user, password_user } = req.body;

  connection.query(
    'SELECT * FROM utilisateur WHERE email_user = ? AND password_user = ?',
    [email_user, password_user],
    (error, results) => {
      if (error) {
        console.error('Login Error:', error);
        return res.status(500).send('Server error');
      }
      
      if (results.length > 0) {
        const user = results[0];
        
        // Check account approval status
        if (user.status_user !== 'approved') {
          return res.redirect('/unapproved_login');
        }

        req.session.user = user;
        
        // Redirect based on role
        switch(user.role_user) {
          case 'chef_dentreprise':
            return res.redirect('/getservices');
          case 'gerant':
            return res.redirect('/getreports');
          case 'directeur':
            return res.redirect('/results');
          default:
            return res.redirect('/login?error=invalid_role');
        }
      } else {
        res.redirect('/login?error=invalid_credentials');
      }
    }
  );
});

app.post('/addservice', (req, res) => {
  const {
    sujet, // Added sujet here
    prenom,
    nom,
    cin,
    numero_transaction,
    certificat_propriete_terre,
    copie_piece_identite_fermier,
    copie_piece_identite_nationale,
    demande_but,
    copie_contrat_location_terrain,
    autres_documents
  } = req.body;

  const fields = {
    sujet, // Include sujet in the fields object
    prenom,
    nom,
    cin,
    numero_transaction,
    certificat_propriete_terre: certificat_propriete_terre === 'true',
    copie_piece_identite_fermier: copie_piece_identite_fermier === 'true',
    copie_piece_identite_nationale: copie_piece_identite_nationale === 'true',
    demande_but: demande_but === 'true',
    copie_contrat_location_terrain: copie_contrat_location_terrain === 'true',
    autres_documents: autres_documents === 'true'
  };
    
  // Updated SQL to include sujet
  const sql = `
    INSERT INTO services_utilisateur 
      (sujet, prenom, nom, cin, numero_transaction, 
       certificat_propriete_terre, copie_piece_identite_fermier, 
       copie_piece_identite_nationale, demande_but, 
       copie_contrat_location_terrain, autres_documents) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  // Ensure the order of values matches the SQL columns
  const values = [
    fields.sujet,
    fields.prenom,
    fields.nom,
    fields.cin,
    fields.numero_transaction,
    fields.certificat_propriete_terre,
    fields.copie_piece_identite_fermier,
    fields.copie_piece_identite_nationale,
    fields.demande_but,
    fields.copie_contrat_location_terrain,
    fields.autres_documents
  ];

  connection.query(sql, values, (err, result) => {
    if (err) {
      console.error('SQL query error:', err.message);
      res.redirect('/services?error=database_error');
      return;
    }
    console.log('New record added with ID: ' + result.insertId);
    res.redirect('/getservices');

  });
});

app.post('/updateservice/:id', isAuthenticated, isChef, (req, res) => {
  const {
    sujet,
    prenom,
    nom,
    cin,
    numero_transaction,
    certificat_propriete_terre = false,
    copie_piece_identite_fermier = false,
    copie_piece_identite_nationale = false,
    demande_but = false,
    copie_contrat_location_terrain = false,
    autres_documents = false
  } = req.body;

  const sql = `
    UPDATE services_utilisateur 
    SET 
      sujet = ?,
      prenom = ?,
      nom = ?,
      cin = ?,
      numero_transaction = ?,
      certificat_propriete_terre = ?,
      copie_piece_identite_fermier = ?,
      copie_piece_identite_nationale = ?,
      demande_but = ?,
      copie_contrat_location_terrain = ?,
      autres_documents = ?
    WHERE id = ?`;

  const values = [
    sujet,
    prenom,
    nom,
    cin,
    numero_transaction,
    certificat_propriete_terre === 'on',
    copie_piece_identite_fermier === 'on',
    copie_piece_identite_nationale === 'on',
    demande_but === 'on',
    copie_contrat_location_terrain === 'on',
    autres_documents === 'on',
    req.params.id
  ];

  connection.query(sql, values, (err) => {
    if (err) {
      console.error('Update Error:', err);
      return res.redirect(`/editservice/${req.params.id}?error=update_failed`);
    }
    res.redirect('/getservices');
  });
});

app.post('/addreport', isAuthenticated, (req, res) => {
  const { 
    cin, 
    sujet, 
    nom, 
    prenom, 
    surface, 
    limites_terrain, 
    localisation, 
    superficie_batiments_anciens, 
    observations 
  } = req.body;

  // Add validation
  if (!cin || !sujet) {
    return res.redirect('/getreports?error=missing_required_fields');
  }

  const sql = `
    INSERT INTO rapport 
    (cin, sujet, nom, prenom, surface, limites_terrain, localisation, superficie_batiments_anciens, observations)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  connection.query(sql, [
    cin, 
    sujet, 
    nom, 
    prenom, 
    surface || null,  // Handle empty values
    limites_terrain || null,
    localisation || null,
    superficie_batiments_anciens || null,
    observations || null
  ], (err, result) => {
    if (err) {
      console.error('Report Creation Error:', err);
      return res.redirect(`/report?cin=${cin}&sujet=${sujet}&error=database_error`);
    }

    // Update service status
    const updateSql = `
      UPDATE services_utilisateur 
      SET status = 'تم' 
      WHERE cin = ? AND sujet = ?`;
    
    connection.query(updateSql, [cin, sujet], (updateErr) => {
      if (updateErr) {
        console.error('Status Update Error:', updateErr);
        return res.redirect('/getreports?error=status_update_failed');
      }
      res.redirect('/getreports');
    });
  });
});

// end post Routes


// start put Routes

app.put('/api/services/:id', isAuthenticated, (req, res) => {
  const {
    sujet,
    prenom,
    nom,
    cin,
    numero_transaction,
    certificat_propriete_terre,
    copie_piece_identite_fermier,
    copie_piece_identite_nationale,
    demande_but,
    copie_contrat_location_terrain,
    autres_documents
  } = req.body;

  const sql = `
    UPDATE services_utilisateur 
    SET 
      sujet = ?,
      prenom = ?,
      nom = ?,
      cin = ?,
      numero_transaction = ?,
      certificat_propriete_terre = ?,
      copie_piece_identite_fermier = ?,
      copie_piece_identite_nationale = ?,
      demande_but = ?,
      copie_contrat_location_terrain = ?,
      autres_documents = ?
    WHERE id = ?
  `;

  const values = [
    sujet,
    prenom,
    nom,
    cin,
    numero_transaction,
    certificat_propriete_terre,
    copie_piece_identite_fermier,
    copie_piece_identite_nationale,
    demande_but,
    copie_contrat_location_terrain,
    autres_documents,
    req.params.id
  ];

  connection.query(sql, values, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Service updated' });
  });
});

// end put Routes


// start delete Routes

app.delete('/api/services/:id', isAuthenticated, (req, res) => {
  const sql = 'DELETE FROM services_utilisateur WHERE id = ?';
  
  connection.query(sql, [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// end delete Routes

// RESULTS// RESULTS// RESULTS// RESULTS// RESULTS// RESULTS// RESULTS// RESULTS// RESULTS// RESULTS// RESULTS

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
      services: services,
      helpers: {
        statusClass: (status) => {
          switch(status) {
            case 'مقبول': return 'bg-green-100 text-green-800 border-green-200';
            case 'مرفوض': return 'bg-red-100 text-red-800 border-red-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
          }
        }
      }
    });
  });
});

// Add delete route for results
app.delete('/api/results', isAuthenticated, (req, res) => {
  const { cin, sujet } = req.body;
  const sql = 'DELETE FROM results WHERE cin = ? AND sujet = ?';
  
  connection.query(sql, [cin, sujet], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.get('/editresult/:id', isAuthenticated, isDirecteur, (req, res) => {
  const sql = `
    SELECT s.*, r.statut 
    FROM services_utilisateur s
    LEFT JOIN results r ON s.cin = r.cin AND s.sujet = r.sujet
    WHERE s.id = ?`;

  connection.query(sql, [req.params.id], (err, results) => {
    if (err || results.length === 0) return res.redirect('/results');
    
    res.render('editresult', {
      title: 'تعديل النتيجة',
      service: results[0],
      result: results[0].statut || 'pending',
      // Add helpers directly in this render call
      helpers: {
        eq: (a, b) => a === b
      }
    });
  });
});

app.post('/updateresult', isAuthenticated, isDirecteur, (req, res) => {
  const { id, sujet, nom, prenom, cin, numero_transaction, statut } = req.body;
  
  // Validate allowed statuses
  const allowedStatuses = ['مقبول', 'مرفوض'];
  if (!allowedStatuses.includes(statut)) {
    return res.status(400).send('الحالة المحددة غير صالحة');
  }

  const sql = `
    INSERT INTO results (sujet, nom, prenom, cin, numero_transaction, statut)
    VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE statut = ?`;
  
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


// RESULTS// RESULTS// RESULTS// RESULTS// RESULTS// RESULTS// RESULTS// RESULTS// RESULTS// RESULTS// RESULTS



//Consulter //Consulter //Consulter //Consulter //Consulter //Consulter //Consulter //Consulter //Consulter 

app.get('/check-status', (req, res) => {
  res.render('check-status', { 
    title: 'التحقق من الحالة',
    result: null,
    error: null
  });
});

app.post('/check-status', (req, res) => {
  const { cin, transaction_number } = req.body;

  // Clear inputs on successful submission
  if (!cin || !transaction_number) {
    return res.render('check-status', {
      title: 'التحقق من الحالة',
      error: 'الرجاء إدخال جميع الحقول المطلوبة',
      formData: req.body // Keep form data for error correction
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

    // Return result without form data
    res.render('check-status', {
      title: 'التحقق من الحالة',
      result: results[0],
      error: null
    });
  });
});

//Consulter //Consulter //Consulter //Consulter //Consulter //Consulter //Consulter //Consulter 



//Edit Reports//Edit Reports//Edit Reports//Edit Reports//Edit Reports//Edit Reports//Edit Reports//Edit Reports
// Get all reports
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
    ORDER BY s.id DESC`;

  connection.query(sql, (err, results) => {
    if (err) return res.status(500).send('Database error');
    res.render('reports', {
      title: 'التقارير',
      services: results
    });
  });
});

// Delete report route
// Update the delete report route in app.js
app.delete('/api/reports/:id', isAuthenticated, isGerant, (req, res) => {
  const reportId = req.params.id;

  connection.beginTransaction(err => {
    if (err) return res.status(500).json({ error: err.message });

    // 1. Get report details first
    connection.query(
      'SELECT cin, sujet FROM rapport WHERE id = ?',
      [reportId],
      (err, results) => {
        if (err) return rollback(res, err);
        
        if (results.length === 0) return rollback(res, new Error('Report not found'));
        
        const { cin, sujet } = results[0];

        // 2. Delete related results
        connection.query(
          'DELETE FROM results WHERE cin = ? AND sujet = ?',
          [cin, sujet],
          (err) => {
            if (err) return rollback(res, err);

            // 3. Delete the report
            connection.query(
              'DELETE FROM rapport WHERE id = ?',
              [reportId],
              (err) => {
                if (err) return rollback(res, err);
                
                connection.commit(err => {
                  if (err) return rollback(res, err);
                  res.json({ success: true });
                });
              }
            );
          }
        );
      }
    );
  });
});

// Edit report route
app.get('/editreport/:id', isAuthenticated, isGerant, (req, res) => {
  const sql = 'SELECT * FROM rapport WHERE id = ?';
  
  connection.query(sql, [req.params.id], (err, results) => {
    if (err || results.length === 0) {
      return res.redirect('/getreports');
    }
    
    res.render('edit-report', {
      title: 'تعديل التقرير',
      report: results[0],
      user: req.session.user
    });
  });
});

// Update report route
app.post('/updatereport/:id', isAuthenticated, isGerant, (req, res) => {
  const {
    surface,
    limites_terrain,
    localisation,
    superficie_batiments_anciens,
    observations
  } = req.body;

  const sql = `
    UPDATE rapport 
    SET 
      surface = ?,
      limites_terrain = ?,
      localisation = ?,
      superficie_batiments_anciens = ?,
      observations = ?
    WHERE id = ?`;

  const values = [
    surface,
    limites_terrain,
    localisation,
    superficie_batiments_anciens,
    observations,
    req.params.id
  ];

  connection.query(sql, values, (err) => {
    if (err) {
      console.error('Update Error:', err);
      return res.redirect(`/editreport/${req.params.id}?error=update_failed`);
    }
    res.redirect('/getreports');
  });
});


//Edit Reports//Edit Reports//Edit Reports//Edit Reports//Edit Reports//Edit Reports//Edit Reports














//register //register //register //register //register //register //register //register 
app.get('/pending_approval', (req, res) => {
  res.render('pending_approval', { 
      title: 'قيد الانتظار'
  });
});
app.get('/unapproved_login', (req, res) => {
  res.render('unapproved_login', { 
      title: 'قيد الانتظار'
  });
});

app.get('/register', (req, res) => {
  res.render('register', { 
    title: 'تسجيل جديد',
    layout: 'main',
    error: req.query.error,
    success: req.query.success
  });
});

// POST route to handle registration form submission
app.post('/register', (req, res) => {
  const { email_user, password_user, role_user, nom_user, prenom_user, sex_user, cin_user } = req.body;

  // Validate domain
  if (!email_user.endsWith('@crda.com')) {
    return res.redirect('/register?error=invalid_domain');
  }

  // Validate required fields
  if (!email_user || !password_user || !role_user || !nom_user || !prenom_user || !sex_user || !cin_user) {
    return res.redirect('/register?error=missing_fields');
  }

  connection.query(
    'SELECT * FROM utilisateur WHERE email_user = ? OR cin_user = ?',
    [email_user, cin_user],
    (error, results) => {
      if (error) return res.redirect('/register?error=database_error');
      if (results.length > 0) return res.redirect('/register?error=exists');

      // Insert as pending
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

//register //register //register //register //register //register //register //register //register //register //register //register 


//admin //admin//admin//admin//admin//admin//admin//admin//admin//admin//admin//admin//admin
app.get('/admin/pending-accounts', isAuthenticated, isDirecteur, (req, res) => {
// In your pending accounts route handler
connection.query(
  'SELECT id, email_user, nom_user, prenom_user, role_user FROM utilisateur WHERE status_user = "pending"',
  (err, results) => {
    if (err) return res.status(500).send('Database error');
    res.render('admin/pending-accounts', {
      title: 'الحسابات المعلقة',
      accounts: results
    });
  }
);
});

// Approve route (PUT)
// TESTING ONLY - Remove isAuthenticated and isDirecteur
// Replace PUT and DELETE routes with POST
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
//admin//admin//admin//admin//admin//admin//admin//admin//admin//admin//admin//admin//admin//admin//admin



// General error handler
app.use((error, req, res, next) => {
  res.status(error.status || 500).json({
    message: error.message || 'Erreur interne du serveur'
  });
});
// See Incoming requests
/*app.use((req, res, next) => {
  console.log(`Incoming ${req.method} request for: ${req.originalUrl}`);
  next();
});*/
// 404 error handler
app.use((req, res, next) => {
  const error = new Error('Ressource non trouvée');
  error.status = 404;
  next(error);
});
// After all routes
app.use((err, req, res, next) => {
  console.error('Global Error:', err);
  res.status(500).render('error', { 
    message: 'حدث خطأ غير متوقع',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// Start the server
const PORT = process.env.PORT || 4200;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
