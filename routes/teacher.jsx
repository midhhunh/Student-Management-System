
const router = require("express").Router();
const db = require("../db.jsx");
const crypto = require("node:crypto");

// ==============================
// TEACHER REGISTER PAGE
// ==============================

router.get("/register", (req, res) => {
    const error = req.session.registerError;
    const success = req.session.registerSuccess;

    req.session.registerError = null;
    req.session.registerSuccess = null;

    res.render("register.ejs", {
        error,
        success
    });
});

// ==============================
// TEACHER REGISTRATION
// ==============================

router.post("/register", (req, res) => {
    const full_name = req.body.fullname;
    const teacher_id = String(req.body.tid || "").trim();
    const email = req.body.email;
    const password = req.body.password;
    const mobile = req.body.mob;
    const aadhar = req.body.aadhar;
    const address = req.body.address;

    if (
        !full_name ||
        !teacher_id ||
        !email ||
        !password ||
        !mobile ||
        !aadhar ||
        !address
    ) {
        return res.status(400).send("Please fill in all required fields");
    }

    // Claim the admin-generated Teacher ID only if unused.
    const claimSql = `
        UPDATE teacher_ids
        SET is_used = 1
        WHERE teacher_id = ? AND is_used = 0
    `;

    db.query(claimSql, [teacher_id], (err, result) => {
        if (err) {
            console.error("Teacher ID verification error:", err);
            return res.status(500).send("Database error");
        }

        if (result.affectedRows !== 1) {
            return res.status(400).send(
                "Invalid or already-used Teacher ID. Please contact the admin."
            );
        }

        // Register the teacher after claiming the ID.
        const sql = `
            INSERT INTO teacher
            (name, teacher_id, email, password, mobile, class, aadhar, address)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            full_name,
            teacher_id,
            email,
            password,
            mobile,
            "",
            aadhar,
            address
        ];

        db.query(sql, values, (insertErr) => {
            if (insertErr) {
                console.error("Teacher registration failed:", insertErr);

                req.session.registerError =
                    insertErr.code === "ER_DUP_ENTRY"
                        ? "This teacher is already registered. Please check your details."
                        : "Teacher registration failed. Please check your details and try again.";

                // Release the ID if registration failed.
                const resetSql = `
                    UPDATE teacher_ids
                    SET is_used = 0
                    WHERE teacher_id = ? AND is_used = 1
                `;

                return db.query(resetSql, [teacher_id], (resetErr) => {
                    if (resetErr) {
                        console.error(
                            "Unable to reset Teacher ID:",
                            resetErr
                        );
                    }

                    return res.redirect("/teacher/register");
                });
            }

            req.session.registerSuccess = "Teacher registered successfully.";
            return res.redirect("/teacher/login");
        });
    });
});

// ==============================
// TEACHER LOGIN PAGE
// ==============================

router.get("/login", (req, res) => {
    res.render("login.ejs");
});

// ==============================
// TEACHER LOGIN
// ==============================

router.post("/login", (req, res) => {
    const email = req.body.email;
    const password = req.body.password;

    const sql = `
        SELECT *
        FROM teacher
        WHERE email = ? AND password = ?
    `;

    db.query(sql, [email, password], (err, result) => {
        if (err) {
            console.error("Teacher login error:", err);
            return res.status(500).send("Database error");
        }

        if (result.length === 0) {
            return res.status(401).send("Invalid email or password");
        }

        req.session.teacher_id = result[0].teacher_id;

        return res.redirect("/teacher/index");
    });
});

// ==============================
// TEACHER HOME
// ==============================

router.get("/index", (req, res) => {
    if (!req.session.teacher_id) {
        return res.redirect("/teacher/login");
    }

    const teacherId = req.session.teacher_id;

    const teacherSql = `
        SELECT id, name, teacher_id, mobile, class, address
        FROM teacher
        WHERE teacher_id = ?
    `;

    db.query(teacherSql, [teacherId], (err, result) => {
        if (err) {
            console.error("Teacher query error:", err);
            return res.status(500).send("Database error");
        }

        if (result.length === 0) {
            return res.status(404).send("Teacher not found");
        }

        const teacher = result[0];

        // If the admin has not assigned a class.
        if (!teacher.class || !String(teacher.class).trim()) {
            return res.render("TeacherDashboard.ejs", {
                teacher,
                students: [],
                showStudents: false,
                message:
                    "Your class has not been assigned yet. Please contact the administrator."
            });
        }

        // Get students from the teacher's assigned class.
        const studentSql = `
            SELECT id, name, register_number, mobile, class, address
            FROM student
            WHERE TRIM(class) = TRIM(?)
            ORDER BY name ASC
        `;

        db.query(studentSql, [teacher.class], (studentErr, students) => {
            if (studentErr) {
                console.error("Student query error:", studentErr);
                return res.status(500).send("Database error");
            }
            const issuedRegisterNumber =
                req.session.issuedRegisterNumber || null;

            const generatedRegisterNumber =
                req.session.generatedRegisterNumber || null;

            const invitedEmail = req.session.invitedEmail || null;

            req.session.issuedRegisterNumber = null;
            req.session.generatedRegisterNumber = null;
            req.session.invitedEmail = null;

            // Display the class teacher's home if students exist.

            return res.render("ClassTeacherHome.ejs", {
                teacher,
                students,
                showStudents: true,
                generatedRegisterNumber,
                invitedEmail
                // issuedRegisterNumber: req.session.issuedRegisterNumber || null,
                // invitedStudentEmail: req.session.invitedStudentEmail || null
            });


            // No students found for this class.
            return res.render("TeacherDashboard.ejs", {
                teacher,
                students: [],
                showStudents: false,
                message: "No students have been assigned to your class yet."
            });
        });
    });
});

/* =========================================
   EDIT STUDENT - OPEN EDIT PAGE
========================================= */

router.get("/student/:register_number/edit", (req, res) => {
    if (!req.session.teacher_id) {
        return res.redirect("/teacher/login");
    }

    const registerNumber = req.params.register_number;

    const teacherSql = `
        SELECT class
        FROM teacher
        WHERE teacher_id = ?
    `;

    db.query(teacherSql, [req.session.teacher_id], (err, teachers) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Database error");
        }

        if (teachers.length === 0) {
            return res.status(403).send("Teacher not found");
        }

        const assignedClass = teachers[0].class;

        if (!assignedClass || !String(assignedClass).trim()) {
            return res.status(403).send("No class has been assigned to you.");
        }

        const studentSql = `
            SELECT id, name, register_number, email, mobile, class, address
            FROM student
            WHERE register_number = ?
              AND TRIM(class) = TRIM(?)
        `;

        db.query(
            studentSql,
            [registerNumber, assignedClass],
            (studentErr, students) => {
                if (studentErr) {
                    console.error(studentErr);
                    return res.status(500).send("Database error");
                }

                if (students.length === 0) {
                    return res.status(404).send(
                        "Student not found in your assigned class."
                    );
                }

                return res.render("editStudent.ejs", {
                    student: students[0]
                });
            }
        );
    });
});


/* =========================================
   UPDATE STUDENT
========================================= */

router.post("/student/:register_number/edit", (req, res) => {
    if (!req.session.teacher_id) {
        return res.redirect("/teacher/login");
    }

    const registerNumber = req.params.register_number;

    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim();
    const mobile = String(req.body.mobile || "").trim();
    const address = String(req.body.address || "").trim();

    if (!name || !email || !mobile || !address) {
        return res.status(400).send("Please fill in all required fields.");
    }

    const teacherSql = `
        SELECT class
        FROM teacher
        WHERE teacher_id = ?
    `;

    db.query(teacherSql, [req.session.teacher_id], (err, teachers) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Database error");
        }

        if (teachers.length === 0) {
            return res.status(403).send("Teacher not found");
        }

        const assignedClass = teachers[0].class;

        if (!assignedClass || !String(assignedClass).trim()) {
            return res.status(403).send("No class has been assigned to you.");
        }

        const updateSql = `
            UPDATE student
            SET name = ?, email = ?, mobile = ?, address = ?
            WHERE register_number = ?
              AND TRIM(class) = TRIM(?)
        `;

        db.query(
            updateSql,
            [name, email, mobile, address, registerNumber, assignedClass],
            (updateErr, result) => {
                if (updateErr) {
                    console.error(updateErr);

                    if (updateErr.code === "ER_DUP_ENTRY") {
                        return res.status(400).send(
                            "That email or another unique field is already in use."
                        );
                    }

                    return res.status(500).send("Unable to update student");
                }

                if (result.affectedRows === 0) {
                    return res.status(404).send(
                        "Student not found in your assigned class."
                    );
                }

                return res.redirect("/teacher/index");
            }
        );
    });
});


/* =========================================
   DELETE STUDENT
========================================= */

router.post("/student/:register_number/delete", (req, res) => {
    if (!req.session.teacher_id) {
        return res.redirect("/teacher/login");
    }

    const registerNumber = req.params.register_number;

    const teacherSql = `
        SELECT class
        FROM teacher
        WHERE teacher_id = ?
    `;

    db.query(teacherSql, [req.session.teacher_id], (err, teachers) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Database error");
        }

        if (teachers.length === 0) {
            return res.status(403).send("Teacher not found");
        }

        const assignedClass = teachers[0].class;

        if (!assignedClass || !String(assignedClass).trim()) {
            return res.status(403).send("No class has been assigned to you.");
        }

        const deleteSql = `
            DELETE FROM student
            WHERE register_number = ?
              AND TRIM(class) = TRIM(?)
        `;

        db.query(
            deleteSql,
            [registerNumber, assignedClass],
            (deleteErr, result) => {
                if (deleteErr) {
                    console.error(deleteErr);
                    return res.status(500).send("Unable to delete student");
                }

                if (result.affectedRows === 0) {
                    return res.status(404).send(
                        "Student not found in your assigned class."
                    );
                }

                return res.redirect("/teacher/index");
            }
        );
    });
});

// ==============================
// VIEW INDIVIDUAL STUDENT
// ==============================

router.get("/student/:register_number", (req, res) => {
    if (!req.session.teacher_id) {
        return res.redirect("/teacher/login");
    }

    const registerNumber = req.params.register_number;

    const sql = `
        SELECT id, name, register_number, email, mobile, class, address
        FROM student
        WHERE register_number = ?
    `;

    db.query(sql, [registerNumber], (err, result) => {
        if (err) {
            console.error("Student profile query error:", err);
            return res.status(500).send("Database error");
        }

        if (result.length === 0) {
            return res.status(404).send("Student not found");
        }

        return res.render("studDashboard.ejs", {
            student: result[0]
        });
    });
});

// ==============================
// TEACHER DASHBOARD
// ==============================

router.get("/dashboard", (req, res) => {
    if (!req.session.teacher_id) {
        return res.redirect("/teacher/login");
    }

    const sql = `
        SELECT *
        FROM teacher
        WHERE teacher_id = ?
    `;

    db.query(sql, [req.session.teacher_id], (err, result) => {
        if (err) {
            console.error("Teacher dashboard query error:", err);
            return res.status(500).send("Database error");
        }

        if (result.length === 0) {
            return res.redirect("/teacher/login");
        }

        return res.render("TeacherDashboard.ejs", {
            teacher: result[0],
            students: [],
            showStudents: false
        });
    });
});

// ==============================
// TEACHER LOGOUT
// ==============================

router.get("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Teacher logout error:", err);
            return res.status(500).send("Unable to log out");
        }

        return res.redirect("/teacher/login");
    });
});

//student invitation

router.post("/student/invite", (req, res) => {
    if (!req.session.teacher_id) {
        return res.redirect("/teacher/login");
    }

    const email = String(req.body.email || "")
        .trim()
        .toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).send("Enter a valid email address.");
    }

    // Get the logged-in teacher's assigned class
    db.query(
        "SELECT class FROM teacher WHERE teacher_id = ?",
        [req.session.teacher_id],
        (err, teachers) => {
            if (err) {
                console.error(err);
                return res.status(500).send("Database error.");
            }

            if (!teachers.length) {
                return res.status(404).send("Teacher account not found.");
            }

            const assignedClass = String(
                teachers[0].class || ""
            ).trim();

            // Stop only when the teacher has no class assigned
            if (!assignedClass) {
                return res.status(403).send(
                    "Your class has not been assigned by the administrator."
                );
            }

            const registerNumber =
                "STU-" +
                crypto.randomBytes(5).toString("hex").toUpperCase();

            const sql = `
                INSERT INTO student_invitations
                    (register_number, email, class, teacher_id)
                VALUES (?, ?, ?, ?)
            `;

            db.query(
                sql,
                [
                    registerNumber,
                    email,
                    assignedClass,
                    req.session.teacher_id
                ],
                (insertErr) => {
                    if (insertErr) {
                        console.error(insertErr);
                        return res.status(500).send(
                            "Unable to create invitation. Please try again."
                        );
                    }

                    req.session.generatedRegisterNumber = registerNumber;
                    req.session.invitedEmail = email;

                    return res.redirect("/teacher/index");
                }
            );
        }
    );
});


router.post("/student/:register_number/change-class", (req, res) => {
    if (!req.session.teacher_id) {
        return res.redirect("/teacher/login");
    }

    const direction = req.body.direction;

    if (!["up", "down"].includes(direction)) {
        return res.status(400).send("Invalid class change.");
    }

    db.query(
        "SELECT class FROM teacher WHERE teacher_id = ?",
        [req.session.teacher_id],
        (err, teachers) => {
            if (err) return res.status(500).send("Database error.");

            if (!teachers.length || !teachers[0].class) {
                return res.status(403).send("No class assigned.");
            }

            const assignedClass = Number(teachers[0].class);

            if (
                !Number.isInteger(assignedClass) ||
                assignedClass < 1 ||
                assignedClass > 12
            ) {
                return res.status(400).send("Invalid assigned class.");
            }

            const delta = direction === "up" ? 1 : -1;
            const newClass = assignedClass + delta;

            if (newClass < 1 || newClass > 12) {
                return res.status(400).send(
                    "Class must be between 1 and 12."
                );
            }

            db.query(
                `UPDATE student
     SET class = ?
     WHERE register_number = ?
       AND TRIM(class) = TRIM(?)`,
                [
                    String(newClass),
                    req.params.register_number,
                    String(assignedClass)
                ],
                (updateErr, result) => {
                    if (updateErr) {
                        console.error(updateErr);
                        return res.status(500).send("Unable to change class.");
                    }

                    if (!result.affectedRows) {
                        return res.status(404).send(
                            "Student not found in your assigned class."
                        );
                    }

                    return res.redirect("/teacher/index");
                }
            );
        }
    );
});

//marks

const PASS_PERCENTAGE = 35;

router.post("/student/:register_number/marks", (req, res) => {
    if (!req.session.teacher_id) {
        return res.redirect("/teacher/login");
    }

    const registerNumber = req.params.register_number;
    const academicYear = String(req.body.academic_year || "").trim();
    const marks = Number(req.body.marks);
    const totalMarks = Number(req.body.total_marks);

    if (
        !/^\d{4}-\d{4}$/.test(academicYear) ||
        !Number.isFinite(marks) ||
        !Number.isFinite(totalMarks) ||
        totalMarks <= 0 ||
        marks < 0 ||
        marks > totalMarks
    ) {
        return res.status(400).send("Invalid academic year or marks.");
    }

    db.query(
        "SELECT class FROM teacher WHERE teacher_id = ?",
        [req.session.teacher_id],
        (err, teachers) => {
            if (err) return res.status(500).send("Database error.");

            if (!teachers.length || !teachers[0].class) {
                return res.status(403).send("No class assigned.");
            }

            const assignedClass = Number(teachers[0].class);

            db.query(
                `SELECT register_number FROM student
                 WHERE register_number = ?
                   AND TRIM(class) = TRIM(?)`,
                [registerNumber, String(assignedClass)],
                (studentErr, students) => {
                    if (studentErr) {
                        return res.status(500).send("Database error.");
                    }

                    if (!students.length) {
                        return res.status(404).send(
                            "Student not found in your assigned class."
                        );
                    }

                    const percentage = (marks / totalMarks) * 100;
                    const status = percentage >= PASS_PERCENTAGE
                        ? "Pass"
                        : "Fail";

                    const sql = `
                        INSERT INTO annual_results
                        (register_number, academic_year, class_at_exam,
                         marks, total_marks, pass_percentage, status)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                        ON DUPLICATE KEY UPDATE
                            marks = IF(finalized = 0, VALUES(marks), marks),
                            total_marks = IF(finalized = 0,
                                VALUES(total_marks), total_marks),
                            pass_percentage = IF(finalized = 0,
                                VALUES(pass_percentage), pass_percentage),
                            status = IF(finalized = 0, VALUES(status), status)
                    `;

                    db.query(
                        sql,
                        [
                            registerNumber,
                            academicYear,
                            assignedClass,
                            marks,
                            totalMarks,
                            PASS_PERCENTAGE,
                            status
                        ],
                        (saveErr) => {
                            if (saveErr) {
                                console.error(saveErr);
                                return res.status(500).send(
                                    "Unable to save annual marks."
                                );
                            }

                            return res.redirect("/teacher/index");
                        }
                    );
                }
            );
        }
    );
});

//finalizing

router.post("/annual-results/finalize", (req, res) => {
    if (!req.session.teacher_id) {
        return res.redirect("/teacher/login");
    }

    const academicYear = String(req.body.academic_year || "").trim();

    if (!/^\d{4}-\d{4}$/.test(academicYear)) {
        return res.status(400).send("Enter a valid academic year.");
    }

    db.query(
        "SELECT class FROM teacher WHERE teacher_id = ?",
        [req.session.teacher_id],
        (err, teachers) => {
            if (err) {
                console.error(err);
                return res.status(500).send("Database error.");
            }

            if (!teachers.length) {
                return res.status(403).send("Teacher not found.");
            }

            const assignedClass = Number(teachers[0].class);

            if (
                !Number.isInteger(assignedClass) ||
                assignedClass < 1 ||
                assignedClass > 12
            ) {
                return res.status(403).send("Invalid assigned class.");
            }
            const finalizeSql = `
    UPDATE annual_results
    SET status = CASE
            WHEN (marks / total_marks) >= 0.35 THEN 'Pass'
            ELSE 'Fail'
        END,
        finalized = 1
    WHERE class_at_exam = ?
      AND academic_year = ?
      AND finalized = 0
      AND total_marks > 0
`;

            db.query(
                finalizeSql,
                [String(assignedClass), academicYear],
                (finalizeErr, result) => {
                    if (finalizeErr) {
                        console.error(finalizeErr);
                        return res.status(500).send(
                            "Unable to finalize annual results."
                        );
                    }

                    const promoteSql = `
                        UPDATE student s
                        JOIN annual_results ar
                          ON ar.register_number = s.register_number
                        SET s.class = ?
                        WHERE ar.class_at_exam = ?
                          AND ar.academic_year = ?
                          AND ar.finalized = 1
                          AND ar.status = 'Pass'
                          AND TRIM(s.class) = ?
                          AND ? < 12
                    `;

                    db.query(
                        promoteSql,
                        [
                            String(assignedClass + 1),
                            String(assignedClass),
                            academicYear,
                            String(assignedClass),
                            assignedClass
                        ],
                        (promoteErr, promoted) => {
                            if (promoteErr) {
                                console.error(promoteErr);
                                return res.status(500).send(
                                    "Results were finalized, but promotion " +
                                    "failed. Contact the administrator."
                                );
                            }

                            return res.send(
                                `Results finalized. ` +
                                `${result.affectedRows} result(s) finalized; ` +
                                `${promoted.affectedRows} student(s) promoted. ` +
                                `Students who failed remain in Class ` +
                                `${assignedClass}.`
                            );
                        }
                    );
                }
            );
        }
    );
});



module.exports = router;
