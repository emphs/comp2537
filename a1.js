

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
        maxAge: 3600
    }
}));

app.use("/js", express.static("./public/js"));
app.use("/css", express.static("./public/css"));
app.use("/img", express.static("./public/img"));
app.use("/html", express.static("./public/html"));

app.get('/', (req, res) => {

    console.log(req.session);
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>a1</title>
        </head>
        <body>
        ${ req.session.stat ?
        `
            <h1>Hello, ${req.session.name || "N/A"}</h1>
            <button onclick="location.href='/members'" type="button">Go to Members Area</button><br>
            <button onclick="location.href='/logout'" type="button">Logout</button>`
        :
        `
            <button onclick="location.href='/signup'" type="button">Sign up</button><br>
            <button onclick="location.href='/login'" type="button">Log in</button>`
    }
        </body>
        </html>
    `);
});

let joiEval = Joi.object({
    name: Joi.string().min(6).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required()
});
const mSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
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
    console.log(233)
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>a1</title>
        </head>
        <body>
        <h1>create user</h1>
        <form action="/signupSubmit" method="POST">
            <input type="text" placeholder="name" name="name"><br>
            <input type="email" placeholder="email" name="email"><br>
            <input type="password" placeholder="password" name="password"><br>
            <br>
            <button type="submit">Submit</button>
        </form>
        </body>
        </html>
    `);
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
        const user = new u_orm(value);
        user.save().then(r => console.log("ok", r));
        res.redirect('/members');
    } else {
        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>a1</title>
            </head>
            <body>
            ${errors}
            <a href="/signup">Try again</a>
            </body>
            </html>
        `);
    }
});

const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required()
});

app.get('/login', async (req, res) => {
    console.log(233)
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>a1</title>
        </head>
        <body>
        <h1>login</h1>
        <form action="/loginSubmit" method="POST">
            <input type="email" placeholder="email" name="email"><br>
            <input type="password" placeholder="password" name="password"><br>
            <br>
            <button type="submit">Submit</button>
        </form>
        </body>
        </html>
    `);
});

app.post('/loginSubmit', async (req, res) => {
    let { email, password } = req.body;

    const { error, value } = loginSchema.validate(req.body);
    if (error) {
        return res.status(400).send(error.details[0].message);
    }

    let user = await u_orm.findOne({ email: value.email });
    if (!user) {
        return res.status(401).send('Invalid credentials');
    }

    if (! await bcrypt.compare(value.password, user.password)) {
        return res.status(401).send('Invalid credentials');
    }

    console.log(user);

    req.session.stat = "valid";
    // req.session.name = user.name;
    req.session.email = email;


    res.redirect('/members');
});

app.get('/logout', (req, res) => {
    req.session.stat = undefined;
    req.session.destroy();
    return res.redirect('/');
});

app.get('/members', async (req, res) => {
    if (!req.session.stat) {
        return res.status(403).redirect('/');
    }

    res.send(`
        <h1>Hello, ${req.session.name}</h1>
        <form action="/logout" method="get">
            <button type="submit">Sign Out</button>
        </form>
    `);
});

app.use(function (req, res, next) {
    res.status(404).send("<html><head><title>404</title></head><body><p>Page not found!</p></body></html>");
});

let port = process.env.PORT || 8000;;
app.listen(port, function () {
    console.log("Example app listening on port " + port + "!");
});

