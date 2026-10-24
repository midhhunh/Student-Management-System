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

    conn.query(`
    
    CREATE TABLE IF NOT EXISTS teacher_ids (
    id INT AUTO_INCREMENT PRIMARY KEY,
    teacher_id VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    is_used TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`,((err)=>{
    if(err){
        console.log(err);
        return;
    }
}))

conn.query(`
        create table if not exists student_invitations(
        id int auto_increment primary key,
        register_number varchar(30) not null unique,
        email varchar(30) not null,
        class varchar(10) not null,
        teacher_id varchar(255) not null,
        is_used TINYINT(1) not null default 0,
        created_at timestamp default current_timestamp
        )`,((err)=>{
            if(err){
                console.log(err);
                return;
            }
            console.log("student invitation created successfully");
        })
    );

conn.query(`
    create table if not exists annual_results(
    id int auto_increment primary key,
    register_number varchar(255) not null,
    academic_year varchar(20) not null,
    class_at_exam int not null,
    marks decimal(7,2) not null,
    total_marks decimal(7,2) not null,
    pass_percentage decimal(5,2) not null default 35.00,
    status enum("Pass","Fail") not null,
    finalized tinyint(1) not null default 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_student_year (
        register_number,
        academic_year
    ))`,((err)=>{
        if(err){
            console.log(err);
            return;
        }
        console.log("Annual result table created successfully");
    })
)

module.exports=conn;