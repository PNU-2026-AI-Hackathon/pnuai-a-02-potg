"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const announcements_1 = __importDefault(require("./routes/announcements"));
const auth_1 = __importDefault(require("./routes/auth"));
const libraries_1 = __importDefault(require("./routes/libraries"));
const programs_1 = __importDefault(require("./routes/programs"));
const volunteers_1 = __importDefault(require("./routes/volunteers"));
const agenda_1 = __importDefault(require("./routes/agenda"));
const search_1 = __importDefault(require("./routes/search"));
const mockData_1 = require("./data/mockData");
const app = (0, express_1.default)();
const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.use((0, cors_1.default)({ origin: ['http://localhost:3000', 'http://127.0.0.1:3000'] }));
app.use(express_1.default.json());
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', message: 'PNUAI backend is running' });
});
app.get('/api/summary', (_req, res) => {
    res.json({
        libraries: mockData_1.libraries.length,
        programs: mockData_1.programs.length,
        agendaItems: mockData_1.agendaItems.length,
        volunteerMatches: mockData_1.volunteers.length,
    });
});
app.use('/api/announcements', announcements_1.default);
app.use('/api/auth', auth_1.default);
app.use('/api/libraries', libraries_1.default);
app.use('/api/programs', programs_1.default);
app.use('/api/volunteers', volunteers_1.default);
app.use('/api/agenda', agenda_1.default);
app.use('/api/search', search_1.default);
app.use((_req, res) => {
    res.status(404).json({ error: 'API route not found' });
});
app.listen(port, () => {
    console.log(`Backend server listening on http://localhost:${port}`);
});
