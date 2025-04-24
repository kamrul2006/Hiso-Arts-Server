const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cookieParser = require('cookie-parser')
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000


// --------------------middle ware-------------------------
app.use(cors({
    origin: ['http://localhost:5173',
        'https://k-histocraft.web.app',
        'https://k-histocraft.firebaseapp.com'
    ],
    credentials: true
}))
app.use(express.json());
app.use(cookieParser());

// // ------------------------------------------

const tokenVerify = (req, res, next) => {
    const token = req?.cookies?.token
    // console.log('inside the tokenVerify part', token)

    if (!token) {
        return res.status(401).send({ massage: "Unauthorized access" })
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            console.error('JWT Verification Error:', err.message);
            return res.status(403).send({ message: "Forbidden: Invalid or Expired Token" });
        }
        req.user = decoded;
        next();
    });

}

// ----------------connecting MONGO db---------------------------
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.8jqou.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {

        // ---------------creating DATA BASE ON MONGO DB----------------------
        const HistoCollection = client.db("CraftDB").collection('All-Crafts')
        const LikedCollection = client.db("CraftDB").collection('All-Liked')

        // ---auth related Apis-------------------------------
        app.post('/jwt', async (req, res) => {
            const user = req.body
            const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '10h' })
            res
                .cookie('token', token, {
                    httpOnly: true,
                    // secure: false,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: process.env.NODE_ENV === 'production' ? "none" : "strict"
                })
                // .send(token)
                .send({ success: true })
        })

        app.post('/logout', (req, res) => {
            res.clearCookie('token', {
                httpOnly: true,
                // secure: false,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? "none" : "strict"
            }).send({ tokenRemoved: true })
        })


        //---------------------------Showing all craft------------------------
        app.get('/allCraft', async (req, res) => {

            //------------------------------Search here---------------------------
            const { Search } = req.query;
            let option = {}
            if (Search) {
                option = { artifactName: { $regex: Search, $options: "i" } }
            }

            const cursor = HistoCollection.find(option).sort({ Like: -1 })
            const result = await cursor.toArray()
            res.send(result)
        })

        //-------------------add Craft------------------------------------------
        app.post('/allCraft', async (req, res) => {
            const newCraft = req.body
            // console.log(newCraft)
            const result = await HistoCollection.insertOne(newCraft)
            res.send(result)
        })

        //---------------------------Get craft by ID-----------------------------
        app.get('/allCraft/:id', async (req, res) => {
            const id = req.params.id
            // console.log(id)
            const query = { _id: new ObjectId(id) }
            const result = await HistoCollection.findOne(query)
            res.send(result)
        })

        //--------------------------------delete craft---------------------------
        app.delete('/allCraft/:id', async (req, res) => {
            const id = req.params.id
            //  console.log(id)
            const cursor = { _id: new ObjectId(id) }
            const result = await HistoCollection.deleteOne(cursor)
            res.send(result)
        })

        //----------------------- update craft---------------------------------
        app.put('/allCraft/:id', async (req, res) => {
            const id = req.params.id
            //  console.log(id)
            const query = { _id: new ObjectId(id) }
            const option = { upsert: true }
            const updatedCraft = req.body
            // console.log(updatedCraft)

            const Craft = {
                $set: {
                    artifactName: updatedCraft.artifactName,
                    artifactImage: updatedCraft.artifactImage,
                    artifactType: updatedCraft.artifactType,
                    historicalContext: updatedCraft.historicalContext,
                    createdAt: updatedCraft.createdAt,
                    discoveredAt: updatedCraft.discoveredAt,
                    presentLocation: updatedCraft.presentLocation,
                    adderInfo: {
                        name: updatedCraft.adderInfo.name,
                        email: updatedCraft.adderInfo.email
                    },
                    discoveredBy: updatedCraft.discoveredBy,
                    Like: updatedCraft.Like,
                }
            }
            // console.log(Craft)

            const result = await HistoCollection.updateOne(query, Craft, option)
            res.send(result)
        })


        //-------------------------------------------------------------------------------------------------------
        //-------------------------------------------------------------------------------------------------------



        //-------------------add liked-----------------------------------------
        app.post('/liked', async (req, res) => {
            const newLiked = req.body
            //  console.log(newVisa)
            const result = await LikedCollection.insertOne(newLiked)

            //-not the best way to get the application count
            const id = newLiked.data._id
            const query = { _id: new ObjectId(id) }
            const likee = await HistoCollection.findOne(query)

            // console.log(newLiked)
            // console.log(query)
            // console.log(likee)

            let likeCount = 0

            if (likee.Like) {
                likeCount = likee.Like + 1
            }
            else {
                likeCount = 1
            }

            //---updating the like count
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    Like: likeCount
                }
            }

            const updatedResult = await HistoCollection.updateOne(filter, updatedDoc)

            res.send(result)
        })


        //---------------------------Showing all like-----------------------
        app.get('/liked', tokenVerify, async (req, res) => {
            const QEmail = req.query.email
            const query = { email: QEmail }

            // console.log(QEmail)
            // console.log(req.user.email)

            if (req.user.email !== req.query.email) {
                return res.status(403).send({ massage: "forbidden" })
            }

            const cursor = await LikedCollection.find(query).toArray()
            // const result = cursor
            // console.log(cursor)
            res.send(cursor)
        })

        //---------------------------Get like by ID-----------------------
        app.get('/liked/:id', async (req, res) => {
            const id = req.params.id
            // console.log(id)
            const query = { likeId: id }
            const result = await LikedCollection.findOne(query)
            res.send(result)
        })

        //--------------------------------delete like---------------------------
        app.delete('/liked/:id', async (req, res) => {
            const id = req.params.id
            //  console.log(id)
            const cursor = { likeId: id }
            const result = await LikedCollection.deleteOne(cursor)

            const query = { _id: new ObjectId(id) }
            const likee = await HistoCollection.findOne(query)

            // console.log(newLiked)
            // console.log(query)
            // console.log(likee)

            if (likee.Like > 1) {
                likeCount = likee.Like - 1
            }
            else {
                likeCount = 0
            }

            //---updating the like count
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    Like: likeCount
                }
            }

            const updatedResult = await HistoCollection.updateOne(filter, updatedDoc)

            res.send(result)
        })

        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {

    }
}
run().catch(console.dir);




// -----------------------get the root rout----------------
app.get("/", (req, res) => {
    res.send('All the history are here.')
})

// -----------------------running on port---------------------
app.listen(port)


