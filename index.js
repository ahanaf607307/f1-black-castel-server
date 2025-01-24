const express = require("express");
const app = express();
const port = process.env.PORT || 5000;
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const stripe = require("stripe")(process.env.STRIPE_KEY);

// middle were

// const corsOptions = {
//   origin: ["https://blackcastel-e3d7a.web.app","http://localhost:5173" ],
//   credentials: true,
//   optionSuccessStatus: 200,
// };
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// mongodb code starts here


const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.USER_NAME}:${process.env.USER_PASSWORD}@cluser12.xm5ca.mongodb.net/?retryWrites=true&w=majority&appName=Cluser12`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
const userCollection = client.db("blackCastelDBC").collection("userDB");
const menuCollection = client.db("blackCastelDBC").collection("menuItemDB");
const reviewCollection = client.db("blackCastelDBC").collection("reviewsDB");
const cartCollection = client.db("blackCastelDBC").collection("cartsDB");
const paymentCollection = client.db("blackCastelDBC").collection("paymentsDB");

async function run() {
  try {
    // CRUD OPERATION HERE STARTS

        // create JWT token here

        app.post("/jwt", async (req, res) => {
     
         const user = req.body
         const token = jwt.sign(user , process.env.USER_TOKEN , {expiresIn : '365d'})
         res.send({token})
        });

        // verify token ----> 

        const verifyToken = (req, res , next) => {
          if(!req.headers.authorization){
            return res.status(401).send({message : 'unauthorize access'})
          }
          const token = req.headers.authorization.split(' ')[1]
          jwt.verify(token , process.env.USER_TOKEN , (err, decoded) => {
            if(err){
              return res.status(401).send({message : 'unauthorize access'})
            }
            req.decoded = decoded
            next()
          })

        }
    
     

    // verify Admin --------

    const verifyAdmin = async (req, res, next) => {
      console.log('token',req.headers.authorization)
      const email = req.decoded?.email;
      console.log(email);
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };



    // add user to userCollection
    app.post("/users", async (req, res) => {
      const users = req.body;
      // check if user alredy exist
      const query = { email: users.email };
      const oldUser = await userCollection.findOne(query);
      if (oldUser) {
        return res.send({ message: "user already Exist" });
      }
      const result = await userCollection.insertOne(users);
      res.send(result);
    });
    // get all users
    app.get("/users",verifyToken,  async (req, res) => {

      const users = req.body;
      const result = await userCollection.find(users).toArray();
      res.send(result);
    });
    // delete One User From Admin
    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    // update user Role
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // get admin By Email ----------
    app.get("/users/admin/:email",verifyToken,verifyAdmin, async (req, res) => {
      const email = req.params.email;

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user.role === "admin";
      }
      res.send({ admin });
    });

    // post menu data

    app.post("/menu",  async (req, res) => {
      const menuItem = req.body;
      const result = await menuCollection.insertOne(menuItem);
      res.send(result);
    });
    // get menu data
    app.get("/menu", async (req, res) => {
      const data = req.body;
      const result = await menuCollection.find(data).toArray();
      res.send(result);
    });

    // delete menu by id
    app.delete("/menu/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    });

    // get single Menu by id
    app.get("/updateItem/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.findOne(query);
      res.send(result);
    });

    // update menu Item by Id
    app.patch("/updateItem/:id", async (req, res) => {
      const id = req.params.id;
      const item = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          name: item.name,
          category: item.category,
          price: item.price,
          image: item.image,
        },
      };

      const result = await menuCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });
    // get reviews data -->
    app.get("/reviews", async (req, res) => {
      const reviews = req.body;
      const result = await reviewCollection.find(reviews).toArray();
      res.send(result);
    });

    // addToCart In Db Post Api
    app.post("/carts", async (req, res) => {
      const carts = req.body;
      const result = await cartCollection.insertOne(carts);
      res.send(result);
    });
    // get all data by Email Get Api for Cart Item

    app.get("/carts", async (req, res) => {
      const email = req.query.email;

      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });
    // delete One Item using params
    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });
    // CRUD OPERATION HERE ENDS

    // payment Post Method Stripe  Payment Intent
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // get Spacific User Email 
    app.get("/payments/:email" , async(req, res) => {
      const query = {email : req.params.email}
      console.log('user email' , req.params.email ,'decoded email' ,  req.decoded.email)
      if(req.params.email !== req.decoded.email){
        return res.status(403).send({message : 'forbidden access'})
      }
      const result = await paymentCollection.find(query).toArray()
      res.send(result)

      console.log(result)
    })
    // Payment Api for stripe
    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);
      const query = {
        _id: {
          $in: payment.menuItemId.map((id) => new ObjectId(id)),
        },
      };

      const deleteResult = await cartCollection.deleteMany(query);
      res.send({ paymentResult, deleteResult });
    });

    // admin Stats Api 

    app.get('/admin-stats' ,async (req, res) => {
      const totalMenu = await menuCollection.estimatedDocumentCount()
      const totalUser = await userCollection.estimatedDocumentCount()
      const totalOrder = await paymentCollection.estimatedDocumentCount()
      // payment revenue 
      // const payments = await paymentCollection.find().toArray()
      // const revenue = payments.reduce((total , payment ) => total + payment.price , 0)

      // best way to get Revenue
      const revenue = await paymentCollection.aggregate([
        {
          $group : {
            _id : null , 
            totalRevenue :{
              $sum :'$price'
            } 
          }
        }
      ]).toArray()
      const totalRevenue = revenue.length > 0 ? revenue[0].totalRevenue : 0;
      res.send({
        totalMenu, 
        totalUser,
        totalOrder,
        totalRevenue
      })
    })




    // end CRUD OPERATION  -------------
  } finally {
  }
}
run().catch(console.dir);

// mongodb code ends here

app.get("/", (req, res) => {
  res.send("Black Castel Server Is Running");
});

app.listen(port, (req, res) => {
  console.log(`Runnig port is --> ${port}`);
});
