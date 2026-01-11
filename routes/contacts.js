const express = require("express");
const router = express.Router();

const contactController = require("../controllers/contactController");
const { requireAdmin } = require("../middleware/auth");

// Страница контактов
router.get("/", contactController.getContacts);

// CRUD операции для контактов (только для администраторов)
router.post("/create", requireAdmin, contactController.createContact);
router.post("/:id/update", requireAdmin, contactController.updateContact);
router.post("/:id/delete", requireAdmin, contactController.deleteContact);

module.exports = router;
