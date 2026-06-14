"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.getJwtOptions = getJwtOptions;
const shared_1 = require("@syncline/shared");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
let jwtOptions;
function getJwtOptions() {
    if (jwtOptions)
        return jwtOptions;
    const algorithm = (process.env.JWT_ALGORITHM || 'HS256');
    let privateKeyOrSecret = process.env.JWT_SECRET || 'super_secret_fallback_key';
    let publicKeyOrSecret = process.env.JWT_SECRET || 'super_secret_fallback_key';
    if (algorithm === 'RS256') {
        try {
            const privateKeyPath = process.env.JWT_PRIVATE_KEY_PATH || path.join(__dirname, '../../keys/private.pem');
            const publicKeyPath = process.env.JWT_PUBLIC_KEY_PATH || path.join(__dirname, '../../keys/public.pem');
            privateKeyOrSecret = fs.readFileSync(privateKeyPath, 'utf8');
            publicKeyOrSecret = fs.readFileSync(publicKeyPath, 'utf8');
        }
        catch (err) {
            console.warn('Could not read RS256 key files. Falling back to secret or throwing.', err);
        }
    }
    jwtOptions = {
        privateKeyOrSecret,
        publicKeyOrSecret,
        algorithm,
    };
    return jwtOptions;
}
async function authenticate(request, reply) {
    try {
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return reply.code(401).send({ error: 'Unauthorized', message: 'Missing token' });
        }
        const token = authHeader.split(' ')[1];
        if (!token) {
            return reply.code(401).send({ error: 'Unauthorized', message: 'Malformed token' });
        }
        const payload = (0, shared_1.verifyAccessToken)(token, getJwtOptions());
        request.user = payload;
    }
    catch (err) {
        return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or expired token' });
    }
}
//# sourceMappingURL=auth.js.map