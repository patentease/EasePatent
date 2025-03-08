import { gql } from 'apollo-server-express';

const typeDefs = gql`
  type User {
    id: ID!
    email: String!
    name: String!
    organization: String
    role: String!
    createdAt: String!
  }

  type Patent {
    id: ID!
    title: String!
    description: String!
    inventors: [String!]!
    filingDate: String
    status: String!
    jurisdictions: [String!]!
    uniquenessScore: Float
    marketPotential: Float
    documents: [Document!]
    owner: User!
    createdAt: String!
    updatedAt: String!
  }

  type Document {
    id: ID!
    name: String!
    type: String!
    url: String!
    uploadedAt: String!
  }

  type AIAnalysis {
    id: ID!
    patentId: ID!
    similarityScore: Float!
    priorArtReferences: [String!]!
    aiSuggestions: String!
    createdAt: String!
  }

  type BlockchainRecord {
    id: ID!
    patentId: ID!
    timestamp: String!
    transactionHash: String!
    network: String!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  input PatentInput {
    title: String!
    description: String!
    inventors: [String!]!
    jurisdictions: [String!]!
  }

  input DocumentInput {
    name: String!
    type: String!
    base64Data: String!
  }

  type Query {
    getUser(id: ID!): User
    getPatent(id: ID!): Patent
    searchPatents(query: String!): [Patent!]!
    getAIAnalysis(patentId: ID!): AIAnalysis
    getBlockchainRecord(patentId: ID!): BlockchainRecord
    getUserPatents: [Patent!]!
  }

  type Mutation {
    register(email: String!, password: String!, name: String!, organization: String): AuthPayload
    login(email: String!, password: String!): AuthPayload
    createPatent(input: PatentInput!): Patent
    updatePatent(id: ID!, input: PatentInput!): Patent
    deletePatent(id: ID!): Boolean
    generateAIAnalysis(patentId: ID!): AIAnalysis
    createBlockchainRecord(patentId: ID!): BlockchainRecord
    uploadDocument(patentId: ID!, document: DocumentInput!): Document
  }

  type Subscription {
    patentStatusUpdated(patentId: ID!): Patent
    newAIAnalysisAvailable(patentId: ID!): AIAnalysis
  }
`;

export default typeDefs; 