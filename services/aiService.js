const tf = require('@tensorflow/tfjs-node');
const natural = require('natural');
const logger = require('../src/utils/logger');

class AIService {
  constructor() {
    this.tokenizer = new natural.WordTokenizer();
    this.sentiment = new natural.SentimentAnalyzer('English', natural.PorterStemmer, 'afinn');
    this.riskModel = null;
    this.initialized = false;
  }

  /**
   * Initialize AI models
   */
  async initialize() {
    try {
      // Load pre-trained risk prediction model
      this.riskModel = await tf.loadLayersModel('file://./models/risk_model/model.json');
      this.initialized = true;
      logger.info('AI models initialized successfully');
    } catch (error) {
      logger.error(`Error initializing AI models: ${error.message}`);
      throw error;
    }
  }

  /**
   * Predict rug pull risk based on project features
   * @param {Object} projectData 
   * @returns {Promise<Object>}
   */
  async predictRugPullRisk(projectData) {
    try {
      if (!this.initialized) await this.initialize();

      // Extract features from project data
      const features = this.extractProjectFeatures(projectData);

      // Convert features to tensor
      const inputTensor = tf.tensor2d([features]);

      // Make prediction
      const prediction = await this.riskModel.predict(inputTensor).array();
      const riskScore = Math.round(prediction[0][0] * 100);

      // Calculate confidence based on feature completeness
      const confidence = this.calculateConfidence(features);

      return {
        riskScore,
        confidence,
        factors: this.identifyRiskFactors(features, riskScore),
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error(`Error predicting rug pull risk: ${error.message}`);
      throw error;
    }
  }

  /**
   * Analyze social media sentiment
   * @param {Array<string>} texts 
   * @returns {Promise<Object>}
   */
  async analyzeSentiment(texts) {
    try {
      const results = texts.map(text => {
        // Tokenize text
        const tokens = this.tokenizer.tokenize(text.toLowerCase());

        // Calculate sentiment score
        const score = this.sentiment.getSentiment(tokens);

        return {
          text,
          score,
          sentiment: this.categorizeSentiment(score)
        };
      });

      // Calculate aggregate metrics
      const scores = results.map(r => r.score);
      const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      const sentimentVolatility = this.calculateVolatility(scores);

      return {
        results,
        aggregate: {
          averageScore,
          dominantSentiment: this.categorizeSentiment(averageScore),
          volatility: sentimentVolatility
        },
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error(`Error analyzing sentiment: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract relevant features from project data
   * @param {Object} projectData 
   * @returns {Array<number>}
   */
  extractProjectFeatures(projectData) {
    const features = [
      // Team features
      projectData.teamAnonymous ? 1 : 0,
      projectData.teamSocialPresence || 0,
      projectData.teamPastProjects || 0,

      // Token features
      projectData.tokenLiquidity || 0,
      projectData.tokenHolderCount || 0,
      projectData.tokenDistribution || 0,

      // Contract features
      projectData.contractAudited ? 1 : 0,
      projectData.contractAge || 0,
      projectData.contractRiskPatterns || 0,

      // Market features
      projectData.marketCap || 0,
      projectData.priceVolatility || 0,
      projectData.tradingVolume || 0
    ];

    return features;
  }

  /**
   * Calculate confidence score based on feature completeness
   * @param {Array<number>} features 
   * @returns {number}
   */
  calculateConfidence(features) {
    const validFeatures = features.filter(f => f !== undefined && f !== null).length;
    return Math.round((validFeatures / features.length) * 100);
  }

  /**
   * Identify risk factors based on features and risk score
   * @param {Array<number>} features 
   * @param {number} riskScore 
   * @returns {Array<string>}
   */
  identifyRiskFactors(features, riskScore) {
    const factors = [];

    // Team risk factors
    if (features[0] === 1) factors.push('Anonymous Team');
    if (features[1] < 0.3) factors.push('Low Social Presence');
    if (features[2] === 0) factors.push('No Past Projects');

    // Token risk factors
    if (features[3] < 0.5) factors.push('Low Liquidity');
    if (features[4] < 100) factors.push('Concentrated Token Holdings');
    if (features[5] < 0.4) factors.push('Uneven Token Distribution');

    // Contract risk factors
    if (features[6] === 0) factors.push('Unaudited Contract');
    if (features[7] < 30) factors.push('New Contract');
    if (features[8] > 0) factors.push('Suspicious Contract Patterns');

    // Market risk factors
    if (features[10] > 0.5) factors.push('High Price Volatility');
    if (features[11] < 1000) factors.push('Low Trading Volume');

    return factors;
  }

  /**
   * Categorize sentiment score
   * @param {number} score 
   * @returns {string}
   */
  categorizeSentiment(score) {
    if (score > 0.2) return 'Positive';
    if (score < -0.2) return 'Negative';
    return 'Neutral';
  }

  /**
   * Calculate volatility of sentiment scores
   * @param {Array<number>} scores 
   * @returns {number}
   */
  calculateVolatility(scores) {
    if (scores.length < 2) return 0;

    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const squaredDiffs = scores.map(score => Math.pow(score - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / (scores.length - 1);
    
    return Math.sqrt(variance);
  }

  /**
   * Analyze chat message for risk indicators
   * @param {string} message 
   * @returns {Promise<Object>}
   */
  async analyzeChatMessage(message) {
    try {
      // Tokenize message
      const tokens = this.tokenizer.tokenize(message.toLowerCase());

      // Risk keywords
      const riskKeywords = [
        'rug', 'scam', 'honeypot', 'dump', 'fake',
        'suspicious', 'warning', 'alert', 'risk', 'danger'
      ];

      // Find risk indicators
      const indicators = riskKeywords.filter(keyword =>
        tokens.includes(keyword)
      );

      // Calculate sentiment
      const sentimentScore = this.sentiment.getSentiment(tokens);

      // Calculate credibility score based on message characteristics
      const credibilityScore = this.calculateMessageCredibility(message, indicators);

      return {
        keywords: tokens,
        riskIndicators: indicators,
        sentiment: this.categorizeSentiment(sentimentScore),
        credibilityScore,
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error(`Error analyzing chat message: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calculate message credibility score
   * @param {string} message 
   * @param {Array<string>} indicators 
   * @returns {number}
   */
  calculateMessageCredibility(message, indicators) {
    let score = 50; // Base score

    // Length factor
    if (message.length > 100) score += 10;
    if (message.length > 200) score += 10;

    // Risk indicators factor
    score -= indicators.length * 5;

    // URL presence factor
    if (message.includes('http')) score += 15;

    // Contract address presence factor
    if (message.match(/0x[a-fA-F0-9]{40}/)) score += 20;

    return Math.min(Math.max(score, 0), 100);
  }
}

module.exports = new AIService();