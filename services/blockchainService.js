const Web3 = require('web3');
const logger = require('../src/utils/logger');

class BlockchainService {
  constructor() {
    this.providers = {
      ethereum: new Web3(process.env.ETH_NODE_URL || 'https://mainnet.infura.io/v3/your-project-id'),
      bsc: new Web3(process.env.BSC_NODE_URL || 'https://bsc-dataseed.binance.org'),
      polygon: new Web3(process.env.POLYGON_NODE_URL || 'https://polygon-rpc.com'),
      solana: null // TODO: Add Solana web3 provider
    };
  }

  /**
   * Get token information from blockchain
   * @param {string} contractAddress 
   * @param {string} network 
   * @returns {Promise<Object>}
   */
  async getTokenInfo(contractAddress, network) {
    try {
      const web3 = this.providers[network.toLowerCase()];
      if (!web3) throw new Error(`Unsupported network: ${network}`);

      // Standard ERC20 ABI for token info
      const minABI = [
        { "inputs": [], "name": "name", "outputs": [{ "type": "string" }], "type": "function" },
        { "inputs": [], "name": "symbol", "outputs": [{ "type": "string" }], "type": "function" },
        { "inputs": [], "name": "decimals", "outputs": [{ "type": "uint8" }], "type": "function" },
        { "inputs": [], "name": "totalSupply", "outputs": [{ "type": "uint256" }], "type": "function" }
      ];

      const contract = new web3.eth.Contract(minABI, contractAddress);

      const [name, symbol, decimals, totalSupply] = await Promise.all([
        contract.methods.name().call(),
        contract.methods.symbol().call(),
        contract.methods.decimals().call(),
        contract.methods.totalSupply().call()
      ]);

      return { name, symbol, decimals, totalSupply };
    } catch (error) {
      logger.error(`Error fetching token info: ${error.message}`);
      throw error;
    }
  }

  /**
   * Monitor large token transfers
   * @param {string} contractAddress 
   * @param {string} network 
   * @param {number} threshold Amount threshold in token decimals
   * @returns {Promise<Array>}
   */
  async monitorLargeTransfers(contractAddress, network, threshold) {
    try {
      const web3 = this.providers[network.toLowerCase()];
      if (!web3) throw new Error(`Unsupported network: ${network}`);

      // Transfer event signature
      const transferEvent = web3.utils.sha3('Transfer(address,address,uint256)');

      // Get latest block number
      const latestBlock = await web3.eth.getBlockNumber();
      const fromBlock = latestBlock - 1000; // Monitor last 1000 blocks

      // Get transfer events
      const events = await web3.eth.getPastLogs({
        fromBlock,
        toBlock: 'latest',
        address: contractAddress,
        topics: [transferEvent]
      });

      // Filter and decode large transfers
      const largeTransfers = events
        .map(event => {
          const decoded = web3.eth.abi.decodeLog(
            [{
              type: 'address',
              name: 'from',
              indexed: true
            },
            {
              type: 'address',
              name: 'to',
              indexed: true
            },
            {
              type: 'uint256',
              name: 'value'
            }],
            event.data,
            event.topics.slice(1)
          );

          return {
            transactionHash: event.transactionHash,
            from: decoded.from,
            to: decoded.to,
            value: decoded.value,
            blockNumber: event.blockNumber
          };
        })
        .filter(transfer => BigInt(transfer.value) >= BigInt(threshold));

      return largeTransfers;
    } catch (error) {
      logger.error(`Error monitoring transfers: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check liquidity pool status
   * @param {string} pairAddress 
   * @param {string} network 
   * @returns {Promise<Object>}
   */
  async checkLiquidityPool(pairAddress, network) {
    try {
      const web3 = this.providers[network.toLowerCase()];
      if (!web3) throw new Error(`Unsupported network: ${network}`);

      // Uniswap V2 Pair ABI (minimal)
      const pairABI = [
        { "inputs": [], "name": "getReserves", "outputs": [{ "type": "uint112" }, { "type": "uint112" }], "type": "function" },
        { "inputs": [], "name": "token0", "outputs": [{ "type": "address" }], "type": "function" },
        { "inputs": [], "name": "token1", "outputs": [{ "type": "address" }], "type": "function" }
      ];

      const pair = new web3.eth.Contract(pairABI, pairAddress);

      const [reserves, token0, token1] = await Promise.all([
        pair.methods.getReserves().call(),
        pair.methods.token0().call(),
        pair.methods.token1().call()
      ]);

      return {
        token0,
        token1,
        reserve0: reserves[0],
        reserve1: reserves[1],
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error(`Error checking liquidity pool: ${error.message}`);
      throw error;
    }
  }

  /**
   * Analyze contract code for potential risks
   * @param {string} contractAddress 
   * @param {string} network 
   * @returns {Promise<Object>}
   */
  async analyzeContractRisks(contractAddress, network) {
    try {
      const web3 = this.providers[network.toLowerCase()];
      if (!web3) throw new Error(`Unsupported network: ${network}`);

      // Get contract code
      const code = await web3.eth.getCode(contractAddress);

      // Basic risk patterns
      const riskPatterns = {
        selfdestruct: '0xff',
        delegatecall: '0xf4',
        assembly: 'assembly',
        // Add more patterns as needed
      };

      const risks = [];

      // Check for risk patterns
      Object.entries(riskPatterns).forEach(([name, pattern]) => {
        if (code.includes(pattern)) {
          risks.push(name);
        }
      });

      // Get contract creation transaction
      const txCount = await web3.eth.getTransactionCount(contractAddress);
      const isContract = code !== '0x' && txCount > 0;

      return {
        isContract,
        hasCode: code !== '0x',
        codeSize: (code.length - 2) / 2, // Remove '0x' and convert to bytes
        risks,
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error(`Error analyzing contract risks: ${error.message}`);
      throw error;
    }
  }

  /**
   * Track team wallet activities
   * @param {Array<string>} walletAddresses 
   * @param {string} network 
   * @returns {Promise<Array>}
   */
  async trackTeamWallets(walletAddresses, network) {
    try {
      const web3 = this.providers[network.toLowerCase()];
      if (!web3) throw new Error(`Unsupported network: ${network}`);

      const activities = await Promise.all(
        walletAddresses.map(async (address) => {
          const balance = await web3.eth.getBalance(address);
          const txCount = await web3.eth.getTransactionCount(address);

          // Get recent transactions
          const latestBlock = await web3.eth.getBlockNumber();
          const transactions = await web3.eth.getPastLogs({
            fromBlock: latestBlock - 1000,
            toBlock: 'latest',
            topics: [null],
            address
          });

          return {
            address,
            balance,
            txCount,
            recentTransactions: transactions.length,
            timestamp: Date.now()
          };
        })
      );

      return activities;
    } catch (error) {
      logger.error(`Error tracking team wallets: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new BlockchainService();