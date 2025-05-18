const { gql } = require('graphql-tag');

const typeDefs = gql`
  # User types
  type User {
    id: ID!
    username: String!
    email: String!
    role: String!
    reputation: Int!
    contributionPoints: Int!
    isPremium: Boolean!
    lastLogin: String
    createdAt: String!
    updatedAt: String!
  }

  input UserInput {
    username: String!
    email: String!
    password: String!
  }

  # RugCoinTombstone types
  type TeamMember {
    name: String
    role: String
    socialLinks: [String]
  }

  type TradingData {
    initialPrice: Float
    peakPrice: Float
    rugPullPrice: Float
    totalVolume: Float
  }

  type RugCoinTombstone {
    id: ID!
    projectName: String!
    tokenSymbol: String!
    blockchainNetwork: String!
    contractAddress: String!
    launchDate: String!
    rugPullDate: String!
    totalLoss: Float!
    affectedUsers: Int!
    fraudTactics: [String!]!
    evidence: [String!]!
    teamInformation: TeamInformation!
    tradingData: TradingData
    verificationStatus: String!
    verifiedBy: [User!]
    submittedBy: User!
    createdAt: String!
    updatedAt: String!
  }

  type TeamInformation {
    knownMembers: [TeamMember]
    anonymous: Boolean!
  }

  input RugCoinTombstoneInput {
    projectName: String!
    tokenSymbol: String!
    blockchainNetwork: String!
    contractAddress: String!
    launchDate: String!
    rugPullDate: String!
    totalLoss: Float!
    affectedUsers: Int!
    fraudTactics: [String!]!
    evidence: [String!]!
    teamInformation: TeamInformationInput!
    tradingData: TradingDataInput
  }

  input TeamInformationInput {
    knownMembers: [TeamMemberInput]
    anonymous: Boolean!
  }

  input TeamMemberInput {
    name: String
    role: String
    socialLinks: [String]
  }

  input TradingDataInput {
    initialPrice: Float
    peakPrice: Float
    rugPullPrice: Float
    totalVolume: Float
  }

  # InsiderInformation types
  type ModeratorNote {
    note: String!
    moderatorId: ID!
    timestamp: String!
  }

  type Report {
    userId: ID!
    reason: String!
    timestamp: String!
  }

  type InsiderInformation {
    id: ID!
    title: String!
    content: String!
    projectName: String!
    blockchainNetwork: String!
    contractAddress: String
    riskLevel: String!
    category: [String!]!
    evidence: [String]
    verificationStatus: String!
    credibilityScore: Int!
    submissionHash: String!
    views: Int!
    likes: Int!
    reports: [Report!]
    moderatorNotes: [ModeratorNote!]
    createdAt: String!
    updatedAt: String!
  }

  input InsiderInformationInput {
    title: String!
    content: String!
    projectName: String!
    blockchainNetwork: String!
    contractAddress: String
    riskLevel: String!
    category: [String!]!
    evidence: [String]
  }

  # WarningSign types
  type OnChainData {
    transactionHash: String
    blockNumber: Int
    timestamp: String
    details: JSON
  }

  type MarketData {
    priceChange: Float
    volumeChange: Float
    liquidityChange: Float
    timestamp: String
  }

  type SocialData {
    sentiment: Float
    volume: Int
    platform: String
    timestamp: String
  }

  type Evidence {
    onChainData: OnChainData
    marketData: MarketData
    socialData: SocialData
  }

  type AIAnalysis {
    riskScore: Int!
    confidence: Int!
    factors: [String!]!
    timestamp: String!
  }

  type Notification {
    type: String!
    timestamp: String!
    recipients: Int!
  }

  type ResolutionDetails {
    resolvedAt: String
    resolvedBy: ID
    resolution: String
  }

  type WarningSign {
    id: ID!
    projectName: String!
    tokenSymbol: String!
    blockchainNetwork: String!
    contractAddress: String!
    riskType: [String!]!
    riskLevel: String!
    description: String!
    evidence: Evidence!
    aiAnalysis: AIAnalysis!
    status: String!
    notificationsSent: [Notification!]!
    verifiedBy: [User!]
    resolutionDetails: ResolutionDetails
    createdAt: String!
    updatedAt: String!
  }

  input WarningSignInput {
    projectName: String!
    tokenSymbol: String!
    blockchainNetwork: String!
    contractAddress: String!
    riskType: [String!]!
    riskLevel: String!
    description: String!
    evidence: EvidenceInput!
  }

  input EvidenceInput {
    onChainData: OnChainDataInput
    marketData: MarketDataInput
    socialData: SocialDataInput
  }

  input OnChainDataInput {
    transactionHash: String
    blockNumber: Int
    timestamp: String
    details: JSON
  }

  input MarketDataInput {
    priceChange: Float
    volumeChange: Float
    liquidityChange: Float
    timestamp: String
  }

  input SocialDataInput {
    sentiment: Float
    volume: Int
    platform: String
    timestamp: String
  }

  # ChatMessage types
  type MessageMetadata {
    projectName: String
    contractAddress: String
    blockchainNetwork: String
    evidenceType: String
    evidenceUrl: String
  }

  type MessageSender {
    userId: ID!
    anonymous: Boolean!
    reputation: Int
  }

  type MessageReactions {
    likes: [ID!]!
    dislikes: [ID!]!
    flags: [MessageFlag!]!
  }

  type MessageFlag {
    userId: ID!
    reason: String!
    timestamp: String!
  }

  type MessageAIAnalysis {
    keywords: [String!]!
    riskIndicators: [String!]!
    credibilityScore: Int
  }

  type MessageModeration {
    status: String!
    moderatedBy: ID
    moderationTime: String
    reason: String
  }

  type ChatMessage {
    id: ID!
    roomId: String!
    content: String!
    messageType: String!
    metadata: MessageMetadata
    sender: MessageSender!
    reactions: MessageReactions!
    aiAnalysis: MessageAIAnalysis
    visibility: String!
    moderationStatus: MessageModeration!
    createdAt: String!
    updatedAt: String!
  }

  input ChatMessageInput {
    roomId: String!
    content: String!
    messageType: String!
    metadata: MessageMetadataInput
    anonymous: Boolean
  }

  input MessageMetadataInput {
    projectName: String
    contractAddress: String
    blockchainNetwork: String
    evidenceType: String
    evidenceUrl: String
  }

  # Custom scalar for handling JSON data
  scalar JSON

  # Queries
  type Query {
    # User queries
    me: User
    user(id: ID!): User
    users(limit: Int, offset: Int): [User!]!

    # RugCoinTombstone queries
    rugCoinTombstone(id: ID!): RugCoinTombstone
    rugCoinTombstones(
      limit: Int
      offset: Int
      network: String
      verificationStatus: String
    ): [RugCoinTombstone!]!
    searchRugCoinTombstones(query: String!): [RugCoinTombstone!]!

    # InsiderInformation queries
    insiderInformation(id: ID!): InsiderInformation
    insiderInformations(
      limit: Int
      offset: Int
      riskLevel: String
      category: String
    ): [InsiderInformation!]!
    searchInsiderInformations(query: String!): [InsiderInformation!]!

    # WarningSign queries
    warningSign(id: ID!): WarningSign
    warningSigns(
      limit: Int
      offset: Int
      riskLevel: String
      status: String
    ): [WarningSign!]!
    activeWarningSigns: [WarningSign!]!

    # ChatMessage queries
    chatMessage(id: ID!): ChatMessage
    chatMessages(
      roomId: String!
      limit: Int
      offset: Int
    ): [ChatMessage!]!
  }

  # Mutations
  type Mutation {
    # User mutations
    register(input: UserInput!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    updateUser(id: ID!, input: UserInput!): User!
    deleteUser(id: ID!): Boolean!

    # RugCoinTombstone mutations
    createRugCoinTombstone(input: RugCoinTombstoneInput!): RugCoinTombstone!
    updateRugCoinTombstone(id: ID!, input: RugCoinTombstoneInput!): RugCoinTombstone!
    verifyRugCoinTombstone(id: ID!, status: String!): RugCoinTombstone!
    deleteRugCoinTombstone(id: ID!): Boolean!

    # InsiderInformation mutations
    submitInsiderInformation(input: InsiderInformationInput!): InsiderInformation!
    verifyInsiderInformation(id: ID!, status: String!, note: String): InsiderInformation!
    updateInsiderInformation(id: ID!, input: InsiderInformationInput!): InsiderInformation!
    deleteInsiderInformation(id: ID!): Boolean!

    # WarningSign mutations
    createWarningSign(input: WarningSignInput!): WarningSign!
    updateWarningSign(id: ID!, input: WarningSignInput!): WarningSign!
    resolveWarningSign(id: ID!, resolution: String!): WarningSign!
    markWarningSignAsFalseAlarm(id: ID!, explanation: String!): WarningSign!

    # ChatMessage mutations
    sendChatMessage(input: ChatMessageInput!): ChatMessage!
    reactToChatMessage(id: ID!, reactionType: String!): ChatMessage!
    flagChatMessage(id: ID!, reason: String!): ChatMessage!
    moderateChatMessage(id: ID!, status: String!, reason: String): ChatMessage!
  }

  # Subscriptions
  type Subscription {
    # WarningSign subscriptions
    warningSignCreated: WarningSign!
    warningSignUpdated(id: ID!): WarningSign!

    # ChatMessage subscriptions
    chatMessageSent(roomId: String!): ChatMessage!
    chatMessageUpdated(roomId: String!): ChatMessage!
  }

  # Auth payload
  type AuthPayload {
    token: String!
    user: User!
  }
`;

module.exports = typeDefs;