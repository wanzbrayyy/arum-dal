const posEngine = require('../services/posEngine');

function getActor(req) {
  return {
    userId: req.user?.id || null,
    name: req.user?.name || req.user?.role || 'system',
    shiftId: req.body?.shiftId || req.query?.shiftId || null,
  };
}

function handleError(res, error) {
  if (error.message === 'TABLE_NOT_FOUND' || error.message === 'ORDER_NOT_FOUND' || error.message === 'PRODUCT_NOT_FOUND' || error.message === 'SHIFT_NOT_FOUND' || error.message === 'CALL_NOT_FOUND' || error.message === 'USER_NOT_FOUND') {
    return res.status(404).json({ msg: error.message });
  }
  if (error.message === 'NOT_ENOUGH_ORDERS' || error.message === 'INSUFFICIENT_STOCK') {
    return res.status(400).json({ msg: error.message });
  }
  console.error(error);
  return res.status(500).json({ msg: 'Server error', detail: error.message });
}

exports.getClientBootstrap = async (req, res) => {
  try {
    res.json(await posEngine.getClientBootstrap(req.params.uniqueIdentifier));
  } catch (error) {
    handleError(res, error);
  }
};

exports.lookupCustomer = async (req, res) => {
  try {
    res.json(await posEngine.lookupCustomer(req.body.phone || req.query.phone || ''));
  } catch (error) {
    handleError(res, error);
  }
};

exports.estimatePricing = async (req, res) => {
  try {
    res.json(await posEngine.estimatePricing(req.body || {}));
  } catch (error) {
    handleError(res, error);
  }
};

exports.createClientOrder = async (req, res) => {
  try {
    const order = await posEngine.createOrder({
      ...req.body,
      source: 'client',
      channel: 'client',
    }, { name: 'client', userId: null, shiftId: null });
    res.status(201).json(order);
  } catch (error) {
    handleError(res, error);
  }
};

exports.getOrderStatus = async (req, res) => {
  try {
    const order = await posEngine.getOrderById(req.params.orderId);
    if (!order) return res.status(404).json({ msg: 'ORDER_NOT_FOUND' });
    res.json(order);
  } catch (error) {
    handleError(res, error);
  }
};

exports.createServiceCall = async (req, res) => {
  try {
    const call = await posEngine.createServiceCall(req.params.uniqueIdentifier, req.body || {});
    res.status(201).json(call);
  } catch (error) {
    handleError(res, error);
  }
};

exports.submitFeedback = async (req, res) => {
  try {
    res.status(201).json(await posEngine.submitFeedback(req.body || {}));
  } catch (error) {
    handleError(res, error);
  }
};

exports.getCashierDashboard = async (req, res) => {
  try {
    res.json(await posEngine.getCashierDashboard(req.user.id));
  } catch (error) {
    handleError(res, error);
  }
};

exports.startShift = async (req, res) => {
  try {
    res.status(201).json(await posEngine.startShift(req.user.id, req.body.initialCash, getActor(req).name));
  } catch (error) {
    handleError(res, error);
  }
};

exports.endShift = async (req, res) => {
  try {
    res.json(await posEngine.endShift(req.user.id, getActor(req).name));
  } catch (error) {
    handleError(res, error);
  }
};

exports.getCurrentShift = async (req, res) => {
  try {
    const shift = await posEngine.getCurrentShift(req.user.id);
    if (!shift) return res.status(404).json({ msg: 'SHIFT_NOT_FOUND' });
    res.json(shift);
  } catch (error) {
    handleError(res, error);
  }
};

exports.createCashLog = async (req, res) => {
  try {
    res.status(201).json(await posEngine.addCashLog(req.body, getActor(req)));
  } catch (error) {
    handleError(res, error);
  }
};

exports.createCashierOrder = async (req, res) => {
  try {
    const order = await posEngine.createOrder({
      ...req.body,
      source: 'cashier',
      channel: 'cashier',
    }, getActor(req));
    res.status(201).json(order);
  } catch (error) {
    handleError(res, error);
  }
};

exports.listCashierOrders = async (req, res) => {
  try {
    res.json(await posEngine.listOrders({
      status: req.query.status ? req.query.status.split(',') : undefined,
      today: req.query.today === 'true',
      tableId: req.query.tableId,
    }));
  } catch (error) {
    handleError(res, error);
  }
};

exports.moveCashierOrderTable = async (req, res) => {
  try {
    res.json(await posEngine.moveOrderTable(req.params.orderId, req.body.tableId, getActor(req).name));
  } catch (error) {
    handleError(res, error);
  }
};

exports.assignCashierOrderWaiter = async (req, res) => {
  try {
    res.json(await posEngine.assignOrderWaiter(req.params.orderId, req.body.waiterId, getActor(req).name));
  } catch (error) {
    handleError(res, error);
  }
};

exports.updateCashierOrderStatus = async (req, res) => {
  try {
    res.json(await posEngine.updateOrderStatus(req.params.orderId, req.body.status, getActor(req).name, req.body));
  } catch (error) {
    handleError(res, error);
  }
};

exports.payCashierOrder = async (req, res) => {
  try {
    const actor = {
      ...getActor(req),
      shiftId: req.body.shiftId,
    };
    res.json(await posEngine.processPayment(req.params.orderId, req.body, actor));
  } catch (error) {
    handleError(res, error);
  }
};

exports.refundCashierOrder = async (req, res) => {
  try {
    res.json(await posEngine.refundOrder(req.params.orderId, req.body, getActor(req)));
  } catch (error) {
    handleError(res, error);
  }
};

exports.splitCashierOrder = async (req, res) => {
  try {
    res.json(await posEngine.splitOrder(req.params.orderId, req.body.groups || [], getActor(req).name));
  } catch (error) {
    handleError(res, error);
  }
};

exports.mergeCashierOrders = async (req, res) => {
  try {
    res.json(await posEngine.mergeOrders(req.body.orderIds || [], getActor(req).name));
  } catch (error) {
    handleError(res, error);
  }
};

exports.closeServiceCall = async (req, res) => {
  try {
    res.json(await posEngine.closeServiceCall(req.params.callId, getActor(req).name));
  } catch (error) {
    handleError(res, error);
  }
};

exports.getCashierSummary = async (req, res) => {
  try {
    res.json(await posEngine.getCashierSummaryToday(req.user.id));
  } catch (error) {
    handleError(res, error);
  }
};

exports.listCashierServiceCalls = async (req, res) => {
  try {
    res.json(await posEngine.listServiceCalls({ status: req.query.status }));
  } catch (error) {
    handleError(res, error);
  }
};

exports.listCashierReservations = async (req, res) => {
  try {
    res.json(await posEngine.listReservations({ status: req.query.status }));
  } catch (error) {
    handleError(res, error);
  }
};

exports.listCashierCashLogs = async (req, res) => {
  try {
    res.json(await posEngine.listCashLogs({ shiftId: req.query.shiftId }));
  } catch (error) {
    handleError(res, error);
  }
};

exports.lookupCashierCustomer = async (req, res) => {
  try {
    res.json(await posEngine.lookupCustomer(req.body.phone || req.query.phone || ''));
  } catch (error) {
    handleError(res, error);
  }
};

exports.getAdminDashboard = async (req, res) => {
  try {
    res.json(await posEngine.getAdminDashboard());
  } catch (error) {
    handleError(res, error);
  }
};

exports.getAdminCatalog = async (req, res) => {
  try {
    res.json(await posEngine.getAdminCatalog());
  } catch (error) {
    handleError(res, error);
  }
};

exports.createAdminCategory = async (req, res) => {
  try {
    res.status(201).json(await posEngine.createAdminCategory(req.body, getActor(req).name));
  } catch (error) {
    handleError(res, error);
  }
};

exports.listAdminCustomers = async (req, res) => {
  try {
    res.json(await posEngine.listCustomers({ query: req.query.q || '' }));
  } catch (error) {
    handleError(res, error);
  }
};

exports.listAdminServiceCalls = async (req, res) => {
  try {
    res.json(await posEngine.listServiceCalls({ status: req.query.status }));
  } catch (error) {
    handleError(res, error);
  }
};

exports.listAdminReservations = async (req, res) => {
  try {
    res.json(await posEngine.listReservations({ status: req.query.status }));
  } catch (error) {
    handleError(res, error);
  }
};

exports.listAdminCashLogs = async (req, res) => {
  try {
    res.json(await posEngine.listCashLogs({ shiftId: req.query.shiftId }));
  } catch (error) {
    handleError(res, error);
  }
};

exports.listAdminAuditLogs = async (req, res) => {
  try {
    res.json(await posEngine.listAuditLogs(Number(req.query.limit || 50)));
  } catch (error) {
    handleError(res, error);
  }
};

exports.createAdminProduct = async (req, res) => {
  try {
    res.status(201).json(await posEngine.createAdminProduct(req.body, getActor(req).name));
  } catch (error) {
    handleError(res, error);
  }
};

exports.updateAdminProduct = async (req, res) => {
  try {
    res.json(await posEngine.updateAdminProduct(req.params.productId, req.body, getActor(req).name));
  } catch (error) {
    handleError(res, error);
  }
};

exports.createAdminTable = async (req, res) => {
  try {
    res.status(201).json(await posEngine.createAdminTable(req.body, getActor(req).name));
  } catch (error) {
    handleError(res, error);
  }
};

exports.updateAdminTable = async (req, res) => {
  try {
    res.json(await posEngine.updateAdminTable(req.params.tableId, req.body, getActor(req).name));
  } catch (error) {
    handleError(res, error);
  }
};

exports.createAdminUser = async (req, res) => {
  try {
    res.status(201).json(await posEngine.createAdminUser(req.body, getActor(req).name));
  } catch (error) {
    handleError(res, error);
  }
};

exports.updateAdminSettings = async (req, res) => {
  try {
    res.json(await posEngine.updateAdminSettings(req.body, getActor(req).name));
  } catch (error) {
    handleError(res, error);
  }
};

exports.createAdminPromo = async (req, res) => {
  try {
    res.status(201).json(await posEngine.createAdminPromo(req.body, getActor(req).name));
  } catch (error) {
    handleError(res, error);
  }
};

exports.getReportsOverview = async (req, res) => {
  try {
    res.json(await posEngine.getReportsOverview(req.query.period || 'daily'));
  } catch (error) {
    handleError(res, error);
  }
};
