import { Composio } from "composio-core";

const composio = new Composio({
  apiKey: "ak_zWAearKVysZhrguvwYak", // ⚠️ regenerate after testing
  workspaceId: "dhairya911_workspace_first_project",
});

const run = async () => {
  const link = await composio.generateConnectLink({
    authConfigId: "ac_FFJUOYasTHf4",
  });
  console.log("Connect URL:", link);
};

run().catch(console.error);
