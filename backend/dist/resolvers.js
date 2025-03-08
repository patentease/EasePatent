"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const graphql_1 = require("graphql");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("./models/User"));
const Patent_1 = __importDefault(require("./models/Patent"));
const generateToken = (userId) => {
    return jsonwebtoken_1.default.sign({ id: userId }, process.env.JWT_SECRET || 'fallback-secret', { expiresIn: '7d' });
};
const resolvers = {
    Query: {
        me: async (_, __, context) => {
            if (!context.user) {
                throw new graphql_1.GraphQLError('Not authenticated', {
                    extensions: { code: 'UNAUTHENTICATED' },
                });
            }
            return await User_1.default.findById(context.user.id);
        },
        getUserPatents: async (_, __, context) => {
            if (!context.user) {
                throw new graphql_1.GraphQLError('Not authenticated', {
                    extensions: { code: 'UNAUTHENTICATED' },
                });
            }
            return await Patent_1.default.find({ owner: context.user.id }).populate('owner');
        },
        getPatent: async (_, { id }, context) => {
            if (!context.user) {
                throw new graphql_1.GraphQLError('Not authenticated', {
                    extensions: { code: 'UNAUTHENTICATED' },
                });
            }
            const patent = await Patent_1.default.findOne({
                _id: id,
                owner: context.user.id,
            }).populate('owner');
            if (!patent) {
                throw new graphql_1.GraphQLError('Patent not found', {
                    extensions: { code: 'NOT_FOUND' },
                });
            }
            return patent;
        },
    },
    Mutation: {
        register: async (_, { input }) => {
            const existingUser = await User_1.default.findOne({ email: input.email });
            if (existingUser) {
                throw new graphql_1.GraphQLError('Email already exists', {
                    extensions: { code: 'BAD_USER_INPUT' },
                });
            }
            const user = await User_1.default.create(input);
            const token = generateToken(user.id);
            return {
                token,
                user,
            };
        },
        login: async (_, { input }) => {
            const user = await User_1.default.findOne({ email: input.email }).select('+password');
            if (!user || !(await user.comparePassword(input.password))) {
                throw new graphql_1.GraphQLError('Invalid email or password', {
                    extensions: { code: 'UNAUTHENTICATED' },
                });
            }
            const token = generateToken(user.id);
            user.password = undefined;
            return {
                token,
                user,
            };
        },
        createPatent: async (_, { input }, context) => {
            if (!context.user) {
                throw new graphql_1.GraphQLError('Not authenticated', {
                    extensions: { code: 'UNAUTHENTICATED' },
                });
            }
            const patent = await Patent_1.default.create({
                ...input,
                owner: context.user.id,
                status: 'draft',
            });
            return await Patent_1.default.findById(patent.id).populate('owner');
        },
        updatePatent: async (_, { id, input }, context) => {
            if (!context.user) {
                throw new graphql_1.GraphQLError('Not authenticated', {
                    extensions: { code: 'UNAUTHENTICATED' },
                });
            }
            const patent = await Patent_1.default.findOneAndUpdate({ _id: id, owner: context.user.id }, input, { new: true }).populate('owner');
            if (!patent) {
                throw new graphql_1.GraphQLError('Patent not found', {
                    extensions: { code: 'NOT_FOUND' },
                });
            }
            return patent;
        },
        deletePatent: async (_, { id }, context) => {
            if (!context.user) {
                throw new graphql_1.GraphQLError('Not authenticated', {
                    extensions: { code: 'UNAUTHENTICATED' },
                });
            }
            const patent = await Patent_1.default.findOneAndDelete({
                _id: id,
                owner: context.user.id,
            });
            if (!patent) {
                throw new graphql_1.GraphQLError('Patent not found', {
                    extensions: { code: 'NOT_FOUND' },
                });
            }
            return true;
        },
        updatePatentStatus: async (_, { id, status }, context) => {
            if (!context.user) {
                throw new graphql_1.GraphQLError('Not authenticated', {
                    extensions: { code: 'UNAUTHENTICATED' },
                });
            }
            const patent = await Patent_1.default.findOneAndUpdate({ _id: id, owner: context.user.id }, { status }, { new: true }).populate('owner');
            if (!patent) {
                throw new graphql_1.GraphQLError('Patent not found', {
                    extensions: { code: 'NOT_FOUND' },
                });
            }
            return patent;
        },
    },
};
exports.default = resolvers;
//# sourceMappingURL=resolvers.js.map