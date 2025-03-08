const typeDefs = `#graphql
  type User {
    id: ID!
    email: String!
    firstName: String!
    lastName: String!
    company: String
    role: String!
    createdAt: String!
    updatedAt: String!
  }

  type Patent {
    id: ID!
    title: String!
    description: String!
    inventors: [String!]!
    jurisdictions: [String!]!
    status: String!
    owner: User!
    uniquenessScore: Float
    marketPotential: Float
    filingDate: String
    grantDate: String
    patentNumber: String
    createdAt: String!
    updatedAt: String!
    documents: [Document!]
    claims: [String!]
    technicalField: String
    backgroundArt: String
    searchReport: SearchReport
  }

  type Document {
    id: ID!
    name: String!
    url: String!
    type: String!
    uploadedAt: String!
  }

  type SearchReport {
    similarityScore: Float!
    priorArtReferences: [PriorArtReference!]!
    aiAnalysis: AIAnalysis
    recommendations: [String!]
  }

  type PriorArtReference {
    patentNumber: String!
    title: String!
    relevanceScore: Float!
    matchingClaims: [String!]
    publicationDate: String!
  }

  type AIAnalysis {
    technicalComplexity: Float!
    marketSizeEstimate: Float!
    competitiveLandscape: [String!]
    innovationScore: Float!
    riskFactors: [String!]
  }

  input SearchInput {
    query: String
    technicalField: String
    dateRange: DateRangeInput
    jurisdictions: [String!]
    status: [String!]
    sortBy: String
    page: Int
    limit: Int
  }

  input DateRangeInput {
    from: String
    to: String
  }

  input PatentInput {
    title: String!
    description: String!
    inventors: [String!]!
    jurisdictions: [String!]!
    technicalField: String
    backgroundArt: String
    claims: [String!]
  }

  input DocumentUploadInput {
    patentId: ID!
    name: String!
    type: String!
    file: Upload!
  }

  type SearchResult {
    patents: [Patent!]!
    totalCount: Int!
    page: Int!
    totalPages: Int!
  }

  type Query {
    me: User
    getUserPatents: [Patent!]!
    getPatent(id: ID!): Patent!
    searchPatents(input: SearchInput!): SearchResult!
    getSimilarPatents(patentId: ID!): [Patent!]!
    getAIAnalysis(patentId: ID!): AIAnalysis!
  }

  type Mutation {
    register(input: RegisterInput!): AuthPayload!
    login(input: LoginInput!): AuthPayload!
    createPatent(input: PatentInput!): Patent!
    updatePatent(id: ID!, input: PatentInput!): Patent!
    deletePatent(id: ID!): Boolean!
    updatePatentStatus(id: ID!, status: String!): Patent!
    uploadDocument(input: DocumentUploadInput!): Document!
    deleteDocument(documentId: ID!): Boolean!
    generateSearchReport(patentId: ID!): SearchReport!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  input RegisterInput {
    email: String!
    password: String!
    firstName: String!
    lastName: String!
    company: String
  }

  input LoginInput {
    email: String!
    password: String!
  }
`;

export default typeDefs; 