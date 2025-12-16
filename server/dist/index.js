"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const path_1 = __importDefault(require("path"));
// Import Routes
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const asset_routes_1 = __importDefault(require("./routes/asset.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const collection_routes_1 = __importDefault(require("./routes/collection.routes"));
// ✅ 1. MAKE SURE THIS IMPORT IS HERE
const category_routes_1 = __importDefault(require("./routes/category.routes"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
app.use((0, cors_1.default)({
    origin: [
        'http://localhost:5173',
        process.env.CLIENT_URL || "" // Automatically allows your prod domain
    ],
    credentials: true
}));
app.use(express_1.default.json());
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
// Register Routes
app.use('/api/auth', auth_routes_1.default);
app.use('/api/assets', asset_routes_1.default);
app.use('/api/users', user_routes_1.default);
app.use('/api/collections', collection_routes_1.default);
// ✅ 2. CRITICAL: REGISTER THE CATEGORY ROUTE
// This tells the server: "When someone asks for /api/categories, go to categoryRoutes"
app.use('/api/categories', category_routes_1.default);
// Debug Route to verify server is alive
app.get('/', (req, res) => {
    res.send('Capydam API is running 🐹');
});
app.listen(PORT, () => {
    console.log(`⚡️ [server]: Server is running at http://localhost:${PORT}`);
    console.log(`   - Auth Routes: /api/auth`);
    console.log(`   - Asset Routes: /api/assets`);
    console.log(`   - Category Routes: /api/categories`); // <--- Check your terminal for this line
});
