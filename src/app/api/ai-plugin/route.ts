import { NextResponse } from "next/server";
import bitteDevJson from "@/bitte.dev.json";
import { DEPLOYMENT_URL } from "vercel-url";

const json = {
  openapi: "3.0.0",
  info: {
    title: "DAO Proposal API",
    description:
      "API for interacting with Sputnik DAO Contracts and putting proposals for simple NEAR transfer.",
    version: "1.0.0",
  },
  servers: [
    {
      url: bitteDevJson.url || DEPLOYMENT_URL,
    },
  ],
  "x-mb": {
    "account-id": "jaswinder.near",
    assistant: {
      name: "DAO Agent",
      description:
        "An API to generate transaction data for creating NEAR transfer proposals in Sputnik DAOs.",
      instructions:
        "Help the user create transfer proposals for Sputnik DAOs. To generate the transaction data, you need to provide the following information: the DAO's address, the recipient's NEAR account address, and the amount of NEAR to be transferred. The API will return transaction data which should be used with the 'generate-transaction' tool to submit the proposal.  Any proposals created should be calling the 'add_proposal' method on the DAO contract. When you fetch DAOs for a given account, display the DAOs in a nice table.",
      tools: [{ type: "generate-transaction" }],
    },
  },
  paths: {
    "/api/daos/{accountId}": {
      get: {
        description: "Fetches all the DAOs a given accountId is a member of.",
        operationId: "fetchUserDaos",
        parameters: [
          {
            in: "path",
            name: "accountId",
            required: true,
            schema: {
              type: "string",
            },
            description:
              "The NEAR account address for which we are looking for all the DAOs it is a member of.",
          },
        ],
        responses: {
          "200": {
            description: "All the DAOs the given account is a member of.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    daos: {
                      type: "array",
                      description:
                        "The list of DAOs the given account is a member of.",
                      items: {
                        type: "string",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/transfer/near/{dao}/{receiver}/{quantity}": {
      get: {
        description:
          "Generate transaction data for creating a proposal to transfer NEAR in a DAO.",
        operationId: "generateTransferProposalTransaction",
        parameters: [
          {
            in: "path",
            name: "dao",
            required: true,
            schema: {
              type: "string",
            },
            description:
              "Address of the Sputnik DAO for which the proposal will be created.",
          },
          {
            in: "path",
            name: "receiver",
            required: true,
            schema: {
              type: "string",
            },
            description:
              "The NEAR account address of the proposed transfer recipient.",
          },
          {
            in: "path",
            name: "quantity",
            required: true,
            schema: {
              type: "number",
            },
            description:
              "The amount of NEAR to be transferred in the proposal.",
          },
        ],
        responses: {
          "200": {
            description: "Transaction data generated successfully.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    signerId: {
                      type: "string",
                      description:
                        "The account ID that should sign this transaction.",
                    },
                    publicKey: {
                      type: "string",
                      description:
                        "The public key associated with the signer account.",
                    },
                    nonce: {
                      type: "string",
                      description:
                        "A unique number to ensure the uniqueness of the transaction.",
                    },
                    receiverId: {
                      type: "string",
                      description:
                        "The account ID of the DAO contract that will receive this transaction.",
                    },
                    actions: {
                      type: "array",
                      description:
                        "The list of actions to be performed in this transaction.",
                      items: {
                        type: "object",
                        properties: {
                          functionCall: {
                            type: "object",
                            properties: {
                              methodName: {
                                type: "string",
                                description:
                                  "The name of the contract method to be called.",
                              },
                              args: {
                                type: "object",
                                properties: {
                                  type: {
                                    type: "string",
                                    description:
                                      "The type of the arguments data.",
                                  },
                                  data: {
                                    type: "array",
                                    items: {
                                      type: "integer",
                                    },
                                    description:
                                      "The encoded arguments for the function call.",
                                  },
                                },
                              },
                              gas: {
                                type: "string",
                                description:
                                  "The amount of gas attached to this function call.",
                              },
                              deposit: {
                                type: "string",
                                description:
                                  "The amount of NEAR tokens attached to this function call.",
                              },
                            },
                          },
                          enum: {
                            type: "string",
                            description: "The type of action being performed.",
                          },
                        },
                      },
                    },
                    blockHash: {
                      type: "object",
                      additionalProperties: {
                        type: "integer",
                      },
                      description:
                        "The hash of the block used as a reference for this transaction.",
                    },
                  },
                  required: [
                    "signerId",
                    "publicKey",
                    "nonce",
                    "receiverId",
                    "actions",
                    "blockHash",
                  ],
                },
              },
            },
          },
        },
      },
    },

    "/api/proposals/{dao}": {
      get: {
        description:
          "Fetches all the proposals of a specified DAO on the NEAR blockchain.",
        operationId: "fetchDaoProposals",
        parameters: [
          {
            in: "path",
            name: "dao",
            required: true,
            schema: {
              type: "string",
            },
            description:
              "The ID of the DAO from which the proposals are being fetched.",
          },
          {
            in: "query",
            name: "count",
            required: false,
            schema: {
              type: "number",
              default: 50,
            },
            description:
              "The number of proposals to fetch. If not provided, fetches all proposals.",
          },
        ],
        responses: {
          "200": {
            description: "A list of proposals from the specified DAO.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    proposals: {
                      type: "array",
                      description: "The list of proposals from the given DAO.",
                      items: {
                        type: "string",
                      },
                    },
                  },
                },
              },
            },
          },
          "404": {
            description: "DAO or proposals not found.",
          },
        },
      },
    },

    "/api/proposals/vote/{account}": {
      get: {
        description:
          "Fetches all proposals where the specified account is eligible to vote.",
        operationId: "fetchAccountVoteProposals",
        parameters: [
          {
            in: "path",
            name: "account",
            required: true,
            schema: {
              type: "string",
            },
            description:
              "The NEAR account address for which to fetch proposals eligible for voting.",
          },
        ],
        responses: {
          "200": {
            description:
              "A list of proposals on which the account is eligible to vote.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    proposals: {
                      type: "array",
                      description:
                        "A list of proposal IDs that the user can vote on.",
                      items: {
                        type: "string",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/proposal/{dao}/{proposalId}": {
      get: {
        description:
          "Fetches information about a specific proposal of a DAO using the proposal ID.",
        operationId: "fetchProposalById",
        parameters: [
          {
            in: "path",
            name: "dao",
            required: true,
            schema: {
              type: "string",
            },
            description: "The ID of the DAO to which the proposal belongs.",
          },
          {
            in: "path",
            name: "proposalId",
            required: true,
            schema: {
              type: "string",
            },
            description: "The unique identifier of the proposal to fetch.",
          },
        ],
        responses: {
          "200": {
            description: "The proposal details.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    proposal: {
                      type: "object",
                    },
                  },
                },
              },
            },
          },
          "404": {
            description: "The specified proposal was not found.",
          },
          "400": {
            description:
              "Invalid input, such as an incorrectly formatted DAO ID or proposal ID.",
          },
        },
      },
    },
    "/api/vote/{dao}/{proposalId}/{action}": {
      get: {
        description:
          "Generate transaction data for vote on a given proposal of a DAO. The action must be either VoteApprove, VoteReject, or VoteRemove. The user can sign the returned transaction to vote on the proposal.",
        operationId: "generateVoteTransaction",
        parameters: [
          {
            in: "path",
            name: "dao",
            required: true,
            schema: {
              type: "string",
            },
            description: "The ID of the DAO to which the proposal belongs.",
          },
          {
            in: "path",
            name: "proposalId",
            required: true,
            schema: {
              type: "string",
            },
            description: "The unique identifier of the proposal.",
          },
          {
            in: "path",
            name: "action",
            required: true,
            schema: {
              type: "string",
              enum: ["VoteApprove", "VoteReject", "VoteRemove"],
            },
            description: "The action to take on the proposal.",
          },
        ],
        responses: {
          "200": {
            description: "Transaction data generated successfully.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    signerId: {
                      type: "string",
                      description:
                        "The account ID that should sign this transaction.",
                    },
                    publicKey: {
                      type: "string",
                      description:
                        "The public key associated with the signer account.",
                    },
                    nonce: {
                      type: "string",
                      description:
                        "A unique number to ensure the uniqueness of the transaction.",
                    },
                    receiverId: {
                      type: "string",
                      description:
                        "The account ID of the DAO contract that will receive this transaction.",
                    },
                    actions: {
                      type: "array",
                      description:
                        "The list of actions to be performed in this transaction.",
                      items: {
                        type: "object",
                        properties: {
                          functionCall: {
                            type: "object",
                            properties: {
                              methodName: {
                                type: "string",
                                description:
                                  "The name of the contract method to be called.",
                              },
                              args: {
                                type: "object",
                                properties: {
                                  type: {
                                    type: "string",
                                    description:
                                      "The type of the arguments data.",
                                  },
                                  data: {
                                    type: "array",
                                    items: {
                                      type: "integer",
                                    },
                                    description:
                                      "The encoded arguments for the function call.",
                                  },
                                },
                              },
                              gas: {
                                type: "string",
                                description:
                                  "The amount of gas attached to this function call.",
                              },
                              deposit: {
                                type: "string",
                                description:
                                  "The amount of NEAR tokens attached to this function call.",
                              },
                            },
                          },
                          enum: {
                            type: "string",
                            description: "The type of action being performed.",
                          },
                        },
                      },
                    },
                    blockHash: {
                      type: "object",
                      additionalProperties: {
                        type: "integer",
                      },
                      description:
                        "The hash of the block used as a reference for this transaction.",
                    },
                  },
                  required: [
                    "signerId",
                    "publicKey",
                    "nonce",
                    "receiverId",
                    "actions",
                    "blockHash",
                  ],
                },
              },
            },
          },
        },
      },
    },
    "/api/alldaos": {
      get: {
        description: "Fetches a list of all DAOs.",
        operationId: "fetchAllDaos",
        responses: {
          "200": {
            description: "A list of DAOs.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    daos: {
                      type: "array",
                      items: {
                        type: "object",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/dao/match/{keyword}": {
      get: {
        description: "Fetches a list of DAOs that match a given keyword.",
        operationId: "fetchDaosByKeyword",
        parameters: [
          {
            in: "path",
            name: "keyword",
            required: true,
            schema: {
              type: "string",
            },
            description: "The keyword to filter DAOs by.",
          },
        ],
        responses: {
          "200": {
            description: "A list of DAOs matching the keyword.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    daos: {
                      type: "array",
                      items: {
                        type: "object",
                      },
                    },
                  },
                },
              },
            },
          },
          "404": {
            description: "No DAOs found for the specified keyword.",
          },
          "500": {
            description: "An error occurred while fetching DAOs.",
          },
        },
      },
    },
    "/api/dao/{daoId}": {
      get: {
        description: "Fetches details about the dao given by it's Id.",
        operationId: "fetchDaosById",
        parameters: [
          {
            in: "path",
            name: "daoId",
            required: true,
            schema: {
              type: "string",
            },
            description: "The sputnik dao id.",
          },
        ],
        responses: {
          "200": {
            description: "Details about the DAO.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    dao: {
                      type: "object",
                    },
                  },
                },
              },
            },
          },
          "404": {
            description: "No DAO found for the specified id.",
          },
          "500": {
            description: "An error occurred while fetching DAO.",
          },
        },
      },
    },
    "/api/proposals/user": {
      get: {
        description:
          "Fetches proposals of all DAOs created by a specific user using their account ID.",
        operationId: "fetchProposalsByUser",
        parameters: [
          {
            in: "query",
            name: "account",
            required: false,
            schema: {
              type: "string",
              default: "near",
            },
            description:
              "The account ID of the user who created the proposals.",
          },
        ],
        responses: {
          "200": {
            description: "A list of proposals created by the user.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    proposals: {
                      type: "array",
                      items: {
                        type: "object",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/transfer/usdt/{dao}/{receiver}/{quantity}": {
      get: {
        description:
          "Creates a transfer proposal to send USDT from a DAO to a specified receiver.",
        operationId: "createUsdtTransferProposal",
        parameters: [
          {
            in: "path",
            name: "dao",
            required: true,
            schema: {
              type: "string",
            },
            description: "The ID of the DAO initiating the USDT transfer.",
          },
          {
            in: "path",
            name: "receiver",
            required: true,
            schema: {
              type: "string",
            },
            description: "The account ID of the receiver.",
          },
          {
            in: "path",
            name: "quantity",
            required: true,
            schema: {
              type: "string",
            },
            description: "The quantity of USDT to be transferred.",
          },
        ],
        responses: {
          "200": {
            description: "Transaction data generated successfully.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    signerId: {
                      type: "string",
                      description:
                        "The account ID that should sign this transaction.",
                    },
                    publicKey: {
                      type: "string",
                      description:
                        "The public key associated with the signer account.",
                    },
                    nonce: {
                      type: "string",
                      description:
                        "A unique number to ensure the uniqueness of the transaction.",
                    },
                    receiverId: {
                      type: "string",
                      description:
                        "The account ID of the DAO contract that will receive this transaction.",
                    },
                    actions: {
                      type: "array",
                      description:
                        "The list of actions to be performed in this transaction.",
                      items: {
                        type: "object",
                        properties: {
                          functionCall: {
                            type: "object",
                            properties: {
                              methodName: {
                                type: "string",
                                description:
                                  "The name of the contract method to be called.",
                              },
                              args: {
                                type: "object",
                                properties: {
                                  type: {
                                    type: "string",
                                    description:
                                      "The type of the arguments data.",
                                  },
                                  data: {
                                    type: "array",
                                    items: {
                                      type: "integer",
                                    },
                                    description:
                                      "The encoded arguments for the function call.",
                                  },
                                },
                              },
                              gas: {
                                type: "string",
                                description:
                                  "The amount of gas attached to this function call.",
                              },
                              deposit: {
                                type: "string",
                                description:
                                  "The amount of NEAR tokens attached to this function call.",
                              },
                            },
                          },
                          enum: {
                            type: "string",
                            description: "The type of action being performed.",
                          },
                        },
                      },
                    },
                    blockHash: {
                      type: "object",
                      additionalProperties: {
                        type: "integer",
                      },
                      description:
                        "The hash of the block used as a reference for this transaction.",
                    },
                  },
                  required: [
                    "signerId",
                    "publicKey",
                    "nonce",
                    "receiverId",
                    "actions",
                    "blockHash",
                  ],
                },
              },
            },
          },
        },
      },
    },
    "/api/transfer/usdc/{dao}/{receiver}/{quantity}": {
      get: {
        description:
          "Creates a transfer proposal to send USDC from a DAO to a specified receiver.",
        operationId: "createUsdcTransferProposal",
        parameters: [
          {
            in: "path",
            name: "dao",
            required: true,
            schema: {
              type: "string",
            },
            description: "The ID of the DAO initiating the USDC transfer.",
          },
          {
            in: "path",
            name: "receiver",
            required: true,
            schema: {
              type: "string",
            },
            description: "The account ID of the receiver.",
          },
          {
            in: "path",
            name: "quantity",
            required: true,
            schema: {
              type: "string",
            },
            description: "The quantity of USDC to be transferred.",
          },
        ],
        responses: {
          "200": {
            description: "Transaction data generated successfully.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    signerId: {
                      type: "string",
                      description:
                        "The account ID that should sign this transaction.",
                    },
                    publicKey: {
                      type: "string",
                      description:
                        "The public key associated with the signer account.",
                    },
                    nonce: {
                      type: "string",
                      description:
                        "A unique number to ensure the uniqueness of the transaction.",
                    },
                    receiverId: {
                      type: "string",
                      description:
                        "The account ID of the DAO contract that will receive this transaction.",
                    },
                    actions: {
                      type: "array",
                      description:
                        "The list of actions to be performed in this transaction.",
                      items: {
                        type: "object",
                        properties: {
                          functionCall: {
                            type: "object",
                            properties: {
                              methodName: {
                                type: "string",
                                description:
                                  "The name of the contract method to be called.",
                              },
                              args: {
                                type: "object",
                                properties: {
                                  type: {
                                    type: "string",
                                    description:
                                      "The type of the arguments data.",
                                  },
                                  data: {
                                    type: "array",
                                    items: {
                                      type: "integer",
                                    },
                                    description:
                                      "The encoded arguments for the function call.",
                                  },
                                },
                              },
                              gas: {
                                type: "string",
                                description:
                                  "The amount of gas attached to this function call.",
                              },
                              deposit: {
                                type: "string",
                                description:
                                  "The amount of NEAR tokens attached to this function call.",
                              },
                            },
                          },
                          enum: {
                            type: "string",
                            description: "The type of action being performed.",
                          },
                        },
                      },
                    },
                    blockHash: {
                      type: "object",
                      additionalProperties: {
                        type: "integer",
                      },
                      description:
                        "The hash of the block used as a reference for this transaction.",
                    },
                  },
                  required: [
                    "signerId",
                    "publicKey",
                    "nonce",
                    "receiverId",
                    "actions",
                    "blockHash",
                  ],
                },
              },
            },
          },
        },
      },
    },
  },
};

export async function GET() {
  //const pluginData = {}
  return NextResponse.json(json);
}
