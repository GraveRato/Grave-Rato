const InsiderInformation = require('../models/InsiderInformation');
const aiService = require('./aiService');
const encryption = require('../src/utils/encryption');
const logger = require('../src/utils/logger');

class InsiderService {
  /**
   * Submit new insider information
   * @param {Object} data Submission data
   * @param {string} submitterInfo Encrypted submitter information
   * @returns {Promise<Object>}
   */
  async submitInformation(data, submitterInfo) {
    try {
      // Generate unique submission hash
      const submissionHash = encryption.generateHash(data);

      // Encrypt submitter information
      const encryptedSubmitterInfo = await encryption.encrypt(submitterInfo);

      // Analyze content credibility
      const analysis = await aiService.analyzeChatMessage(data.content);

      // Create new submission
      const submission = new InsiderInformation({
        ...data,
        submissionHash,
        encryptedSubmitterInfo,
        credibilityScore: analysis.credibilityScore
      });

      const savedSubmission = await submission.save();
      logger.info(`New insider information submitted: ${savedSubmission.id}`);

      return savedSubmission;
    } catch (error) {
      logger.error(`Error submitting insider information: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verify insider information
   * @param {string} submissionId 
   * @param {string} status 
   * @param {string} moderatorId 
   * @param {string} note 
   * @returns {Promise<Object>}
   */
  async verifyInformation(submissionId, status, moderatorId, note) {
    try {
      const submission = await InsiderInformation.findById(submissionId);
      if (!submission) throw new Error('Submission not found');

      // Update verification status
      await submission.updateVerificationStatus(status, moderatorId, note);

      // Recalculate credibility score based on verification
      const newScore = this.calculateVerifiedCredibility(submission, status);
      await submission.updateCredibilityScore(newScore);

      logger.info(`Insider information ${submissionId} verified with status: ${status}`);
      return submission;
    } catch (error) {
      logger.error(`Error verifying insider information: ${error.message}`);
      throw error;
    }
  }

  /**
   * Search insider information
   * @param {Object} criteria Search criteria
   * @returns {Promise<Array>}
   */
  async searchInformation(criteria) {
    try {
      const query = {};

      // Apply search criteria
      if (criteria.riskLevel) query.riskLevel = criteria.riskLevel;
      if (criteria.category) query.category = { $in: criteria.category };
      if (criteria.verificationStatus) query.verificationStatus = criteria.verificationStatus;

      // Date range filter
      if (criteria.dateRange) {
        query.createdAt = {
          $gte: criteria.dateRange.start,
          $lte: criteria.dateRange.end
        };
      }

      // Text search
      if (criteria.searchText) {
        query.$or = [
          { title: { $regex: criteria.searchText, $options: 'i' } },
          { content: { $regex: criteria.searchText, $options: 'i' } },
          { projectName: { $regex: criteria.searchText, $options: 'i' } }
        ];
      }

      const submissions = await InsiderInformation.find(query)
        .sort({ credibilityScore: -1, createdAt: -1 });

      return submissions;
    } catch (error) {
      logger.error(`Error searching insider information: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get related submissions
   * @param {string} submissionId 
   * @returns {Promise<Array>}
   */
  async getRelatedSubmissions(submissionId) {
    try {
      const submission = await InsiderInformation.findById(submissionId);
      if (!submission) throw new Error('Submission not found');

      // Find related submissions based on project and category
      const related = await InsiderInformation.find({
        _id: { $ne: submissionId },
        $or: [
          { projectName: submission.projectName },
          { category: { $in: submission.category } }
        ],
        verificationStatus: 'Verified'
      })
        .limit(5)
        .sort({ credibilityScore: -1 });

      return related;
    } catch (error) {
      logger.error(`Error getting related submissions: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calculate credibility score for verified submission
   * @param {Object} submission 
   * @param {string} verificationStatus 
   * @returns {number}
   */
  calculateVerifiedCredibility(submission, verificationStatus) {
    let score = submission.credibilityScore;

    switch (verificationStatus) {
      case 'Verified':
        score = Math.min(score + 30, 100);
        break;
      case 'Rejected':
        score = Math.max(score - 50, 0);
        break;
      default:
        break;
    }

    return score;
  }

  /**
   * Get submission statistics
   * @param {Object} dateRange 
   * @returns {Promise<Object>}
   */
  async getSubmissionStats(dateRange) {
    try {
      const query = {
        createdAt: {
          $gte: dateRange.start,
          $lte: dateRange.end
        }
      };

      const submissions = await InsiderInformation.find(query);

      // Calculate statistics
      const stats = {
        totalSubmissions: submissions.length,
        verifiedCount: 0,
        rejectedCount: 0,
        pendingCount: 0,
        averageCredibility: 0,
        categoryDistribution: {},
        riskLevelDistribution: {}
      };

      let totalCredibility = 0;

      submissions.forEach(sub => {
        // Count by verification status
        switch (sub.verificationStatus) {
          case 'Verified':
            stats.verifiedCount++;
            break;
          case 'Rejected':
            stats.rejectedCount++;
            break;
          case 'Pending':
            stats.pendingCount++;
            break;
        }

        // Sum credibility scores
        totalCredibility += sub.credibilityScore;

        // Count categories
        sub.category.forEach(cat => {
          stats.categoryDistribution[cat] = (stats.categoryDistribution[cat] || 0) + 1;
        });

        // Count risk levels
        stats.riskLevelDistribution[sub.riskLevel] =
          (stats.riskLevelDistribution[sub.riskLevel] || 0) + 1;
      });

      // Calculate average credibility
      stats.averageCredibility = submissions.length ?
        Math.round(totalCredibility / submissions.length) : 0;

      return stats;
    } catch (error) {
      logger.error(`Error getting submission statistics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Report submission
   * @param {string} submissionId 
   * @param {string} userId 
   * @param {string} reason 
   * @returns {Promise<Object>}
   */
  async reportSubmission(submissionId, userId, reason) {
    try {
      const submission = await InsiderInformation.findById(submissionId);
      if (!submission) throw new Error('Submission not found');

      // Add report
      submission.reports.push({
        userId,
        reason,
        timestamp: new Date()
      });

      // Auto-moderate if report count exceeds threshold
      if (submission.reports.length >= 5) {
        submission.verificationStatus = 'Pending';
      }

      await submission.save();
      logger.info(`Submission ${submissionId} reported by user ${userId}`);

      return submission;
    } catch (error) {
      logger.error(`Error reporting submission: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new InsiderService();