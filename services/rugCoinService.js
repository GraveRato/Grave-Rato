const RugCoinTombstone = require('../models/RugCoinTombstone');
const blockchainService = require('./blockchainService');
const aiService = require('./aiService');
const logger = require('../src/utils/logger');

class RugCoinService {
  /**
   * Create a new rug coin tombstone
   * @param {Object} data Tombstone data
   * @param {string} userId Submitter's user ID
   * @returns {Promise<Object>}
   */
  async createTombstone(data, userId) {
    try {
      // Verify token contract
      const tokenInfo = await blockchainService.getTokenInfo(
        data.contractAddress,
        data.blockchainNetwork
      );

      // Analyze contract risks
      const contractRisks = await blockchainService.analyzeContractRisks(
        data.contractAddress,
        data.blockchainNetwork
      );

      // Create tombstone with additional information
      const tombstone = new RugCoinTombstone({
        ...data,
        submittedBy: userId,
        verificationStatus: 'Pending',
        tradingData: {
          ...data.tradingData,
          totalVolume: await this.calculateTotalVolume(data.contractAddress, data.blockchainNetwork)
        }
      });

      // Save tombstone
      const savedTombstone = await tombstone.save();
      logger.info(`New rug coin tombstone created: ${savedTombstone.id}`);

      return savedTombstone;
    } catch (error) {
      logger.error(`Error creating rug coin tombstone: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verify a rug coin tombstone
   * @param {string} tombstoneId 
   * @param {string} status 
   * @param {string} userId 
   * @returns {Promise<Object>}
   */
  async verifyTombstone(tombstoneId, status, userId) {
    try {
      const tombstone = await RugCoinTombstone.findById(tombstoneId);
      if (!tombstone) throw new Error('Tombstone not found');

      // Update verification status
      await tombstone.updateVerificationStatus(status, userId);
      logger.info(`Rug coin tombstone ${tombstoneId} verified with status: ${status}`);

      return tombstone;
    } catch (error) {
      logger.error(`Error verifying rug coin tombstone: ${error.message}`);
      throw error;
    }
  }

  /**
   * Search for rug coin tombstones
   * @param {Object} criteria Search criteria
   * @returns {Promise<Array>}
   */
  async searchTombstones(criteria) {
    try {
      const query = {};

      // Apply search criteria
      if (criteria.network) query.blockchainNetwork = criteria.network;
      if (criteria.status) query.verificationStatus = criteria.status;
      if (criteria.dateRange) {
        query.rugPullDate = {
          $gte: criteria.dateRange.start,
          $lte: criteria.dateRange.end
        };
      }

      // Text search
      if (criteria.searchText) {
        query.$or = [
          { projectName: { $regex: criteria.searchText, $options: 'i' } },
          { tokenSymbol: { $regex: criteria.searchText, $options: 'i' } }
        ];
      }

      const tombstones = await RugCoinTombstone.find(query)
        .populate('verifiedBy', 'username reputation')
        .populate('submittedBy', 'username reputation')
        .sort({ rugPullDate: -1 });

      return tombstones;
    } catch (error) {
      logger.error(`Error searching rug coin tombstones: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get similar rug pull cases
   * @param {string} tombstoneId 
   * @returns {Promise<Array>}
   */
  async getSimilarCases(tombstoneId) {
    try {
      const tombstone = await RugCoinTombstone.findById(tombstoneId);
      if (!tombstone) throw new Error('Tombstone not found');

      // Find similar cases based on fraud tactics and blockchain network
      const similarCases = await RugCoinTombstone.find({
        _id: { $ne: tombstoneId },
        blockchainNetwork: tombstone.blockchainNetwork,
        fraudTactics: { $in: tombstone.fraudTactics },
        verificationStatus: 'Verified'
      })
        .limit(5)
        .sort({ rugPullDate: -1 });

      return similarCases;
    } catch (error) {
      logger.error(`Error getting similar cases: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calculate total trading volume
   * @param {string} contractAddress 
   * @param {string} network 
   * @returns {Promise<number>}
   */
  async calculateTotalVolume(contractAddress, network) {
    try {
      // Get trading data from blockchain
      const transfers = await blockchainService.monitorLargeTransfers(
        contractAddress,
        network,
        0 // Set threshold to 0 to get all transfers
      );

      // Calculate total volume
      const totalVolume = transfers.reduce(
        (sum, transfer) => sum + BigInt(transfer.value),
        BigInt(0)
      );

      return totalVolume.toString();
    } catch (error) {
      logger.error(`Error calculating total volume: ${error.message}`);
      return '0';
    }
  }

  /**
   * Generate risk report for a project
   * @param {Object} projectData 
   * @returns {Promise<Object>}
   */
  async generateRiskReport(projectData) {
    try {
      // Get contract analysis
      const contractRisks = await blockchainService.analyzeContractRisks(
        projectData.contractAddress,
        projectData.blockchainNetwork
      );

      // Check liquidity pool
      const liquidityData = await blockchainService.checkLiquidityPool(
        projectData.pairAddress,
        projectData.blockchainNetwork
      );

      // Track team wallet activities
      const teamActivities = await blockchainService.trackTeamWallets(
        projectData.teamWallets,
        projectData.blockchainNetwork
      );

      // Predict rug pull risk using AI
      const riskAnalysis = await aiService.predictRugPullRisk({
        ...projectData,
        contractRisks,
        liquidityData,
        teamActivities
      });

      return {
        contractAnalysis: contractRisks,
        liquidityAnalysis: liquidityData,
        teamAnalysis: teamActivities,
        riskPrediction: riskAnalysis,
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error(`Error generating risk report: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get rug pull statistics
   * @param {string} network 
   * @param {Object} dateRange 
   * @returns {Promise<Object>}
   */
  async getRugPullStats(network, dateRange) {
    try {
      const query = {
        verificationStatus: 'Verified',
        rugPullDate: {
          $gte: dateRange.start,
          $lte: dateRange.end
        }
      };

      if (network) query.blockchainNetwork = network;

      const tombstones = await RugCoinTombstone.find(query);

      // Calculate statistics
      const stats = {
        totalCases: tombstones.length,
        totalLoss: tombstones.reduce((sum, t) => sum + t.totalLoss, 0),
        affectedUsers: tombstones.reduce((sum, t) => sum + t.affectedUsers, 0),
        fraudTactics: {},
        timeline: {}
      };

      // Count fraud tactics
      tombstones.forEach(t => {
        t.fraudTactics.forEach(tactic => {
          stats.fraudTactics[tactic] = (stats.fraudTactics[tactic] || 0) + 1;
        });

        // Group by month for timeline
        const month = t.rugPullDate.toISOString().slice(0, 7);
        stats.timeline[month] = (stats.timeline[month] || 0) + 1;
      });

      return stats;
    } catch (error) {
      logger.error(`Error getting rug pull statistics: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new RugCoinService();