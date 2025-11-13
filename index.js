const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const admin = require("firebase-admin");

const serviceAccount = require("./homigoFirebaseKey.json");
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

//middleware
app.use(cors());
app.use(express.json());

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

app.get('/', (req, res) => {
    res.send('Hello World!')
})

// MongoDB connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@shworddb.sx7qtlu.mongodb.net/?appName=SHWordDB`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

const verifyIdFierbaseToken = async (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        res.status(401).send(
            { message: "unauthorization access." }
        );
    }
    const token = authorization.split(' ')[1];

    if (!token) {
        res.status(401).send(
            { message: "unauthorization access." }
        );
    }

    try {
        const decode = await admin.auth().verifyIdToken(token);
        console.log(decode);
        next();
    } catch {
        res.status(401).send(
            { message: "unauthorization access." }
        );
    }
}

async function run() {
    try {
        // await client.connect();

        const db = client.db('homigo_db');
        const servicesCollection = db.collection('services');
        const bookingsCollection = db.collection("bookings");
        const usersCollection = db.collection('usersInfo');

        //get all services
        app.get('/services', async (req, res) => {

            const result = await servicesCollection
                .find().toArray();

            res.send(result);
        });

        // get 3 services for banner
        app.get('/services/banner', async (req, res) => {
            try {
                const result = await servicesCollection
                    .find({}, { projection: { serviceImageURL: 1, serviceName: 1, description: 1 } })
                    .limit(3)
                    .toArray();

                res.send(result);
            } catch (error) {
                res.status(500).send({ error: "Failed to fetch banner services" });
            }
        });



        // get 6 top rated services
        app.get('/services/top-rated', async (req, res) => {

            try {
                const result = await servicesCollection
                    .find()
                    .sort({ ratings: -1 })
                    .limit(6)
                    .toArray();

                res.send(result);
            } catch (error) {

                res.status(500)
                    .send({ error: "Failed to fetch top-rated services" });
            }
        });

        // get single service details
        app.get('/services/:id', verifyIdFierbaseToken, async (req, res) => {

            const id = req.params.id;
            const result = await servicesCollection
                .findOne({ _id: new ObjectId(id) });

            res.send(result);
        });

        // Example Express route
        app.get('/services', async (req, res) => {
            const { minPrice, maxPrice } = req.query;
            const query = {};

            if (minPrice || maxPrice) {
                query.price = {};
                if (minPrice) query.price.$gte = Number(minPrice);
                if (maxPrice) query.price.$lte = Number(maxPrice);
            }

            try {
                const services = await servicesCollection.find(query).toArray();
                res.json(services);
            } catch (error) {
                console.error("Error fetching services:", error);
                res.status(500).json({ error: "Failed to fetch services" });
            }
        });



        // create booking
        app.post("/bookings", verifyIdFierbaseToken, async (req, res) => {

            const booking = req.body;

            const service = await servicesCollection.findOne({ _id: new ObjectId(booking.serviceId) });

            if (service.providerEmail === booking.userEmail) {
                return res.status(400)
                    .send({ error: "You cannot book your own service" });
            }

            booking.createdAt = new Date();
            const result = await bookingsCollection
                .insertOne(booking);

            res.send(result);
        });

        // get bookings for a user
        app.get("/my-bookings", verifyIdFierbaseToken, async (req, res) => {

            const email = req.query.email;

            const result = await bookingsCollection
                .find({ userEmail: email })
                .toArray();

            res.send(result);
        });

        // delete booking
        app.delete("/bookings/:id", verifyIdFierbaseToken, async (req, res) => {

            const id = req.params.id;

            const result = await bookingsCollection
                .deleteOne({ _id: new ObjectId(id) });
            res.send(result);
        });

        // add services
        app.post('/service', verifyIdFierbaseToken, async (req, res) => {

            const service = req.body;
            // service.createdAt = new Date();

            const result = await servicesCollection
                .insertOne(service);

            res.send({ success: true, result });
        });

        // get my services
        app.get('/my-services', verifyIdFierbaseToken, async (req, res) => {

            const email = req.query.email;

            const services = await servicesCollection
                .find({
                    providerEmail: email
                }).toArray();

            res.send(services);
        });

        // delete services
        app.delete('/services/:id', verifyIdFierbaseToken, async (req, res) => {

            const id = req.params.id;

            const result = await servicesCollection.deleteOne({ _id: new ObjectId(id) });

            res.send(result);
        });

        // PATCH /services/:id 
        app.patch('/services/:id', async (req, res) => {
            const id = req.params.id;
            const updateDoc = { $set: req.body };
            const result = await servicesCollection
                .updateOne({ _id: new ObjectId(id) }, updateDoc); res.send(result);
        });


        app.post("/users", async (req, res) => {
            const user = req.body;

            const existing = await usersCollection.findOne({ uid: user.uid });
            if (existing) {
                return res.json({ success: false, message: "User already exists" });
            }

            const result = await usersCollection.insertOne(user);
            res.json({ success: true, insertedId: result.insertedId });
        });

        //post reviews
        app.post("/services/:id/reviews", async (req, res) => {
            const { id } = req.params;
            const { userName, email, photoURL, rating, comment } = req.body;

            const review = {
                userName,
                email,
                photoURL,
                rating: Number(rating),
                comment,
                createdAt: new Date(),
            };

            await servicesCollection.updateOne(
                { _id: new ObjectId(id) },
                { $push: { reviews: review } }
            );

            const service = await servicesCollection.findOne({ _id: new ObjectId(id) });
            const ratings = service.reviews.map(r => r.rating);
            const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;

            await servicesCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: { averageRating: avg, ratings: ratings.length } }
            );

            res.json({ success: true });
        });

        // GET: All reviews with serviceName and customer info
        app.get("/reviews", async (req, res) => {
            try {
                const services = await servicesCollection.find({}).toArray();

                const allReviews = services.flatMap(service =>
                    (service.reviews || []).map(r => ({
                        serviceName: service.serviceName,
                        userName: r.userName,
                        comment: r.comment,
                        rating: r.rating,
                        photoURL: r.photoURL
                    }))
                );

                res.json(allReviews);
            } catch (error) {
                console.error("Error fetching reviews:", error);
                res.status(500).json({ error: "Failed to fetch reviews" });
            }
        });




        // await client.db("admin").command({ ping: 1 });
        console.log("Backend running...");
    } finally {
        // await client.close();
    }
}
run().catch(console.dir);

app.listen(port, () => {
    console.log(`Server listening on port ${port}`)
})