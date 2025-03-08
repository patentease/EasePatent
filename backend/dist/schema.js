"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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

  input PatentInput {
    title: String!
    description: String!
    inventors: [String!]!
    jurisdictions: [String!]!
  }

  type Query {
    me: User
    getUserPatents: [Patent!]!
    getPatent(id: ID!): Patent!
  }

  type Mutation {
    register(input: RegisterInput!): AuthPayload!
    login(input: LoginInput!): AuthPayload!
    createPatent(input: PatentInput!): Patent!
    updatePatent(id: ID!, input: PatentInput!): Patent!
    deletePatent(id: ID!): Boolean!
    updatePatentStatus(id: ID!, status: String!): Patent!
  }
`;
exports.default = typeDefs;
//# sourceMappingURL=schema.js.map