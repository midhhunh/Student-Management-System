const mysql=require("mysql")

const conn=mysql.createConnection({
    host:"localhost",
    user:"root",
    password:"",
    database:"sms"
});

conn.connect((err)=>{
    if(err){
        console.log("MySQL connection error",err);
        return;
    }
    console.log("MySQL connected successfully");
})
//Admin table
conn.query(`
    CREATE TABLE IF NOT EXISTS admin(id int auto_increment primary key,
    email varchar(255) NOT NULL UNIQUE,
    password varchar(255) NOT NULL UNIQUE)`,((err)=>{
        if(err){
            console.log(err);
            return;
        }
        console.log("Admin created successfully");
    }))

//student table
conn.query(`
        CREATE TABLE IF NOT EXISTS student(id int auto_increment primary key,
        name varchar(255) NOT NULL,
        register_number varchar(255) NOT NULL UNIQUE,
        email varchar(255) NOT NULL,
        password varchar(255) NOT NULL UNIQUE,
        mobile VARCHAR(10) NOT NULL,
        class varchar(255) NOT NULL,
        aadhaar VARCHAR(12) NOT NULL,
        address varchar(255)NOT NULL)`,((err)=>{
            if(err){
                console.log(err);
                return;
            }
            console.log("Student table created successfully");           
        }))

//teacher table
conn.query(`
    CREATE TABLE IF NOT EXISTS teacher(id int auto_increment primary key,
    name varchar(255) NOT NULL,
    teacher_id varchar(255) NOT NULL UNIQUE,
    email varchar(255) NOT NULL,
    password varchar(255) NOT NULL UNIQUE,
    mobile VARCHAR(10) NOT NULL,
    class varchar(255) NOT NULL,
    aadhar VARCHAR(12) NOT NULL,
    address varchar(255)NOT NULL)`,((err)=>{
        if (err){
            console.log(err);
            return;
        }
        console.log("Teachers table created successfully");
    }))

module.exports=conn;