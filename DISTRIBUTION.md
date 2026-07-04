# compass-mcp distribution runbook

The connector is published on npm as `@licentium/compass-mcp`. This runbook takes it the rest of the
way: its own GitHub repo, a listing on the official MCP Registry, and the discovery directories.

Prepared for you already: `package.json` now carries `"mcpName": "io.github.LicentiumIO/compass-mcp"`
and the version is bumped to `1.0.1`; `server.json` (the registry manifest) is in this folder.

---

## A. Give it its own GitHub repo

`compass-mcp` currently sits untracked inside your `~/compass` repo. Make it standalone, the same way
`compass-app` already is.

With the GitHub CLI (fastest):

```
cd ~/compass/compass-mcp
git init
git add .
git -c user.email="illia@prokopievlaw.com" -c user.name="Illia Prokopiev" commit -m "compass-mcp 1.0.1: MCP connector for Compass"
git branch -M main
gh repo create LicentiumIO/compass-mcp --public --source=. --remote=origin --push
```

Without `gh`: create an empty public repo at github.com/organizations/LicentiumIO (name it
`compass-mcp`, no README/license/gitignore), then:

```
cd ~/compass/compass-mcp
git init && git add .
git -c user.email="illia@prokopievlaw.com" -c user.name="Illia Prokopiev" commit -m "compass-mcp 1.0.1: MCP connector for Compass"
git branch -M main
git remote add origin https://github.com/LicentiumIO/compass-mcp.git
git push -u origin main
```

Optional tidy-up: add a line `compass-mcp/` to `~/compass/.gitignore` so the backend repo stops listing
it as untracked (it is now its own repo).

---

## B. List it on the official MCP Registry

This is the canonical registry (backed by Anthropic, GitHub, PulseMCP and Microsoft); most clients and
directories read from it.

1. Republish npm so the public package carries the ownership tag (`mcpName`). Version is already 1.0.1:

   ```
   cd ~/compass/compass-mcp
   npm publish --access public
   ```

   (If you cleared the publish token earlier, re-add it first with the same `npm config set` line, or
   use `--otp` / `--auth-type=web`.)

2. Install the publisher CLI:

   ```
   brew install mcp-publisher
   ```

3. `server.json` is ready in this folder. If the CLI reports a schema mismatch, regenerate the base with
   `mcp-publisher init` and re-add the `description`, `transport`, and `COMPASS_API_KEY` block from the
   existing file.

4. Authenticate. The namespace `io.github.LicentiumIO/*` verifies through GitHub, so log in as an owner
   of the LicentiumIO org:

   ```
   mcp-publisher login github
   ```

5. Publish and verify:

   ```
   mcp-publisher publish
   curl https://registry.modelcontextprotocol.io/v0/servers?search=compass-mcp
   ```

Namespace note: `io.github.LicentiumIO` is the easy path (GitHub OAuth). If you'd rather have the
branded `com.licentium/compass-mcp`, that route verifies via a DNS TXT record on licentium.ai instead,
covered in the registry's publishing guide.

---

## C. Submit to the discovery directories

These crawl the ecosystem and drive most human discovery. Four cover the field:

- **Glama** (glama.ai/mcp): auto-indexes public GitHub MCP repos, so it will pick up
  `LicentiumIO/compass-mcp` once the repo is public. Sign in to claim and enrich the listing.
- **PulseMCP** (pulsemcp.com): use the Submit button in the top nav.
- **Smithery** (smithery.ai): `smithery mcp publish` from the CLI, or submit via the site.
- **MCP.so** (mcp.so): the Submit button, or open an issue on their GitHub.
- **awesome-mcp-servers** (github.com/punkpeye/awesome-mcp-servers): open a PR adding compass-mcp under
  Finance (or Legal), one line with the repo link and a short description.

Optional: the community tool `mcp-submit` pushes to 10+ directories in a single command.

Suggested listing blurb:

> **compass-mcp** — Ground your LLM in EU financial, crypto and AI regulation (MiCA, DORA, the AML
> package, the AI Act, GDPR and more). Two tools: `compass_retrieve` (top governing provisions,
> verbatim and article-cited) and `compass_verify` (is this quote real?). Needs a free Compass API key.

---

## D. Publishing an update later

Bump `version` in both `package.json` and `server.json`, then:

```
npm publish --access public
mcp-publisher publish
git commit -am "vX.Y.Z" && git push
```
