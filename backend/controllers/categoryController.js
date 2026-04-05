const prisma = require("../config/prisma");

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

    const category = await prisma.categories.create({
      data: {
        user_id: userId,
        name: name.trim(),
        type,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Category created.",
      data: category,
    });
  } catch (err) {
    // P2002 = unique constraint violation
    if (err.code === "P2002") {
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

    const where = { user_id: userId };
    if (type && ["income", "expense"].includes(type)) {
      where.type = type;
    }

    const categories = await prisma.categories.findMany({
      where,
      orderBy: { created_at: "desc" },
    });

    return res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (err) {
    next(err);
  }
};

const getCategoryById = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const category = await prisma.categories.findFirst({
      where: { id, user_id: userId },
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: category,
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

    // Check ownership
    const existing = await prisma.categories.findFirst({
      where: { id, user_id: userId },
    });
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Category not found.",
      });
    }

    const data = {};
    if (name) data.name = name.trim();
    if (type) data.type = type;

    const updated = await prisma.categories.update({
      where: { id },
      data,
    });

    return res.status(200).json({
      success: true,
      message: "Category updated.",
      data: updated,
    });
  } catch (err) {
    if (err.code === "P2002") {
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

    const category = await prisma.categories.findFirst({
      where: { id, user_id: userId },
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found.",
      });
    }

    // Nullify foreign key on related transactions before deleting
    await prisma.transactions.updateMany({
      where: { category_id: id },
      data: { category_id: null },
    });

    await prisma.categories.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: "Category deleted. Linked transactions have been moved to uncategorized.",
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
