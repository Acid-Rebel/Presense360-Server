const express=require('express');
const {Client} = require('pg');
const cors= require('cors');
const multer = require('multer');
const location=require('./fencing');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
// const register=require('./facereg');
// const matcher=require('./facematcher');
// const faceauth=require('./web.js');
const WebSocket = require('ws');

const url = require('url');
const { loadModels, handleFaceAuth } = require('./faceAuth');
const app=express();
app.use(express());
app.use(cors());
app.use(express.json());

const JWT_KEY='123456';
const AUTH_KEY='123456789';


const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'Presense360',
    password: 'sql@123',
    port: 5432,
  });
  
  

  async function startServer() 
  {
    client.connect();
    app.listen(5000,'0.0.0.0');
    await loadModels(); // Load once at startup

    const wss = new WebSocket.Server({ port: 3000 }, () => 
    {
      console.log(`📡 WebSocket server running on ws://localhost:${3000}`);
    });

    wss.on('connection', (ws, req) => 
    {

        const params = new URLSearchParams(req.url.replace('/?', ''));
        const token = params.get('token');
        const action = params.get('action');

    if (!token) 
    {
      console.log("No token");
      ws.send('❌ token is required');
      ws.close(4000);
      return;
    }
    try
    {
        const user=jwt.verify(token,JWT_KEY);
        const userId=user.rollno;
        console.log(`${userId} from token`);
        client.query('SELECT * from face_id where rollno=$1',["CSE21001"],(err, ress) => 
        {
            if(err)
            {
                
                console.log(err);
                return;
            }
            else if(ress.rows.length===0)
            {
                console.log("❌ No face data found");
                ws.send('❌ No face data found');
                ws.close(4000);
                return;
            }
            else
            {
                //console.log(ress);
                const descriptor= new Float32Array(ress.rows[0]["descriptor"]);
                handleFaceAuth(ws, descriptor, userId,1,action,(userId,result) => 
                { 
                    console.log(`🔚 Face auth result for ${userId}: ${result}`);
                    // You can perform DB logging, audit, redirect, etc. here
                });
            }
        });
    }
    catch(err)
    {
        console.log("Invalid token");
        ws.close(4002, "Invalid token");
    }

  });
}



  function getFormattedDateTime() {
    const date = new Date();

    // Extract individual components
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    // Format as yyyy-mm-ddThh:mm:ss
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}
  
// Location authentication
app.post("/location",verifyToken,(req,res)=>{
    
    var coordinates=req.body.coo;
    console.log(coordinates);
    console.log("Hello");
    if(coordinates==="GPSENABLE")
    {
        res.sendStatus(401);
    }
    else if(coordinates==="PERMISSIONDENIED")
    {
        res.sendStatus(402);
    }
    else if(coordinates==="PERMISSIONDENIEDFOREVER")
    {
        res.sendStatus(403);
    }
    else
    {
        coordinates=coordinates.split(',');
        console.log(coordinates);
        if(location.checkLocation(coordinates))
        {
        res.sendStatus(200);
        }
        else
        {
            //should always be 400
        //res.send(400)
        res.sendStatus(200);
        }
    }
})


// Login authentication
app.post("/login",(req,res) =>{

    console.log(req.body)
    const { rollno, pass, id } = req.body;
    
    user=rollno;
    console.log(user);
    console.log(pass);
    console.log(id);


    client.query('SELECT * from Faculty_Login where rollno=$1',[user], async(err, ress) => {
        console.log(ress);
        if(ress.rows.length==1) 
        {
            if(ress.rows[0].password===pass)
            {
                client.query('SELECT * from device_id where rollno=$1',[user],async (err, resss) => 
                {
                    if(resss.rows.length===0)
                    {
                        console.log('before the query');
                        client.query('insert into device_id (rollno,dev_id) values($1,$2)',[user,id], async (error, result) => 
                        {
                            if(error)
                            {
                                console.log(error);
                            }
                            else
                            {
                                console.log(result);
                            }
                        });
                        console.log("Login sucessfull first time");
                        const token = jwt.sign(
                          { rollno: user, id: id },
                          JWT_KEY,
                          { expiresIn: "1h" }
                        );
                        res.status(201).json({token});
                    }
                    else if(resss.rows[0].dev_id===id)
                    {
                        console.log("Login sucessfull");

                       const token = jwt.sign(
                          { rollno: user, id: id },
                          JWT_KEY,
                          { expiresIn: "1h" }
                        );
                        res.status(200).json({token});
                    }
                    else
                    {
                        console.log("Account already registered on another device");
                        res.sendStatus(402);
                    }
                });
               
            }
            else
            {
                console.log("Wrong password");
                res.sendStatus(401);
            }
        }
        else
        {
            console.log("Wrong user");
            res.sendStatus(400);
        }
      });
  })


  function verifyToken(req, res, next) 
  {
    const bearerHeader = req.headers["authorization"];
    if (!bearerHeader) return res.sendStatus(405);
    const token = bearerHeader.split(" ")[1];
    try 
    {
      const decoded = jwt.verify(token, JWT_KEY);
      req.user = decoded;
      next();
    } 
    catch (err) 
    {
        
      return res.status(406).json({ message: "Invalid or expired token" });
    }
}


// function generateAuthToken(userId,action) {
//   return jwt.sign(
//     {
//       userId: userId,
//       action: action,
//     },
//     AUTH_KEY,
//     { expiresIn: '2m' }
//   );
// }

function verifyAuthTokenIn(req, res, next) 
  {
    const authToken = req.headers["authtoken"];
    if (!authToken) 
        {   console.log("Sending 405");
            return res.sendStatus(405);
        }
    console.log(authToken);
    
    try 
    {
      const decoded = jwt.verify(authToken, AUTH_KEY);
      if(decoded.action=='checkin')
      {
        req.tokenUser=decoded.userId;
        next();
      }
      else
      {
        res.sendStatus(407);
      }
    } 
    catch (err) 
    {
        
      return res.status(408).json({ message: "Invalid or expired token" });
    }
}
function verifyAuthTokenOut(req, res, next) 
  {
    const authToken = req.headers["authtoken"];
    if (!authToken)
        { 
        console.log("Sending 405");
        return res.sendStatus(405);
    }
    
    try 
    {
      const decoded = jwt.verify(authToken, AUTH_KEY);
      if(decoded.action=='checkout')
      {
        req.tokenUser=decoded.userId;
        next();
      }
      else
      {
        res.sendStatus(407);
      }
    } 
    catch (err) 
    {
        
      return res.status(408).json({ message: "Invalid or expired token" });
    }
}

app.get("/verify",verifyToken,(req,res)=>{
    console.log("Token valid");
    res.sendStatus(200);
})


  //Get user info for dashboard
  app.get("/dashboard",verifyToken,(req,res)=>{
    const user=req.user.rollno;
    client.query('select * from faculty_info where rollno = $1', [user] ,async (err, ress)=>{
        if(err)
        {
            console.error(err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        else if
        (ress.rows.length === 0) 
        {
            return res.status(404).json({ error: 'User not found' });
        }
        else
        {
            res.json(ress.rows[0]);
            console.log(ress.rows[0]);
        }
    })
  })


  // inserting 'not checked in' data if not checked in --- incorrect practice
//   app.get("/dashboard/status/check",  (req,res)=>{
//     const user=req.query.rollno;
//     var datetime = getFormattedDateTime();
//     datetime=datetime.slice(0,10);
//     var f=0;
//     client.query(`select * from faculty_attendance where rollno='${user}' and currdate='${datetime}'`,(err,ress)=>
//     {
//         if(err)
//         {
//             console.log(err);
//             //res.sendStatus(400);
//             return;
//         }
//         else if(ress.rows.length===0)
//         {
//             console.log(ress.rows);
//             client.query(`insert into faculty_attendance values('${user}','${datetime}',NULL,NULL,5)`,(errr,re)=>
//             {
//                 if(errr)
//                 {
//                     console.log(errr);
//                     //res.sendStatus(400);
//                     f=1;
//                     return;
//                 }
//             });
//         }
//     })
//   })

//get checkin status of the user
  app.get("/dashboard/status/stat",verifyToken,(req,res)=>
    {
        const user=req.user.rollno;
        var datetime = getFormattedDateTime();
        datetime=datetime.slice(0,10);
        client.query('select * from faculty_attendance where rollno=$1 and currdate=$2',[user,datetime],async (err,ress)=>
            {
                if(err)
                {
                    console.log(err);
                    console.log("Internal server error");
                    res.sendStatus(500);
                }
                else if(ress.rows.length===0)
                {
                    res.sendStatus(201);
                }
                else
                {
                    console.log(ress.rows[0]);
                    res.status(200).json(ress.rows[0]);
                    
                }
            });
  });
  
  
//checkin logic
  app.post("/dashboard/status/checkin",verifyAuthTokenIn,verifyToken,(req,res)=>{
    const user=req.user.rollno;
    const tokenUser=req.tokenUser;
    var datetime = getFormattedDateTime();
    var time=datetime.slice(11,19);
    datetime=datetime.slice(0,10);
    if(user!=tokenUser)
    {
        return res.sendStatus(409);
    }
    client.query('select * from faculty_attendance where rollno=$1 and currdate=$2',[user,datetime],(err,ress)=>
    {
        if(err)
        {
            console.log(err)
            return res.sendStatus(500);
        }
        else if(ress.rows.length===0)
        {
            console.log(ress.rows);
            client.query('insert into faculty_attendance values($1,$2,$3,NULL,0)',[user,datetime,time],(errr,re)=>
            {
                if(errr)
                {
                    console.log(errr)
                    return res.sendStatus(500);
                }
                else
                {
                    console.log("checked in 0 row length");
                    return res.status(200).send(time);
                }
            });
        }
        else if(ress.rows[0].checkin===null)
        {
            client.query('update faculty_attendance set type = 0, checkin=$1 where rollno = $2 and currdate=$3',[time,user,datetime], (err,ress)=>
            {
                if(err)
                {
                    console.log(err)
                    return res.sendStatus(500);
                }
                else
                {
                    console.log("checked in");
                    return res.status(200).send(time);
                }
                        
            })
        }
        else
        {
            console.log("already checked in");
            return res.sendStatus(400);
        }
    
    })
  })



  //checkout logic
  app.post("/dashboard/status/checkout",verifyAuthTokenOut,verifyToken,(req,res)=>{
    const user=req.user.rollno;
    const tokenUser=req.tokenUser;
    var datetime = getFormattedDateTime();
    var time=datetime.slice(11,19);
    datetime=datetime.slice(0,10);
    if(user!=tokenUser)
    {
        return res.sendStatus(409);
    }
    client.query('select * from faculty_attendance where rollno=$1 and currdate=$2',[user,datetime],(err,ress)=>
        {
            if(err)
            {
                console.log(err);
                return res.sendStatus(500);
            }
            else if(ress.rows.length===0 || ress.rows[0].checkin===null)
            {
                res.sendStatus(401);
                console.log("not checked in");
                return 
            }
            else if(ress.rows[0].checkout===null)
            {
                client.query('update faculty_attendance set type = 0 , checkout = $1 where rollno = $2 and currdate=$3',[time,user,datetime],(err,ress)=>
                    {
                        if(err)
                        {
                            console.log(err)
                            res.sendStatus(500);
                            return 
                        }
                        else
                        {
                            console.log("checked out");
                            res.status(200).send(time);
                            return
                        }
            
                    })
            }
            else
            {
                console.log("already checked out");
                res.sendStatus(402);
                return
            }
        })
    
  })


  //attendance data
  app.get("/attendance",verifyToken,(req,res)=>{
    const user=req.user.rollno;
    client.query('select * from faculty_attendance where rollno=$1',[user],(err, ress)=>{
        if(err)
        {
            console.log(err);
            res.sendStatus(500);
        }
        else
        {
            res.status(200).json(ress.rows);
        }
        // console.log(ress.rows)
  })
})


 app.get("/leaverequest",verifyToken,(req,res)=>{
    const user=req.user.rollno;
    client.query('select * from leave_request where rollno=$1',[user],(err, ress)=>{
        if(err)
        {
            console.log(err);
            res.sendStatus(500);
        }
        else
        {
            res.status(200).json(ress.rows);
        }
        // console.log(ress.rows)
  })
})

app.get("/geocoordinates",verifyToken,(req,res)=>{
    const user=req.user.rollno;
    console.log("acquiring coordinates");
    client.query('SELECT a.id ,coordinates from coordinates as a inner join faculty_coordinates as b on a.id=b.id where rollno =$1',[user],(err, ress)=>{
        if(err)
        {
            console.log(err);
            res.sendStatus(500);
        }
        else
        {
            console.log(ress.rows)
            res.status(200).json(ress.rows);
        }
    })
})




startServer();


  
  
//   // Endpoint to receive uploaded image
//   app.post('/upload', upload.single('image'), (req, res) => {
//     const user= req.query.rollno;
//     const reg=req.query.reg;

//     if (!req.file) {
//       return res.status(400).send('No file uploaded.');
//     }
  
//     // File info available at req.file
//     console.log('File uploaded:', req.file.path);
//     if(reg==1)
//     {
//         arr=register.register(req.file.path);
//         if(arr==='No face detected in the image')
//         {
//             return res.status(400).send('No face detected in the image');
//         }
//         else
//         {
//         client.query(`insert into face values ('${user}',ARRAY${arr})`, (err, ress)=>{
//         if(err)
//         {
//             console.log(err);
//         }
//       })
//     }
//     res.json({ message: 'Face registered sucessfully', path: req.file.path });
//     }
//     else
//     {
//         //authentication logic here

//         arr1=Float32Array(register.register(req.file.path));
//         arr2=[];
//         client.query(`select descriptor from face where id=${user}`, (err, ress)=>{
//             if(err)
//             {
//                 console.log(err);
//             }
//             else
//             {
//                 arr2=Float32Array(ress.rows[0]["descriptor"]);
//                 val=matcher.compareDescriptors(arr1,arr2);
//                 if(val<=6.0)
//                 {
//                     res.sendStatus(200);
//                 }
//                 else
//                 {
//                     res.sendStatus(401);
//                 }
//             }
//         });
//     }
//   });

//   app.get("/face",(req,res)=>{
//     const user=req.query.id;
//     client.query(`select * from face where id=${user}`, (err, ress)=>{
//         if(err)
//         {
//             console.log(err);
//         }
//         console.log(ress.rows[0]["descriptor"])
//         res.status(200).json(ress.rows[0]["descriptor"]);
//         // console.log(ress.rows)
//   })
// })







//old checkin checkin logic -- kinda stupid
//   app.get("/dashboard/status/checkin",(req,res)=>{
//     const user=req.query.rollno;
//     var datetime = getFormattedDateTime();
//     var time=datetime.slice(11,19);
//     datetime=datetime.slice(0,10);
//     client.query(`select * from faculty_attendance where rollno='${user}' and currdate='${datetime}'`,(err,ress)=>
//         {
//             if(err)
//             {
//                 console.log(err)
//                 res.sendStatus(400);
//             }
//             else if(ress.rows.length===0)
//             {
//                 console.log(ress.rows);
//                 client.query(`insert into faculty_attendance values('${user}','${datetime}','${time}',NULL,0)`,(errr,re)=>
//                 {
//                     if(errr)
//                     {
//                         console.log(errr)
//                         res.sendStatus(400);
//                     }
//                     else
//                     {
//                         console.log("checked in");
//                         res.sendStatus(200);
//                     }
//                 });
//             }
//             else
//             {
//                 client.query(`select checkin from faculty_attendance where rollno='${user}' and currdate='${datetime}'`,(err,ress)=>
//                     {
//                         if(err)
//                         {
//                             console.log(err)
//                             res.sendStatus(400);
//                         }
//                         else
//                         {
//                             // console.log(ress.rows);
//                             // console.log(ress.rows[0].checkin);
//                             // console.log("yya");
//                             if(ress.rows[0].checkin===null)
//                             {
//                                 client.query(`update faculty_attendance set type = 0, checkin='${time}' where rollno = '${user}' and currdate='${datetime}'`,(err,ress)=>
//                                     {
//                                         if(err)
//                                         {
//                                             console.log(err)
//                                             res.sendStatus(400);
//                                         }
//                                         else
//                                         {
//                                             console.log("checked in");
//                                             res.status(200).send(time);
//                                         }
                            
//                                     })
//                             }
//                             else
//                             {
//                                 console.log("already checked in");
//                                 res.sendStatus(404);
//                             }
//                         }
//                     })
//             }
//         })
        
//   })
  


/*
the status in fetched from the back end gives 0 or 1 or 2 or 3 or 4 where 
0 is present, 
1 is casual leave, 
2 is medical leave , 
3 is a public holiday , 
4 is absent
5 is not checked in,
*/

