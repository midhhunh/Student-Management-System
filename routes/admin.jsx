const router=require("express").Router()
let db=require("../db.jsx")
const crypto = require("crypto");

const admin_email="midhun@gmail.com";
const admin_password="midhun@Admin";

router.get("/login",(req,res)=>{
    res.render("login.ejs")
})

router.post("/login",(req,res)=>{
    const email=req.body.email;
    const password=req.body.password;

    if(email==admin_email && password==admin_password){
        req.session.isAdmin=true;
        return res.redirect("/admin/home")
    }
    return res.redirect("/admin/login")
})

router.use((req,res,next)=>{
    if(!req.session.isAdmin){
        return res.redirect("/admin/login");
    }
    next();
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
router.post("/add-teacher", (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).send("Enter a valid email address");
    }

    const teacherId = "TCH" + crypto.randomInt(10000, 100000);

    const sql = `
        INSERT INTO teacher_ids (teacher_id, email)
        VALUES (?, ?)
    `;

    db.query(sql, [teacherId, email], (err) => {
        if (err) {
            if (err.code === "ER_DUP_ENTRY") {
                return res.status(400).send("This email or Teacher ID already exists");
            }

            console.error(err);
            return res.status(500).send("Unable to generate Teacher ID");
        }

        res.render("teacherIdGenerated.ejs", {
            teacherId,
            email
        });
    });
});

// Only an administrator can assign or change a teacher's class responsibility.
router.post("/teacher/:teacher_id/assign-class",(req,res)=>{
    const teacherId=req.params.teacher_id;
    const classValue=String(req.body.class || "").trim();
    if(classValue && !/^(0?[1-9]|1[0-2])$/.test(classValue)){
        return res.status(400).send("Choose a valid class");
    }
    const sql="UPDATE teacher SET class=? WHERE teacher_id=?";
    db.query(sql,[classValue,teacherId],(err,result)=>{
        if(err){
            console.log("Teacher class assignment error:",err);
            return res.status(500).send("Unable to assign class");
        }
        if(result.affectedRows===0){
            return res.status(404).send("Teacher not found");
        }
        return res.redirect("/admin/home");
    });
})

router.get("/logout",(req,res)=>{
    req.session.destroy(()=>res.redirect("/admin/login"));
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
        if(result.length===0){
            return res.status(404).send("Student not found");
        }
        res.render("studDashboard.ejs",{
            student:result[0]
        })
    })
})

// Promote an individual student after confirming they passed the year.
router.post("/student/:register_number/promote",(req,res)=>{
    const registerNumber=req.params.register_number;
    const sql=`UPDATE student
        SET class = CAST(class AS UNSIGNED) + 1
        WHERE register_number = ?
          AND TRIM(class) REGEXP '^(0?[1-9]|1[0-2])$'
          AND CAST(class AS UNSIGNED) BETWEEN 1 AND 11`;
    db.query(sql,[registerNumber],(err,result)=>{
        if(err){
            console.log("Student promotion error:",err);
            return res.status(500).send("Unable to promote student");
        }
        if(result.affectedRows===0){
            return res.status(400).send("Student not found or already in the final class");
        }
        res.redirect(`/admin/student/${encodeURIComponent(registerNumber)}`);
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

// Open the student edit page
router.get("/student/:register_number/edit", (req, res) => {
    const registerNumber = req.params.register_number;

    const sql = `
        SELECT id, name, register_number, email, mobile, class, address
        FROM student
        WHERE register_number = ?
    `;

    db.query(sql, [registerNumber], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Database error");
        }

        if (result.length === 0) {
            return res.status(404).send("Student not found");
        }

        res.render("editStudent.ejs", {
            student: result[0]
        });
    });
});


// Save the edited student details
router.post("/student/:register_number/edit", (req, res) => {
    const registerNumber = req.params.register_number;

    const { name, email, mobile, class: studentClass, address } = req.body;

    const sql = `
        UPDATE student
        SET name = ?, email = ?, mobile = ?, class = ?, address = ?
        WHERE register_number = ?
    `;

    db.query(
        sql,
        [name, email, mobile, studentClass, address, registerNumber],
        (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).send("Unable to update student");
            }

            if (result.affectedRows === 0) {
                return res.status(404).send("Student not found or no changes made");
            }

            res.redirect("/admin/home");
        }
    );
});

router.post("/student/:register_number/delete", (req, res) => {
    const registerNumber = req.params.register_number;

    const sql = `
        DELETE FROM student
        WHERE register_number = ?
    `;

    db.query(sql, [registerNumber], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Unable to delete student");
        }

        if (result.affectedRows === 0) {
            return res.status(404).send("Student not found");
        }

        res.redirect("/admin/home");
    });
});

// Open the teacher edit page
router.get("/teacher/:teacher_id/edit", (req, res) => {
    const teacherId = req.params.teacher_id;

    const sql = `
        SELECT id, name, teacher_id, email, mobile, class, address
        FROM teacher
        WHERE teacher_id = ?
    `;

    db.query(sql, [teacherId], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Database error");
        }

        if (result.length === 0) {
            return res.status(404).send("Teacher not found");
        }

        res.render("editTeacher.ejs", {
            teacher: result[0]
        });
    });
});


// Save the edited teacher details
router.post("/teacher/:teacher_id/edit", (req, res) => {
    const teacherId = req.params.teacher_id;

    const { name, email, mobile, class: teacherClass, address } = req.body;

    const sql = `
        UPDATE teacher
        SET name = ?, email = ?, mobile = ?, class = ?, address = ?
        WHERE teacher_id = ?
    `;

    db.query(
        sql,
        [name, email, mobile, teacherClass, address, teacherId],
        (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).send("Unable to update teacher");
            }

            if (result.affectedRows === 0) {
                return res.status(404).send("Teacher not found or no changes made");
            }

            res.redirect("/admin/home");
        }
    );
});

router.post("/teacher/:teacher_id/delete", (req, res) => {
    const teacherId = req.params.teacher_id;

    const sql = `
        DELETE FROM teacher
        WHERE teacher_id = ?
    `;

    db.query(sql, [teacherId], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).send(
                "Unable to delete teacher. Check whether related records exist."
            );
        }

        if (result.affectedRows === 0) {
            return res.status(404).send("Teacher not found");
        }

        res.redirect("/admin/home");
    });
});

module.exports=router
