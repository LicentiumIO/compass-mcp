# compass-mcp

An [MCP](https://modelcontextprotocol.io) server that grounds your LLM in **EU financial, crypto and AI regulation** via [Compass](https://compass.licentium.ai). Add it to Claude Desktop, Cursor, or any MCP host, and the model can pull the governing EU provisions, verbatim and article-cited, before it answers.

It exposes two tools over Compass's public grounding API:

- **`compass_retrieve`**: a question in, the top governing provisions out (verbatim text, article-level citations, cross-references) from the core EU acts (MiCA, DORA, MiFID II, the AML package, the AI Act, GDPR and more).
- **`compass_verify`**: check that a quote is a verbatim span of a specific provision, so the model never misquotes the law.

## 1. Get an API key

Create a key at **[compass.licentium.ai/developers](https://compass.licentium.ai/developers)**. It looks like `ck_live_...`. The first calls are free; after that, usage is metered against your Compass credits. Keep the key secret.

## 2. Install and build

```bash
git clone <this-repo> compass-mcp
cd compass-mcp
npm install
npm run build
```

This produces `dist/index.js`. (Once published to npm, hosts can run it with `npx -y @licentium/compass-mcp` and skip the clone/build.)

## 3. Configure your MCP host

Set `COMPASS_API_KEY` to your key in the server's environment.

### Claude Desktop

Edit `claude_desktop_config.json` (Settings → Developer → Edit Config):

```json
{
  "mcpServers": {
    "compass": {
      "command": "node",
      "args": ["/absolute/path/to/compass-mcp/dist/index.js"],
      "env": { "COMPASS_API_KEY": "ck_live_your_key_here" }
    }
  }
}
```

Restart Claude Desktop. You should see `compass_retrieve` and `compass_verify` in the tools list.

### Cursor

Add to `~/.cursor/mcp.json` (or the project's `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "compass": {
      "command": "node",
      "args": ["/absolute/path/to/compass-mcp/dist/index.js"],
      "env": { "COMPASS_API_KEY": "ck_live_your_key_here" }
    }
  }
}
```

### Any other MCP host

Run the binary over stdio with `COMPASS_API_KEY` set:

```bash
COMPASS_API_KEY=ck_live_your_key_here node dist/index.js
```

## Tools

### `compass_retrieve`

| Param   | Type   | Notes                                                    |
| ------- | ------ | -------------------------------------------------------- |
| `query` | string | A regulatory question in plain language.                 |
| `top_k` | number | Optional. Provisions to return, 1 to 20 (default 8).     |

Returns the governing provisions as verbatim text, each with its reference (e.g. `MiCA, Article 59`), a `node_id`, and any cross-references. Feed a `node_id` into `compass_verify` to confirm a quote.

### `compass_verify`

| Param     | Type   | Notes                                              |
| --------- | ------ | -------------------------------------------------- |
| `node_id` | string | The `node_id` of a provision from `compass_retrieve`. |
| `quote`   | string | The exact text you intend to attribute to it.      |

Returns whether the quote is a verbatim span of that provision.

## Configuration

| Env var            | Required | Default                          | Notes                                    |
| ------------------ | -------- | -------------------------------- | ---------------------------------------- |
| `COMPASS_API_KEY`  | yes      | (none)                           | Your `ck_live_` key.                     |
| `COMPASS_API_URL`  | no       | `https://compass.licentium.ai`   | Override only for self-hosted endpoints. |

## Notes

Compass returns primary-law text only. It is a research and scoping tool, not legal advice. When the corpus does not govern a question, `compass_retrieve` returns nothing rather than guessing, so instruct your model not to assert an ungrounded answer.

Logs go to stderr so they never corrupt the stdio JSON-RPC stream.
