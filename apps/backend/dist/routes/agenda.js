"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mockData_1 = require("../data/mockData");
const router = (0, express_1.Router)();
router.get('/', (_req, res) => {
    res.json(mockData_1.agendaItems);
});
router.get('/:id', (req, res) => {
    const agenda = mockData_1.agendaItems.find((item) => item.id === req.params.id);
    if (!agenda) {
        return res.status(404).json({ error: 'Agenda item not found' });
    }
    res.json(agenda);
});
exports.default = router;
