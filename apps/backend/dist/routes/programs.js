"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mockData_1 = require("../data/mockData");
const router = (0, express_1.Router)();
router.get('/', (_req, res) => {
    res.json(mockData_1.programs);
});
router.get('/:id', (req, res) => {
    const program = mockData_1.programs.find((item) => item.id === req.params.id);
    if (!program) {
        return res.status(404).json({ error: 'Program not found' });
    }
    res.json(program);
});
exports.default = router;
