const file=require('fs')
const express=require('express')
const app=express();
const cors=require('cors')
const mysql=require('mysql2')
const Razorpay=require('razorpay')
const crypto=require('crypto')
const bcrypt=require('bcrypt')
require("dotenv").config();
const jwt = require("jsonwebtoken");


const JWT_SECRET = process.env.JWT_SECRET;

// Example: generate token when user logs in
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role }, 
    JWT_SECRET, 
    { expiresIn: "1h" }
  );
}
// Example: verify token middleware
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(" ")[1];

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        return res.sendStatus(403); // Invalid token
      }
      req.user = user;
      next();
    });
  } else {
    res.sendStatus(401); // No token
  }
}

// for storing images to cloudinary and sending link to database

const cloudinary = require('cloudinary');
const { string } = require('yup');
// const { log } = require('console');




const uploadImage = async (localImagePath) => {
  try {
    const result = await cloudinary.uploader.upload(localImagePath);
    console.log("Image uploaded successfully!");
    console.log("Image URL:", result.secure_url);
    return result.secure_url;
  } catch (error) {
    console.error("Error uploading image:", error);
  }
};

// Call the function
// img 1 
// uploadImage("C:\\Images\\course1_img.webp");
//  img 2
// uploadImage("C:\\Images\\course2_img.webp");
// img3
// uploadImage("C:\\Images\\course3_img.webp");
// img4
// uploadImage("C:\\Images\\course4_img.webp");



app.use(express.json())
app.use(cors())

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
});


db.connect((err)=>{
    if(err)throw err
    console.log("Successfully Connection to database!!")
})


app.get('/allcourses', (req, res) => {
    const all_course_query = 'SELECT * FROM web_dev_courses;';
    db.query(all_course_query, (err, results) => {
        if (err) {
            // If there's an error in the query, send an error response
            return res.status(500).json({ msg: "Error fetching data from the database" });
        }
        if (results.length > 0) {
            console.log("Backend data retrieved!!");
            // Send the response after successfully fetching the data
            res.json({ msg: "Successfully retrieved", data: results });
        } else {
            // If no data is found
            res.json({ msg: "No courses found", data: [] });
        }
    });
});

app.post('/registration', async (req, res) => {
  const { email, password, role } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);  // ✅ hash here

    const check_query = `SELECT * FROM local_user WHERE email = ?;`;
    db.query(check_query, [email], (err, results) => {
      if (err) return res.status(500).json({ msg: "DB error" });

      if (results.length > 0) {
        return res.json({ msg: "User already exists!!" });
      } else {
        const store_data = 'INSERT INTO local_user (email, password, role) VALUES (?, ?, ?)';
        db.query(store_data, [email, hashedPassword, role], (err, results) => {
          if (err) {
            console.log(err);
            return res.status(500).json({ msg: "Error inserting user" });
          }
          res.json({ msg: "Registered successfully !!" });
        });
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
});






// admin registration
app.post('/adminregistration',(req,res)=>{
  const {email,password}=req.body
  const data=[
    String(email),
    String(password)
  ]
  
  const querry=`select * from admin_user where email=? and password=?;`
  db.query(querry,data,(err,results)=>{
    if (err) console.log(err);
    if(results.length>0){
      res.json({"msg":"Admin User already exist!!"})
    }
    else{
      const store_data='insert into admin_user(email,password)values(?,?)'
      db.query(store_data,data,(err,results)=>{
        if(err) console.log(err);
        else{
          res.json({"msg":"Admin Registered successfully !!"})
        }
      })
    }
    
    
  })
})

// admin login logic

app.post('/adminlogin',(req,res)=>{
  const {email,password,username,role}=req.body

  const data=[
    String(email),
    String(password),
    String(role)
  ]
  const table_name=[
    String(username)
  ]

  const querry=`select * from admin_user where email=? and password=?;`
  db.query(querry,data,(err,results)=>{
    if(err) console.log(err);
    if(results.length>0){
      const create_user_table='create table if not exists ??(id int auto_increment primary key ,course_name varchar(255),course_desc varchar(255),author varchar(255),price bigint,c_image varchar(255));'
      db.query(create_user_table,table_name,(err,results)=>{
        if(err)console.log(err);
        else{
          res.json({"msg1":"Login Successfully","msg2":" Admin table created Successfully",username})
        }
      })
    }
    else{
      res.json({"msg":"Invalid Credentials !"})
    }
  })
});

//user login
// user login
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  const query = "SELECT * FROM local_user WHERE email = ?";
  db.query(query, [email], async (err, results) => {
    if (err) return res.status(500).json({ msg: "DB error" });

    if (results.length === 0) {
      return res.status(401).json({ msg: "Invalid email or password" });
    }

    const user = results[0];

    // compare plain password with hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ msg: "Invalid email or password" });
    }

    // create JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    // ✅ Send role & email back too
    res.json({
      msg: "Login successful",
      token,
      role: user.role,
      email: user.email
    });
  });
});



// add course from admin and then add to system  main users table



// show all courses added by admin to the admin module
app.post('/add_my_course', (req, res) => {
  const { email, course_name, course_desc, author, price, c_image } = req.body;
  const insert_values=[
    String(email),
    String(course_name),
    String(course_desc),
    String(author),
    parseInt(price),
    String(c_image),
  ]

  const query = `INSERT INTO all_courses 
    (email, course_name, course_desc, author, price, c_image) 
    VALUES (?, ?, ?, ?, ?, ?)`;

  db.query(query,insert_values, (err, result) => {
    if (err) {
      console.log(err);
      res.status(500).json({ msg: "Error adding course" });
    } else {
      res.json({ msg: "Course added successfully" });
    }
  });
});


// load for single admin all courses added by this admin
app.get('/singleadmincourses', (req, res) => {
  const email = req.query.email;
  const query = 'SELECT * FROM all_courses WHERE email = ?';
  db.query(query, [email], (err, results) => {
    if (err) {
      console.error(err);
      res.status(500).json({ msg: "Error fetching data" });
    } else {
      res.json({ msg: "Successfully retrieved data", data: results });
    }
  });
});




// load all courses
app.get('/forusers', (req, res) => {
  const query = "SELECT * FROM all_courses WHERE email IS NOT NULL";
  
  db.query(query, (err, results) => {
    if (err) {
      console.log("Error fetching courses:", err);
      res.status(500).json({ msg: "Error retrieving courses" });
    } else {
      console.log(results);
      res.json({ msg: "All courses retrieved successfully!", data: results });
    }
  });
});



// add to cart functionality
app.get('/addtocart', (req, res) => {
  const { cart_course_id } = req.query;

  // 1. fetch course from all_courses
  const query = "SELECT * FROM all_courses WHERE id = ?";
  db.query(query, [cart_course_id], (err, results) => {
    if (err) {
      console.log("Error finding course:", err);
      return res.status(500).json({ msg: "Database error" });
    }

    if (results.length === 0) {
      return res.json({ msg: "Course not found" });
    }

    const course = results[0];

    // 2. insert into add_to_cart table
    const insertQuery = `
      INSERT INTO add_to_cart (course_id, course_name, course_desc, author, price, c_image) 
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const values = [
      course.id,
      course.course_name,
      course.course_desc,
      course.author,
      course.price,
      course.c_image,
    ];

    db.query(insertQuery, values, (err) => {
      if (err) {
        console.log("Error inserting into cart:", err);
        return res.status(500).json({ msg: "Could not add to cart" });
      }

      // 3. fetch updated cart
      const cartQuery = "SELECT * FROM add_to_cart";
      db.query(cartQuery, (err, cartResults) => {
        if (err) {
          console.log("Error retrieving cart:", err);
          return res.status(500).json({ msg: "Error retrieving cart" });
        }

        res.json({
          msg1: "Added to cart successfully!",
          msg2: "Course inserted into cart table",
          msg3: "Cart retrieved successfully",
          data: cartResults,
        });
      });
    });
  });
});



// API: Get all cart items for a user
app.get('/allcartitems', (req, res) => {
  const { email } = req.query;  // pass email from frontend

  const all_carts = 'SELECT * FROM add_to_cart';
  db.query(all_carts, [], (err, results) => {
    if (err) {
      console.log("Error fetching cart:", err);
      return res.status(500).json({ msg: "Error retrieving cart data" });
    }

    res.json({
      msg: "Cart items retrieved successfully!",
      data: results
    });
  });
});


// API: Delete item from cart table
// API: Delete item from cart table
// API: Delete item from cart table
app.get('/deleteitem', (req, res) => {
  const { cart_id } = req.query; // <-- cart_id from query

  const del_query = 'DELETE FROM add_to_cart WHERE cart_id = ?';
  db.query(del_query, [cart_id], (err, results) => {
    if (err) {
      console.log("Error deleting item:", err);
      return res.status(500).json({ msg: "Error removing item from cart" });
    }

    if (results.affectedRows === 0) {
      return res.json({ msg: "No item found with this cart_id" });
    }

    res.json({ msg: "Item removed from cart successfully!" });
  });
});

// Delete course from admin button
app.post('/delete_item_id',(req,res)=>{
  const { id } = req.body;
  const del_querry='delete from all_courses where id=?';
  db.query(del_querry,id,(err,results)=>{
    if (err) {
      console.log("Error deleting item:", err);
      return res.status(500).json({ msg: "Error removing course from courses" });
    }
    if (results.affectedRows === 0) {
      return res.json({ msg: "No Course found with this id " });
    }

    res.json({ msg: "Course removed successfully!" });
  })
});



// -------------------- ROUTES --------------------

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});


// Create Order
app.post("/create-order", async (req, res) => {
  const { amount } = req.body;

  const options = {
    amount: amount * 100, // paise
    currency: "INR",
    receipt: `receipt_${Date.now()}`,
    payment_capture: 1,
  };

  try {
    const response = await razorpay.orders.create(options);

    const sql =
      "INSERT INTO payments (order_id, amount, currency, receipt, status) VALUES (?, ?, ?, ?, ?)";
    db.query(
      sql,
      [response.id, amount, options.currency, options.receipt, "created"],
      (err) => {
        if (err) {
          console.error("❌ DB Insert Error:", err);
          return res.status(500).json({ error: "Database Error" });
        }
        res.json({ id: response.id, receipt: options.receipt });
      }
    );
  } catch (error) {
    console.error("❌ Razorpay Order Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Verify Payment
app.post("/verify-payment", (req, res) => {
  const { payment_id, order_id, signature } = req.body;

  const body = `${order_id}|${payment_id}`;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");

  if (expectedSignature === signature) {
    const sql =
      "UPDATE payments SET payment_id = ?, signature = ?, status = ? WHERE order_id = ?";
    db.query(sql, [payment_id, signature, "paid", order_id], (err) => {
      if (err) {
        console.error("❌ DB Update Error:", err);
        return res.status(500).json({ error: "Database Update Error" });
      }
      res.status(200).send("✅ Payment Verified Successfully");
    });
  } else {
    const sql = "UPDATE payments SET status = ? WHERE order_id = ?";
    db.query(sql, ["failed", order_id], (err) => {
      if (err) {
        console.error("DB Update Error:", err);
        return res.status(500).json({ error: "Database Update Error" });
      }
      res.status(400).send("Payment Verification Failed");
    });
  }
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
