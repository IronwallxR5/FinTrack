const pool = require("../config/db");

const createCategory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { name, type } = req.body;

    if (!name || !type) {
      return res.status(400).json({
        success: false,
        message: "Name and type are required.",
      });
    }

    if (typeof name !== "string" || name.trim().length === 0 || name.trim().length > 100) {
      return res.status(400).json({
        success: false,
        message: "Name must be between 1 and 100 characters.",
      });
    }

    if (!["income", "expense"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Type must be 'income' or 'expense'.",
      });
    }

    const result = await pool.query(
      `INSERT INTO categories (user_id, name, type)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, name.trim(), type]
    );

    return res.status(201).json({
      success: true,
      message: "Category created.",
      data: result.rows[0],
    });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "A category with this name and type already exists.",
      });
    }
    next(err);
  }
};

const getCategories = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { type } = req.query; 

    let query = "SELECT * FROM categories WHERE user_id = $1";
    const params = [userId];

    if (type && ["income", "expense"].includes(type)) {
      query += " AND type = $2";
      params.push(type);
    }

    query += " ORDER BY created_at DESC";

    const result = await pool.query(query, params);

    return res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    next(err);
  }
};

const getCategoryById = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await pool.query(
      "SELECT * FROM categories WHERE id = $1 AND user_id = $2",
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Category not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

const updateCategory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { name, type } = req.body;

    if (!name && !type) {
      return res.status(400).json({
        success: false,
        message: "Provide at least name or type to update.",
      });
    }

    if (name !== undefined && (typeof name !== "string" || name.trim().length === 0 || name.trim().length > 100)) {
      return res.status(400).json({
        success: false,
        message: "Name must be between 1 and 100 characters.",
      });
    }

    if (type && !["income", "expense"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Type must be 'income' or 'expense'.",
      });
    }

    const fields = [];
    const params = [];
    let idx = 1;

    if (name) {
      fields.push(`name = $${idx++}`);
      params.push(name.trim());
    }
    if (type) {
      fields.push(`type = $${idx++}`);
      params.push(type);
    }

    params.push(id, userId);

    const result = await pool.query(
      `UPDATE categories SET ${fields.join(", ")}
       WHERE id = $${idx++} AND user_id = $${idx}
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Category not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Category updated.",
      data: result.rows[0],
    });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "A category with this name and type already exists.",
      });
    }
    next(err);
  }
};

const deleteCategory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const cat = await pool.query(
      "SELECT id FROM categories WHERE id = $1 AND user_id = $2",
      [id, userId]
    );

    if (cat.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Category not found.",
      });
    }

    await pool.query(
      "UPDATE transactions SET category_id = NULL WHERE category_id = $1",
      [id]
    );

    await pool.query("DELETE FROM categories WHERE id = $1", [id]);

    return res.status(200).json({
      success: true,
      message:
        "Category deleted. Linked transactions have been moved to uncategorized.",
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
};      
