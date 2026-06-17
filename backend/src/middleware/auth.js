const jwt = require('jsonwebtoken');

function getRequiredPermission(url) {
    const cleanUrl = url.toLowerCase();
    if (cleanUrl.includes('/api/reports/staff-activity') || cleanUrl.includes('/api/reports/debug-logs')) return 'DEVICES';
    if (cleanUrl.includes('/api/reports') || cleanUrl.includes('/api/backup') || cleanUrl.includes('/api/purchase-returns')) return 'REPORTS';
    if (cleanUrl.includes('/api/inventory')) return 'INVENTORY';
    if (cleanUrl.includes('/api/purchases')) return 'PROCUREMENT';
    if (cleanUrl.includes('/api/suppliers')) return 'SUPPLIERS';
    if (cleanUrl.includes('/api/customers')) return 'CUSTOMERS';
    if (cleanUrl.includes('/api/expenses')) return 'EXPENSES';
    if (cleanUrl.includes('/api/settings') || cleanUrl.includes('/api/restaurant-settings')) return 'SETTINGS';
    if (cleanUrl.includes('/api/devices') || cleanUrl.includes('/api/licenses')) return 'DEVICES';
    if (cleanUrl.includes('/api/ap')) return 'AP';
    if (cleanUrl.includes('/api/tables')) return 'TABLES';
    if (cleanUrl.includes('/api/kots')) return 'KITCHEN';
    if (cleanUrl.includes('/api/shifts')) return 'SHIFT';
    if (cleanUrl.includes('/api/products') || cleanUrl.includes('/api/categories')) return 'POS';
    return null;
}

/**
 * Auth Middleware
 * Separates JWT verification from database-dependent license checks
 * to prevent transient DB errors from triggering 401 (and thus logging out users).
 */
const auth = (allowedRoles = []) => {
    return async (req, res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const token = authHeader.split(' ')[1];
        let decoded;

        // Phase 1: JWT Verification (Purely local/CPU bound)
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET || 'freshnaad_pos_enterprise_secret_2026');
            req.user = decoded;
        } catch (error) {
            console.error('JWT Verification Failed:', error.message);
            return res.status(401).json({ message: 'Session expired or invalid. Please login again.' });
        }

        // Phase 2: Database Dependent Checks (License/Permissions)
        try {
            const prisma = require('../config/prisma');

            // SaaS: Verify license status if not Super Admin
            if (decoded.role !== 'ADMIN' && decoded.licenseId) {
                const license = await prisma.license.findUnique({ where: { id: decoded.licenseId } });
                
                if (!license || license.status !== 'ACTIVE') {
                    return res.status(403).json({ message: 'License is inactive or invalid' });
                }
                
                if (new Date(license.expiryDate) < new Date()) {
                    return res.status(403).json({ message: 'License has expired' });
                }
            }

            if (allowedRoles.length > 0 && !allowedRoles.includes(decoded.role)) {
                // Check if user has granular permissions in the database to override role restrictions
                const userRecord = await prisma.user.findUnique({ where: { id: decoded.id } });
                
                let permissionGranted = false;
                if (userRecord && userRecord.permissions && typeof userRecord.permissions === 'object') {
                    const requiredPermission = getRequiredPermission(req.originalUrl);
                    if (requiredPermission && userRecord.permissions[requiredPermission] === true) {
                        permissionGranted = true;
                    }
                }
                
                if (!permissionGranted) {
                    return res.status(403).json({ message: 'Access denied: insufficient permissions' });
                }
            }

            next();
        } catch (dbError) {
            console.error('Database error in auth middleware:', dbError.message);
            // Return 500 instead of 401 to prevent frontend logout
            return res.status(500).json({ 
                message: 'Internal server error during authentication', 
                details: 'Database connectivity issue' 
            });
        }
    };
};

module.exports = auth;
