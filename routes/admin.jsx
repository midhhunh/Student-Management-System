
const router = require("express").Router();
const db = require("../db.jsx");
const crypto = require("crypto");

// Admin credentials — retained from your original code.
const admin_email = "midhun@gmail.com";
const admin_password = "midhun@Admin";

// --------------------------------------------------
// HELPER FUNCTIONS
// --------------------------------------------------

const isValidEmail = (email) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const isValidMobile = (mobile) =>
    /^[0-9]{10}$/.test(mobile);

const isValidClass = (value) =>
    /^(0?[1-9]|1[0-2])$/.test(String(value || "").trim());

const clean = (value) =>
    typeof value === "string" ? value.trim() : "";

const databaseError = (res, message, err) => {
    console.error(message, err);
    return res.status(500).send(message);
};

// --------------------------------------------------
// ADMIN LOGIN
// --------------------------------------------------

router.get("/login", (req, res) => {
    if (req.session.isAdmin) {
        return res.redirect("/admin/home");
    }

    res.render("login.ejs");
});

router.post("/login", (req, res) => {
    const email = clean(req.body.email).toLowerCase();
    const password = req.body.password;

    if (
        email === admin_email.toLowerCase() &&
        password === admin_password
    ) {
        req.session.isAdmin = true;

        return req.session.save((err) => {
            if (err) {
                return databaseError(
                    res,
                    "Unable to create admin session.",
                    err
                );
            }

            res.redirect("/admin/index");
        });
    }

    return res.redirect("/admin/login");
});

// --------------------------------------------------
// ADMIN AUTHENTICATION
// All routes below this middleware require admin login.
// --------------------------------------------------

router.use((req, res, next) => {
    if (!req.session || !req.session.isAdmin) {
        return res.redirect("/admin/login");
    }

    next();
});

// --------------------------------------------------
// ADMIN HOME — FETCH STUDENTS AND TEACHERS
// --------------------------------------------------

router.get("/index", (req, res) => {
    const studentSql = `
        SELECT *
        FROM student
        ORDER BY CAST(class AS UNSIGNED) DESC, name ASC
    `;

    const teacherSql = `
        SELECT *
        FROM teacher
        ORDER BY CAST(class AS UNSIGNED) DESC, name ASC
    `;

    db.query(studentSql, (studentErr, students) => {
        if (studentErr) {
            return databaseError(
                res,
                "Unable to fetch students.",
                studentErr
            );
        }

        db.query(teacherSql, (teacherErr, teachers) => {
            if (teacherErr) {
                return databaseError(
                    res,
                    "Unable to fetch teachers.",
                    teacherErr
                );
            }

            res.render("adminHome.ejs", {
                students,
                teachers
            });
        });
    });
});

// --------------------------------------------------
// GENERATE A TEACHER ID
// Requires the existing teacher_ids table.
// --------------------------------------------------

router.post("/add-teacher", (req, res) => {
    const email = clean(req.body.email).toLowerCase();

    if (!isValidEmail(email)) {
        return res.status(400).send(
            "Please enter a valid email address."
        );
    }

    const teacherId = "TCH" + crypto.randomInt(10000, 100000);

    const sql = `
        INSERT INTO teacher_ids (teacher_id, email)
        VALUES (?, ?)
    `;

    db.query(sql, [teacherId, email], (err) => {
        if (err) {
            if (err.code === "ER_DUP_ENTRY") {
                return res.status(400).send(
                    "This email or Teacher ID already exists."
                );
            }

            return databaseError(
                res,
                "Unable to generate Teacher ID.",
                err
            );
        }

        res.render("teacherIdGenerated.ejs", {
            teacherId,
            email
        });
    });
});

// --------------------------------------------------
// ASSIGN OR CHANGE A TEACHER'S CLASS
// --------------------------------------------------

router.post("/teacher/:teacher_id/assign-class", (req, res) => {
    const teacherId = clean(req.params.teacher_id);
    const classValue = clean(req.body.class);

    // An empty value removes the teacher's class responsibility.
    if (classValue !== "" && !isValidClass(classValue)) {
        return res.status(400).send(
            "Please select a valid class between 1 and 12."
        );
    }

    const sql = `
        UPDATE teacher
        SET class = ?
        WHERE teacher_id = ?
    `;

    db.query(sql, [classValue, teacherId], (err, result) => {
        if (err) {
            return databaseError(
                res,
                "Unable to assign the teacher's class.",
                err
            );
        }

        if (result.affectedRows === 0) {
            return res.status(404).send("Teacher not found.");
        }

        res.redirect("/admin/index");
    });
});

// --------------------------------------------------
// VIEW STUDENT DETAILS
// --------------------------------------------------

router.get("/student/:register_number", (req, res) => {
    const registerNumber = clean(req.params.register_number);

    const sql = `
        SELECT id, name, register_number, email, mobile, class, address
        FROM student
        WHERE register_number = ?
    `;

    db.query(sql, [registerNumber], (err, result) => {
        if (err) {
            return databaseError(res, "Unable to fetch student.", err);
        }

        if (result.length === 0) {
            return res.status(404).send("Student not found.");
        }

        res.render("studDashboard.ejs", {
            student: result[0]
        });
    });
});

// --------------------------------------------------
// PROMOTE STUDENT TO THE NEXT CLASS
// Classes 1–11 can be promoted.
// --------------------------------------------------

router.post("/student/:register_number/promote", (req, res) => {
    const registerNumber = clean(req.params.register_number);

    const sql = `
        UPDATE student
        SET class = CAST(TRIM(class) AS UNSIGNED) + 1
        WHERE register_number = ?
          AND TRIM(class) REGEXP '^(0?[1-9]|1[0-2])$'
          AND CAST(TRIM(class) AS UNSIGNED) BETWEEN 1 AND 11
    `;

    db.query(sql, [registerNumber], (err, result) => {
        if (err) {
            return databaseError(
                res,
                "Unable to promote student.",
                err
            );
        }

        if (result.affectedRows === 0) {
            return res.status(400).send(
                "Student not found or already in the final class."
            );
        }

        res.redirect(
            `/admin/student/${encodeURIComponent(registerNumber)}`
        );
    });
});

// --------------------------------------------------
// VIEW TEACHER DETAILS
// --------------------------------------------------

router.get("/teacher/:teacher_id", (req, res) => {
    const teacherId = clean(req.params.teacher_id);

    const sql = `
        SELECT id, name, teacher_id, email, mobile, class, address
        FROM teacher
        WHERE teacher_id = ?
    `;

    db.query(sql, [teacherId], (err, result) => {
        if (err) {
            return databaseError(res, "Unable to fetch teacher.", err);
        }

        if (result.length === 0) {
            return res.status(404).send("Teacher not found.");
        }

        res.render("TeacherDashboard.ejs", {
            teacher: result[0]
        });
    });
});

// --------------------------------------------------
// OPEN STUDENT EDIT PAGE
// --------------------------------------------------

router.get("/student/:register_number/edit", (req, res) => {
    const registerNumber = clean(req.params.register_number);

    const sql = `
        SELECT id, name, register_number, email, mobile, class, address
        FROM student
        WHERE register_number = ?
    `;

    db.query(sql, [registerNumber], (err, result) => {
        if (err) {
            return databaseError(res, "Unable to fetch student.", err);
        }

        if (result.length === 0) {
            return res.status(404).send("Student not found.");
        }

        res.render("editStudent.ejs", {
            student: result[0]
        });
    });
});

// --------------------------------------------------
// SAVE EDITED STUDENT DETAILS
// --------------------------------------------------

router.post("/student/:register_number/edit", (req, res) => {
    const registerNumber = clean(req.params.register_number);

    const name = clean(req.body.name);
    const email = clean(req.body.email).toLowerCase();
    const mobile = clean(req.body.mobile);
    const studentClass = clean(req.body.class);
    const address = clean(req.body.address);

    if (!name || name.length > 100) {
        return res.status(400).send(
            "Name is required and must not exceed 100 characters."
        );
    }

    if (!isValidEmail(email)) {
        return res.status(400).send("Please enter a valid email address.");
    }

    if (!isValidMobile(mobile)) {
        return res.status(400).send(
            "Mobile number must contain exactly 10 digits."
        );
    }

    if (!isValidClass(studentClass)) {
        return res.status(400).send(
            "Please select a class between 1 and 12."
        );
    }

    if (address.length > 1000) {
        return res.status(400).send("Address is too long.");
    }

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
                if (err.code === "ER_DUP_ENTRY") {
                    return res.status(400).send(
                        "This email is already in use."
                    );
                }

                return databaseError(
                    res,
                    "Unable to update student.",
                    err
                );
            }

            if (result.affectedRows === 0) {
                // MySQL can report zero when the row exists but
                // no values changed, so check whether it exists.
                return db.query(
                    "SELECT register_number FROM student WHERE register_number = ?",
                    [registerNumber],
                    (checkErr, rows) => {
                        if (checkErr) {
                            return databaseError(
                                res,
                                "Unable to verify student.",
                                checkErr
                            );
                        }

                        if (rows.length === 0) {
                            return res.status(404).send(
                                "Student not found."
                            );
                        }

                        res.redirect("/admin/index");
                    }
                );
            }

            res.redirect("/admin/index");
        }
    );
});

// --------------------------------------------------
// DELETE STUDENT
// --------------------------------------------------

router.post("/student/:register_number/delete", (req, res) => {
    const registerNumber = clean(req.params.register_number);

    const sql = `
        DELETE FROM student
        WHERE register_number = ?
    `;

    db.query(sql, [registerNumber], (err, result) => {
        if (err) {
            return databaseError(res, "Unable to delete student.", err);
        }

        if (result.affectedRows === 0) {
            return res.status(404).send("Student not found.");
        }

        res.redirect("/admin/index");
    });
});

// --------------------------------------------------
// OPEN TEACHER EDIT PAGE
// --------------------------------------------------

router.get("/teacher/:teacher_id/edit", (req, res) => {
    const teacherId = clean(req.params.teacher_id);

    const sql = `
        SELECT id, name, teacher_id, email, mobile, class, address
        FROM teacher
        WHERE teacher_id = ?
    `;

    db.query(sql, [teacherId], (err, result) => {
        if (err) {
            return databaseError(res, "Unable to fetch teacher.", err);
        }

        if (result.length === 0) {
            return res.status(404).send("Teacher not found.");
        }

        res.render("editTeacher.ejs", {
            teacher: result[0]
        });
    });
});

// --------------------------------------------------
// SAVE EDITED TEACHER DETAILS
// --------------------------------------------------

router.post("/teacher/:teacher_id/edit", (req, res) => {
    const teacherId = clean(req.params.teacher_id);

    const name = clean(req.body.name);
    const email = clean(req.body.email).toLowerCase();
    const mobile = clean(req.body.mobile);
    const teacherClass = clean(req.body.class);
    const address = clean(req.body.address);

    if (!name || name.length > 100) {
        return res.status(400).send(
            "Name is required and must not exceed 100 characters."
        );
    }

    if (!isValidEmail(email)) {
        return res.status(400).send("Please enter a valid email address.");
    }

    if (!isValidMobile(mobile)) {
        return res.status(400).send(
            "Mobile number must contain exactly 10 digits."
        );
    }

    // Empty class is allowed for teachers without class responsibility.
    if (teacherClass !== "" && !isValidClass(teacherClass)) {
        return res.status(400).send(
            "Please select a valid class between 1 and 12."
        );
    }

    if (address.length > 1000) {
        return res.status(400).send("Address is too long.");
    }

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
                if (err.code === "ER_DUP_ENTRY") {
                    return res.status(400).send(
                        "This email is already in use."
                    );
                }

                return databaseError(
                    res,
                    "Unable to update teacher.",
                    err
                );
            }

            if (result.affectedRows === 0) {
                return db.query(
                    "SELECT teacher_id FROM teacher WHERE teacher_id = ?",
                    [teacherId],
                    (checkErr, rows) => {
                        if (checkErr) {
                            return databaseError(
                                res,
                                "Unable to verify teacher.",
                                checkErr
                            );
                        }

                        if (rows.length === 0) {
                            return res.status(404).send(
                                "Teacher not found."
                            );
                        }

                        res.redirect("/admin/index");
                    }
                );
            }

            res.redirect("/admin/index");
        }
    );
});

// --------------------------------------------------
// DELETE TEACHER
// --------------------------------------------------

router.post("/teacher/:teacher_id/delete", (req, res) => {
    const teacherId = clean(req.params.teacher_id);

    const sql = `
        DELETE FROM teacher
        WHERE teacher_id = ?
    `;

    db.query(sql, [teacherId], (err, result) => {
        if (err) {
            return databaseError(
                res,
                "Unable to delete teacher. Check whether related records exist.",
                err
            );
        }

        if (result.affectedRows === 0) {
            return res.status(404).send("Teacher not found.");
        }

        res.redirect("/admin/index");
    });
});

// --------------------------------------------------
// ADMIN LOGOUT
// --------------------------------------------------

router.get("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Admin logout error:", err);
            return res.status(500).send("Unable to log out.");
        }

        res.clearCookie("connect.sid");
        res.redirect("/admin/login");
    });
});

module.exports = router;