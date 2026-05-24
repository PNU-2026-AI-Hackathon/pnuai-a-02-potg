"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mockData_1 = require("../data/mockData");
const router = (0, express_1.Router)();
router.get('/', (_req, res) => {
    res.json(mockData_1.volunteers);
});
router.get('/:id', (req, res) => {
    const volunteer = mockData_1.volunteers.find((item) => item.id === req.params.id);
    if (!volunteer) {
        return res.status(404).json({ error: 'Volunteer item not found' });
    }
    res.json(volunteer);
});
exports.default = router;
