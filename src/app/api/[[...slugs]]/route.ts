import { swagger } from "@elysiajs/swagger";
import { Elysia } from "elysia";
import { transactions, utils } from "near-api-js";
import {
  createTransferProposal,
  fetchNearView,
  fetchNonce,
  latestBlockHash,
  pikespeakQuery,
} from "./utils";
import Big from "big.js";

const app = new Elysia({ prefix: "/api", aot: false })
  .use(swagger())
  // Create a Near Transfer proposal
  .get(
    "/transfer/near/:dao/:receiver/:quantity",
    async ({ params: { dao, receiver, quantity }, headers }) => {
      const mbMetadata = JSON.parse(headers["mb-metadata"] || "{}");
      const accountId = mbMetadata?.accountData?.accountId || "near";
      const publicKey = mbMetadata?.accountData?.devicePublicKey || "";
      const transaction = await createTransferProposal(
        accountId,
        publicKey,
        dao,
        receiver,
        quantity,
        "",
      );
      return transaction;
    },
  )
  // List of all DAOs a user is part of.
  .get("/daos/:account?", async ({ params: { account }, headers }) => {
    const mbMetadata = JSON.parse(headers["mb-metadata"] || "{}");
    const accountId = account || mbMetadata?.accountData?.accountId || "near";
    const allDaos = await pikespeakQuery("daos/members");
    const userDaos = allDaos?.[accountId]?.daos || [];

    return { daos: userDaos };
  })
  // List of top n(or all) proposals in a DAO.
  .get("/proposals/:dao", async ({ params: { dao }, query }) => {
    const count = query.count ? Number(query.count) : 50;
    const proposals = await pikespeakQuery(`daos/proposals`, {
      daos: [dao],
      limit: count,
    });
    return { proposals: proposals };
  })
  // List proposals the user is eligible to vote on
  .get(
    "/proposals/vote/:account?",
    async ({ params: { account }, headers }) => {
      const mbMetadata = JSON.parse(headers["mb-metadata"] || "{}");
      const accountId = account || mbMetadata?.accountData?.accountId || "near";

      // daos where user has permission to vote
      const daos =
        (await pikespeakQuery(`daos/members`))[accountId]?.daos ?? [];

      const daoPolicyPromises = daos.map((dao) =>
        fetchNearView(dao, "get_policy", "e30=").then((policy) => ({
          daoId: dao,
          policy,
        })),
      );
      const policies = await Promise.all(daoPolicyPromises);

      const groupWithPermission = policies.flatMap(({ daoId, policy }) =>
        policy.roles
          .filter((role) => {
            const hasVotingPermission =
              role.permissions &&
              role.permissions.some(
                (permission) =>
                  permission.includes(":VoteApprove") ||
                  permission.includes(":VoteReject") ||
                  permission.includes(":VoteRemove"),
              );
            // Ensure that role.kind.Group exists and account is included in the group
            const isAccountInGroup =
              role.kind.Group && role.kind.Group.includes(account);
            // Only return roles where voting permission exists and account is included in the group
            return hasVotingPermission && isAccountInGroup;
          })
          .map(() => daoId),
      );
      const proposals = await pikespeakQuery(`daos/proposals`, {
        daos: [groupWithPermission],
        status: ["InProgress"],
      });

      return { proposals: proposals };
    },
  )
  // Specific Information for a given proposal
  .get(
    "/proposal/:dao/:proposalId",
    async ({ params: { dao, proposalId } }) => {
      const response = await pikespeakQuery(`daos/proposal/${dao}`, {
        id: proposalId,
      });
      return { proposal: response[0] };
    },
  )
  // Voting on a given proposal.
  .get(
    "/vote/:dao/:proposalId/:action",
    async ({ params: { dao, proposalId, action }, headers }) => {
      const mbMetadata = JSON.parse(headers["mb-metadata"] || "{}");
      const accountId = mbMetadata?.accountData?.accountId || "near";
      const publicKey = mbMetadata?.accountData?.devicePublicKey || "";
      const actions: transactions.Action[] = [];
      actions.push(
        transactions.functionCall(
          "act_proposal",
          {
            id: proposalId,
            action: action,
          },
          BigInt("300000000000000"),
          BigInt("0"),
        ),
      );

      const blockHash = await latestBlockHash();
      const nonce = await fetchNonce(accountId, publicKey);
      const transaction = transactions.createTransaction(
        accountId,
        publicKey,
        dao,
        nonce,
        actions,
        utils.serialize.base_decode(blockHash),
      );

      return transaction;
    },
  )
  // fetch all daos
  .get("/alldaos", async () => {
    const daos = (await pikespeakQuery(`daos/all`)).map(({ contract_id }) => ({
      contract_id,
    })); // Exclude total_in_dollar
    return { daos };
  })
  // Fetch a single DAO using specific keywords.
  .get("/dao/match/:keyword", async ({ params: { keyword } }) => {
    const daos = await pikespeakQuery(`daos/all`);
    // Filter the daos based on the keyword matching part or the full contract_id
    const filteredDaos = daos
      .filter((dao) => new RegExp(keyword, "i").test(dao.contract_id))
      .map(({ contract_id }) => ({ contract_id }));

    return { filteredDaos };
  })
  // Details of a particular DAO
  .get("/dao/:daoId", async ({ params: { daoId } }) => {
    const dao = await fetchNearView(daoId, "get_policy", "e30=");
    return { dao };
  })
  // List proposals only created by the user
  .get("/proposals/user", async ({ query, headers }) => {
    const mbMetadata = JSON.parse(headers["mb-metadata"] || "{}");
    const accountId =
      query.account || mbMetadata?.accountData?.accountId || "near";
    const proposals = await pikespeakQuery(
      `daos/proposals-by-proposer/${accountId}`,
    );
    return { proposals };
  })
  // Proposal for USDT transfer
  .get(
    "/transfer/usdt/:dao/:receiver/:quantity",
    async ({ params: { dao, receiver, quantity }, headers }) => {
      const mbMetadata = JSON.parse(headers["mb-metadata"] || "{}");
      const accountId = mbMetadata?.accountData?.accountId || "near";
      const publicKey = mbMetadata?.accountData?.devicePublicKey || "";
      const transaction = await createTransferProposal(
        accountId,
        publicKey,
        dao,
        receiver,
        quantity,
        "usdt.tether-token.near",
      );
      return transaction;
    },
  )
  // Proposal for USDC transfer
  .get(
    "/transfer/usdc/:dao/:receiver/:quantity",
    async ({ params: { dao, receiver, quantity }, headers }) => {
      const mbMetadata = JSON.parse(headers["mb-metadata"] || "{}");
      const accountId = mbMetadata?.accountData?.accountId || "near";
      const publicKey = mbMetadata?.accountData?.devicePublicKey || "";
      const transaction = await createTransferProposal(
        accountId,
        publicKey,
        dao,
        receiver,
        quantity,
        "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
      );
      return transaction;
    },
  )
  .compile();

export const GET = app.handle;
export const POST = app.handle;
