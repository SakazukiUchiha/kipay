const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bodyParser = require('body-parser');
const http = require('http');
const fs = require('fs');
const session = require('express-session');

const app = express();
const port = 3004;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(__dirname));

app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

const mongoURI = 'mongodb://127.0.0.1:27017/AppointmentSystem';

// Connect to MongoDB
mongoose.connect(mongoURI, {
    serverSelectionTimeoutMS: 5000, 
})
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => {
        console.error('Error connecting to MongoDB:', err);
        process.exit(1);
    });

mongoose.Promise = global.Promise;

const userSchema = new mongoose.Schema({
    username: String,
    email: String,
    password: String,
    role: String
});

const User = mongoose.model('User', userSchema);

const patientSchema = new mongoose.Schema({
    username: String,
    email: String,
    password: String,
    isProfileComplete: { type: Boolean, default: false }
});

const staffSchema = new mongoose.Schema({
    username: String,
    email: String,
    password: String
});

const providerSchema = new mongoose.Schema({
    username: String,
    email: String,
    password: String,
    isProfileComplete: { type: Boolean, default: false } // Added isProfileComplete field
});

const Patient = mongoose.model('Patient', patientSchema);
const Staff = mongoose.model('Staff', staffSchema);
const Provider = mongoose.model('Provider', providerSchema);

const patientProfileSchema = new mongoose.Schema({
    email: String,
    fullName: String,
    contactInfo: String,
    medicalConditions: String,
    medications: String,
    allergies: String,
    emergencyContactName: String,
    emergencyContactPhone: String,
    age: Number, // Added age field
    gender: String, // Added gender field
    // Add other fields here
});

const PatientProfile = mongoose.model('PatientProfile', patientProfileSchema);

const providerProfileSchema = new mongoose.Schema({
    fullName: String,
    contactInfo: String, // Changed from Number to String
    job: String,
    specialization: String,
    licenseNumber: Number,
    medicalSchool: String,
    graduationYear: Number,
    yearsOfExperience: Number,
    boardCertifications: String,
    affiliations: String
});

const ProviderProfile = mongoose.model('ProviderProfile', providerProfileSchema);

app.post('/create', async (req, res) => {
    const { username, email, password, confirmPassword, role } = req.body;

    if (password !== confirmPassword) {
        return res.status(400).send('Passwords do not match');
    }

    let newUser;
    switch (role) {
        case 'patient':
            newUser = new Patient({ username, email, password, isProfileComplete: false });
            break;
        case 'clinic-staff':
            newUser = new Staff({ username, email, password });
            break;
        case 'healthcare-provider':
            newUser = new Provider({ username, email, password });
            break;
        default:
            return res.status(400).send('Invalid role');
    }

    try {
        await newUser.save();
        res.status(201).send('User created');
    } catch (error) {
        res.status(500).send('Error creating user');
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        let user = await Patient.findOne({ username, password });
        if (user) {
            if (!user.isProfileComplete) {
                req.session.email = user.email; // Store email in session
                return res.redirect(`/PatientProfile.html?email=${user.email}`);
            } else {
                req.session.email = user.email; // Store email in session
                return res.redirect(`/MainPatientDash.html`);
            }
        }

        user = await Staff.findOne({ username, password });
        if (user) {
            req.session.email = user.email; // Store email in session
            return res.redirect(`/StaffProfile.html?email=${user.email}`);
        }

        user = await Provider.findOne({ username, password });
        if (user) {
            req.session.email = user.email; // Store email in session
            if (!user.isProfileComplete) {
                return res.redirect(`/ProviderProfile.html?email=${user.email}`);
            } else {
                return res.redirect(`/MainProviderDash.html`);
            }
        }

        res.status(401).send('Invalid username or password');
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).send('Internal server error');
    }
});

app.post('/saveProfile', async (req, res) => {
    const { email, /* other fields */ } = req.body;

    try {
        const profile = new PatientProfile({ email, /* other fields */ });
        await profile.save();
        res.status(201).send('Profile saved');
    } catch (error) {
        console.error('Error saving profile:', error);
        res.status(500).send('Error saving profile');
    }
});

app.post('/savePatientProfile', async (req, res) => {
    const { email, fullName, contactInfo, medicalConditions, medications, allergies, emergencyContactName, emergencyContactPhone, age, gender } = req.body; // Added age and gender

    try {
        const profile = new PatientProfile({ email, fullName, contactInfo, medicalConditions, medications, allergies, emergencyContactName, emergencyContactPhone, age, gender }); // Added age and gender
        await profile.save();
        await Patient.updateOne({ email }, { isProfileComplete: true });
        res.status(201).json({ success: true, message: 'Profile saved successfully' });
    } catch (error) {
        console.error('Error saving profile:', error);
        res.status(500).json({ success: false, message: 'Error saving profile' });
    }
});

app.post('/saveProviderProfile', async (req, res) => {
    const { fullName, contactInfo, jobTitle, specialization, licenseNumber, medicalSchool, graduationYear, experienceYears, boardCertifications, affiliations } = req.body;

    try {
        const profile = new ProviderProfile({
            fullName,
            contactInfo,
            job: jobTitle,
            specialization,
            licenseNumber,
            medicalSchool,
            graduationYear,
            yearsOfExperience: experienceYears,
            boardCertifications,
            affiliations
        });
        await profile.save();
        await Provider.updateOne({ email: req.session.email }, { isProfileComplete: true }); // Update isProfileComplete to true
        res.status(201).json({ success: true, message: 'Profile saved successfully' });
    } catch (error) {
        console.error('Error saving provider profile:', error);
        res.status(500).json({ success: false, message: 'Error saving provider profile' });
    }
});

app.get('/getProviderProfiles', async (req, res) => {
    try {
        const profiles = await ProviderProfile.find({});
        res.status(200).json(profiles);
    } catch (error) {
        console.error('Error fetching provider profiles:', error);
        res.status(500).json({ success: false, message: 'Error fetching provider profiles' });
    }
});

app.get('/getAllProviderProfiles', async (req, res) => {
    try {
        const profiles = await ProviderProfile.find({});
        res.status(200).json(profiles);
    } catch (error) {
        console.error('Error fetching provider profiles:', error);
        res.status(500).json({ success: false, message: 'Error fetching provider profiles' });
    }
});

app.get('/getPatientProfile', async (req, res) => {
    const { email } = req.query;

    try {
        const profile = await PatientProfile.findOne({ email });
        if (profile) {
            res.status(200).json(profile);
        } else {
            res.status(404).json({ message: 'Profile not found' });
        }
    } catch (error) {
        console.error('Error fetching patient profile:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.get('/api/getUserProfile', async (req, res) => {
    const email = req.session.email; // Assuming email is stored in session
    if (!email) {
        return res.status(401).send('Unauthorized');
    }

    try {
        const profile = await PatientProfile.findOne({ email });
        if (profile) {
            res.status(200).json(profile);
        } else {
            res.status(404).json({ message: 'Profile not found' });
        }
    } catch (error) {
        console.error('Error fetching patient profile:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.get('/getProviderDetails', async (req, res) => {
    const providerId = req.query.providerId; // Get provider ID from query parameter

    if (!providerId || !mongoose.Types.ObjectId.isValid(providerId)) {
        return res.status(400).send('Invalid provider ID');
    }

    try {
        const provider = await ProviderProfile.findById(providerId);
        if (provider) {
            res.json(provider); // Send provider details as JSON response
        } else {
            res.status(404).send('Provider not found');
        }
    } catch (error) {
        console.error('Error fetching provider details:', error);
        res.status(500).send('Internal server error');
    }
});

app.get('/appointmentMenu', (req, res) => {
    const providerId = req.query.providerId;
    if (!providerId) {
        return res.status(400).send('Provider ID is missing');
    }
    res.sendFile(path.join(__dirname, 'AppointmentMenu.html'));
});

app.post('/bookAppointment', async (req, res) => {
    const { providerId, userId, appointmentDate, appointmentTime } = req.body;

    try {
        // Save appointment to the database
        await db.query(
            'INSERT INTO appointments (providerId, userId, appointmentDate, appointmentTime) VALUES (?, ?, ?, ?)',
            [providerId, userId, appointmentDate, appointmentTime]
        );
        res.send('Appointment booked successfully');
    } catch (error) {
        console.error('Error booking appointment:', error);
        res.status(500).send('Error booking appointment');
    }
});

app.get('/', (req, res) => {
    res.redirect('/main.html');
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Trying another port...`);
        app.listen(0, () => {
            const newPort = app.address().port;
            console.log(`Server running at http://localhost:${newPort}/`);
        });
    } else {
        console.error('Server error:', err);
    }
});