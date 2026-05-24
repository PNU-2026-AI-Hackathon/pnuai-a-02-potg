"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mockData_1 = require("../data/mockData");
const router = (0, express_1.Router)();
router.get('/', (req, res) => {
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    const type = typeof req.query.type === 'string' ? req.query.type.toLowerCase() : undefined;
    if (!query) {
        return res.status(400).json({ error: 'query parameter q is required' });
    }
    const results = (0, mockData_1.searchAll)(query, type);
    res.json(results);
});
exports.default = router;
