"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
var generative_ai_1 = require("@google/generative-ai");
var crypto_1 = __importDefault(require("crypto"));
/**
 * Vercel Serverless: POST /api/telegram-webhook
 * Webhook nhận sự kiện trực tiếp từ Telegram.
 *
 * Query params:
 * ?ownerId=[OWNER_ID]
 *
 * POST body:
 * Theo chuẩn Telegram Update Object
 */
var PROJECT_ID = 'dunvex-89461';
var FIRESTORE_BASE = "https://firestore.googleapis.com/v1/projects/".concat(PROJECT_ID, "/databases/(default)/documents");
var GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
function getAccessToken() {
    return __awaiter(this, void 0, void 0, function () {
        var json, sa, header, now, claim, b64obj, sign, partial, jwt, tokenRes, td;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    json = process.env.FIREBASE_SERVICE_ACCOUNT;
                    if (!json)
                        throw new Error('Missing FIREBASE_SERVICE_ACCOUNT env');
                    sa = JSON.parse(json);
                    header = { alg: 'RS256', typ: 'JWT', kid: sa.private_key_id };
                    now = Math.floor(Date.now() / 1000);
                    claim = {
                        iss: sa.client_email, sub: sa.client_email,
                        aud: 'https://oauth2.googleapis.com/token',
                        iat: now, exp: now + 3600,
                        scope: 'https://www.googleapis.com/auth/datastore',
                    };
                    b64obj = function (obj) { return Buffer.from(JSON.stringify(obj)).toString('base64url'); };
                    sign = function (pk, data) {
                        return crypto_1.default.createSign('RSA-SHA256').update(data).sign(pk, 'base64url');
                    };
                    partial = "".concat(b64obj(header), ".").concat(b64obj(claim));
                    jwt = "".concat(partial, ".").concat(sign(sa.private_key, partial));
                    return [4 /*yield*/, fetch('https://oauth2.googleapis.com/token', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                            body: "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=".concat(jwt),
                        })];
                case 1:
                    tokenRes = _a.sent();
                    return [4 /*yield*/, tokenRes.json()];
                case 2:
                    td = _a.sent();
                    if (td.error)
                        throw new Error("Auth: ".concat(td.error_description || td.error));
                    return [2 /*return*/, td.access_token];
            }
        });
    });
}
function restGet(token, path) {
    return __awaiter(this, void 0, void 0, function () {
        var res;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fetch("".concat(FIRESTORE_BASE, "/").concat(path), { headers: { Authorization: "Bearer ".concat(token) } })];
                case 1:
                    res = _a.sent();
                    if (res.status === 404)
                        return [2 /*return*/, null];
                    if (!res.ok)
                        throw new Error("Firestore GET ".concat(path, ": ").concat(res.status));
                    return [2 /*return*/, res.json()];
            }
        });
    });
}
function runStructuredQuery(token, collectionId, fieldFilters, limit, orderBy) {
    return __awaiter(this, void 0, void 0, function () {
        var url, filter, body, res, txt, data;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    url = "".concat(FIRESTORE_BASE, ":runQuery");
                    filter = fieldFilters.length === 1
                        ? fieldFilters[0]
                        : {
                            compositeFilter: {
                                op: 'AND',
                                filters: fieldFilters
                            }
                        };
                    body = {
                        structuredQuery: {
                            from: [{ collectionId: collectionId }],
                            where: filter
                        }
                    };
                    if (limit)
                        body.structuredQuery.limit = limit;
                    if (orderBy)
                        body.structuredQuery.orderBy = [orderBy];
                    return [4 /*yield*/, fetch(url, {
                            method: 'POST',
                            headers: {
                                'Authorization': "Bearer ".concat(token),
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(body)
                        })];
                case 1:
                    res = _a.sent();
                    if (!!res.ok) return [3 /*break*/, 3];
                    return [4 /*yield*/, res.text()];
                case 2:
                    txt = _a.sent();
                    throw new Error("Firestore query failed: ".concat(res.status, " ").concat(txt));
                case 3: return [4 /*yield*/, res.json()];
                case 4:
                    data = _a.sent();
                    if (!Array.isArray(data))
                        return [2 /*return*/, []];
                    return [2 /*return*/, data
                            .filter(function (item) { return item.document; })
                            .map(function (item) { return item.document; })];
            }
        });
    });
}
function restCreate(token, collection, fields) {
    return __awaiter(this, void 0, void 0, function () {
        var url, res;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    url = "".concat(FIRESTORE_BASE, "/").concat(collection);
                    return [4 /*yield*/, fetch(url, {
                            method: 'POST',
                            headers: { 'Authorization': "Bearer ".concat(token), 'Content-Type': 'application/json' },
                            body: JSON.stringify({ fields: fields })
                        })];
                case 1:
                    res = _a.sent();
                    if (!res.ok)
                        throw new Error("Firestore POST ".concat(collection, " failed: ").concat(res.status));
                    return [2 /*return*/, res.json()];
            }
        });
    });
}
function restPatch(token, path, fields) {
    return __awaiter(this, void 0, void 0, function () {
        var keys, mask, url, res;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    keys = Object.keys(fields);
                    mask = keys.map(function (k) { return "updateMask.fieldPaths=".concat(k); }).join('&');
                    url = "".concat(FIRESTORE_BASE, "/").concat(path, "?").concat(mask);
                    return [4 /*yield*/, fetch(url, {
                            method: 'PATCH',
                            headers: { 'Authorization': "Bearer ".concat(token), 'Content-Type': 'application/json' },
                            body: JSON.stringify({ fields: fields })
                        })];
                case 1:
                    res = _a.sent();
                    if (!res.ok)
                        throw new Error("Firestore PATCH ".concat(path, " failed: ").concat(res.status));
                    return [2 /*return*/, res.json()];
            }
        });
    });
}
function handler(req, res) {
    return __awaiter(this, void 0, void 0, function () {
        var ownerId_1, body, userMessage, chatId, chatType, lowerText, isCalledByName, token, keyDoc, kf, botToken, isGroupChat, chatIdField, currentValue, _a, userDoc, customersData, suppliersData, recentOrders, supplierDebtsData, adminName_1, customersWithDebt, suppliersWithDebt, _loop_1, _i, suppliersData_1, s, ordersData, systemPrompt, genAI, model, chat, result, e_1, call, funcResult, _b, customerName, totalAmount, _c, customerName, adjustmentAmount, customers, c, currentDebt, newDebt, customerId, e_2, e_3, text, error_1;
        var _d;
        var _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
        return __generator(this, function (_u) {
            switch (_u.label) {
                case 0:
                    // CORS
                    res.setHeader('Access-Control-Allow-Origin', '*');
                    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
                    if (req.method === 'OPTIONS') {
                        return [2 /*return*/, res.status(200).end()];
                    }
                    if (req.method !== 'POST') {
                        return [2 /*return*/, res.status(405).json({ error: 'Method not allowed. Use POST.' })];
                    }
                    if (!GEMINI_API_KEY) {
                        console.error('GEMINI_API_KEY not configured on server');
                        return [2 /*return*/, res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' })];
                    }
                    _u.label = 1;
                case 1:
                    _u.trys.push([1, 24, , 25]);
                    ownerId_1 = req.query.ownerId;
                    if (!ownerId_1) {
                        console.error('Missing ownerId in query');
                        return [2 /*return*/, res.status(400).json({ error: 'Missing ownerId' })];
                    }
                    body = req.body;
                    // Telegram webhook sends { update_id, message: { message_id, from, chat, date, text } }
                    if (!body || !body.message || !body.message.chat) {
                        // Ignore non-message updates (like edited_message, channel_post) to avoid errors
                        return [2 /*return*/, res.status(200).json({ status: 'ignored' })];
                    }
                    userMessage = body.message.text || body.message.caption || '';
                    chatId = body.message.chat.id;
                    chatType = body.message.chat.type;
                    // Nếu là group, chỉ phản hồi khi được gọi đích danh (chứa "dunvex bot")
                    if (chatType === 'group' || chatType === 'supergroup') {
                        lowerText = userMessage.toLowerCase();
                        isCalledByName = lowerText.includes('dunvex bot');
                        if (!isCalledByName) {
                            // Bỏ qua tin nhắn trò chuyện bình thường của các thành viên trong nhóm
                            return [2 /*return*/, res.status(200).json({ status: 'ignored_group_chatter' })];
                        }
                    }
                    return [4 /*yield*/, getAccessToken()];
                case 2:
                    token = _u.sent();
                    return [4 /*yield*/, restGet(token, "api_keys/".concat(ownerId_1))];
                case 3:
                    keyDoc = _u.sent();
                    if (!keyDoc) {
                        console.error('API key doc not found for owner:', ownerId_1);
                        return [2 /*return*/, res.status(403).json({ error: 'Owner not found' })];
                    }
                    kf = keyDoc.fields || {};
                    botToken = (_e = kf.telegramBotToken) === null || _e === void 0 ? void 0 : _e.stringValue;
                    if (!botToken || ((_f = kf.enabled) === null || _f === void 0 ? void 0 : _f.booleanValue) !== true) {
                        console.error('Invalid or disabled bot token for owner:', ownerId_1);
                        return [2 /*return*/, res.status(403).json({ error: 'Invalid or disabled bot token' })];
                    }
                    isGroupChat = chatType === 'group' || chatType === 'supergroup';
                    chatIdField = isGroupChat ? 'telegramGroupChatId' : 'telegramChatId';
                    currentValue = (_g = kf[chatIdField]) === null || _g === void 0 ? void 0 : _g.stringValue;
                    if (!(!currentValue || currentValue !== String(chatId))) return [3 /*break*/, 5];
                    return [4 /*yield*/, fetch("".concat(FIRESTORE_BASE, "/api_keys/").concat(ownerId_1, "?updateMask.fieldPaths=").concat(chatIdField), {
                            method: 'PATCH',
                            headers: { 'Authorization': "Bearer ".concat(token), 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                name: "projects/".concat(PROJECT_ID, "/databases/(default)/documents/api_keys/").concat(ownerId_1),
                                fields: (_d = {},
                                    _d[chatIdField] = { stringValue: String(chatId) },
                                    _d)
                            })
                        })];
                case 4:
                    _u.sent();
                    _u.label = 5;
                case 5: return [4 /*yield*/, Promise.all([
                        restGet(token, "users/".concat(ownerId_1)),
                        runStructuredQuery(token, 'customers', [{ fieldFilter: { field: { fieldPath: 'ownerId' }, op: 'EQUAL', value: { stringValue: ownerId_1 } } }]),
                        runStructuredQuery(token, 'suppliers', [{ fieldFilter: { field: { fieldPath: 'ownerId' }, op: 'EQUAL', value: { stringValue: ownerId_1 } } }]),
                        runStructuredQuery(token, 'orders', [{ fieldFilter: { field: { fieldPath: 'ownerId' }, op: 'EQUAL', value: { stringValue: ownerId_1 } } }], 50, { field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }),
                        runStructuredQuery(token, 'supplier_debts', [{ fieldFilter: { field: { fieldPath: 'ownerId' }, op: 'EQUAL', value: { stringValue: ownerId_1 } } }])
                    ])];
                case 6:
                    _a = _u.sent(), userDoc = _a[0], customersData = _a[1], suppliersData = _a[2], recentOrders = _a[3], supplierDebtsData = _a[4];
                    adminName_1 = ((_j = (_h = userDoc === null || userDoc === void 0 ? void 0 : userDoc.fields) === null || _h === void 0 ? void 0 : _h.displayName) === null || _j === void 0 ? void 0 : _j.stringValue) || ((_l = (_k = userDoc === null || userDoc === void 0 ? void 0 : userDoc.fields) === null || _k === void 0 ? void 0 : _k.email) === null || _l === void 0 ? void 0 : _l.stringValue) || 'Admin';
                    customersWithDebt = customersData.filter(function (c) {
                        var _a, _b, _c, _d;
                        var debt = Number(((_b = (_a = c.fields) === null || _a === void 0 ? void 0 : _a.debt) === null || _b === void 0 ? void 0 : _b.integerValue) || ((_d = (_c = c.fields) === null || _c === void 0 ? void 0 : _c.debt) === null || _d === void 0 ? void 0 : _d.doubleValue) || 0);
                        return debt > 0;
                    }).map(function (c) {
                        var _a, _b, _c, _d, _e, _f, _g, _h;
                        return {
                            name: ((_b = (_a = c.fields) === null || _a === void 0 ? void 0 : _a.name) === null || _b === void 0 ? void 0 : _b.stringValue) || '',
                            debt: Number(((_d = (_c = c.fields) === null || _c === void 0 ? void 0 : _c.debt) === null || _d === void 0 ? void 0 : _d.integerValue) || ((_f = (_e = c.fields) === null || _e === void 0 ? void 0 : _e.debt) === null || _f === void 0 ? void 0 : _f.doubleValue) || 0),
                            days: ((_h = (_g = c.fields) === null || _g === void 0 ? void 0 : _g.debtDays) === null || _h === void 0 ? void 0 : _h.integerValue) || 0
                        };
                    });
                    suppliersWithDebt = [];
                    _loop_1 = function (s) {
                        var sDebts = supplierDebtsData.filter(function (d) {
                            var _a, _b;
                            var supplierId = (_b = (_a = d.fields) === null || _a === void 0 ? void 0 : _a.supplierId) === null || _b === void 0 ? void 0 : _b.stringValue;
                            return supplierId === s.id;
                        });
                        var netDebt = sDebts.reduce(function (sum, d) {
                            var _a, _b, _c, _d, _e, _f, _g, _h;
                            var amount = Number((_f = (_c = (_b = (_a = d.fields) === null || _a === void 0 ? void 0 : _a.amount) === null || _b === void 0 ? void 0 : _b.integerValue) !== null && _c !== void 0 ? _c : (_e = (_d = d.fields) === null || _d === void 0 ? void 0 : _d.amount) === null || _e === void 0 ? void 0 : _e.doubleValue) !== null && _f !== void 0 ? _f : 0);
                            var type = (_h = (_g = d.fields) === null || _g === void 0 ? void 0 : _g.type) === null || _h === void 0 ? void 0 : _h.stringValue;
                            if (type === 'debt_increase')
                                return sum + amount;
                            if (type === 'payment')
                                return sum - amount;
                            return sum;
                        }, 0);
                        if (netDebt > 0) {
                            suppliersWithDebt.push({
                                name: ((_o = (_m = s.fields) === null || _m === void 0 ? void 0 : _m.name) === null || _o === void 0 ? void 0 : _o.stringValue) || '',
                                debt: netDebt
                            });
                        }
                    };
                    for (_i = 0, suppliersData_1 = suppliersData; _i < suppliersData_1.length; _i++) {
                        s = suppliersData_1[_i];
                        _loop_1(s);
                    }
                    ordersData = recentOrders.map(function (o) {
                        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
                        var emailName = ((_b = (_a = o.fields) === null || _a === void 0 ? void 0 : _a.createdByEmail) === null || _b === void 0 ? void 0 : _b.stringValue) ? o.fields.createdByEmail.stringValue.split('@')[0] : '';
                        var fallbackStaff = ((_d = (_c = o.fields) === null || _c === void 0 ? void 0 : _c.createdBy) === null || _d === void 0 ? void 0 : _d.stringValue) === ownerId_1 ? adminName_1 : (emailName || 'Nhân viên');
                        return {
                            customerName: ((_f = (_e = o.fields) === null || _e === void 0 ? void 0 : _e.customerName) === null || _f === void 0 ? void 0 : _f.stringValue) || '',
                            totalAmount: Number(((_h = (_g = o.fields) === null || _g === void 0 ? void 0 : _g.totalAmount) === null || _h === void 0 ? void 0 : _h.integerValue) || ((_k = (_j = o.fields) === null || _j === void 0 ? void 0 : _j.totalAmount) === null || _k === void 0 ? void 0 : _k.doubleValue) || 0),
                            staffName: ((_m = (_l = o.fields) === null || _l === void 0 ? void 0 : _l.staffName) === null || _m === void 0 ? void 0 : _m.stringValue) || fallbackStaff,
                            date: ((_p = (_o = o.fields) === null || _o === void 0 ? void 0 : _o.orderDate) === null || _p === void 0 ? void 0 : _p.stringValue) || ''
                        };
                    });
                    systemPrompt = "B\u1EA1n l\u00E0 tr\u1EE3 l\u00FD AI (t\u00EAn l\u00E0 dunvex bot) ph\u1EE5c v\u1EE5 \u0110\u1ED8C QUY\u1EC0N cho t\u00E0i kho\u1EA3n: ".concat(adminName_1, " c\u1EE7a ph\u1EA7n m\u1EC1m qu\u1EA3n l\u00FD Dunvex Build.\nNhi\u1EC7m v\u1EE5 c\u1EE7a b\u1EA1n: Tr\u1EA3 l\u1EDDi t\u1EF1 nhi\u00EAn, th\u00E2n thi\u1EC7n v\u00E0 cung c\u1EA5p th\u00F4ng tin ch\u00EDnh x\u00E1c t\u1EEB h\u1EC7 th\u1ED1ng.\nQUY T\u1EAEC QUAN TR\u1ECCNG: \n1. B\u1EAET BU\u1ED8C S\u1EEC D\u1EE4NG HTML \u0110\u1EC2 \u0110\u1ECANH D\u1EA0NG (v\u00ED d\u1EE5: <b>ch\u1EEF \u0111\u1EADm</b>, <i>ch\u1EEF nghi\u00EAng</i>). \n2. TUY\u1EC6T \u0110\u1ED0I KH\u00D4NG D\u00D9NG MARKDOWN (kh\u00F4ng d\u00F9ng d\u1EA5u * hay ** hay #). C\u00E1c danh s\u00E1ch h\u00E3y d\u00F9ng g\u1EA1ch \u0111\u1EA7u d\u00F2ng (-) ho\u1EB7c c\u00E1c emoji (\uD83D\uDC49, \uD83D\uDCE6, \uD83D\uDCB0, \uD83D\uDC64).\n3. HI\u1EC6N T\u1EA0I B\u1EA0N \u0110\u00C3 C\u00D3 KH\u1EA2 N\u0102NG S\u1EEC D\u1EE4NG C\u00D4NG C\u1EE4 (TOOLS). Khi ng\u01B0\u1EDDi d\u00F9ng y\u00EAu c\u1EA7u t\u1EA1o \u0111\u01A1n h\u00E0ng, s\u1EEDa \u0111\u01A1n h\u00E0ng, hay ch\u1EC9nh s\u1EEDa c\u00F4ng n\u1EE3, H\u00C3Y G\u1ECCI H\u00C0M T\u01AF\u01A0NG \u1EE8NG.\n4. B\u00E1o c\u00E1o doanh thu ho\u1EB7c c\u00F4ng n\u1EE3 m\u1ED9t c\u00E1ch d\u1EC5 hi\u1EC3u, format ti\u1EC1n t\u1EC7 VN\u0110 (v\u00ED d\u1EE5: 10.000.000\u0111).\n5. Nh\u1EAFc \u0111\u1EBFn t\u00EAn admin l\u00E0 ").concat(adminName_1, " n\u1EBFu ng\u01B0\u1EDDi d\u00F9ng h\u1ECFi b\u1EA1n \u0111ang ph\u1EE5c v\u1EE5 ai.\n\n--- D\u1EEE LI\u1EC6U HI\u1EC6N T\u1EA0I T\u1EEA H\u1EC6 TH\u1ED0NG C\u1EE6A ADMIN: ").concat(adminName_1, " ---\nKh\u00E1ch h\u00E0ng \u0111ang c\u00F3 c\u00F4ng n\u1EE3 (Kh\u00E1ch h\u00E0ng n\u1EE3 m\u00ECnh):\n").concat(customersWithDebt.map(function (c) { return "- ".concat(c.name, ": N\u1EE3 ").concat(c.debt.toLocaleString('vi-VN'), "\u0111 (S\u1ED1 ng\u00E0y: ").concat(c.days, ")"); }).join('\n') || 'Không có khách nợ.', "\n\nNh\u00E0 cung c\u1EA5p \u0111ang c\u00F3 c\u00F4ng n\u1EE3 (M\u00ECnh n\u1EE3 NCC):\n").concat(suppliersWithDebt.map(function (s) { return "- ".concat(s.name, ": \u0110ang n\u1EE3 ").concat(s.debt.toLocaleString('vi-VN'), "\u0111"); }).join('\n') || 'Không có nợ nhà cung cấp.', "\n\n50 \u0110\u01A1n h\u00E0ng g\u1EA7n nh\u1EA5t (Kh\u00E1ch h\u00E0ng / Doanh thu / Nh\u00E2n vi\u00EAn / Ng\u00E0y):\n").concat(ordersData.map(function (o) { return "- ".concat(o.customerName, ": ").concat(o.totalAmount.toLocaleString('vi-VN'), "\u0111 (Nh\u00E2n vi\u00EAn: ").concat(o.staffName, ", Ng\u00E0y: ").concat(new Date(o.date).toLocaleDateString('vi-VN'), ")"); }).join('\n') || 'Chưa có đơn hàng.', "\n------------------------------------------------");
                    genAI = new generative_ai_1.GoogleGenerativeAI(GEMINI_API_KEY);
                    model = genAI.getGenerativeModel({
                        model: 'gemini-2.5-flash-lite',
                        systemInstruction: systemPrompt,
                        tools: [{
                                functionDeclarations: [
                                    {
                                        name: "create_order",
                                        description: "Tạo đơn hàng mới cho khách hàng.",
                                        parameters: {
                                            type: generative_ai_1.SchemaType.OBJECT,
                                            properties: {
                                                customerName: { type: generative_ai_1.SchemaType.STRING, description: "Tên khách hàng" },
                                                totalAmount: { type: generative_ai_1.SchemaType.NUMBER, description: "Tổng tiền đơn hàng (VNĐ)" }
                                            },
                                            required: ["customerName", "totalAmount"]
                                        }
                                    },
                                    {
                                        name: "update_customer_debt",
                                        description: "Thêm hoặc trừ công nợ của khách hàng (VD: khách trả nợ thì trừ nợ, khách mua nợ thì thêm nợ).",
                                        parameters: {
                                            type: generative_ai_1.SchemaType.OBJECT,
                                            properties: {
                                                customerName: { type: generative_ai_1.SchemaType.STRING, description: "Tên khách hàng" },
                                                adjustmentAmount: { type: generative_ai_1.SchemaType.NUMBER, description: "Số tiền thay đổi (số ÂM nếu khách trả nợ / giảm nợ, số DƯƠNG nếu khách nợ thêm)" }
                                            },
                                            required: ["customerName", "adjustmentAmount"]
                                        }
                                    }
                                ]
                            }]
                    });
                    chat = model.startChat();
                    result = void 0;
                    _u.label = 7;
                case 7:
                    _u.trys.push([7, 9, , 10]);
                    return [4 /*yield*/, chat.sendMessage(userMessage)];
                case 8:
                    result = _u.sent();
                    return [3 /*break*/, 10];
                case 9:
                    e_1 = _u.sent();
                    console.error('Gemini error:', e_1);
                    return [2 /*return*/, res.status(500).json({ error: 'Lỗi khi gọi AI', details: e_1.message })];
                case 10:
                    call = (_p = result.response.functionCalls()) === null || _p === void 0 ? void 0 : _p[0];
                    if (!call) return [3 /*break*/, 22];
                    funcResult = "";
                    _u.label = 11;
                case 11:
                    _u.trys.push([11, 18, , 19]);
                    if (!(call.name === "create_order")) return [3 /*break*/, 13];
                    _b = call.args, customerName = _b.customerName, totalAmount = _b.totalAmount;
                    return [4 /*yield*/, restCreate(token, 'orders', {
                            ownerId: { stringValue: ownerId_1 },
                            customerName: { stringValue: customerName },
                            totalAmount: { integerValue: String(totalAmount) },
                            status: { stringValue: 'Đơn chốt' },
                            createdAt: { timestampValue: new Date().toISOString() },
                            createdBy: { stringValue: 'Telegram Bot' }
                        })];
                case 12:
                    _u.sent();
                    funcResult = "T\u1EA1o \u0111\u01A1n h\u00E0ng th\u00E0nh c\u00F4ng cho ".concat(customerName, " v\u1EDBi s\u1ED1 ti\u1EC1n ").concat(totalAmount, "\u0111");
                    return [3 /*break*/, 17];
                case 13:
                    if (!(call.name === "update_customer_debt")) return [3 /*break*/, 17];
                    _c = call.args, customerName = _c.customerName, adjustmentAmount = _c.adjustmentAmount;
                    return [4 /*yield*/, runStructuredQuery(token, 'customers', [
                            { fieldFilter: { field: { fieldPath: 'ownerId' }, op: 'EQUAL', value: { stringValue: ownerId_1 } } },
                            { fieldFilter: { field: { fieldPath: 'name' }, op: 'EQUAL', value: { stringValue: customerName } } }
                        ], 1)];
                case 14:
                    customers = _u.sent();
                    if (!(customers.length > 0)) return [3 /*break*/, 16];
                    c = customers[0];
                    currentDebt = Number(((_r = (_q = c.fields) === null || _q === void 0 ? void 0 : _q.debt) === null || _r === void 0 ? void 0 : _r.integerValue) || ((_t = (_s = c.fields) === null || _s === void 0 ? void 0 : _s.debt) === null || _t === void 0 ? void 0 : _t.doubleValue) || 0);
                    newDebt = currentDebt + Number(adjustmentAmount);
                    customerId = c.name.split('/').pop();
                    return [4 /*yield*/, restPatch(token, "customers/".concat(customerId), {
                            debt: { integerValue: String(newDebt) }
                        })];
                case 15:
                    _u.sent();
                    funcResult = "\u0110\u00E3 c\u1EADp nh\u1EADt c\u00F4ng n\u1EE3 cho ".concat(customerName, ". N\u1EE3 c\u0169: ").concat(currentDebt, "\u0111, N\u1EE3 m\u1EDBi: ").concat(newDebt, "\u0111");
                    return [3 /*break*/, 17];
                case 16:
                    funcResult = "Kh\u00F4ng t\u00ECm th\u1EA5y kh\u00E1ch h\u00E0ng n\u00E0o t\u00EAn ".concat(customerName, ". Y\u00EAu c\u1EA7u qu\u1EA3n tr\u1ECB vi\u00EAn ki\u1EC3m tra l\u1EA1i t\u00EAn.");
                    _u.label = 17;
                case 17: return [3 /*break*/, 19];
                case 18:
                    e_2 = _u.sent();
                    funcResult = "L\u1ED7i h\u1EC7 th\u1ED1ng khi th\u1EF1c hi\u1EC7n: ".concat(e_2.message);
                    return [3 /*break*/, 19];
                case 19:
                    _u.trys.push([19, 21, , 22]);
                    return [4 /*yield*/, chat.sendMessage([{
                                functionResponse: {
                                    name: call.name,
                                    response: { result: funcResult }
                                }
                            }])];
                case 20:
                    result = _u.sent();
                    return [3 /*break*/, 22];
                case 21:
                    e_3 = _u.sent();
                    console.error('Gemini function response error:', e_3);
                    return [3 /*break*/, 22];
                case 22:
                    text = result.response.text() || 'Xin lỗi, tôi không thể xử lý câu hỏi này lúc này.';
                    // Gửi tin nhắn lại Telegram
                    return [4 /*yield*/, fetch("https://api.telegram.org/bot".concat(botToken, "/sendMessage"), {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                chat_id: chatId,
                                text: text,
                                parse_mode: 'HTML'
                            })
                        })];
                case 23:
                    // Gửi tin nhắn lại Telegram
                    _u.sent();
                    // Luôn trả về 200 OK cho Telegram Webhook để nó không gửi lại
                    return [2 /*return*/, res.status(200).json({ success: true })];
                case 24:
                    error_1 = _u.sent();
                    console.error('Telegram webhook error:', error_1);
                    // Trả về 200 ngay cả khi lỗi để Telegram không retry làm kẹt hàng đợi
                    return [2 /*return*/, res.status(200).json({ error: error_1.message || 'Internal server error' })];
                case 25: return [2 /*return*/];
            }
        });
    });
}
