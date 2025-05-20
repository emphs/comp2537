

const express = require("express");
const session = require('express-session');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const { JSDOM } = require('jsdom');
const bcrypt = require('bcrypt');
const Joi = require('joi');
const app = express();
app.use(express.json());
const fs = require("fs");

require('dotenv').config();

// const { MongoClient, ServerApiVersion } = require('mongodb');
// const uri = "";
// const client = new MongoClient(uri, {
//     serverApi: {
//         version: ServerApiVersion.v1,
//         strict: true,
//         deprecationErrors: true,
//     }
// });
// async function run() {
//     try {
//         await client.connect();
//         await client.db("admin").command({ ping: 1 });
//         console.log("Pinged your deployment. You successfully connected to MongoDB!");
//     } finally {
//         await client.close();
//     }
// }
// run().catch(console.dir);

mongoose.connect(process.env.MONGO_URL)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
    secret: "uhm secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 360000
    }
}));

app.use("/js", express.static("./public/js"));
app.use("/css", express.static("./public/css"));
app.use("/img", express.static("./public/img"));
app.use("/html", express.static("./public/html"));

app.set('view engine', 'ejs');
app.set('views', 'ejs_views');

app.get('/', (req, res) => {

    console.log(req.session);

    res.render('index', {
        title: "home", stat: req.session.stat, name: req.session.name,
    });

});

let joiEval = Joi.object({
    name: Joi.string().min(6).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
});

const mSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    session_from: { type: Number, default: 0 },
    user_type: { type: String, enum: ['user', 'admin'], default: 'user' },
    password: { type: String, required: true }
});

mSchema.pre('save', async function(next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

const u_orm = mongoose.model('User', mSchema);

app.get('/signup', async (req, res) => {
    res.render('signup', {
        title: "signup",
    });
});

app.post('/signupSubmit', (req, res) => {
    let { name, email, password } = req.body;
    let errors = name ? "" : "<p>missing name</p><br>";
    errors += email ? "" : "<p>missing email</p><br>";
    errors += password ? "" : "<p>missing password</p><br>";

    console.log(name)
    console.log(email)
    console.log(password)

    if (name && email && password) {

        let { error, value } = joiEval.validate(req.body);
        if (error) {
            return res.status(400).send(error.details[0].message + "<br><a href=\"/signup\">Try again</a>");
        }

        req.session.stat = "valid";
        req.session.name = name;
        req.session.type = "user";
        value.session_from = Date.now();
        const user = new u_orm(value);
        user.save().then(r => console.log("ok", r));
        res.redirect('/members');
    } else {
        res.render('signupSubmit', {
            title: "signupSubmit", errors: errors,
        });
    }
});

const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required()
});

app.get('/login', async (req, res) => {

    res.render('login', {
        title: "login",
    });
});

app.post('/loginSubmit', async (req, res) => {
    let { email, password } = req.body;

    const { error, value } = loginSchema.validate(req.body);
    if (error) {
        return res.status(400).render('loginSubmit', {
            title: "loginSubmit", errors: error.details[0].message,
        });
    }

    let user = await u_orm.findOne({ email: value.email });

    if (!user) {
        return res.status(401).render('loginSubmit', {
            title: "loginSubmit", errors: "Invalid credentials",
        });
    }

    if (! await bcrypt.compare(value.password, user.password)) {
        return res.status(401).render('loginSubmit', {
            title: "loginSubmit", errors: "Invalid credentials",
        });
    }

    console.log(user);

    req.session.stat = "valid";
    req.session.name = user.name;
    req.session.email = email;
    req.session.type = user.user_type;


    res.redirect('/members');
});

app.get('/logout', (req, res) => {
    req.session.stat = undefined;
    req.session.destroy();
    return res.redirect('/');
});

app.get('/members', async (req, res) => {

    console.log(req.session.stat);

    if (!req.session.stat) {
        return res.status(403).redirect('/');
    }

    const routes = ['/img/icon-mail.svg', '/img/icon_js.svg', '/img/icon_terraform.svg'];

    res.render('members', {
        title: "member",
        routes: routes,
    });
});


app.get('/admin', async (req, res) => {

    if (!req.session.stat) {
        return res.status(403).redirect('/login');
    }

    if (req.session.type !== "admin") {
        return res.status(403).render('adminError', {
            title: "adminError",
        });
    }

    const users = await u_orm.find();
    res.render('admin', {
        title: "admin",
        users
    });


});

app.post('/admin/update', async (req, res) => {
    const { userId, action } = req.body;
    try {
        const user = await u_orm.findById(userId);
        if (user) {
            user.user_type = action === 'promote' ? 'admin' : 'user';
            await user.save();
            res.redirect('/admin');
        } else {
            res.redirect('/admin');
        }
    } catch (error) {
        console.error(error);
        res.redirect('/admin');
    }
});

app.use(function (req, res, next) {
    res.status(404).render('404', {
        title: "404",
    });
});

let port = process.env.PORT || 8000;;
app.listen(port, function () {
    console.log("Example app listening on port " + port + "!");
});

