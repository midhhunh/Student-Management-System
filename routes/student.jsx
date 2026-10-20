const router=require("express").Router()
let db=require("../db.jsx")


router.get("/register",(req,res)=>{
    res.render("register.ejs")
})
router.post("/register",(req,res)=>{
    const full_name=req.body.fullname;
    const reg_no=req.body.reg_no;
    const email=req.body.email;
    const password=req.body.password;
    const mobile=req.body.mob;
    const classes=req.body.classes;
    const aadhar=req.body.aadhar;
    const address=req.body.address;

    let sql="insert into student(name,register_number,email,password,mobile,class,aadhaar,address) values(?,?,?,?,?,?,?,?)"
    let values=[full_name,reg_no,email,password,mobile,classes,aadhar,address]
    db.query(sql,values,(err)=>{
        if(err){
        console.log("student registration failed",err);
        return res.redirect("/students/register");  
        }
        res.redirect("/students/login")
    })
})

router.get("/login",(req,res)=>{
    res.render("login.ejs")
})

router.post("/login",(req,res)=>{
    const email=req.body.email;
    const password=req.body.password;
    const sql="select * from student where email=? and password=?";
    db.query(sql,[email,password],(err,result)=>{
        if(err){
            console.log(err);
            return;
        }
        if(result.length===0){
            return res.status(401).send("Invalid email or password");
        }
        req.session.studid=result[0].register_number;

        return res.redirect("/students/home")
    })
})

router.get("/home",(req,res)=>{
    if(!req.session.studid){
        return res.redirect("/students/login")
    }
    const sql="select * from student where register_number=?";
    db.query(sql,[req.session.studid],(err,result)=>{
        if(err){
            console.log("Home page error",err);
            return;
        }
        if(result.length===0){
            return res.redirect("/students/login")
        }
        res.render("studentsHome.ejs",{
            student:result[0]
        })
    })
})

router.get("/dashboard",(req,res)=>{
    if(!req.session.studid){
        return res.redirect("/students/login")
    }
    const sql="select * from student where register_number=?";
    db.query(sql,[req.session.studid],(err,result)=>{
        if(err){
            console.log(err);
            return;
        }
        if(result.length===0){
            return res.redirect("/students/login")
        }
        res.render("studDashboard.ejs",{
            student:result[0]
        })
    })
})

module.exports=router