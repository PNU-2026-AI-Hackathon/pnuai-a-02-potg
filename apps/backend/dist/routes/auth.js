"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const mockData_1 = require("../data/mockData");
const router = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET ?? 'pnuai-secret-key';
const JWT_EXPIRES_IN = '1h';
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'email and password are required' });
    }
    const user = mockData_1.users.find((item) => item.email === email);
    if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    const passwordMatches = await bcryptjs_1.default.compare(password, user.password);
    if (!passwordMatches) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jsonwebtoken_1.default.sign({ sub: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    return res.status(200).json({
        token,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
        },
    });
});
router.post('/register', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'name, email, and password are required' });
    }
    const exists = mockData_1.users.some((item) => item.email === email);
    if (exists) {
        return res.status(409).json({ error: 'User already exists' });
    }
    const hashedPassword = await bcryptjs_1.default.hash(password, 10);
    const newUser = { id: `u${mockData_1.users.length + 1}`, name, email, password: hashedPassword };
    mockData_1.users.push(newUser);
    const token = jsonwebtoken_1.default.sign({ sub: newUser.id, email: newUser.email, name: newUser.name }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    return res.status(201).json({
        token,
        user: {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
        },
    });
});
exports.default = router;
