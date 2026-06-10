"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.users = exports.agendaItems = exports.volunteers = exports.programs = exports.libraries = exports.announcements = void 0;
exports.searchAll = searchAll;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
exports.announcements = [
    { id: 'a1', title: '2026년 금정구 작은도서관 협력 프로그램 운영 안내', date: '2026.05.09' },
    { id: 'a2', title: '지역 아동 대상 AI 독서 멘토링 참가자 모집', date: '2026.05.08' },
    { id: 'a3', title: '주민 제안 의제 기반 6월 문화프로그램 수요조사', date: '2026.05.07' },
    { id: 'a4', title: '대학생 전공 봉사자 모집 및 매칭 신청 안내', date: '2026.05.06' },
    { id: 'a5', title: '작은도서관 운영지원 플랫폼 시범서비스 오픈', date: '2026.05.03' },
];
exports.libraries = [
    {
        id: 'l1',
        name: '금샘마을 작은도서관',
        region: '금정구',
        address: '부산 금정구 금샘로 12',
        description: '지역 주민을 위한 작은 도서관입니다.',
        openHours: '09:00 - 18:00',
    },
    {
        id: 'l2',
        name: '부곡꿈 작은도서관',
        region: '부곡동',
        address: '부산 금정구 부곡로 38',
        description: '어린이와 청소년을 위한 독서 지원 서비스.',
        openHours: '10:00 - 19:00',
    },
    {
        id: 'l3',
        name: '서동누리 작은도서관',
        region: '서동',
        address: '부산 금정구 서동로 56',
        description: '성인을 위한 학습 프로그램과 문화 강좌를 운영합니다.',
        openHours: '09:30 - 18:30',
    },
    {
        id: 'l4',
        name: '장전책마을 작은도서관',
        region: '장전',
        address: '부산 금정구 장전로 9',
        description: '마을 주민 중심의 독서 및 프로그램 허브.',
        openHours: '10:00 - 17:30',
    },
];
exports.programs = [
    {
        id: 'p1',
        title: 'AI 독서 멘토링',
        libraryName: '금샘마을 작은도서관',
        date: '2026.05.22',
        participants: 15,
        status: '신청중',
    },
    {
        id: 'p2',
        title: '주민 제안 의제 워크숍',
        libraryName: '부곡꿈 작은도서관',
        date: '2026.05.25',
        participants: 20,
        status: '모집중',
    },
    {
        id: 'p3',
        title: '청소년 코딩 교실',
        libraryName: '서동누리 작은도서관',
        date: '2026.05.28',
        participants: 12,
        status: '신청마감',
    },
    {
        id: 'p4',
        title: '문화예술 그림책 읽기',
        libraryName: '장전책마을 작은도서관',
        date: '2026.06.01',
        participants: 18,
        status: '신청중',
    },
];
exports.volunteers = [
    {
        id: 'v1',
        title: '도서관 프로그램 운영 봉사',
        libraryName: '금샘마을 작은도서관',
        date: '2026.05.29',
        slots: 5,
        status: '가능',
    },
    {
        id: 'v2',
        title: '아동 독서 멘토링 지원',
        libraryName: '부곡꿈 작은도서관',
        date: '2026.06.03',
        slots: 3,
        status: '가능',
    },
    {
        id: 'v3',
        title: '행사 안내 및 진행 보조',
        libraryName: '서동누리 작은도서관',
        date: '2026.06.05',
        slots: 4,
        status: '가능',
    },
];
exports.agendaItems = [
    {
        id: 'g1',
        title: '지역 아동 독서 공간 개선',
        category: '지역 의제',
        summary: '작은도서관의 아동 열람실을 개선하고 독서 환경을 확충합니다.',
    },
    {
        id: 'g2',
        title: '청소년 진로 교육 연계 프로그램',
        category: '지역 의제',
        summary: '청소년 대상 진로 멘토링 및 AI 독서 프로그램을 강화합니다.',
    },
    {
        id: 'g3',
        title: '도서관 접근성 확대',
        category: '지역 의제',
        summary: '교통 취약 지역 주민을 위한 이동 도서관 및 안내 서비스를 제공합니다.',
    },
];
exports.users = [
    {
        id: 'u1',
        name: '홍길동',
        email: 'test@example.com',
        password: bcryptjs_1.default.hashSync('password123', 10),
    },
];
function searchAll(query, type) {
    const normalized = query.trim().toLowerCase();
    const results = {};
    if (!normalized) {
        return results;
    }
    const matches = (items) => items.filter((item) => [item.title, item.name, item.description, item.summary]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalized)));
    if (!type || type === 'announcement') {
        results.announcements = exports.announcements.filter((item) => item.title.toLowerCase().includes(normalized));
    }
    if (!type || type === 'library') {
        results.libraries = exports.libraries.filter((item) => item.name.toLowerCase().includes(normalized) || item.description.toLowerCase().includes(normalized));
    }
    if (!type || type === 'program') {
        results.programs = exports.programs.filter((item) => item.title.toLowerCase().includes(normalized) || item.libraryName.toLowerCase().includes(normalized));
    }
    if (!type || type === 'volunteer') {
        results.volunteers = exports.volunteers.filter((item) => item.title.toLowerCase().includes(normalized) || item.libraryName.toLowerCase().includes(normalized));
    }
    if (!type || type === 'agenda') {
        results.agenda = exports.agendaItems.filter((item) => item.title.toLowerCase().includes(normalized) || item.summary.toLowerCase().includes(normalized));
    }
    return results;
}
