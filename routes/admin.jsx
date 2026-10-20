const router=require("express").Router()
let db=require("../db.jsx")

const admin_email="midhun@gmail.com";
const admin_password="midhun@Admin";

router.get("/login",(req,res)=>{
    res.render("login.ejs")
})

router.post("/login",(req,res)=>{
    const email=req.body.email;
    const password=req.body.password;

    if(email==admin_email && password==admin_password){
        return res.redirect("/admin/home")
    }
    return res.redirect("/admin/login")
})

router.get("/home",(req,res)=>{
    const stud=`select * from student order by class desc`;
    const teach=`select * from teacher order by class desc`;

    db.query(stud,(err,studresult)=>{
        if(err){
            console.log("Student query error:", err);
            return res.status(500).send("unable to fetch students")
        }
        db.query(teach,(err,teachresult)=>{
            if(err){
                console.log("Teacher query error",err);
                return res.status(500).send("Unable to fetch Teachers");
            }
            res.render("adminHome.ejs",{
                students:studresult,
                teachers:teachresult
            })
        })
    })
})

router.get("/student/:register_number",(req,res)=>{
    const registerNumber=req.params.register_number;

    const sql = `
        SELECT id, name, register_number, email, mobile, class, address
        FROM student
        WHERE register_number = ?
    `;
    db.query(sql,[registerNumber],(err,result)=>{
        if(err){
            console.log(err);
            return res.status(500).send("Database error");
        }
        if(result===0){
            return res.status(404).send("Student not found");
        }
        res.render("studDashboard.ejs",{
            student:result[0]
        })
    })
})

router.get("/teacher/:teacher_id",(req,res)=>{
    const teacherId=req.params.teacher_id;

    const sql=`select id,name,teacher_id,email,mobile,class,address from teacher where teacher_id=?`;
    db.query(sql,[teacherId],(err,result)=>{
        if(err){
            console.log(err);
            return res.status(500).send("Database error")
        }
        if(result.length===0){
            return res.status(404).send("Teacher not found")
        }
        res.render("TeacherDashboard.ejs",{
            teacher:result[0]
        })
    })
})


module.exports=router