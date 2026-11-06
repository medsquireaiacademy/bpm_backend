const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const integrationRoutes = require('./integration.routes');
const serviceRequestRoutes = require('./service-request.routes');
const agencyRoutes = require('./agency.routes');
const workOrderRoutes = require('./work-order.routes');
const technicianRoutes = require('./technician.routes');
const gatePassRoutes = require('./gate-pass.routes');
const securityRoutes = require('./security.routes');
const healthRoutes = require('./health.routes');

router.use('/auth', authRoutes);
router.use('/integrations', integrationRoutes);
router.use('/service-requests', serviceRequestRoutes);
router.use('/agency', agencyRoutes);
router.use('/work-orders', workOrderRoutes);
router.use('/technician', technicianRoutes);
router.use('/gate-passes', gatePassRoutes);
router.use('/security', securityRoutes);
router.use('/health', healthRoutes);

module.exports = router;

