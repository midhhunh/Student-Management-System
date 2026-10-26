const router = require("express").Router();
const db = require("../db.jsx");

// ------------------------------------
// Helper: ensure student is logged in
// ------------------------------------
function requireStudent(req, res, next) {
    if (!req.session.studid) {
        return res.redirect("/students/login");
    }

    next();
}

// ------------------------------------
// REGISTER PAGE
// ------------------------------------
router.get("/register", (req, res) => {
    const error = req.session.registerError || null;
    const success = req.session.registerSuccess || null;

    delete req.session.registerError;
    delete req.session.registerSuccess;

    res.render("register.ejs", { error, success });
});

// ------------------------------------
// STUDENT REGISTRATION
// Requires a valid teacher invitation
// ------------------------------------
router.post("/register", (req, res) => {
    const fullName = String(req.body.fullname || "").trim();
    const registerNumber = String(req.body.registerNumber || req.body.reg_no || "").trim().toUpperCase();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const mobile = String(req.body.mob || "").trim();
    const aadhaar = String(
        req.body.aadhar || req.body.aadhaar || ""
    ).trim();
    const address = String(req.body.address || "").trim();

    if (
        !fullName ||
        !registerNumber ||
        !email ||
        !password ||
        !mobile ||
        !aadhaar ||
        !address
    ) {
        req.session.registerError =
            "Please fill in all required fields.";

        return res.redirect("/students/register");
    }

    if (fullName.length < 2 || fullName.length > 100) {
        req.session.registerError =
            "Name must contain between 2 and 100 characters.";

        return res.redirect("/students/register");
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        req.session.registerError =
            "Please enter a valid email address.";

        return res.redirect("/students/register");
    }

    if (password.length < 8) {
        req.session.registerError =
            "Password must contain at least 8 characters.";

        return res.redirect("/students/register");
    }

    if (!/^[0-9]{10}$/.test(mobile)) {
        req.session.registerError =
            "Enter a valid 10-digit mobile number.";

        return res.redirect("/students/register");
    }

    if (!/^[0-9]{12}$/.test(aadhaar)) {
        req.session.registerError =
            "Enter a valid 12-digit Aadhaar number.";

        return res.redirect("/students/register");
    }

    const invitationSql = `
        SELECT register_number, email, class
        FROM student_invitations
        WHERE register_number = ?
          AND LOWER(email) = ?
          AND is_used = 0
        LIMIT 1
    `;

    db.query(
        invitationSql,
        [registerNumber, email],
        (inviteErr, invitations) => {
            if (inviteErr) {
                console.error("Invitation lookup error:", inviteErr);

                return res.status(500).send(
                    "Unable to verify the registration invitation."
                );
            }

            if (!invitations || invitations.length === 0) {
                req.session.registerError =
                    "Invalid registration number or email, or the invitation has already been used. Ask your teacher for a valid invitation.";

                return res.redirect("/students/register");
            }

            const invitation = invitations[0];

            /*
             * Claim the invitation before creating the student.
             * Only one request can change is_used from 0 to 1.
             */
            const claimSql = `
                UPDATE student_invitations
                SET is_used = 1
                WHERE register_number = ?
                  AND LOWER(email) = ?
                  AND is_used = 0
            `;

            db.query(
                claimSql,
                [invitation.register_number, email],
                (claimErr, claimResult) => {
                    if (claimErr) {
                        console.error(
                            "Invitation claim error:",
                            claimErr
                        );

                        return res.status(500).send(
                            "Unable to claim the registration invitation."
                        );
                    }

                    if (claimResult.affectedRows !== 1) {
                        req.session.registerError =
                            "This invitation has already been used. Please contact your teacher.";

                        return res.redirect("/students/register");
                    }

                    const insertSql = `
                        INSERT INTO student
                        (
                            name,
                            register_number,
                            email,
                            password,
                            mobile,
                            class,
                            aadhaar,
                            address
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `;

                    db.query(
                        insertSql,
                        [
                            fullName,
                            invitation.register_number,
                            email,
                            password,
                            mobile,
                            invitation.class,
                            aadhaar,
                            address
                        ],
                        (insertErr) => {
                            if (insertErr) {
                                console.error(
                                    "Student registration error:",
                                    insertErr
                                );

                                // Restore invitation if insertion failed.
                                db.query(
                                    `UPDATE student_invitations
                                     SET is_used = 0
                                     WHERE register_number = ?
                                       AND is_used = 1`,
                                    [invitation.register_number],
                                    (restoreErr) => {
                                        if (restoreErr) {
                                            console.error(
                                                "Invitation restore error:",
                                                restoreErr
                                            );
                                        }

                                        if (
                                            insertErr.code ===
                                            "ER_DUP_ENTRY"
                                        ) {
                                            req.session.registerError =
                                                "The email, registration number, or password conflicts with an existing record.";
                                        } else {
                                            req.session.registerError =
                                                "Student registration failed. Please try again.";
                                        }

                                        return res.redirect(
                                            "/students/register"
                                        );
                                    }
                                );

                                return;
                            }

                            req.session.registerSuccess =
                                "Registration successful. Please log in.";

                            return res.redirect("/students/login");
                        }
                    );
                }
            );
        }
    );
});

// ------------------------------------
// LOGIN PAGE
// ------------------------------------
router.get("/login", (req, res) => {
    res.render("login.ejs", {
        error: req.session.loginError || null,
        success: req.session.registerSuccess || null
    });

    delete req.session.loginError;
    delete req.session.registerSuccess;
});

// ------------------------------------
// STUDENT LOGIN
// ------------------------------------
router.post("/login", (req, res) => {
    const email = String(req.body.email || "")
        .trim()
        .toLowerCase();
    const password = String(req.body.password || "");

    if (!email || !password) {
        req.session.loginError =
            "Please enter your email and password.";

        return res.redirect("/students/login");
    }

    const sql = `
        SELECT register_number
        FROM student
        WHERE LOWER(email) = ?
          AND password = ?
        LIMIT 1
    `;

    db.query(sql, [email, password], (err, result) => {
        if (err) {
            console.error("Student login error:", err);

            return res.status(500).send(
                "Unable to log in right now. Please try again."
            );
        }

        if (!result || result.length === 0) {
            req.session.loginError =
                "Invalid email or password.";

            return res.redirect("/students/login");
        }

        // Regenerate the session after successful authentication.
        req.session.regenerate((sessionErr) => {
            if (sessionErr) {
                console.error("Session regeneration error:", sessionErr);

                return res.status(500).send(
                    "Unable to create a login session."
                );
            }

            req.session.studid = result[0].register_number;

            req.session.save((saveErr) => {
                if (saveErr) {
                    console.error("Session save error:", saveErr);

                    return res.status(500).send(
                        "Unable to save your login session."
                    );
                }

                return res.redirect("/students/index");
            });
        });
    });
});

// ------------------------------------
// STUDENT HOME
// ------------------------------------
router.get("/index", requireStudent, (req, res) => {
    const sql = `
        SELECT *
        FROM student
        WHERE register_number = ?
        LIMIT 1
    `;

    db.query(sql, [req.session.studid], (err, result) => {
        if (err) {
            console.error("Student home error:", err);

            return res.status(500).send(
                "Unable to load the student home page."
            );
        }

        if (!result || result.length === 0) {
            return req.session.destroy(() => {
                res.redirect("/students/login");
            });
        }

        return res.render("studentsHome.ejs", {
            student: result[0]
        });
    });
});

// ------------------------------------
// STUDENT DASHBOARD
// ------------------------------------
router.get("/dashboard", requireStudent, (req, res) => {
    const studentSql = `
        SELECT *
        FROM student
        WHERE register_number = ?
        LIMIT 1
    `;

    db.query(studentSql, [req.session.studid], (err, studentRows) => {
        if (err) {
            console.error("Student dashboard error:", err);
            return res.status(500).send("Unable to load student dashboard.");
        }

        if (!studentRows || studentRows.length === 0) {
            return req.session.destroy(() => {
                res.redirect("/students/login");
            });
        }

        const student = studentRows[0];

        const resultsSql = `
            SELECT
                academic_year,
                class_at_exam,
                marks,
                total_marks,
                status,
                finalized
            FROM annual_results
            WHERE register_number = ?
              AND finalized = 1
            ORDER BY academic_year DESC
        `;

        db.query(
            resultsSql,
            [student.register_number],
            (resultsErr, results) => {
                if (resultsErr) {
                    console.error("Annual results error:", resultsErr);
                    return res.status(500).send(
                        "Unable to load annual examination results."
                    );
                }

                return res.render("studDashboard.ejs", {
                    student: student,
                    results: results || []
                });
            }
        );
    });
});

// ------------------------------------
// ABOUT PAGE
// Create views/studentAbout.ejs to use this route.
// ------------------------------------
router.get("/about", requireStudent, (req, res) => {
    return res.render("studentAbout.ejs");
});

// ------------------------------------
// CONTACT PAGE
// Create views/studentContact.ejs to use this route.
// ------------------------------------
router.get("/contact", requireStudent, (req, res) => {
    return res.render("studentContact.ejs");
});

// ------------------------------------
// STUDENT LOGOUT
// ------------------------------------
router.get("/logout", (req, res) => {
    if (!req.session) {
        return res.redirect("/students/login");
    }

    req.session.destroy((err) => {
        if (err) {
            console.error("Student logout error:", err);

            return res.status(500).send(
                "Unable to log out. Please try again."
            );
        }

        res.clearCookie("connect.sid");

        return res.redirect("/students/login");
    });
});

module.exports = router;