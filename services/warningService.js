const WarningSign = require('../models/WarningSign');
const blockchainService = require('./blockchainService');
const aiService = require('./aiService');
const logger = require('../src/utils/logger');

class WarningService {
  constructor() {
    this.monitoringIntervals = new Map();
  }

  /**
   * Create new warning sign
   * @param {Object} data Warning data
   * @returns {Promise<Object>}
   */
  async createWarningSign(data) {
    try {
      // Analyze risk using AI
      const riskAnalysis = await aiService.predictRugPullRisk({
        ...data,
        contractRisks: await blockchainService.analyzeContractRisks(
          data.contractAddress,
          data.blockchainNetwork
        )
      });

      // Create warning sign
      const warning = new WarningSign({
        ...data,
        aiAnalysis: riskAnalysis,
        status: 'Active'
      });

      const savedWarning = await warning.save();
      logger.info(`New warning sign created: ${savedWarning.id}`);

      // Start monitoring if needed
      if (data.requiresMonitoring) {
        this.startMonitoring(savedWarning.id);
      }

      return savedWarning;
    } catch (error) {
      logger.error(`Error creating warning sign: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update warning sign
   * @param {string} warningId 
   * @param {Object} data 
   * @returns {Promise<Object>}
   */
  async updateWarningSign(warningId, data) {
    try {
      const warning = await WarningSign.findById(warningId);
      if (!warning) throw new Error('Warning sign not found');

      // Update warning data
      Object.assign(warning, data);

      // Update risk analysis if evidence changed
      if (data.evidence) {
        const riskAnalysis = await aiService.predictRugPullRisk({
          ...warning.toObject(),
          ...data
        });
        warning.aiAnalysis = riskAnalysis;
      }

      const updatedWarning = await warning.save();
      logger.info(`Warning sign ${warningId} updated`);

      return updatedWarning;
    } catch (error) {
      logger.error(`Error updating warning sign: ${error.message}`);
      throw error;
    }
  }

  /**
   * Start monitoring a project
   * @param {string} warningId 
   */
  startMonitoring(warningId) {
    if (this.monitoringIntervals.has(warningId)) return;

    const interval = setInterval(async () => {
      try {
        await this.checkWarningStatus(warningId);
      } catch (error) {
        logger.error(`Error in monitoring interval: ${error.message}`);
      }
    }, 5 * 60 * 1000); // Check every 5 minutes

    this.monitoringIntervals.set(warningId, interval);
    logger.info(`Started monitoring for warning ${warningId}`);
  }

  /**
   * Stop monitoring a project
   * @param {string} warningId 
   */
  stopMonitoring(warningId) {
    const interval = this.monitoringIntervals.get(warningId);
    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(warningId);
      logger.info(`Stopped monitoring for warning ${warningId}`);
    }
  }

  /**
   * Check warning status and update if needed
   * @param {string} warningId 
   * @returns {Promise<Object>}
   */
  async checkWarningStatus(warningId) {
    try {
      const warning = await WarningSign.findById(warningId);
      if (!warning || warning.status !== 'Active') {
        this.stopMonitoring(warningId);
        return;
      }

      // Check on-chain activity
      const contractRisks = await blockchainService.analyzeContractRisks(
        warning.contractAddress,
        warning.blockchainNetwork
      );

      // Check liquidity if pair address available
      let liquidityData = null;
      if (warning.evidence.onChainData?.pairAddress) {
        liquidityData = await blockchainService.checkLiquidityPool(
          warning.evidence.onChainData.pairAddress,
          warning.blockchainNetwork
        );
      }

      // Update evidence
      const newEvidence = {
        onChainData: {
          ...warning.evidence.onChainData,
          ...contractRisks
        },
        marketData: liquidityData ? {
          ...warning.evidence.marketData,
          liquidityChange: this.calculateLiquidityChange(
            warning.evidence.marketData,
            liquidityData
          )
        } : warning.evidence.marketData
      };

      // Update warning
      await this.updateWarningSign(warningId, { evidence: newEvidence });

    } catch (error) {
      logger.error(`Error checking warning status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calculate liquidity change percentage
   * @param {Object} oldData 
   * @param {Object} newData 
   * @returns {number}
   */
  calculateLiquidityChange(oldData, newData) {
    if (!oldData || !newData) return 0;

    const oldLiquidity = parseFloat(oldData.reserve0) + parseFloat(oldData.reserve1);
    const newLiquidity = parseFloat(newData.reserve0) + parseFloat(newData.reserve1);

    return ((newLiquidity - oldLiquidity) / oldLiquidity) * 100;
  }

  /**
   * Get active warnings for a network
   * @param {string} network 
   * @returns {Promise<Array>}
   */
  async getActiveWarnings(network) {
    try {
      const query = { status: 'Active' };
      if (network) query.blockchainNetwork = network;

      return await WarningSign.find(query)
        .sort({ 'aiAnalysis.riskScore': -1 });
    } catch (error) {
      logger.error(`Error getting active warnings: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get warning statistics
   * @param {Object} dateRange 
   * @returns {Promise<Object>}
   */
  async getWarningStats(dateRange) {
    try {
      const query = {
        createdAt: {
          $gte: dateRange.start,
          $lte: dateRange.end
        }
      };

      const warnings = await WarningSign.find(query);

      // Calculate statistics
      const stats = {
        totalWarnings: warnings.length,
        activeWarnings: 0,
        resolvedWarnings: 0,
        falseAlarms: 0,
        riskTypeDistribution: {},
        riskLevelDistribution: {},
        averageRiskScore: 0
      };

      let totalRiskScore = 0;

      warnings.forEach(warning => {
        // Count by status
        switch (warning.status) {
          case 'Active':
            stats.activeWarnings++;
            break;
          case 'Resolved':
            stats.resolvedWarnings++;
            break;
          case 'False Alarm':
            stats.falseAlarms++;
            break;
        }

        // Count risk types
        warning.riskType.forEach(type => {
          stats.riskTypeDistribution[type] = (stats.riskTypeDistribution[type] || 0) + 1;
        });

        // Count risk levels
        stats.riskLevelDistribution[warning.riskLevel] =
          (stats.riskLevelDistribution[warning.riskLevel] || 0) + 1;

        // Sum risk scores
        totalRiskScore += warning.aiAnalysis.riskScore;
      });

      // Calculate average risk score
      stats.averageRiskScore = warnings.length ?
        Math.round(totalRiskScore / warnings.length) : 0;

      return stats;
    } catch (error) {
      logger.error(`Error getting warning statistics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send notifications for warning
   * @param {string} warningId 
   * @param {Array} recipients 
   * @returns {Promise<Object>}
   */
  async sendNotifications(warningId, recipients) {
    try {
      const warning = await WarningSign.findById(warningId);
      if (!warning) throw new Error('Warning sign not found');

      // TODO: Implement actual notification sending logic
      const notification = {
        type: 'Push',
        timestamp: new Date(),
        recipients: recipients.length
      };

      warning.notificationsSent.push(notification);
      await warning.save();

      logger.info(`Notifications sent for warning ${warningId}`);
      return warning;
    } catch (error) {
      logger.error(`Error sending notifications: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new WarningService();