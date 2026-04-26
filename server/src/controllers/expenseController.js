const express=require("express");
const auth = require("../middleware/authMiddleware");
const router=express.Router()
const pool=require("../config/db")

// Expense Endpoints
// 1. Create Expense
// POST /expenses
// Add new expense
// Example:
// title
// amount
// category
// expense_date

router.post("/createexpense", auth, async (req, res) => {
    try {
        const userId = req.user.id;

        const {
            title,
            amount,
            category,
            expense_date
        } = req.body;

        if (!title || amount == null || !category || !expense_date) {
            return res.status(400).json({
                error: "Enter all required fields"
            });
        }

        const newExpense = await pool.query(
            `INSERT INTO expenses 
            (title, amount, category, expense_date, user_id)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *`,
            [title, amount, category, expense_date, userId]
        );

        return res.status(201).json({
            message: "Expense created successfully",
            expense: newExpense.rows[0]
        });

    } catch (error) {
        console.log(error);

        return res.status(500).json({
            error: "Internal server error"
        });
    }
});




// 2. Get All My Expenses
// GET /expenses
// Only logged-in user’s expenses
// Not everyone’s.

router.get("/getExpenses", auth, async (req, res) => {
    try {
        const userId = req.user.id;

        const expenses = await pool.query(
            "SELECT * FROM expenses WHERE user_id = $1",
            [userId]
        );

        if (expenses.rows.length === 0) {
            return res.status(200).json({
                message: "You don't have any expenses yet",
                expenses: []
            });
        }

        return res.status(200).json({
            message: "Expenses fetched successfully",
            expenses: expenses.rows
        });

    } catch (error) {
        console.log(error);

        return res.status(500).json({
            error: "Internal server error"
        });
    }
});
// 3. Get Single Expense
// GET /expenses/:id
// View one specific expense
// Only if it belongs to that user
router.get("/expenses/:id(\\d+)", auth, async (req, res) => {
    try {
        const userId = req.user.id;      // from JWT middleware
        const expenseId = req.params.id; // from URL params

        const expense = await pool.query(
            `SELECT * 
             FROM expenses
             WHERE id = $1
             AND user_id = $2`,
            [expenseId, userId]
        );

        if (expense.rows.length === 0) {
            return res.status(404).json({
                error: "Expense not found"
            });
        }

        return res.status(200).json({
            message: "Expense fetched successfully",
            expense: expense.rows[0]
        });

    } catch (error) {
        console.log(error);

        return res.status(500).json({
            error: "Internal server error"
        });
    }
});
// 4. Update Expense
// PUT /expenses/:id
// Edit expense
// Only owner can update
router.put("/expenses/:id(\\d+)", auth, async (req, res) => {
    try {
        const userId = req.user.id;      // from JWT middleware
        const expenseId = req.params.id; // from URL params

        const {
            title,
            amount,
            category,
            expense_date
        } = req.body;

        if (!title || amount == null || !category || !expense_date) {
            return res.status(400).json({
                error: "All fields are required"
            });
        }

        const updatedExpense = await pool.query(
            `UPDATE expenses
             SET title = $1,
                 amount = $2,
                 category = $3,
                 expense_date = $4
             WHERE id = $5
             AND user_id = $6
             RETURNING *`,
            [
                title,
                amount,
                category,
                expense_date,
                expenseId,
                userId
            ]
        );

        if (updatedExpense.rows.length === 0) {
            return res.status(404).json({
                error: "Expense not found or unauthorized"
            });
        }

        return res.status(200).json({
            message: "Expense updated successfully",
            expense: updatedExpense.rows[0]
        });

    } catch (error) {
        console.log(error);

        return res.status(500).json({
            error: "Internal server error"
        });
    }
});

// 5. Delete Expense
// DELETE /expenses/:id
// Delete expense
// Only owner can delete
router.delete("/expenses/:id(\\d+)", auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const expenseId = req.params.id;

        const deletedExpense = await pool.query(
            `DELETE FROM expenses
             WHERE id = $1
             AND user_id = $2
             RETURNING *`,
            [expenseId, userId]
        );

        if (deletedExpense.rows.length === 0) {
            return res.status(404).json({
                error: "Expense not found"
            });
        }

        return res.status(200).json({
            message: "Expense deleted successfully",
            expense: deletedExpense.rows[0]
        });

    } catch (error) {
        console.log(error);

        return res.status(500).json({
            error: "Internal server error"
        });
    }
});

// 6. Filter by Category
// GET /expenses/category/:category
// Example:
// /expenses/category/Food
// Useful.
// Good SQL practice.
// 1. Filter Expenses by Category

router.get("/expenses/category/:category", auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const category = req.params.category;

        const expenses = await pool.query(
            `SELECT *
             FROM expenses
             WHERE user_id = $1
             AND category = $2`,
            [userId, category]
        );

        if (expenses.rows.length === 0) {
            return res.status(200).json({
                message: "No expenses found for this category",
                expenses: []
            });
        }

        return res.status(200).json({
            message: "Category expenses fetched successfully",
            expenses: expenses.rows
        });

    } catch (error) {
        console.log(error);

        return res.status(500).json({
            error: "Internal server error"
        });
    }
});

// 7. Monthly Summary
// GET /expenses/summary
// Example response:
// {  "total": 12400}
// Very strong interview endpoint.
// Because it uses:
// SQL aggregation
// 2. Monthly Summary (Total Expense)

router.get("/expenses/summary", auth, async (req, res) => {
    try {
        const userId = req.user.id;

        const summary = await pool.query(
            `SELECT COALESCE(SUM(amount), 0) AS total_expense
             FROM expenses
             WHERE user_id = $1`,
            [userId]
        );

        return res.status(200).json({
            message: "Expense summary fetched successfully",
            total_expense: summary.rows[0].total_expense
        });

    } catch (error) {
        console.log(error);

        return res.status(500).json({
            error: "Internal server error"
        });
    }
});
module.exports={router}