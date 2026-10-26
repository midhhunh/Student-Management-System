const express=require("express")
const session=require("express-session")
const app=express()

let db=require("./db.jsx")

app.set("view engine","ejs")

app.use(session({
    secret: "student-management",
    resave: false,
    saveUninitialized: false
}))
app.use(express.static(__dirname+"/public"))
app.use(express.urlencoded({extended:false}))


// const log_in=require("./routes/log.jsx")
const admin_router=require("./routes/admin.jsx")
const stud_router=require("./routes/student.jsx")
const teacher_router=require("./routes/teacher.jsx")
// app.use("/",log_in)
app.use("/admin",admin_router)
app.use("/students",stud_router)
app.use("/teacher",teacher_router)

app.get("/about",(req,res)=>{
    res.render("about.ejs")
})

app.get("/",(req,res)=>{
    res.render("home.ejs")
})

let port=1917;
app.listen(port,(err)=>{
    if(err){
        console.log(err,"Error on the server");
        
    }else{
        console.log(`server listening at port ${port} \n http://localhost:1917/`);
        
    }
})
