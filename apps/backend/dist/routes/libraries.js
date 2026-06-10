"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mockData_1 = require("../data/mockData");
const router = (0, express_1.Router)();
router.get('/', (_req, res) => {
    res.json(mockData_1.libraries);
});
router.get('/:id', (req, res) => {
    const library = mockData_1.libraries.find((item) => item.id === req.params.id);
    if (!library) {
        return res.status(404).json({ error: 'Library not found' });
    }
    res.json(library);
});
exports.default = router;
