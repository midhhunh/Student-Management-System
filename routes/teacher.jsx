const router=require("express").Router()
let db=require("../db.jsx")

router.get("/register",(req,res)=>{
    res.render("register.ejs")
})
router.post("/register",(req,res)=>{
    const full_name=req.body.fullname;
    const teacher_id=req.body.tid;
    const email=req.body.email;
    const password =req.body.password;
    const mobile=req.body.mob;
    const classes=req.body.classes;
    const aadhar=req.body.aadhar;
    const address=req.body.address;

    let sql="insert into teacher(name,teacher_id,email,password,mobile,class,aadhar,address) values(?,?,?,?,?,?,?,?)"
    let values=[full_name,teacher_id,email,password,mobile,classes,aadhar,address]
    db.query(sql,values,(err)=>{
        if(err){
            console.log("Teacher registration failed",err);
            return res.redirect("/teacher/register");
        }
        res.redirect("/teacher/login")
    })
})

router.get("/login",(req,res)=>{
    res.render("login.ejs")
})

router.post("/login",(req,res)=>{
    const email=req.body.email;
    const password=req.body.password;
    const sql="select * from teacher where email=? and password=?";
    db.query(sql,[email,password],(err,result)=>{
        if(err){
            console.log(err);
            return 
        }
        if(result.length===0){
            return res.status(401).send("invalid email or password")
        }
        req.session.teacher_id=result[0].teacher_id;
        return res.redirect("/teacher/home")
    })
})

router.get("/home",(req,res)=>{
    if(!req.session.teacher_id){
        return res.redirect("/teacher/login")
    }
    const teacherId=req.session.teacher_id;
    const tsql=`
    select id,name,teacher_id,mobile,class,address from teacher where teacher_id=?`;
    db.query(tsql,[teacherId],(err,result)=>{
        if(err){
            console.log(err);
            return res.status(500).send("Database error");
        }
        if(result.length===0){
            return res.status(404).send("Teacher not found");
        }
        const teacher=result[0];

        const studsql=`select id,name,register_number,mobile,class,address from student where trim(class)=trim(?)`;
        db.query(studsql,[teacher.class],(err,students)=>{
            if(err){
                console.log(err);
                return res.status(500).send("Database error");
            }
            if(students.length>0){
                return res.render("ClassTeacherHome.ejs",{
                    teacher:teacher,
                    students:students,
                    showStudents:true
                });
            }
            return res.render("TeacherDashboard.ejs",{
                teacher:teacher,
            
            })
        })
    })
})

router.get("/student/:register_number",(req,res)=>{
    if(!req.session.teacher_id){
        return res.redirect("/teacher/login")
    }
    const registerNumber=req.params.register_number;

    const sql=`SELECT id, name, register_number, email, mobile, class, address FROM student WHERE register_number = ?`;
    db.query(sql,[registerNumber],(err,result)=>{
        if (err){
            console.log(err);
                return res.status(500).send("Database error");
        }
        if(result.length===0){
            return res.status(404).send("student not found")
        }
        res.render("studDashboard.ejs",{
            student:result[0]
        })
    })
})

router.get("/dashboard",(req,res)=>{
    if(!req.session.teacher_id){
        return res.redirect("/teacher/login")
    }
    const sql="select * from teacher where teacher_id=?";

    db.query(sql,[req.session.teacher_id],(err,result)=>{
        if(err){
            console.log(err);
            return res.status(500).send("database error");
        }
        if(result.length===0){
            return res.redirect("/teacher/login")
        }
        res.render("TeacherDashboard.ejs",{
            teacher:result[0]
        })
    })
})

module.exports=router