const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

//middleware
app.use(cors());
app.use(express.json());

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

async function run() {
    try {
        await client.connect();

        const db = client.db('homigo_db');
        const servicesCollection = db.collection('services');
        const userInfoCollection = db.collection('userInfo');
        const bookingsCollection = db.collection("bookings");

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
        app.get('/services/:id', async (req, res) => {

            const id = req.params.id;
            const result = await servicesCollection
                .findOne({ _id: new ObjectId(id) });

            res.send(result);
        });

        // create booking
        app.post("/bookings", async (req, res) => {

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
        app.get("/my-bookings", async (req, res) => {

            const email = req.query.email;

            const result = await bookingsCollection
                .find({ userEmail: email })
                .toArray();

            res.send(result);
        });

        // delete booking
        app.delete("/bookings/:id", async (req, res) => {

            const id = req.params.id;

            const result = await bookingsCollection
                .deleteOne({ _id: new ObjectId(id) });
            res.send(result);
        });

        // add services
        app.post('/service', async (req, res) => {

            const service = req.body;
            // service.createdAt = new Date();

            const result = await servicesCollection
                .insertOne(service);

            res.send({ success: true, result });
        });

        // get my services
        app.get('/my-services', async (req, res) => {

            const email = req.query.email;

            const services = await servicesCollection
                .find({
                    providerEmail: email
                }).toArray();

            res.send(services);
        });

        // delete services
        app.delete('/services/:id', async (req, res) => {

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


        app.get('/userInfo', async (req, res) => {

            const result = await userInfoCollection
                .find().toArray();

            res.send(result);
        });


        await client.db("admin").command({ ping: 1 });
        console.log("Backend running...");
    } finally {
        // await client.close();
    }
}
run().catch(console.dir);

app.listen(port, () => {
    console.log(`Server listening on port ${port}`)
})