const settingsService = require('./settings.service');

/**
 * GET /settings
 */
async function getSettings(req, res, next) {
  try {
    const store = settingsService.getStoreSettings();
    const dbStats = await settingsService.getDatabaseStats();
    return res.json({ success: true, data: { store, dbStats } });
  } catch (err) {
    next(err);
  }
}

module.exports = { getSettings };
