import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5001/api";

const emptyExpense = {
  title: "",
  amount: "",
  category: "",
  expense_date: "",
};

function App() {
  const [mode, setMode] = useState("login");
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [token, setToken] = useState(localStorage.getItem("walletwise_token") || "");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [expenses, setExpenses] = useState([]);
  const [expenseForm, setExpenseForm] = useState(emptyExpense);
  const [editingId, setEditingId] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [totalExpense, setTotalExpense] = useState("0.00");

  const categories = useMemo(() => {
    const set = new Set(expenses.map((item) => item.category));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [expenses]);

  const filteredExpenses = useMemo(() => {
    if (categoryFilter === "all") return expenses;
    return expenses.filter((item) => item.category === categoryFilter);
  }, [categoryFilter, expenses]);

  const insight = useMemo(() => {
    if (!expenses.length) {
      return {
        biggest: 0,
        topCategory: "-",
      };
    }

    const biggest = expenses.reduce((max, item) => Math.max(max, Number(item.amount)), 0);
    const totalsByCategory = expenses.reduce((acc, item) => {
      const amount = Number(item.amount) || 0;
      acc[item.category] = (acc[item.category] || 0) + amount;
      return acc;
    }, {});

    const topCategory = Object.entries(totalsByCategory).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";

    return {
      biggest,
      topCategory,
    };
  }, [expenses]);

  const authHeaders = useMemo(() => {
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }, [token]);

  const showMessage = (text) => {
    setMessage(text);
    window.clearTimeout(window.__walletwiseMsgTimeout);
    window.__walletwiseMsgTimeout = window.setTimeout(() => setMessage(""), 2500);
  };

  const fetchMe = async (activeToken) => {
    const response = await fetch(`${API_BASE}/auth/me`, {
      headers: {
        Authorization: `Bearer ${activeToken}`,
      },
    });
    if (!response.ok) throw new Error("Session invalid. Please login again.");
    const data = await response.json();
    setUser(data.user);
  };

  const fetchExpenses = async () => {
    const response = await fetch(`${API_BASE}/getExpenses`, {
      headers: authHeaders,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not fetch expenses");
    setExpenses(data.expenses || []);
  };

  const fetchSummary = async () => {
    const response = await fetch(`${API_BASE}/expenses/summary`, {
      headers: authHeaders,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not fetch summary");
    setTotalExpense(data.total_expense || "0.00");
  };

  const syncDashboard = async () => {
    await Promise.all([fetchExpenses(), fetchSummary()]);
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);

    try {
      const endpoint = mode === "login" ? "login" : "register";
      const payload =
        mode === "login"
          ? { email: authForm.email, password: authForm.password }
          : authForm;

      const response = await fetch(`${API_BASE}/auth/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Authentication failed");

      localStorage.setItem("walletwise_token", data.token);
      setToken(data.token);
      setUser(data.user);
      setAuthForm({ name: "", email: "", password: "" });
      showMessage(data.message || "Welcome back");
    } catch (error) {
      showMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExpenseSubmit = async (event) => {
    event.preventDefault();

    try {
      const endpoint = editingId ? `/expenses/${editingId}` : "/createexpense";
      const method = editingId ? "PUT" : "POST";
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers: authHeaders,
        body: JSON.stringify(expenseForm),
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Could not save expense");

      setExpenseForm(emptyExpense);
      setEditingId(null);
      await syncDashboard();
      showMessage(data.message || "Expense saved");
    } catch (error) {
      showMessage(error.message);
    }
  };

  const startEdit = (expense) => {
    setEditingId(expense.id);
    setExpenseForm({
      title: expense.title,
      amount: expense.amount,
      category: expense.category,
      expense_date: expense.expense_date?.slice(0, 10),
    });
  };

  const deleteExpense = async (id) => {
    try {
      const response = await fetch(`${API_BASE}/expenses/${id}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not delete expense");

      await syncDashboard();
      showMessage(data.message || "Expense removed");
    } catch (error) {
      showMessage(error.message);
    }
  };

  const applyFilter = async (selectedCategory) => {
    setCategoryFilter(selectedCategory);
    if (selectedCategory === "all") {
      fetchExpenses();
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/expenses/category/${selectedCategory}`, {
        headers: authHeaders,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not filter by category");
      setExpenses(data.expenses || []);
    } catch (error) {
      showMessage(error.message);
    }
  };

  const logout = () => {
    localStorage.removeItem("walletwise_token");
    setToken("");
    setUser(null);
    setExpenses([]);
    setTotalExpense("0.00");
    setCategoryFilter("all");
    showMessage("Logged out");
  };

  useEffect(() => {
    if (!token) return;

    const bootstrap = async () => {
      try {
        await fetchMe(token);
      } catch (error) {
        localStorage.removeItem("walletwise_token");
        setToken("");
        setUser(null);
        showMessage(error.message);
        return;
      }

      try {
        await syncDashboard();
      } catch (error) {
        showMessage(error.message || "Dashboard data failed to load");
      }
    };

    bootstrap();
  }, [token]);

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <main className="page">
        <header className="hero-panel">
          <div className="hero-main">
            <div className="brand-pill">
              <span className="brand-dot" />
              <div>
                <p className="brand-name">LumenLedger</p>
                <p className="brand-meta">Expense Intelligence Suite</p>
              </div>
            </div>

            <div className="hero-copy">
              <p className="eyebrow">Personal Finance Command Center</p>
              <h1>Command your cashflow. Every rupee, every day.</h1>
              <p className="hero-subtitle">
                Beautiful expense intelligence, powered by your PostgreSQL API.
              </p>
            </div>
          </div>

          {user ? (
            <aside className="user-panel">
              <p className="user-panel-label">Signed in as</p>
              <p className="user-panel-name">{user.name}</p>
              <small className="user-panel-email">{user.email}</small>
              <button className="btn btn-logout" onClick={logout}>Logout</button>
            </aside>
          ) : (
            <aside className="user-panel guest">
              <p className="user-panel-label">Secure Session</p>
              <p className="user-panel-name">Ready to sign in</p>
              <small className="user-panel-email">Your data stays linked to your account</small>
            </aside>
          )}
        </header>

        {message ? <div className="toast">{message}</div> : null}

        {!token ? (
          <section className="auth-wrap">
            <div className="auth-tabs">
              <button
                className={mode === "login" ? "active" : ""}
                onClick={() => setMode("login")}
              >
                Login
              </button>
              <button
                className={mode === "register" ? "active" : ""}
                onClick={() => setMode("register")}
              >
                Register
              </button>
            </div>

            <form className="card auth-card" onSubmit={handleAuthSubmit}>
              {mode === "register" ? (
                <label>
                  Name
                  <input
                    value={authForm.name}
                    onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                    required
                  />
                </label>
              ) : null}

              <label>
                Email
                <input
                  type="email"
                  value={authForm.email}
                  onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                  required
                />
              </label>

              <label>
                Password
                <input
                  type="password"
                  value={authForm.password}
                  onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                  required
                />
              </label>

              <button className="btn btn-primary" disabled={loading}>
                {loading ? "Please wait..." : mode === "login" ? "Login" : "Create account"}
              </button>
            </form>
          </section>
        ) : (
          <section className="dashboard-grid">
            <article className="card stats">
              <h3>Total Expense</h3>
              <strong>Rs {Number(totalExpense).toLocaleString()}</strong>
              <p>{expenses.length} transactions captured</p>
            </article>

            <article className="card stats">
              <h3>Spending Insight</h3>
              <strong>Rs {Number(insight.biggest).toLocaleString()}</strong>
              <p>Highest single expense</p>
            </article>

            <article className="card stats">
              <h3>Category Filter</h3>
              <select value={categoryFilter} onChange={(e) => applyFilter(e.target.value)}>
                <option value="all">All categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <p>Top spending category: {insight.topCategory}</p>
            </article>

            <form className="card expense-form" onSubmit={handleExpenseSubmit}>
              <h3>{editingId ? "Edit Expense" : "Add Expense"}</h3>
              <label>
                Title
                <input
                  value={expenseForm.title}
                  onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
                  required
                />
              </label>

              <label>
                Amount
                <input
                  type="number"
                  step="0.01"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  required
                />
              </label>

              <label>
                Category
                <input
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                  required
                />
              </label>

              <label>
                Date
                <input
                  type="date"
                  value={expenseForm.expense_date}
                  onChange={(e) =>
                    setExpenseForm({ ...expenseForm, expense_date: e.target.value })
                  }
                  required
                />
              </label>

              <div className="inline-actions">
                <button className="btn btn-primary" type="submit">
                  {editingId ? "Update" : "Create"}
                </button>
                {editingId ? (
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setExpenseForm(emptyExpense);
                    }}
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>

            <article className="card expense-list">
              <div className="list-header">
                <h3>Your Expenses</h3>
                <button className="btn btn-ghost" onClick={syncDashboard}>
                  Refresh
                </button>
              </div>

              {filteredExpenses.length ? (
                <div className="rows">
                  {filteredExpenses.map((expense) => (
                    <div className="row" key={expense.id}>
                      <div>
                        <p className="title">{expense.title}</p>
                        <small>
                          {expense.category} • {String(expense.expense_date).slice(0, 10)}
                        </small>
                      </div>
                      <div className="row-side">
                        <strong>Rs {Number(expense.amount).toLocaleString()}</strong>
                        <div className="inline-actions compact">
                          <button className="btn btn-ghost" onClick={() => startEdit(expense)}>
                            Edit
                          </button>
                          <button
                            className="btn btn-danger"
                            onClick={() => deleteExpense(expense.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty">No expenses yet. Add your first entry.</p>
              )}
            </article>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
